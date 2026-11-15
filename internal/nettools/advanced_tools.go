package nettools

import (
	"bytes"
	"context"
	"crypto/tls"
	"crypto/x509"
	"errors"
	"fmt"
	"io"
	"math"
	"net"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"golang.org/x/net/dns/dnsmessage"
)

// TLSCertReport describes the live TLS handshake and X.509 certificate chain metadata.
type TLSCertReport struct {
	Host            string   `json:"host"`
	Port            int      `json:"port"`
	ProtocolVersion string   `json:"protocolVersion"`
	CipherSuite     string   `json:"cipherSuite"`
	HandshakeMs     float64  `json:"handshakeMs"`
	Subject         string   `json:"subject"`
	Issuer          string   `json:"issuer"`
	SANs            []string `json:"sans"`
	NotBefore       string   `json:"notBefore"`
	NotAfter        string   `json:"notAfter"`
	DaysRemaining   int      `json:"daysRemaining"`
	Verified        bool     `json:"verified"`
	VerifyError     string   `json:"verifyError,omitempty"`
	ChainSubjects   []string `json:"chainSubjects"`
	CheckedAt       string   `json:"checkedAt"`
}

const (
	dohTimeout    = 3500 * time.Millisecond
	maxCustomPort = 256
)

var dohHTTPClient = &http.Client{
	Timeout: dohTimeout,
	Transport: &http.Transport{
		Proxy:               http.ProxyFromEnvironment,
		MaxIdleConns:        8,
		MaxIdleConnsPerHost: 4,
	},
}

// ComputeBufferbloatGrade grades latency inflation under load (Waveform/Speedtest methodology).
func ComputeBufferbloatGrade(idleMs, downLoadedMs, upLoadedMs float64) string {
	if idleMs <= 0 || (downLoadedMs <= 0 && upLoadedMs <= 0) {
		return ""
	}
	worstLoaded := math.Max(downLoadedMs, upLoadedMs)
	delta := worstLoaded - idleMs
	if delta < 0 {
		delta = 0
	}
	switch {
	case delta <= 5.0:
		return "A+"
	case delta <= 30.0:
		return "A"
	case delta <= 60.0:
		return "B"
	case delta <= 200.0:
		return "C"
	case delta <= 400.0:
		return "D"
	default:
		return "F"
	}
}

func computePercentile(samples []float64, pct float64) float64 {
	if len(samples) == 0 {
		return 0
	}
	if pct <= 0 {
		pct = 0
	} else if pct >= 100 {
		pct = 100
	}
	cp := make([]float64, len(samples))
	copy(cp, samples)
	sort.Float64s(cp)
	if len(cp) == 1 {
		return round1(cp[0])
	}
	rank := (pct / 100.0) * float64(len(cp)-1)
	lo := int(math.Floor(rank))
	hi := int(math.Ceil(rank))
	if lo == hi {
		return round1(cp[lo])
	}
	frac := rank - float64(lo)
	return round1(cp[lo] + frac*(cp[hi]-cp[lo]))
}

// ParsePortSpec parses comma-separated ports, ranges ("8000-8010"), or presets ("common", "web", "database", "remote").
func ParsePortSpec(spec string) ([]int, error) {
	trimmed := strings.ToLower(strings.TrimSpace(spec))
	switch trimmed {
	case "", "common", "default":
		return DefaultScanPorts(), nil
	case "web":
		return []int{80, 443, 3000, 5000, 8000, 8008, 8080, 8443}, nil
	case "database", "db":
		return []int{1433, 1521, 3306, 5432, 6379, 9200, 27017}, nil
	case "remote", "admin":
		return []int{22, 23, 3389, 5900, 5985, 5986}, nil
	}

	seen := make(map[int]struct{})
	out := make([]int, 0, 32)
	tokens := strings.FieldsFunc(trimmed, func(r rune) bool {
		return r == ',' || r == ' ' || r == ';' || r == '\t'
	})
	for _, tok := range tokens {
		if strings.Contains(tok, "-") {
			parts := strings.SplitN(tok, "-", 2)
			startP, err1 := strconv.Atoi(strings.TrimSpace(parts[0]))
			endP, err2 := strconv.Atoi(strings.TrimSpace(parts[1]))
			if err1 != nil || err2 != nil || startP < 1 || endP > 65535 || startP > endP {
				return nil, fmt.Errorf("invalid port range %q (expected start-end within 1..65535)", tok)
			}
			for p := startP; p <= endP; p++ {
				if _, ok := seen[p]; !ok {
					seen[p] = struct{}{}
					out = append(out, p)
					if len(out) > maxCustomPort {
						return nil, fmt.Errorf("port scan limit exceeded (maximum %d ports per run)", maxCustomPort)
					}
				}
			}
			continue
		}
		p, err := strconv.Atoi(tok)
		if err != nil || p < 1 || p > 65535 {
			return nil, fmt.Errorf("invalid port number %q (expected 1..65535)", tok)
		}
		if _, ok := seen[p]; !ok {
			seen[p] = struct{}{}
			out = append(out, p)
			if len(out) > maxCustomPort {
				return nil, fmt.Errorf("port scan limit exceeded (maximum %d ports per run)", maxCustomPort)
			}
		}
	}
	if len(out) == 0 {
		return nil, errors.New("no valid ports specified")
	}
	sort.Ints(out)
	return out, nil
}

