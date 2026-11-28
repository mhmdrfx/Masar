package mtr

import (
	"context"
	"encoding/binary"
	"fmt"
	"math"
	"net"
	"strconv"
	"strings"
	"sync/atomic"
	"syscall"
	"time"

	"golang.org/x/net/icmp"
	"golang.org/x/net/ipv4"
	"golang.org/x/net/ipv6"
)

const (
	ProbeICMP = "icmp"
	ProbeTCP  = "tcp"
	ProbeUDP  = "udp"
)

// NormalizeProbeMode validates and normalizes an MTR probe protocol string.
func NormalizeProbeMode(raw string) string {
	switch strings.ToLower(strings.TrimSpace(raw)) {
	case ProbeTCP, "tcp-syn", "syn":
		return ProbeTCP
	case ProbeUDP:
		return ProbeUDP
	default:
		return ProbeICMP
	}
}

func parseTargetAndPort(rawTarget string, mode string) (string, int) {
	clean := strings.TrimSpace(rawTarget)
	clean = strings.TrimPrefix(clean, "https://")
	clean = strings.TrimPrefix(clean, "http://")
	if idx := strings.IndexByte(clean, '/'); idx != -1 {
		clean = clean[:idx]
	}

	port := 0
	if mode == ProbeTCP {
		port = 443
	} else if mode == ProbeUDP {
		port = 33434
	}

	if host, portStr, err := net.SplitHostPort(clean); err == nil {
		if parsed, convErr := strconv.Atoi(strings.TrimSpace(portStr)); convErr == nil && parsed > 0 && parsed <= 65535 {
			port = parsed
			clean = strings.Trim(strings.TrimSpace(host), "[]")
			return clean, port
		}
	}
	return strings.Trim(clean, "[]"), port
}

// ComputeMOS calculates the ITU-T G.107 E-Model Mean Opinion Score (1.0 - 4.5) and quality tier.
func ComputeMOS(avgMs, jitterMs, lossPct float64) (float64, string) {
	if avgMs < 0 {
		avgMs = 0
	}
	if jitterMs < 0 {
		jitterMs = 0
	}
	if lossPct < 0 {
		lossPct = 0
	}

	effLatency := avgMs + jitterMs*2.0 + 10.0
	var delayImpairment float64
	if effLatency < 160.0 {
		delayImpairment = effLatency / 40.0
	} else {
		delayImpairment = (effLatency - 120.0) / 10.0
	}

	rFactor := 93.2 - delayImpairment - lossPct*2.5
	if rFactor < 0 {
		rFactor = 0
	} else if rFactor > 100 {
		rFactor = 100
	}

	mos := 1.0 + 0.035*rFactor + 7.0e-6*rFactor*(rFactor-60.0)*(100.0-rFactor)
	if mos < 1.0 {
		mos = 1.0
	} else if mos > 4.5 {
		mos = 4.5
	}
	mos = math.Round(mos*100.0) / 100.0

	switch {
	case mos >= 4.3:
		return mos, "HD"
	case mos >= 4.0:
		return mos, "Good"
	case mos >= 3.6:
		return mos, "Fair"
	case mos >= 3.1:
		return mos, "Poor"
	default:
		return mos, "Bad"
	}
}

func extractQuotedL4Ports(isIPv6 bool, data []byte) (proto byte, srcPort uint16, dstPort uint16, ok bool) {
	if isIPv6 {
		if len(data) < 44 {
			return 0, 0, 0, false
		}
		proto = data[6]
		srcPort = binary.BigEndian.Uint16(data[40:42])
		dstPort = binary.BigEndian.Uint16(data[42:44])
		return proto, srcPort, dstPort, true
	}
	if len(data) < 20 {
		return 0, 0, 0, false
	}
	ihl := int(data[0]&0x0f) * 4
	if ihl < 20 || len(data) < ihl+4 {
		return 0, 0, 0, false
	}
	proto = data[9]
	srcPort = binary.BigEndian.Uint16(data[ihl : ihl+2])
	dstPort = binary.BigEndian.Uint16(data[ihl+2 : ihl+4])
	return proto, srcPort, dstPort, true
}

func (e *Engine) setProtocolLabel(label string) {
	e.mu.Lock()
	e.protocolOverride = label
	e.mu.Unlock()
}

func (e *Engine) setHybridTCP(label string) {
	e.mu.Lock()
	e.hybridTCP = true
	e.protocolOverride = label
	e.mu.Unlock()
}

func (e *Engine) nextEphemeralSrcPort() uint16 {
	n := atomic.AddUint32(&e.l4PortCursor, 1)
	return uint16(49200 + (n % 14000))
}

