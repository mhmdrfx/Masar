//go:build windows

package mtr

import (
	"context"
	"encoding/binary"
	"errors"
	"fmt"
	"net"
	"runtime"
	"sync"
	"syscall"
	"time"
	"unsafe"

	"golang.org/x/sys/windows"
)

var (
	modIphlpapi        = windows.NewLazySystemDLL("iphlpapi.dll")
	procIcmpCreateFile = modIphlpapi.NewProc("IcmpCreateFile")
	procIcmp6Create    = modIphlpapi.NewProc("Icmp6CreateFile")
	procIcmpClose      = modIphlpapi.NewProc("IcmpCloseHandle")
	procIcmpSendEcho2  = modIphlpapi.NewProc("IcmpSendEcho2")
	procIcmp6SendEcho2 = modIphlpapi.NewProc("Icmp6SendEcho2")
)

const (
	ipSuccess           uint32 = 0
	ipDestNetUnreach    uint32 = 11002
	ipDestHostUnreach   uint32 = 11003
	ipDestProtUnreach   uint32 = 11004
	ipDestPortUnreach   uint32 = 11005
	ipReqTimedOut       uint32 = 11010
	ipTTLExpiredTransit uint32 = 11013
	ipTTLExpiredReassem uint32 = 11014
)

type ipOptionInformation struct {
	Ttl         uint8
	Tos         uint8
	Flags       uint8
	OptionsSize uint8
	OptionsData uintptr
}

func (e *Engine) runPlatform(ctx context.Context) error {
	if e.isIPv6 {
		return e.runWindowsICMP6(ctx)
	}
	return e.runWindowsICMP4(ctx)
}

func (e *Engine) runWindowsICMP4(ctx context.Context) error {
	hRaw, _, callErr := procIcmpCreateFile.Call()
	handle := windows.Handle(hRaw)
	if handle == 0 || handle == windows.InvalidHandle {
		// Fall back cleanly if ICMP helper creation fails in an unusual environment.
		return e.runSocketPlatform(ctx)
	}

	dest4 := e.destIP.To4()
	if dest4 == nil {
		_, _, _ = procIcmpClose.Call(uintptr(handle))
		return fmt.Errorf("invalid IPv4 address: %v", e.destIP)
	}
	destAddr := binary.LittleEndian.Uint32(dest4)

	var wg sync.WaitGroup
	cleanup := func() {
		go func() {
			wg.Wait()
			_, _, _ = procIcmpClose.Call(uintptr(handle))
		}()
	}

	probeFn := func(ttl int, seq uint16, reqData []byte) {
		wg.Add(1)
		go func(hopTTL int, seqNum uint16, payload []byte) {
			defer wg.Done()

			opts := ipOptionInformation{Ttl: uint8(hopTTL)}
			replyBuf := make([]byte, 256)
			timeoutMs := uint32(PacketTimeout.Milliseconds())

			sentAt := time.Now()
			ret, _, callErr := procIcmpSendEcho2.Call(
				uintptr(handle),
				0,
				0,
				0,
				uintptr(destAddr),
				uintptr(unsafe.Pointer(&payload[0])),
				uintptr(len(payload)),
				uintptr(unsafe.Pointer(&opts)),
				uintptr(unsafe.Pointer(&replyBuf[0])),
				uintptr(len(replyBuf)),
				uintptr(timeoutMs),
			)
			recvTime := time.Now()
			runtime.KeepAlive(payload)
			runtime.KeepAlive(&opts)
			runtime.KeepAlive(replyBuf)

			if ctx.Err() != nil {
				return
			}

			peerIP, status, ok := parseWindowsICMP4Reply(replyBuf, ret, callErr)
			if !ok {
				e.clearInFlight(seqNum)
				return
			}

			e.recordWindowsICMPReply(seqNum, peerIP, status, sentAt, recvTime)
		}(ttl, seq, reqData)
	}

	e.sweepWindowsAndLoop(ctx, probeFn, cleanup)
	_ = callErr
	return nil
}

func (e *Engine) runWindowsICMP6(ctx context.Context) error {
	hRaw, _, callErr := procIcmp6Create.Call()
	handle := windows.Handle(hRaw)
	if handle == 0 || handle == windows.InvalidHandle {
		return e.runSocketPlatform(ctx)
	}

	dest16 := e.destIP.To16()
	if dest16 == nil {
		_, _, _ = procIcmpClose.Call(uintptr(handle))
		return fmt.Errorf("invalid IPv6 address: %v", e.destIP)
	}

	// sockaddr_in6: sin6_family(2) + sin6_port(2) + sin6_flowinfo(4) + sin6_addr(16) + sin6_scope_id(4) = 28 bytes
	var srcSockAddr [28]byte
	binary.LittleEndian.PutUint16(srcSockAddr[0:2], windows.AF_INET6)

	var dstSockAddr [28]byte
	binary.LittleEndian.PutUint16(dstSockAddr[0:2], windows.AF_INET6)
	copy(dstSockAddr[8:24], dest16)

	var wg sync.WaitGroup
	cleanup := func() {
		go func() {
			wg.Wait()
			_, _, _ = procIcmpClose.Call(uintptr(handle))
		}()
	}

	probeFn := func(ttl int, seq uint16, reqData []byte) {
		wg.Add(1)
		go func(hopTTL int, seqNum uint16, payload []byte) {
			defer wg.Done()

			opts := ipOptionInformation{Ttl: uint8(hopTTL)}
			replyBuf := make([]byte, 256)
			timeoutMs := uint32(PacketTimeout.Milliseconds())

			sentAt := time.Now()
			ret, _, callErr := procIcmp6SendEcho2.Call(
				uintptr(handle),
				0,
				0,
				0,
				uintptr(unsafe.Pointer(&srcSockAddr[0])),
				uintptr(unsafe.Pointer(&dstSockAddr[0])),
				uintptr(unsafe.Pointer(&payload[0])),
				uintptr(len(payload)),
				uintptr(unsafe.Pointer(&opts)),
				uintptr(unsafe.Pointer(&replyBuf[0])),
				uintptr(len(replyBuf)),
				uintptr(timeoutMs),
			)
			recvTime := time.Now()
			runtime.KeepAlive(&srcSockAddr)
			runtime.KeepAlive(&dstSockAddr)
			runtime.KeepAlive(payload)
			runtime.KeepAlive(&opts)
			runtime.KeepAlive(replyBuf)

			if ctx.Err() != nil {
				return
			}

			peerIP, status, ok := parseWindowsICMP6Reply(replyBuf, ret, callErr)
			if !ok {
				e.clearInFlight(seqNum)
				return
			}

			e.recordWindowsICMPReply(seqNum, peerIP, status, sentAt, recvTime)
		}(ttl, seq, reqData)
	}

	e.sweepWindowsAndLoop(ctx, probeFn, cleanup)
	_ = callErr
	return nil
}