// ScanPortsSpec scans TCP ports parsed from a custom specification string or preset name.
func ScanPortsSpec(rawHost, portSpec string) (PortScanReport, error) {
	ports, err := ParsePortSpec(portSpec)
	if err != nil {
		return PortScanReport{}, err
	}
	return ScanPorts(rawHost, ports)
}

func resolveUpstreamConfig(choice string, useDoH bool) (displayName, dohURL, udpAddr string) {
	c := strings.ToLower(strings.TrimSpace(choice))
	switch c {
	case "", "system", "default":
		if useDoH {
			return "1.1.1.1 (Cloudflare DoH)", "https://cloudflare-dns.com/dns-query", ""
		}
		return "System Resolver", "", ""
	case "1.1.1.1", "cloudflare", "cf":
		if useDoH {
			return "1.1.1.1 (Cloudflare DoH)", "https://cloudflare-dns.com/dns-query", ""
		}
		return "1.1.1.1 (Cloudflare)", "", "1.1.1.1:53"
	case "8.8.8.8", "google":
		if useDoH {
			return "8.8.8.8 (Google DoH)", "https://dns.google/dns-query", ""
		}
		return "8.8.8.8 (Google)", "", "8.8.8.8:53"
	case "9.9.9.9", "quad9":
		if useDoH {
			return "9.9.9.9 (Quad9 DoH)", "https://dns.quad9.net/dns-query", ""
		}
		return "9.9.9.9 (Quad9)", "", "9.9.9.9:53"
	default:
		if strings.HasPrefix(c, "https://") {
			return choice, choice, ""
		}
		if ip := net.ParseIP(strings.Trim(c, "[]")); ip != nil {
			addr := net.JoinHostPort(ip.String(), "53")
			return ip.String(), "", addr
		}
		if _, _, err := net.SplitHostPort(c); err == nil {
			return c, "", c
		}
		return "System Resolver", "", ""
	}
}

func buildDNSWireQuery(qname string, qtype dnsmessage.Type) ([]byte, error) {
	fqdn := strings.TrimSuffix(strings.TrimSpace(qname), ".") + "."
	parsedName, err := dnsmessage.NewName(fqdn)
	if err != nil {
		return nil, err
	}
	var opt dnsmessage.OPTResource
	hdr := dnsmessage.ResourceHeader{
		Name:  dnsmessage.MustNewName("."),
		Type:  dnsmessage.TypeOPT,
		Class: 4096,
	}
	_ = hdr.SetEDNS0(4096, dnsmessage.RCodeSuccess, true) // Enable DO (DNSSEC OK) bit

	msg := dnsmessage.Message{
		Header: dnsmessage.Header{
			ID:               uint16(time.Now().UnixNano() & 0xffff),
			RecursionDesired: true,
		},
		Questions: []dnsmessage.Question{
			{
				Name:  parsedName,
				Type:  qtype,
				Class: dnsmessage.ClassINET,
			},
		},
		Additionals: []dnsmessage.Resource{
			{
				Header: hdr,
				Body:   &opt,
			},
		},
	}
	return msg.Pack()
}