func (e *Engine) discardProbe(key uint16, ttl int) {
	e.mu.Lock()
	if _, exists := e.inFlight[key]; exists {
		delete(e.inFlight, key)
		if h, ok := e.hops[ttl]; ok && h.sent > h.received && h.sent > 0 {
			h.sent--
		}
	}
	e.mu.Unlock()
}

func (e *Engine) receiveL4ICMP(ctx context.Context, conn *icmp.PacketConn, expectedProto byte, fixedSrcPort, fixedDstPort uint16) {
	buf := make([]byte, 1500)
	proto := ProtocolICMP
	if e.isIPv6 {
		proto = ProtocolICMPv6
	}
	for {
		select {
		case <-ctx.Done():
			return
		default:
		}

		_ = conn.SetReadDeadline(time.Now().Add(250 * time.Millisecond))
		n, peer, err := conn.ReadFrom(buf)
		if err != nil {
			if netErr, ok := err.(net.Error); ok && netErr.Timeout() {
				continue
			}
			select {
			case <-ctx.Done():
				return
			default:
				continue
			}
		}

		recvTime := time.Now()
		peerIP := extractPeerIP(peer)
		msg, err := icmp.ParseMessage(proto, buf[:n])
		if err != nil {
			continue
		}

		var quoted []byte
		isDest := false
		if e.isIPv6 {
			switch msg.Type {
			case ipv6.ICMPTypeTimeExceeded:
				if body, ok := msg.Body.(*icmp.TimeExceeded); ok {
					quoted = body.Data
				}
			case ipv6.ICMPTypeDestinationUnreachable:
				if body, ok := msg.Body.(*icmp.DstUnreach); ok {
					quoted = body.Data
					isDest = peerIP == e.destIP.String() || msg.Code == 4
				}
			}
		} else {
			switch msg.Type {
			case ipv4.ICMPTypeTimeExceeded:
				if body, ok := msg.Body.(*icmp.TimeExceeded); ok {
					quoted = body.Data
				}
			case ipv4.ICMPTypeDestinationUnreachable:
				if body, ok := msg.Body.(*icmp.DstUnreach); ok {
					quoted = body.Data
					isDest = peerIP == e.destIP.String() || msg.Code == 3
				}
			}
		}
		if len(quoted) == 0 {
			continue
		}

		innerProto, srcPort, dstPort, ok := extractQuotedL4Ports(e.isIPv6, quoted)
		if !ok || innerProto != expectedProto {
			continue
		}
		if fixedSrcPort != 0 && srcPort != fixedSrcPort {
			continue
		}
		if fixedDstPort != 0 && dstPort != fixedDstPort {
			continue
		}

		key := dstPort
		if expectedProto == 6 {
			key = srcPort
		}
		if e.recordReply(key, peerIP, recvTime, isDest) {
			e.emitSnapshot()
		}
	}
}

func (e *Engine) runTCPMTR(ctx context.Context) error {
	icmpNet := "ip4:icmp"
	bindAddr := "0.0.0.0"
	tcpNet := "tcp4"
	if e.isIPv6 {
		icmpNet = "ip6:ipv6-icmp"
		bindAddr = "::"
		tcpNet = "tcp6"
	}

	icmpConn, err := icmp.ListenPacket(icmpNet, bindAddr)
	if err != nil {
		if isWindowsHost && isPermissionError(err) {
			return e.runHybridTCP(ctx)
		}
		if isPermissionError(err) {
			return fmt.Errorf("TCP-MTR intermediate discovery requires elevated privileges (%s): %w", icmpNet, err)
		}
		return fmt.Errorf("failed to open %s socket for TCP-MTR: %w", icmpNet, err)
	}
	defer icmpConn.Close()

	e.setProtocolLabel(fmt.Sprintf("TCP-MTR :%d", e.targetPort))

	recvDone := make(chan struct{})
	go func() {
		defer close(recvDone)
		e.receiveL4ICMP(ctx, icmpConn, 6, 0, uint16(e.targetPort))
	}()

	dstAddr := net.JoinHostPort(e.destIP.String(), strconv.Itoa(e.targetPort))

	sendSweepTCP := func() {
		limitTTL := e.beginSweepRound()
		for ttl := 1; ttl <= limitTTL; ttl++ {
			select {
			case <-ctx.Done():
				return
			default:
			}

			e.mu.Lock()
			if ttl > e.maxDestTTL {
				e.mu.Unlock()
				break
			}
			srcPort := e.nextEphemeralSrcPort()
			now := time.Now()
			e.inFlight[srcPort] = probeRecord{ttl: ttl, sentAt: now}
			if h, ok := e.hops[ttl]; ok {
				h.sent++
			}
			e.mu.Unlock()

			go func(probeTTL int, lPort uint16) {
				probeCtx, cancel := context.WithTimeout(ctx, PacketTimeout)
				defer cancel()

				dialer := net.Dialer{
					Timeout: PacketTimeout,
					LocalAddr: &net.TCPAddr{
						IP:   platformBindIP(e.isIPv6),
						Port: int(lPort),
					},
					Control: func(network, address string, c syscall.RawConn) error {
						return setSocketTTL(c, e.isIPv6, probeTTL)
					},
				}
				conn, dialErr := dialer.DialContext(probeCtx, tcpNet, dstAddr)
				if dialErr == nil {
					_ = conn.Close()
					if e.recordReply(lPort, e.destIP.String(), time.Now(), true) {
						e.emitSnapshot()
					}
					return
				}
				if isConnRefused(dialErr) {
					if e.recordReply(lPort, e.destIP.String(), time.Now(), true) {
						e.emitSnapshot()
					}
					return
				}
				if isAddrInUse(dialErr) {
					e.discardProbe(lPort, probeTTL)
				}
			}(ttl, srcPort)

			if ttl < limitTTL {
				select {
				case <-ctx.Done():
					return
				case <-time.After(ProbeSpacing):
				}
			}
		}
	}

	sendSweepTCP()
	e.emitSnapshotImmediate()
	return e.runL4PollLoop(ctx, icmpConn, recvDone, sendSweepTCP)
}