func (e *Engine) sweepWindowsAndLoop(ctx context.Context, probeFn func(ttl int, seq uint16, payload []byte), cleanup func()) {
	defer cleanup()

	e.sendSweepWindows(ctx, probeFn)
	e.emitSnapshotImmediate()

	pollTicker := time.NewTicker(PollInterval)
	defer pollTicker.Stop()

	reapTicker := time.NewTicker(200 * time.Millisecond)
	defer reapTicker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-reapTicker.C:
			if e.reapTimeouts() {
				e.emitSnapshotImmediate()
			} else {
				e.flushPendingSnapshot()
			}
		case <-pollTicker.C:
			e.reapTimeouts()
			e.sendSweepWindows(ctx, probeFn)
			e.emitSnapshotImmediate()
		}
	}
}

func (e *Engine) sendSweepWindows(ctx context.Context, probeFn func(ttl int, seq uint16, payload []byte)) {
	limitTTL := e.beginSweepRound()

	for ttl := 1; ttl <= limitTTL; ttl++ {
		select {
		case <-ctx.Done():
			return
		default:
		}

		e.mu.Lock()
		// Re-check dynamic maxDestTTL if a fast parallel probe already hit the target.
		if ttl > e.maxDestTTL {
			e.mu.Unlock()
			break
		}
		e.seqCounter++
		seq := e.seqCounter
		now := time.Now()
		e.inFlight[seq] = probeRecord{
			ttl:    ttl,
			sentAt: now,
		}
		if h, ok := e.hops[ttl]; ok {
			h.sent++
		}
		e.mu.Unlock()

		payload := make([]byte, 32)
		binary.BigEndian.PutUint64(payload[0:8], uint64(now.UnixNano()))
		binary.BigEndian.PutUint16(payload[8:10], seq)
		probeFn(ttl, seq, payload)

		if ttl < limitTTL {
			select {
			case <-ctx.Done():
				return
			case <-time.After(ProbeSpacing):
			}
		}
	}
}

func (e *Engine) recordWindowsICMPReply(seq uint16, peerIP string, status uint32, sentAt, recvTime time.Time) {
	e.mu.Lock()
	if p, ok := e.inFlight[seq]; ok {
		p.sentAt = sentAt
		e.inFlight[seq] = p
	}
	e.mu.Unlock()

	isDest := status == ipSuccess || peerIP == e.destIP.String()
	if e.recordReply(seq, peerIP, recvTime, isDest) {
		e.emitSnapshot()
	}
}

func parseWindowsICMP4Reply(buf []byte, ret uintptr, callErr error) (peerIP string, status uint32, ok bool) {
	if len(buf) < 12 {
		return "", 0, false
	}
	if ret == 0 {
		var errno syscall.Errno
		if !errors.As(callErr, &errno) || uint32(errno) != ipTTLExpiredTransit {
			return "", 0, false
		}
	}
	status = binary.LittleEndian.Uint32(buf[4:8])
	if !isTraceReplyStatus(status) {
		return "", status, false
	}
	ip := net.IPv4(buf[0], buf[1], buf[2], buf[3])
	if ip.IsUnspecified() {
		return "", status, false
	}
	return ip.String(), status, true
}

func parseWindowsICMP6Reply(buf []byte, ret uintptr, callErr error) (peerIP string, status uint32, ok bool) {
	// ICMPV6_ECHO_REPLY is pshpack1: IPV6_ADDRESS_EX (26 bytes) + Status (4) + RoundTripTime (4) = 34 bytes
	if len(buf) < 34 {
		return "", 0, false
	}
	if ret == 0 {
		var errno syscall.Errno
		if !errors.As(callErr, &errno) || uint32(errno) != ipTTLExpiredTransit {
			return "", 0, false
		}
	}
	status = binary.LittleEndian.Uint32(buf[26:30])
	if !isTraceReplyStatus(status) {
		return "", status, false
	}
	ip := make(net.IP, net.IPv6len)
	copy(ip, buf[6:22])
	if ip.IsUnspecified() {
		return "", status, false
	}
	return ip.String(), status, true
}

func isTraceReplyStatus(status uint32) bool {
	switch status {
	case ipSuccess,
		ipTTLExpiredTransit,
		ipTTLExpiredReassem,
		ipDestNetUnreach,
		ipDestHostUnreach,
		ipDestProtUnreach,
		ipDestPortUnreach:
		return true
	default:
		return false
	}
}