func parseDNSWireResponse(wire []byte, qtype dnsmessage.Type, latencyMs float64) ([]DNSRecordItem, bool, error) {
	var p dnsmessage.Parser
	hdr, err := p.Start(wire)
	if err != nil {
		return nil, false, err
	}
	if err := p.SkipAllQuestions(); err != nil {
		return nil, hdr.AuthenticData, err
	}

	items := make([]DNSRecordItem, 0, 4)
	for {
		ah, err := p.AnswerHeader()
		if err == dnsmessage.ErrSectionDone {
			break
		}
		if err != nil {
			return items, hdr.AuthenticData, err
		}

		typeLabel := qtypeLabel(ah.Type)
		if qtype != ah.Type && ah.Type != dnsmessage.TypeCNAME {
			_ = p.SkipAnswer()
			continue
		}

		switch ah.Type {
		case dnsmessage.TypeA:
			r, rErr := p.AResource()
			if rErr == nil {
				items = append(items, DNSRecordItem{
					Type:      "A",
					Value:     net.IP(r.A[:]).String(),
					TTL:       ah.TTL,
					LatencyMs: round1(latencyMs),
					DNSSEC:    hdr.AuthenticData,
				})
			}
		case dnsmessage.TypeAAAA:
			r, rErr := p.AAAAResource()
			if rErr == nil {
				items = append(items, DNSRecordItem{
					Type:      "AAAA",
					Value:     net.IP(r.AAAA[:]).String(),
					TTL:       ah.TTL,
					LatencyMs: round1(latencyMs),
					DNSSEC:    hdr.AuthenticData,
				})
			}
		case dnsmessage.TypeCNAME:
			r, rErr := p.CNAMEResource()
			if rErr == nil {
				items = append(items, DNSRecordItem{
					Type:      "CNAME",
					Value:     strings.TrimSuffix(r.CNAME.String(), "."),
					TTL:       ah.TTL,
					LatencyMs: round1(latencyMs),
					DNSSEC:    hdr.AuthenticData,
				})
			}
		case dnsmessage.TypePTR:
			r, rErr := p.PTRResource()
			if rErr == nil {
				items = append(items, DNSRecordItem{
					Type:      "PTR",
					Value:     strings.TrimSuffix(r.PTR.String(), "."),
					TTL:       ah.TTL,
					LatencyMs: round1(latencyMs),
					DNSSEC:    hdr.AuthenticData,
				})
			}
		case dnsmessage.TypeNS:
			r, rErr := p.NSResource()
			if rErr == nil {
				items = append(items, DNSRecordItem{
					Type:      "NS",
					Value:     strings.TrimSuffix(r.NS.String(), "."),
					TTL:       ah.TTL,
					LatencyMs: round1(latencyMs),
					DNSSEC:    hdr.AuthenticData,
				})
			}
		case dnsmessage.TypeMX:
			r, rErr := p.MXResource()
			if rErr == nil {
				items = append(items, DNSRecordItem{
					Type:      "MX",
					Value:     fmt.Sprintf("%s (Pref %d)", strings.TrimSuffix(r.MX.String(), "."), r.Pref),
					TTL:       ah.TTL,
					LatencyMs: round1(latencyMs),
					DNSSEC:    hdr.AuthenticData,
				})
			}
		case dnsmessage.TypeTXT:
			r, rErr := p.TXTResource()
			if rErr == nil {
				items = append(items, DNSRecordItem{
					Type:      "TXT",
					Value:     strings.Join(r.TXT, ""),
					TTL:       ah.TTL,
					LatencyMs: round1(latencyMs),
					DNSSEC:    hdr.AuthenticData,
				})
			}
		case dnsmessage.TypeSOA:
			r, rErr := p.SOAResource()
			if rErr == nil {
				items = append(items, DNSRecordItem{
					Type:      "SOA",
					Value:     fmt.Sprintf("%s %s (serial %d, refresh %ds)", strings.TrimSuffix(r.NS.String(), "."), strings.TrimSuffix(r.MBox.String(), "."), r.Serial, r.Refresh),
					TTL:       ah.TTL,
					LatencyMs: round1(latencyMs),
					DNSSEC:    hdr.AuthenticData,
				})
			}
		case dnsmessage.Type(257): // RFC 8659 CAA
			r, rErr := p.UnknownResource()
			if rErr == nil && len(r.Data) >= 2 {
				flags := r.Data[0]
				tagLen := int(r.Data[1])
				if len(r.Data) >= 2+tagLen {
					tag := string(r.Data[2 : 2+tagLen])
					val := string(r.Data[2+tagLen:])
					items = append(items, DNSRecordItem{
						Type:      "CAA",
						Value:     fmt.Sprintf("%d %s %q", flags, tag, val),
						TTL:       ah.TTL,
						LatencyMs: round1(latencyMs),
						DNSSEC:    hdr.AuthenticData,
					})
				}
			}
		default:
			_ = typeLabel
			_ = p.SkipAnswer()
		}
	}
	return items, hdr.AuthenticData, nil
}