func (e *Engine) runL4PollLoop(ctx context.Context, icmpConn *icmp.PacketConn, recvDone <-chan struct{}, sendSweep func()) error {
	pollTicker := time.NewTicker(PollInterval)
	defer pollTicker.Stop()

	reapTicker := time.NewTicker(200 * time.Millisecond)
	defer reapTicker.Stop()

	for {
		select {
		case <-ctx.Done():
			_ = icmpConn.SetReadDeadline(time.Now())
			_ = icmpConn.Close()
			<-recvDone
			return nil
		case <-reapTicker.C:
			if e.reapTimeouts() {
				e.emitSnapshotImmediate()
			} else {
				e.flushPendingSnapshot()
			}
		case <-pollTicker.C:
			e.reapTimeouts()
			sendSweep()
			e.emitSnapshotImmediate()
		}
	}
}

func (e *Engine) runHybridTCP(ctx context.Context) error {
	e.setHybridTCP(fmt.Sprintf("TCP-MTR :%d (Hybrid)", e.targetPort))

	destDone := make(chan struct{})
	go func() {
		defer close(destDone)
		e.runTCPDestLoop(ctx)
	}()

	err := e.runPlatform(ctx)
	<-destDone
	return err
}

func (e *Engine) runTCPDestLoop(ctx context.Context) {
	// Allow the initial ICMP intermediate sweep ~400ms to reveal transit hops before pinning destination hop TTL.
	select {
	case <-ctx.Done():
		return
	case <-time.After(400 * time.Millisecond):
	}

	tcpNet := "tcp4"
	if e.isIPv6 {
		tcpNet = "tcp6"
	}
	dstAddr := net.JoinHostPort(e.destIP.String(), strconv.Itoa(e.targetPort))
	destIPStr := e.destIP.String()

	probeOnce := func() {
		targetTTL := e.pickHybridDestTTL()
		e.mu.Lock()
		h, ok := e.hops[targetTTL]
		if ok {
			h.sent++
		}
		e.mu.Unlock()

		probeCtx, cancel := context.WithTimeout(ctx, PacketTimeout)
		defer cancel()
		dialer := net.Dialer{Timeout: PacketTimeout}
		sentAt := time.Now()
		conn, err := dialer.DialContext(probeCtx, tcpNet, dstAddr)
		rttMs := float64(time.Since(sentAt).Microseconds()) / 1000.0
		if rttMs < 0.05 {
			rttMs = 0.05
		}

		if err == nil || isConnRefused(err) {
			if conn != nil {
				_ = conn.Close()
			}
			e.recordDirectDestSample(targetTTL, destIPStr, rttMs)
			e.emitSnapshotImmediate()
		}
	}

	probeOnce()

	ticker := time.NewTicker(PollInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			probeOnce()
		}
	}
}