func qtypeLabel(t dnsmessage.Type) string {
	switch t {
	case dnsmessage.TypeA:
		return "A"
	case dnsmessage.TypeAAAA:
		return "AAAA"
	case dnsmessage.TypeCNAME:
		return "CNAME"
	case dnsmessage.TypePTR:
		return "PTR"
	case dnsmessage.TypeNS:
		return "NS"
	case dnsmessage.TypeMX:
		return "MX"
	case dnsmessage.TypeTXT:
		return "TXT"
	case dnsmessage.TypeSOA:
		return "SOA"
	case dnsmessage.Type(257):
		return "CAA"
	default:
		return fmt.Sprintf("TYPE%d", t)
	}
}

func buildReversePTRName(ip net.IP) (string, bool) {
	if ip == nil {
		return "", false
	}
	if ip4 := ip.To4(); ip4 != nil {
		return fmt.Sprintf("%d.%d.%d.%d.in-addr.arpa", ip4[3], ip4[2], ip4[1], ip4[0]), true
	}
	ip16 := ip.To16()
	if ip16 == nil {
		return "", false
	}
	const hexDigits = "0123456789abcdef"
	nibbles := make([]byte, 0, 64)
	for i := len(ip16) - 1; i >= 0; i-- {
		b := ip16[i]
		nibbles = append(nibbles, hexDigits[b&0x0f], '.', hexDigits[b>>4], '.')
	}
	return string(nibbles) + "ip6.arpa", true
}

func queryDNSWire(ctx context.Context, client *http.Client, dohURL, udpAddr, qname string, qtype dnsmessage.Type) ([]DNSRecordItem, bool, error) {
	wireReq, err := buildDNSWireQuery(qname, qtype)
	if err != nil {
		return nil, false, err
	}

	start := time.Now()
	var wireResp []byte

	if dohURL != "" {
		req, rErr := http.NewRequestWithContext(ctx, http.MethodPost, dohURL, bytes.NewReader(wireReq))
		if rErr != nil {
			return nil, false, rErr
		}
		req.Header.Set("Content-Type", "application/dns-message")
		req.Header.Set("Accept", "application/dns-message")
		resp, doErr := client.Do(req)
		if doErr != nil {
			return nil, false, doErr
		}
		defer resp.Body.Close()
		if resp.StatusCode != http.StatusOK {
			return nil, false, fmt.Errorf("DoH HTTP %d", resp.StatusCode)
		}
		wireResp, err = io.ReadAll(io.LimitReader(resp.Body, 64*1024))
		if err != nil {
			return nil, false, err
		}
	} else {
		conn, dErr := (&net.Dialer{Timeout: dohTimeout}).DialContext(ctx, "udp", udpAddr)
		if dErr != nil {
			return nil, false, dErr
		}
		defer conn.Close()
		_ = conn.SetDeadline(time.Now().Add(dohTimeout))
		if _, wErr := conn.Write(wireReq); wErr != nil {
			return nil, false, wErr
		}
		buf := make([]byte, 4096)
		n, rErr := conn.Read(buf)
		if rErr != nil {
			return nil, false, rErr
		}
		wireResp = buf[:n]
	}

	latMs := float64(time.Since(start).Microseconds()) / 1000.0
	return parseDNSWireResponse(wireResp, qtype, latMs)
}

// LookupDNSWithOptions resolves DNS records using System resolver, custom UDP upstream, or DNS-over-HTTPS (RFC 8484).
func LookupDNSWithOptions(rawTarget, resolverChoice string, useDoH bool) (DNSReport, error) {
	target := strings.TrimSpace(rawTarget)
	target = strings.TrimPrefix(target, "https://")
	target = strings.TrimPrefix(target, "http://")
	if idx := strings.IndexByte(target, '/'); idx != -1 {
		target = target[:idx]
	}
	if h, _, err := net.SplitHostPort(target); err == nil {
		target = h
	}
	target = strings.Trim(strings.TrimSpace(target), "[]")
	if target == "" {
		return DNSReport{}, errors.New("domain or IP target cannot be empty")
	}

	displayResolver, dohURL, udpAddr := resolveUpstreamConfig(resolverChoice, useDoH)
	if dohURL == "" && udpAddr == "" {
		rep, err := LookupDNS(target)
		if err != nil {
			return rep, err
		}
		rep.Resolver = displayResolver
		rep.UseDoH = false
		return rep, nil
	}

	return lookupDNSWireWithClient(target, displayResolver, dohURL, udpAddr, dohHTTPClient)
}

func lookupDNSWireWithClient(target, displayResolver, dohURL, udpAddr string, client *http.Client) (DNSReport, error) {
	start := time.Now()
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var qname string
	var queryTypes []dnsmessage.Type
	if ip := net.ParseIP(target); ip != nil {
		rev, ok := buildReversePTRName(ip)
		if !ok {
			return DNSReport{}, fmt.Errorf("invalid IP address %q", target)
		}
		qname = rev
		queryTypes = []dnsmessage.Type{dnsmessage.TypePTR}
	} else {
		qname = target
		queryTypes = []dnsmessage.Type{
			dnsmessage.TypeA,
			dnsmessage.TypeAAAA,
			dnsmessage.TypeCNAME,
			dnsmessage.TypeMX,
			dnsmessage.TypeNS,
			dnsmessage.TypeTXT,
			dnsmessage.TypeSOA,
			dnsmessage.Type(257), // CAA
		}
	}

	var mu sync.Mutex
	var wg sync.WaitGroup
	records := make([]DNSRecordItem, 0, 12)
	seen := make(map[string]struct{})
	dnssecValidated := false
	anySuccess := false
	var firstErr error

	for _, qt := range queryTypes {
		wg.Add(1)
		go func(t dnsmessage.Type) {
			defer wg.Done()
			items, ad, qErr := queryDNSWire(ctx, client, dohURL, udpAddr, qname, t)
			mu.Lock()
			defer mu.Unlock()
			if qErr != nil {
				if firstErr == nil {
					firstErr = qErr
				}
				return
			}
			anySuccess = true
			if ad && len(items) > 0 {
				dnssecValidated = true
			}
			for _, it := range items {
				key := it.Type + "|" + it.Value
				if _, dup := seen[key]; dup {
					continue
				}
				seen[key] = struct{}{}
				records = append(records, it)
			}
		}(qt)
	}
	wg.Wait()

	if !anySuccess && firstErr != nil {
		return DNSReport{}, firstErr
	}

	typeOrder := map[string]int{
		"A": 1, "AAAA": 2, "CNAME": 3, "PTR": 4, "MX": 5, "NS": 6, "TXT": 7, "SOA": 8, "CAA": 9,
	}
	sort.Slice(records, func(i, j int) bool {
		oi, okI := typeOrder[records[i].Type]
		oj, okJ := typeOrder[records[j].Type]
		if !okI {
			oi = 99
		}
		if !okJ {
			oj = 99
		}
		if oi != oj {
			return oi < oj
		}
		return records[i].Value < records[j].Value
	})

	elapsedMs := float64(time.Since(start).Microseconds()) / 1000.0
	return DNSReport{
		Target:          target,
		Resolver:        displayResolver,
		UseDoH:          dohURL != "",
		DNSSECValidated: dnssecValidated,
		QueryTimeMs:     round1(elapsedMs),
		Records:         records,
		CheckedAt:       time.Now().Format("15:04:05"),
	}, nil
}