func (e *Engine) pickHybridDestTTL() int {
	e.mu.RLock()
	defer e.mu.RUnlock()

	if e.hybridDestTTL > 0 && e.hybridDestTTL <= MaxHops {
		return e.hybridDestTTL
	}
	highestAlive := 0
	for ttl := 1; ttl <= MaxHops; ttl++ {
		if h, ok := e.hops[ttl]; ok && h.received > 0 && h.ip != e.destIP.String() {
			highestAlive = ttl
		}
	}
	targetTTL := highestAlive + 1
	if targetTTL < 1 {
		targetTTL = 1
	} else if targetTTL > MaxHops {
		targetTTL = MaxHops
	}
	return targetTTL
}

func (e *Engine) recordDirectDestSample(ttl int, peerIP string, rttMs float64) {
	e.mu.Lock()
	h, ok := e.hops[ttl]
	if !ok {
		e.mu.Unlock()
		return
	}
	e.applyHopSample(h, ttl, peerIP, rttMs, true)
	e.mu.Unlock()

	if peerIP != "" {
		e.triggerAsyncDNS(peerIP)
		e.triggerAsyncGeo(peerIP)
	}
}

func (e *Engine) runUDPMTR(ctx context.Context) error {
	icmpNet := "ip4:icmp"
	udpNet := "udp4"
	bindAddr := "0.0.0.0"
	if e.isIPv6 {
		icmpNet = "ip6:ipv6-icmp"
		udpNet = "udp6"
		bindAddr = "::"
	}

	icmpConn, err := icmp.ListenPacket(icmpNet, bindAddr)
	if err != nil {
		if isPermissionError(err) {
			return fmt.Errorf("UDP-MTR requires Administrator privileges on Windows or CAP_NET_RAW on Linux/macOS to receive ICMP Time-Exceeded replies (try ICMP or TCP mode): %w", err)
		}
		return fmt.Errorf("failed to open %s socket for UDP-MTR: %w", icmpNet, err)
	}
	defer icmpConn.Close()

	udpConn, err := net.ListenUDP(udpNet, &net.UDPAddr{IP: platformBindIP(e.isIPv6), Port: 0})
	if err != nil {
		return fmt.Errorf("failed to open UDP probe socket: %w", err)
	}
	defer udpConn.Close()

	localUDPAddr, ok := udpConn.LocalAddr().(*net.UDPAddr)
	if !ok || localUDPAddr.Port <= 0 {
		return fmt.Errorf("failed to resolve local UDP port")
	}
	localPort := uint16(localUDPAddr.Port)
	e.setProtocolLabel("UDP-MTR")

	var p4 *ipv4.PacketConn
	var p6 *ipv6.PacketConn
	if e.isIPv6 {
		p6 = ipv6.NewPacketConn(udpConn)
	} else {
		p4 = ipv4.NewPacketConn(udpConn)
	}

	recvDone := make(chan struct{})
	go func() {
		defer close(recvDone)
		e.receiveL4ICMP(ctx, icmpConn, 17, localPort, 0)
	}()

	payload := []byte("MASAR-UDP-MTR-DIAGNOSTIC-PROBE!!")

	sendSweepUDP := func() {
		limitTTL := e.beginSweepRound()
		for ttl := 1; ttl <= limitTTL; ttl++ {
			select {
			case <-ctx.Done():
				return
			default:
			}

			e.mu.Lock()
			if ttl > e.maxDestTTL {
				e.mu.Unlock()
				break
			}
			e.seqCounter++
			dstPort := uint16(33434 + (uint32(e.seqCounter) % 20000))
			now := time.Now()
			e.inFlight[dstPort] = probeRecord{ttl: ttl, sentAt: now}
			if h, ok := e.hops[ttl]; ok {
				h.sent++
			}
			e.mu.Unlock()

			var ttlErr error
			if e.isIPv6 {
				ttlErr = p6.SetHopLimit(ttl)
			} else {
				ttlErr = p4.SetTTL(ttl)
			}
			if ttlErr != nil {
				e.discardProbe(dstPort, ttl)
				continue
			}

			_ = udpConn.SetWriteDeadline(time.Now().Add(100 * time.Millisecond))
			if _, wErr := udpConn.WriteToUDP(payload, &net.UDPAddr{IP: e.destIP, Port: int(dstPort)}); wErr != nil {
				e.discardProbe(dstPort, ttl)
			}

			if ttl < limitTTL {
				select {
				case <-ctx.Done():
					return
				case <-time.After(ProbeSpacing):
				}
			}
		}
	}

	sendSweepUDP()
	e.emitSnapshotImmediate()
	return e.runL4PollLoop(ctx, icmpConn, recvDone, sendSweepUDP)
}