// InspectTLS dials host:port over TLS and extracts protocol, cipher, SANs, expiry, and verification chain status.
func InspectTLS(rawHost string, port int) (TLSCertReport, error) {
	host := strings.TrimSpace(rawHost)
	host = strings.TrimPrefix(host, "https://")
	host = strings.TrimPrefix(host, "http://")
	if idx := strings.IndexByte(host, '/'); idx != -1 {
		host = host[:idx]
	}
	if h, pStr, err := net.SplitHostPort(host); err == nil {
		host = h
		if port <= 0 {
			if p, pErr := strconv.Atoi(pStr); pErr == nil && p > 0 && p <= 65535 {
				port = p
			}
		}
	}
	host = strings.Trim(strings.TrimSpace(host), "[]")
	if host == "" {
		return TLSCertReport{}, errors.New("TLS target host cannot be empty")
	}
	if port <= 0 || port > 65535 {
		port = 443
	}

	addr := net.JoinHostPort(host, strconv.Itoa(port))
	dialer := &net.Dialer{Timeout: 4 * time.Second}
	start := time.Now()
	conn, err := tls.DialWithDialer(dialer, "tcp", addr, &tls.Config{
		ServerName: host,
		MinVersion: tls.VersionTLS10,
	})
	if err == nil {
		hsMs := float64(time.Since(start).Microseconds()) / 1000.0
		state := conn.ConnectionState()
		_ = conn.Close()
		return buildTLSCertReportFromState(host, port, state, hsMs, true, ""), nil
	}

	var certErr x509.CertificateInvalidError
	var unknownAuthErr x509.UnknownAuthorityError
	var hostErr x509.HostnameError
	if errors.As(err, &certErr) || errors.As(err, &unknownAuthErr) || errors.As(err, &hostErr) || strings.Contains(strings.ToLower(err.Error()), "x509:") {
		verifyErrMsg := err.Error()
		start2 := time.Now()
		unverifiedConn, err2 := tls.DialWithDialer(dialer, "tcp", addr, &tls.Config{
			ServerName:         host,
			MinVersion:         tls.VersionTLS10,
			InsecureSkipVerify: true,
		})
		if err2 != nil {
			return TLSCertReport{}, fmt.Errorf("TLS handshake to %s failed: %w", addr, err)
		}
		hsMs := float64(time.Since(start2).Microseconds()) / 1000.0
		state := unverifiedConn.ConnectionState()
		_ = unverifiedConn.Close()
		return buildTLSCertReportFromState(host, port, state, hsMs, false, verifyErrMsg), nil
	}

	return TLSCertReport{}, fmt.Errorf("failed to inspect TLS on %s: %w", addr, err)
}

func buildTLSCertReportFromState(host string, port int, state tls.ConnectionState, handshakeMs float64, verified bool, verifyErr string) TLSCertReport {
	verName := tls.VersionName(state.Version)
	if verName == "" {
		verName = fmt.Sprintf("0x%04x", state.Version)
	}
	cipherName := tls.CipherSuiteName(state.CipherSuite)
	rep := TLSCertReport{
		Host:            host,
		Port:            port,
		ProtocolVersion: verName,
		CipherSuite:     cipherName,
		HandshakeMs:     round1(handshakeMs),
		Verified:        verified,
		VerifyError:     verifyErr,
		CheckedAt:       time.Now().Format("15:04:05"),
	}
	if len(state.PeerCertificates) > 0 {
		leaf := state.PeerCertificates[0]
		rep.Subject = leaf.Subject.CommonName
		if rep.Subject == "" {
			rep.Subject = leaf.Subject.String()
		}
		rep.Issuer = leaf.Issuer.CommonName
		if rep.Issuer == "" {
			rep.Issuer = leaf.Issuer.String()
		}
		sans := make([]string, 0, len(leaf.DNSNames)+len(leaf.IPAddresses))
		sans = append(sans, leaf.DNSNames...)
		for _, ip := range leaf.IPAddresses {
			sans = append(sans, ip.String())
		}
		rep.SANs = sans
		rep.NotBefore = leaf.NotBefore.UTC().Format("2006-01-02")
		rep.NotAfter = leaf.NotAfter.UTC().Format("2006-01-02")
		rep.DaysRemaining = int(math.Floor(time.Until(leaf.NotAfter).Hours() / 24.0))

		chain := make([]string, 0, len(state.PeerCertificates))
		for _, c := range state.PeerCertificates {
			name := c.Subject.CommonName
			if name == "" {
				name = c.Subject.String()
			}
			chain = append(chain, name)
		}
		rep.ChainSubjects = chain
	}
	// Preserve clean state output.
	return rep
}
