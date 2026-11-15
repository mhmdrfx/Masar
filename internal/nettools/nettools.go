package nettools

import (
	"bytes"
	"context"
	"crypto/tls"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math"
	"net"
	"net/http"
	"net/url"
	"sort"
	"strings"
	"sync"
	"sync/atomic"
	"time"
)

// DNSRecordItem represents a single resolved DNS resource record.
type DNSRecordItem struct {
	Type      string  `json:"type"`
	Value     string  `json:"value"`
	TTL       uint32  `json:"ttl,omitempty"`
	LatencyMs float64 `json:"latencyMs,omitempty"`
	DNSSEC    bool    `json:"dnssec,omitempty"`
}

// DNSReport holds comprehensive DNS lookup results and timing telemetry.
type DNSReport struct {
	Target          string          `json:"target"`
	Resolver        string          `json:"resolver,omitempty"`
	UseDoH          bool            `json:"useDoH,omitempty"`
	DNSSECValidated bool            `json:"dnssecValidated,omitempty"`
	QueryTimeMs     float64         `json:"queryTimeMs"`
	Records         []DNSRecordItem `json:"records"`
	CheckedAt       string          `json:"checkedAt"`
}

// PortResult represents the status and TCP handshake latency of a single port.
type PortResult struct {
	Port      int     `json:"port"`
	Service   string  `json:"service"`
	State     string  `json:"state"` // "open" | "closed" | "filtered"
	LatencyMs float64 `json:"latencyMs"`
}

// PortScanReport holds the results of a concurrent TCP port scan.
type PortScanReport struct {
	Host       string       `json:"host"`
	ResolvedIP string       `json:"resolvedIp"`
	OpenCount  int          `json:"openCount"`
	TotalPorts int          `json:"totalPorts"`
	DurationMs float64      `json:"durationMs"`
	Results    []PortResult `json:"results"`
}

// EdgePingItem represents HTTP/TLS response latency to a global edge provider.
type EdgePingItem struct {
	Provider  string    `json:"provider"`
	Endpoint  string    `json:"endpoint"`
	LatencyMs float64   `json:"latencyMs"`
	AvgMs     float64   `json:"avgMs"`
	BestMs    float64   `json:"bestMs"`
	History   []float64 `json:"history"`
	Status    string    `json:"status"`
}

// SpeedMeta holds client ISP identity and active Anycast test server information.
type SpeedMeta struct {
	ClientIP       string `json:"clientIp"`
	ClientISP      string `json:"clientIsp"`
	ClientLocation string `json:"clientLocation"`
	ServerName     string `json:"serverName"`
	ServerLocation string `json:"serverLocation"`
}

// SpeedSnapshot holds telemetry for the staged Speed & Edge Benchmark.
type SpeedSnapshot struct {
	Seq               uint64         `json:"seq"`
	Running           bool           `json:"running"`
	Completed         bool           `json:"completed"`
	Progress          int            `json:"progress"`       // 0 to 100%
	Phase             string         `json:"phase"`          // "idle" | "ping" | "download" | "upload" | "complete" | "error"
	Error             string         `json:"error,omitempty"`
	ConnectionMode    string         `json:"connectionMode"` // "multi" | "single"
	ActiveStreams     int            `json:"activeStreams"`
	DownloadMbps      float64        `json:"downloadMbps"`
	PeakDownloadMbps  float64        `json:"peakDownloadMbps"`
	FinalDownloadMbps float64        `json:"finalDownloadMbps"`
	UploadMbps        float64        `json:"uploadMbps"`
	PeakUploadMbps    float64        `json:"peakUploadMbps"`
	FinalUploadMbps   float64        `json:"finalUploadMbps"`
	PingMs             float64        `json:"pingMs"`
	BestPingMs         float64        `json:"bestPingMs"`
	MaxPingMs          float64        `json:"maxPingMs"`
	LatencyP50Ms       float64        `json:"latencyP50Ms,omitempty"`
	LatencyP95Ms       float64        `json:"latencyP95Ms,omitempty"`
	LatencyP99Ms       float64        `json:"latencyP99Ms,omitempty"`
	LoadedPingMs       float64        `json:"loadedPingMs"`
	DownloadLatencyMs  float64        `json:"downloadLatencyMs"`
	DownloadLatencyP95 float64        `json:"downloadLatencyP95,omitempty"`
	UploadLatencyMs    float64        `json:"uploadLatencyMs"`
	UploadLatencyP95   float64        `json:"uploadLatencyP95,omitempty"`
	BufferbloatGrade   string         `json:"bufferbloatGrade,omitempty"`
	JitterMs           float64        `json:"jitterMs"`
	PacketLoss        float64        `json:"packetLoss"`
	TotalMB           float64        `json:"totalMB"`
	ClientIP          string         `json:"clientIp"`
	ClientISP         string         `json:"clientIsp"`
	ClientLocation    string         `json:"clientLocation"`
	ServerName        string         `json:"serverName"`
	ServerLocation    string         `json:"serverLocation"`
	DownloadHistory   []float64      `json:"downloadHistory"`
	UploadHistory     []float64      `json:"uploadHistory"`
	PingHistory       []float64      `json:"pingHistory"`
	EdgePings         []EdgePingItem `json:"edgePings"`
	UpdatedAt         string         `json:"updatedAt"`
}

// SpeedReport is kept for backward compatibility with single-shot calls.
type SpeedReport = SpeedSnapshot

var commonPortServices = map[int]string{
	21:    "FTP",
	22:    "SSH",
	25:    "SMTP",
	53:    "DNS",
	80:    "HTTP",
	110:   "POP3",
	143:   "IMAP",
	443:   "HTTPS",
	445:   "SMB",
	993:   "IMAPS",
	995:   "POP3S",
	1433:  "MSSQL",
	3306:  "MySQL",
	3389:  "RDP",
	5432:  "PostgreSQL",
	6379:  "Redis",
	8080:  "HTTP-Alt",
	8443:  "HTTPS-Alt",
	27017: "MongoDB",
}

// DefaultScanPorts returns the standard IT diagnostic TCP port list.
func DefaultScanPorts() []int {
	return []int{21, 22, 25, 53, 80, 110, 143, 443, 445, 993, 995, 1433, 3306, 3389, 5432, 6379, 8080, 8443}
}

// LookupDNS performs concurrent DNS lookups (A, AAAA, CNAME, MX, NS, TXT, PTR).
func LookupDNS(rawTarget string) (DNSReport, error) {
	target := strings.TrimSpace(rawTarget)
	target = strings.TrimPrefix(target, "https://")
	target = strings.TrimPrefix(target, "http://")
	if idx := strings.IndexByte(target, '/'); idx != -1 {
		target = target[:idx]
	}
	// Strip port if user accidentally entered host:port
	if h, _, err := net.SplitHostPort(target); err == nil {
		target = h
	}
	target = strings.TrimSpace(target)
	if target == "" {
		return DNSReport{}, errors.New("please enter a valid domain name or IP address")
	}

	start := time.Now()
	ctx, cancel := context.WithTimeout(context.Background(), 4*time.Second)
	defer cancel()

	var mu sync.Mutex
	records := make([]DNSRecordItem, 0, 16)
	addRec := func(t, v string, latMs float64) {
		mu.Lock()
		records = append(records, DNSRecordItem{
			Type:      t,
			Value:     v,
			LatencyMs: round1(latMs),
		})
		mu.Unlock()
	}

	if parsedIP := net.ParseIP(target); parsedIP != nil {
		q0 := time.Now()
		names, err := net.DefaultResolver.LookupAddr(ctx, target)
		qMs := float64(time.Since(q0).Microseconds()) / 1000.0
		if err == nil {
			for _, n := range names {
				addRec("PTR", strings.TrimSuffix(n, "."), qMs)
			}
		}
	} else {
		var wg sync.WaitGroup

		wg.Add(1)
		go func() {
			defer wg.Done()
			q0 := time.Now()
			ips, err := net.DefaultResolver.LookupIPAddr(ctx, target)
			qMs := float64(time.Since(q0).Microseconds()) / 1000.0
			if err == nil {
				for _, ip := range ips {
					if ip.IP.To4() != nil {
						addRec("A", ip.IP.String(), qMs)
					} else {
						addRec("AAAA", ip.IP.String(), qMs)
					}
				}
			}
		}()

		wg.Add(1)
		go func() {
			defer wg.Done()
			q0 := time.Now()
			cname, err := net.DefaultResolver.LookupCNAME(ctx, target)
			qMs := float64(time.Since(q0).Microseconds()) / 1000.0
			if err == nil && cname != "" && strings.TrimSuffix(cname, ".") != target {
				addRec("CNAME", strings.TrimSuffix(cname, "."), qMs)
			}
		}()

		wg.Add(1)
		go func() {
			defer wg.Done()
			q0 := time.Now()
			mxs, err := net.DefaultResolver.LookupMX(ctx, target)
			qMs := float64(time.Since(q0).Microseconds()) / 1000.0
			if err == nil {
				for _, mx := range mxs {
					addRec("MX", fmt.Sprintf("%d %s", mx.Pref, strings.TrimSuffix(mx.Host, ".")), qMs)
				}
			}
		}()

		wg.Add(1)
		go func() {
			defer wg.Done()
			q0 := time.Now()
			nss, err := net.DefaultResolver.LookupNS(ctx, target)
			qMs := float64(time.Since(q0).Microseconds()) / 1000.0
			if err == nil {
				for _, ns := range nss {
					addRec("NS", strings.TrimSuffix(ns.Host, "."), qMs)
				}
			}
		}()

		wg.Add(1)
		go func() {
			defer wg.Done()
			q0 := time.Now()
			txts, err := net.DefaultResolver.LookupTXT(ctx, target)
			qMs := float64(time.Since(q0).Microseconds()) / 1000.0
			if err == nil {
				for _, txt := range txts {
					addRec("TXT", txt, qMs)
				}
			}
		}()

		wg.Wait()
	}

	elapsedMs := float64(time.Since(start).Microseconds()) / 1000.0
	sort.Slice(records, func(i, j int) bool {
		if records[i].Type == records[j].Type {
			return records[i].Value < records[j].Value
		}
		return records[i].Type < records[j].Type
	})

	return DNSReport{
		Target:      target,
		QueryTimeMs: round1(elapsedMs),
		Records:     records,
		CheckedAt:   time.Now().Format("15:04:05"),
	}, nil
}

// ScanPorts concurrently probes TCP ports on host and measures connection handshake latency.
func ScanPorts(rawHost string, ports []int) (PortScanReport, error) {
	host := strings.TrimSpace(rawHost)
	host = strings.TrimPrefix(host, "https://")
	host = strings.TrimPrefix(host, "http://")
	if idx := strings.IndexByte(host, '/'); idx != -1 {
		host = host[:idx]
	}
	if h, _, err := net.SplitHostPort(host); err == nil {
		host = h
	}
	host = strings.TrimSpace(host)
	if host == "" {
		return PortScanReport{}, errors.New("please enter a valid host or IPv4 address")
	}
	if len(ports) == 0 {
		ports = DefaultScanPorts()
	} else {
		seen := make(map[int]struct{}, len(ports))
		validPorts := make([]int, 0, len(ports))
		for _, p := range ports {
			if p < 1 || p > 65535 {
				continue
			}
			if _, exists := seen[p]; exists {
				continue
			}
			seen[p] = struct{}{}
			validPorts = append(validPorts, p)
			if len(validPorts) >= 128 {
				break
			}
		}
		if len(validPorts) == 0 {
			validPorts = DefaultScanPorts()
		}
		ports = validPorts
	}

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	resolvedIP := host
	if net.ParseIP(host) == nil {
		addrs, err := net.DefaultResolver.LookupIPAddr(ctx, host)
		if err != nil || len(addrs) == 0 {
			return PortScanReport{}, fmt.Errorf("failed to resolve host %q", host)
		}
		resolvedIP = addrs[0].IP.String()
		for _, addr := range addrs {
			if ip4 := addr.IP.To4(); ip4 != nil {
				resolvedIP = ip4.String()
				break
			}
		}
	}

	start := time.Now()
	results := make([]PortResult, len(ports))
	var wg sync.WaitGroup
	sem := make(chan struct{}, 20)

	for i, p := range ports {
		wg.Add(1)
		go func(idx, port int) {
			defer wg.Done()
			sem <- struct{}{}
			defer func() { <-sem }()

			svc := commonPortServices[port]
			if svc == "" {
				svc = "TCP"
			}

			t0 := time.Now()
			addr := net.JoinHostPort(resolvedIP, fmt.Sprintf("%d", port))
			conn, err := net.DialTimeout("tcp", addr, 850*time.Millisecond)
			if err == nil {
				_ = conn.Close()
				rtt := float64(time.Since(t0).Microseconds()) / 1000.0
				results[idx] = PortResult{
					Port:      port,
					Service:   svc,
					State:     "open",
					LatencyMs: round1(rtt),
				}
			} else {
				results[idx] = PortResult{
					Port:      port,
					Service:   svc,
					State:     classifyPortDialError(err),
					LatencyMs: 0,
				}
			}
		}(i, p)
	}

	wg.Wait()

	openCount := 0
	for _, r := range results {
		if r.State == "open" {
			openCount++
		}
	}

	return PortScanReport{
		Host:       host,
		ResolvedIP: resolvedIP,
		OpenCount:  openCount,
		TotalPorts: len(results),
		DurationMs: round1(float64(time.Since(start).Microseconds()) / 1000.0),
		Results:    results,
	}, nil
}

func classifyPortDialError(err error) string {
	if err == nil {
		return "open"
	}
	if errors.Is(err, context.DeadlineExceeded) {
		return "filtered"
	}
	var netErr net.Error
	if errors.As(err, &netErr) && netErr.Timeout() {
		return "filtered"
	}
	return "closed"
}

type edgeStatInternal struct {
	provider string
	endpoint string
	lastMs   float64
	sumMs    float64
	bestMs   float64
	count    int
	history  []float64
	status   string
}

var uploadChunkPattern = bytes.Repeat([]byte{'M'}, 32*1024)

// meteredUploadReader streams bytes in bounded chunks while atomically counting sent bytes.
type meteredUploadReader struct {
	ctx     context.Context
	counter *atomic.Int64
	total   *atomic.Int64
	remain  int64
}

func (r *meteredUploadReader) Read(p []byte) (int, error) {
	select {
	case <-r.ctx.Done():
		return 0, r.ctx.Err()
	default:
	}
	if r.remain <= 0 {
		return 0, io.EOF
	}
	n := len(p)
	if n > 16*1024 {
		n = 16 * 1024
	}
	if n > len(uploadChunkPattern) {
		n = len(uploadChunkPattern)
	}
	if int64(n) > r.remain {
		n = int(r.remain)
	}
	copy(p[:n], uploadChunkPattern[:n])
	r.remain -= int64(n)
	r.counter.Add(int64(n))
	r.total.Add(int64(n))
	return n, nil
}

// connTracker records dialed TCP connections so cancellation immediately aborts blocked transfers.
type connTracker struct {
	mu     sync.Mutex
	conns  []net.Conn
	closed bool
}

func (ct *connTracker) track(c net.Conn) net.Conn {
	ct.mu.Lock()
	if ct.closed {
		ct.mu.Unlock()
		_ = c.Close()
		return c
	}
	ct.conns = append(ct.conns, c)
	ct.mu.Unlock()
	return c
}

func (ct *connTracker) setWriteBufferAll(sz int) {
	if sz <= 0 {
		return
	}
	ct.mu.Lock()
	conns := make([]net.Conn, len(ct.conns))
	copy(conns, ct.conns)
	ct.mu.Unlock()
	for _, c := range conns {
		if tc, ok := c.(*net.TCPConn); ok {
			_ = tc.SetWriteBuffer(sz)
		}
	}
}

func (ct *connTracker) closeAll() {
	ct.mu.Lock()
	if ct.closed {
		ct.mu.Unlock()
		return
	}
	ct.closed = true
	conns := ct.conns
	ct.conns = nil
	ct.mu.Unlock()
	for _, c := range conns {
		if c != nil {
			_ = c.Close()
		}
	}
}

func isAllowedSpeedURL(u *url.URL) bool {
	if u == nil || u.User != nil || !strings.EqualFold(u.Scheme, "https") {
		return false
	}
	host := strings.ToLower(u.Hostname())
	return host == "speed.cloudflare.com" || host == "1.1.1.1"
}

func isSpeedBenchmarkAddr(addr string) bool {
	host, _, err := net.SplitHostPort(addr)
	return err == nil && strings.EqualFold(host, "speed.cloudflare.com")
}

func resolvePinnedSpeedDialTarget(addr, pinnedAddr string) string {
	if pinnedAddr != "" && isSpeedBenchmarkAddr(addr) {
		return pinnedAddr
	}
	return addr
}

type speedClientConfig struct {
	readBuf      int
	writeBuf     int
	tracker      *connTracker
	network      string
	pinnedAddr   string
	sockWriteBuf int
}

// newPinnedSpeedHTTP1Client creates an HTTP/1.1 keep-alive transport optionally pinned to a
// verified IP stack/address while preserving TLS SNI and certificate validation on host.
func newPinnedSpeedHTTP1Client(cfg speedClientConfig) (*http.Transport, *http.Client) {
	baseDialer := &net.Dialer{
		Timeout:   4 * time.Second,
		KeepAlive: 30 * time.Second,
	}
	tr := &http.Transport{
		Proxy: http.ProxyFromEnvironment,
		DialContext: func(ctx context.Context, network, addr string) (net.Conn, error) {
			dialNet := network
			if cfg.network != "" {
				dialNet = cfg.network
			}
			dialTarget := resolvePinnedSpeedDialTarget(addr, cfg.pinnedAddr)
			c, err := baseDialer.DialContext(ctx, dialNet, dialTarget)
			if err != nil {
				return nil, err
			}
			if cfg.sockWriteBuf > 0 {
				if tc, ok := c.(*net.TCPConn); ok {
					_ = tc.SetWriteBuffer(cfg.sockWriteBuf)
				}
			}
			if cfg.tracker != nil {
				return cfg.tracker.track(c), nil
			}
			return c, nil
		},
		TLSClientConfig: &tls.Config{
			MinVersion: tls.VersionTLS12,
		},
		TLSHandshakeTimeout:   4 * time.Second,
		ResponseHeaderTimeout: 6 * time.Second,
		ExpectContinueTimeout: 1 * time.Second,
		TLSNextProto:          make(map[string]func(authority string, c *tls.Conn) http.RoundTripper),
		ForceAttemptHTTP2:     false,
		DisableCompression:    true,
		MaxIdleConns:          8,
		MaxIdleConnsPerHost:   8,
		IdleConnTimeout:       30 * time.Second,
		ReadBufferSize:        cfg.readBuf,
		WriteBufferSize:       cfg.writeBuf,
	}
	client := &http.Client{
		Transport: tr,
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			if len(via) >= 2 || !isAllowedSpeedURL(req.URL) {
				return errors.New("blocked unsafe or off-origin redirect")
			}
			return nil
		},
	}
	return tr, client
}

// newSpeedHTTP1Client creates an HTTP/1.1 keep-alive transport so each stream owns an independent TCP socket.
func newSpeedHTTP1Client(readBuf, writeBuf int, tracker *connTracker) (*http.Transport, *http.Client) {
	return newPinnedSpeedHTTP1Client(speedClientConfig{
		readBuf:  readBuf,
		writeBuf: writeBuf,
		tracker:  tracker,
	})
}

// setSpeedBrowserHeaders attaches standard browser headers required by speed.cloudflare.com WAF/CORS policy.
func setSpeedBrowserHeaders(req *http.Request) {
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36")
	req.Header.Set("Origin", "https://speed.cloudflare.com")
	req.Header.Set("Referer", "https://speed.cloudflare.com/")
	req.Header.Set("Accept", "*/*")
	req.Header.Set("Cache-Control", "no-store")
}

// parseSpeedMetaJSON decodes Cloudflare speed /meta responses supporting both object and string colo schemas.
func parseSpeedMetaJSON(data []byte) (SpeedMeta, bool) {
	fallback := SpeedMeta{
		ServerName:     "Cloudflare Anycast CDN",
		ServerLocation: "Global Edge Network",
	}
	var raw struct {
		ClientIP       string          `json:"clientIp"`
		ASN            int             `json:"asn"`
		AsOrganization string          `json:"asOrganization"`
		City           string          `json:"city"`
		Country        string          `json:"country"`
		Colo           json.RawMessage `json:"colo"`
	}
	if err := json.Unmarshal(data, &raw); err != nil {
		return fallback, false
	}

	isp := strings.TrimSpace(raw.AsOrganization)
	if isp == "" && raw.ASN > 0 {
		isp = fmt.Sprintf("AS%d", raw.ASN)
	}
	locParts := make([]string, 0, 2)
	if c := strings.TrimSpace(raw.City); c != "" {
		locParts = append(locParts, c)
	}
	if co := strings.TrimSpace(raw.Country); co != "" {
		locParts = append(locParts, co)
	}

	var coloCode, coloCity, coloCountry string
	if len(raw.Colo) > 0 && raw.Colo[0] == '{' {
		var coloObj struct {
			Iata string `json:"iata"`
			City string `json:"city"`
			Cca2 string `json:"cca2"`
		}
		if json.Unmarshal(raw.Colo, &coloObj) == nil {
			coloCode = strings.TrimSpace(coloObj.Iata)
			coloCity = strings.TrimSpace(coloObj.City)
			coloCountry = strings.TrimSpace(coloObj.Cca2)
		}
	} else if len(raw.Colo) > 0 && raw.Colo[0] == '"' {
		var coloStr string
		if json.Unmarshal(raw.Colo, &coloStr) == nil {
			coloCode = strings.TrimSpace(coloStr)
		}
	}

	srvName := fallback.ServerName
	srvLoc := fallback.ServerLocation
	if coloCode != "" {
		srvName = fmt.Sprintf("Cloudflare Anycast (%s)", coloCode)
		if coloCity != "" && coloCountry != "" {
			srvLoc = fmt.Sprintf("%s, %s • Anycast Edge", coloCity, coloCountry)
		} else if coloCity != "" {
			srvLoc = fmt.Sprintf("%s • Anycast Edge", coloCity)
		} else {
			srvLoc = fmt.Sprintf("POP %s • Anycast Edge", coloCode)
		}
	}

	ip := strings.TrimSpace(raw.ClientIP)
	if ip == "" && isp == "" && coloCode == "" {
		return fallback, false
	}
	return SpeedMeta{
		ClientIP:       ip,
		ClientISP:      isp,
		ClientLocation: strings.Join(locParts, ", "),
		ServerName:     srvName,
		ServerLocation: srvLoc,
	}, true
}

type speedEndpointCandidate struct {
	network    string // "tcp4" | "tcp6" | ""
	remoteAddr string // resolved ip:port (or [ipv6]:port)
	rttMs      float64
	meta       SpeedMeta
	redirected bool
	ok         bool
}

func annotateSpeedMetaTransport(meta SpeedMeta, network string) SpeedMeta {
	var tag string
	switch network {
	case "tcp4":
		tag = "IPv4"
	case "tcp6":
		tag = "IPv6"
	default:
		return meta
	}
	if strings.Contains(meta.ServerLocation, "Anycast Edge") {
		meta.ServerLocation = strings.Replace(meta.ServerLocation, "Anycast Edge", "Anycast "+tag, 1)
	} else if meta.ServerLocation != "" && !strings.Contains(meta.ServerLocation, tag) {
		meta.ServerLocation = meta.ServerLocation + " • " + tag
	}
	return meta
}

func measureBareTCPRTT(ctx context.Context, network, addr string, attempts int) (float64, bool) {
	if addr == "" || attempts <= 0 {
		return 0, false
	}
	if network == "" {
		network = "tcp"
	}
	var best float64
	for i := 0; i < attempts; i++ {
		if ctx.Err() != nil {
			break
		}
		pCtx, cancel := context.WithTimeout(ctx, 850*time.Millisecond)
		dialer := &net.Dialer{Timeout: 800 * time.Millisecond}
		t0 := time.Now()
		conn, err := dialer.DialContext(pCtx, network, addr)
		cancel()
		if err == nil {
			_ = conn.Close()
			rtt := float64(time.Since(t0).Microseconds()) / 1000.0
			if rtt > 0 && (best == 0 || rtt < best) {
				best = rtt
			}
		}
	}
	return best, best > 0
}

func probeStackCandidate(ctx context.Context, netFamily string) speedEndpointCandidate {
	reqCtx, cancel := context.WithTimeout(ctx, 2200*time.Millisecond)
	defer cancel()

	tracker := &connTracker{}
	defer tracker.closeAll()

	tr, cl := newPinnedSpeedHTTP1Client(speedClientConfig{
		readBuf:  16 * 1024,
		writeBuf: 16 * 1024,
		tracker:  tracker,
		network:  netFamily,
	})
	defer tr.CloseIdleConnections()

	origDial := tr.DialContext
	var remoteMu sync.Mutex
	var remoteAddr string
	tr.DialContext = func(dCtx context.Context, network, addr string) (net.Conn, error) {
		c, err := origDial(dCtx, network, addr)
		if err == nil && c != nil && c.RemoteAddr() != nil && isSpeedBenchmarkAddr(addr) {
			remoteMu.Lock()
			if remoteAddr == "" {
				remoteAddr = c.RemoteAddr().String()
			}
			remoteMu.Unlock()
		}
		return c, err
	}

	req, err := http.NewRequestWithContext(reqCtx, http.MethodGet, "https://speed.cloudflare.com/meta", nil)
	if err != nil {
		return speedEndpointCandidate{}
	}
	setSpeedBrowserHeaders(req)

	tStart := time.Now()
	resp, doErr := cl.Do(req)
	if doErr != nil {
		if strings.Contains(doErr.Error(), "blocked unsafe or off-origin redirect") {
			return speedEndpointCandidate{network: netFamily, redirected: true}
		}
		return speedEndpointCandidate{}
	}
	defer resp.Body.Close()

	if resp.Request != nil && !isAllowedSpeedURL(resp.Request.URL) {
		_, _ = io.Copy(io.Discard, io.LimitReader(resp.Body, 4096))
		return speedEndpointCandidate{network: netFamily, redirected: true}
	}
	if resp.StatusCode >= 300 && resp.StatusCode < 400 {
		_, _ = io.Copy(io.Discard, io.LimitReader(resp.Body, 4096))
		return speedEndpointCandidate{network: netFamily, redirected: true}
	}
	if resp.StatusCode != http.StatusOK {
		return speedEndpointCandidate{}
	}

	body, err := io.ReadAll(io.LimitReader(resp.Body, 16*1024))
	if err != nil {
		return speedEndpointCandidate{}
	}
	httpElapsedMs := float64(time.Since(tStart).Microseconds()) / 1000.0

	meta, ok := parseSpeedMetaJSON(body)
	if !ok {
		return speedEndpointCandidate{}
	}

	remoteMu.Lock()
	resolved := remoteAddr
	remoteMu.Unlock()

	rttMs := httpElapsedMs
	if bareRTT, gotBare := measureBareTCPRTT(reqCtx, netFamily, resolved, 2); gotBare {
		rttMs = bareRTT
	}

	return speedEndpointCandidate{
		network:    netFamily,
		remoteAddr: resolved,
		rttMs:      rttMs,
		meta:       meta,
		ok:         true,
	}
}

func chooseOptimalEndpoint(candidates ...speedEndpointCandidate) (speedEndpointCandidate, bool) {
	var valid []speedEndpointCandidate
	for _, c := range candidates {
		if c.redirected {
			return speedEndpointCandidate{redirected: true}, false
		}
		if c.ok {
			valid = append(valid, c)
		}
	}
	if len(valid) == 0 {
		return speedEndpointCandidate{}, false
	}
	best := valid[0]
	for _, c := range valid[1:] {
		if c.rttMs <= 0 {
			continue
		}
		if best.rttMs <= 0 {
			best = c
			continue
		}
		// Prefer IPv4 on near-ties (<= 3ms) to avoid IPv6 transit/PMTU drops; otherwise strictly pick lowest RTT POP.
		if best.network == "tcp4" && c.network == "tcp6" && (best.rttMs-c.rttMs) <= 3.0 {
			continue
		}
		if c.network == "tcp4" && best.network == "tcp6" && (c.rttMs-best.rttMs) <= 3.0 {
			best = c
			continue
		}
		if c.rttMs < best.rttMs {
			best = c
		}
	}
	return best, true
}

// selectOptimalSpeedEndpoint races IPv4 vs IPv6 to lock onto the closest/lowest-RTT Anycast POP.
func selectOptimalSpeedEndpoint(ctx context.Context) speedEndpointCandidate {
	var (
		wg    sync.WaitGroup
		cand4 speedEndpointCandidate
		cand6 speedEndpointCandidate
	)
	wg.Add(2)
	go func() {
		defer wg.Done()
		cand4 = probeStackCandidate(ctx, "tcp4")
	}()
	go func() {
		defer wg.Done()
		cand6 = probeStackCandidate(ctx, "tcp6")
	}()
	wg.Wait()

	if best, ok := chooseOptimalEndpoint(cand4, cand6); ok {
		best.meta = annotateSpeedMetaTransport(best.meta, best.network)
		return best
	} else if best.redirected {
		return best
	}

	// Proxy or dual-stack fallback without forcing address family
	if fb := probeStackCandidate(ctx, ""); fb.ok || fb.redirected {
		fb.meta = annotateSpeedMetaTransport(fb.meta, fb.network)
		return fb
	}
	return speedEndpointCandidate{}
}

// FetchSpeedMeta discovers client ISP, public IP, and lowest-RTT Cloudflare Anycast server POP.
func FetchSpeedMeta(ctx context.Context) SpeedMeta {
	fallback := SpeedMeta{
		ServerName:     "Cloudflare Anycast CDN",
		ServerLocation: "Global Edge Network",
	}
	if chosen := selectOptimalSpeedEndpoint(ctx); chosen.ok {
		return chosen.meta
	}
	return fallback
}

func computeIntervalMbps(deltaBytes int64, deltaSec float64) float64 {
	if deltaBytes <= 0 || deltaSec <= 0 {
		return 0
	}
	return (float64(deltaBytes) * 8.0) / (deltaSec * 1_000_000.0)
}

func computeDownloadPlan(recentMbps, rttMs float64, mode string) (targetStreams int, chunkBytes int64) {
	if mode == "single" {
		targetStreams = 1
		switch {
		case recentMbps >= 250:
			chunkBytes = 88_000_000
		case recentMbps >= 100:
			chunkBytes = 64_000_000
		case recentMbps >= 25:
			chunkBytes = 40_000_000
		default:
			chunkBytes = 16_000_000
		}
		return targetStreams, chunkBytes
	}

	switch {
	case recentMbps >= 300:
		targetStreams = 16
		chunkBytes = 88_000_000
	case recentMbps >= 140:
		targetStreams = 10
		chunkBytes = 64_000_000
	case recentMbps >= 25:
		targetStreams = 6
		chunkBytes = 40_000_000
	default:
		targetStreams = 4
		chunkBytes = 16_000_000
	}

	// BDP compensation: higher-RTT regional/international POPs benefit from extra parallel flows.
	if rttMs >= 35.0 && targetStreams < 16 {
		targetStreams += 2
		if targetStreams > 16 {
			targetStreams = 16
		}
	}
	return targetStreams, chunkBytes
}

func computeUploadPlan(recentMbps, rttMs float64, mode string) (targetStreams int, chunkBytes int64, sockWriteBuf int) {
	if mode == "single" {
		targetStreams = 1
		switch {
		case recentMbps >= 200:
			return 1, 20 * 1024 * 1024, 384 * 1024
		case recentMbps >= 80:
			return 1, 12 * 1024 * 1024, 192 * 1024
		case recentMbps >= 25:
			return 1, 6 * 1024 * 1024, 96 * 1024
		case recentMbps >= 8:
			return 1, 2 * 1024 * 1024, 64 * 1024
		default:
			return 1, 1 * 1024 * 1024, 64 * 1024
		}
	}

	switch {
	case recentMbps >= 250:
		targetStreams = 16
		chunkBytes = 24 * 1024 * 1024
		sockWriteBuf = 384 * 1024
	case recentMbps >= 110:
		targetStreams = 12
		chunkBytes = 16 * 1024 * 1024
		sockWriteBuf = 192 * 1024
	case recentMbps >= 45:
		targetStreams = 8
		chunkBytes = 10 * 1024 * 1024
		sockWriteBuf = 64 * 1024
	case recentMbps >= 15:
		targetStreams = 6
		chunkBytes = 4 * 1024 * 1024
		sockWriteBuf = 64 * 1024
	case recentMbps >= 5:
		targetStreams = 6
		chunkBytes = 1536 * 1024
		sockWriteBuf = 64 * 1024
	default:
		targetStreams = 4
		chunkBytes = 512 * 1024
		sockWriteBuf = 64 * 1024
	}

	if rttMs >= 35.0 {
		if targetStreams < 16 {
			targetStreams += 2
			if targetStreams > 16 {
				targetStreams = 16
			}
		}
		if recentMbps >= 25 && sockWriteBuf < 128*1024 {
			sockWriteBuf = 128 * 1024
		}
	}
	return targetStreams, chunkBytes, sockWriteBuf
}

type rollingDeltaSample struct {
	at    time.Time
	bytes int64
	dt    float64
}

// speedWindowTracker provides Ookla-grade rolling display smoothing and fixed time-slice collection.
type speedWindowTracker struct {
	phaseStart    time.Time
	warmupDur     time.Duration
	sliceDur      time.Duration
	maxSlices     int
	windowDur     time.Duration
	lastSampleAt  time.Time
	lastBytes     int64
	nextSliceAt   time.Time
	sliceStartByt int64
	inSteady      bool
	emaMbps       float64
	peakMbps      float64
	ring          []rollingDeltaSample
	slices        []float64
}

func newSpeedWindowTracker(now time.Time, warmupDur, sliceDur time.Duration, maxSlices int) *speedWindowTracker {
	return &speedWindowTracker{
		phaseStart:   now,
		warmupDur:    warmupDur,
		sliceDur:     sliceDur,
		maxSlices:    maxSlices,
		windowDur:    1800 * time.Millisecond,
		lastSampleAt: now,
		nextSliceAt:  now.Add(warmupDur + sliceDur),
		ring:         make([]rollingDeltaSample, 0, 32),
		slices:       make([]float64, 0, maxSlices+2),
	}
}

func (st *speedWindowTracker) update(now time.Time, totalPhaseBytes int64) (liveMbps float64, peakMbps float64, historyPoint float64, recordHist bool) {
	dt := now.Sub(st.lastSampleAt).Seconds()
	if dt < 0.03 {
		return st.emaMbps, st.peakMbps, 0, false
	}

	delta := totalPhaseBytes - st.lastBytes
	if delta < 0 {
		delta = 0
	}
	st.lastBytes = totalPhaseBytes
	st.lastSampleAt = now

	st.ring = append(st.ring, rollingDeltaSample{
		at:    now,
		bytes: delta,
		dt:    dt,
	})
	cutoff := now.Add(-st.windowDur)
	trim := 0
	for trim < len(st.ring)-1 && st.ring[trim].at.Before(cutoff) {
		trim++
	}
	if trim > 0 {
		st.ring = st.ring[trim:]
	}

	var sumBytes int64
	var sumDt float64
	for _, item := range st.ring {
		sumBytes += item.bytes
		sumDt += item.dt
	}

	elapsed := now.Sub(st.phaseStart)
	effectiveDt := sumDt
	if elapsed < st.warmupDur && effectiveDt < 0.55 {
		// Prevent initial socket buffer prefill from creating an artificial warmup spike & dip.
		effectiveDt = 0.55
	}

	rollingMbps := 0.0
	if effectiveDt > 0 {
		rollingMbps = (float64(sumBytes) * 8.0) / (effectiveDt * 1_000_000.0)
	}

	if elapsed < st.warmupDur {
		// Time-constant normalized glide-in from zero during initial TCP slow-start.
		alpha := 1.0 - math.Exp(-dt/0.28)
		st.emaMbps += (rollingMbps - st.emaMbps) * alpha
	} else {
		// Time-constant normalized steady damping for a jitter-free gauge needle.
		alpha := 1.0 - math.Exp(-dt/0.45)
		st.emaMbps += (rollingMbps - st.emaMbps) * alpha
		if !st.inSteady {
			st.inSteady = true
			st.sliceStartByt = totalPhaseBytes
			st.nextSliceAt = now.Add(st.sliceDur)
		}
		if st.emaMbps > st.peakMbps {
			st.peakMbps = st.emaMbps
		}
		missed := 0
		sliceCursor := st.nextSliceAt
		for len(st.slices)+missed < st.maxSlices && !now.Before(sliceCursor) {
			missed++
			sliceCursor = sliceCursor.Add(st.sliceDur)
		}
		if missed > 0 {
			sliceBytes := totalPhaseBytes - st.sliceStartByt
			if sliceBytes < 0 {
				sliceBytes = 0
			}
			windowStart := st.nextSliceAt.Add(-st.sliceDur)
			actualSpanSec := now.Sub(windowStart).Seconds()
			minSpanSec := float64(missed) * st.sliceDur.Seconds()
			if actualSpanSec < minSpanSec {
				actualSpanSec = minSpanSec
			}
			sliceMbps := (float64(sliceBytes) * 8.0) / (actualSpanSec * 1_000_000.0)
			for m := 0; m < missed; m++ {
				st.slices = append(st.slices, sliceMbps)
				st.nextSliceAt = st.nextSliceAt.Add(st.sliceDur)
			}
			st.sliceStartByt = totalPhaseBytes
		}
	}

	return st.emaMbps, st.peakMbps, st.emaMbps, st.emaMbps > 0 || len(st.slices) > 0
}

// RunLiveSpeedBenchmark executes a staged Speedtest-compliant benchmark using default multi-connection mode.
func RunLiveSpeedBenchmark(ctx context.Context, onUpdate func(SpeedSnapshot)) {
	RunLiveSpeedBenchmarkWithMode(ctx, "multi", onUpdate)
}

// RunLiveSpeedBenchmarkWithMode runs an Ookla Speedtest-calibrated benchmark in "multi" or "single" TCP mode.
func RunLiveSpeedBenchmarkWithMode(ctx context.Context, rawMode string, onUpdate func(SpeedSnapshot)) {
	mode := strings.ToLower(strings.TrimSpace(rawMode))
	if mode != "single" {
		mode = "multi"
	}

	edgeDefs := []struct {
		provider string
		endpoint string
	}{
		{"Cloudflare Anycast Edge", "1.1.1.1:443"},
		{"Google Public Edge", "8.8.8.8:443"},
		{"Quad9 Security Edge", "9.9.9.9:443"},
		{"OpenDNS / Cisco Edge", "208.67.222.222:443"},
	}

	var mu sync.Mutex
	edges := make([]*edgeStatInternal, len(edgeDefs))
	for i, d := range edgeDefs {
		edges[i] = &edgeStatInternal{
			provider: d.provider,
			endpoint: d.endpoint,
			status:   "probing",
			history:  make([]float64, 0, 40),
		}
	}

	var (
		phase             = "ping"
		completed         = false
		runErrMsg         = ""
		progress          = 2
		activeStreams     = 1
		downloadMbps      float64
		peakDownloadMbps  float64
		finalDownloadMbps float64
		uploadMbps        float64
		peakUploadMbps    float64
		finalUploadMbps   float64
		pingMs             float64
		bestPingMs         float64
		maxPingMs          float64
		latencyP50Ms       float64
		latencyP95Ms       float64
		latencyP99Ms       float64
		loadedPingMs       float64
		downloadLatencyMs  float64
		downloadLatencyP95 float64
		uploadLatencyMs    float64
		uploadLatencyP95   float64
		bufferbloatGrade   string
		jitterMs           float64
		packetLoss        float64
		meta              = SpeedMeta{ServerName: "Cloudflare Anycast CDN", ServerLocation: "Global Edge Network"}
		downHistory       = make([]float64, 0, 90)
		upHistory         = make([]float64, 0, 90)
		pingHistory       = make([]float64, 0, 40)
		totalBytes        atomic.Int64
	)
	if mode == "multi" {
		activeStreams = 4
	}

	buildSnapshot := func() SpeedSnapshot {
		mu.Lock()
		defer mu.Unlock()

		edgeItems := make([]EdgePingItem, len(edges))
		for i, e := range edges {
			avg := 0.0
			if e.count > 0 {
				avg = e.sumMs / float64(e.count)
			}
			hCopy := make([]float64, len(e.history))
			copy(hCopy, e.history)
			edgeItems[i] = EdgePingItem{
				Provider:  e.provider,
				Endpoint:  e.endpoint,
				LatencyMs: round1(e.lastMs),
				AvgMs:     round1(avg),
				BestMs:    round1(e.bestMs),
				History:   hCopy,
				Status:    e.status,
			}
		}

		dCopy := make([]float64, len(downHistory))
		copy(dCopy, downHistory)
		uCopy := make([]float64, len(upHistory))
		copy(uCopy, upHistory)
		pCopy := make([]float64, len(pingHistory))
		copy(pCopy, pingHistory)

		return SpeedSnapshot{
			Running:           ctx.Err() == nil && !completed && runErrMsg == "",
			Completed:         completed,
			Progress:          progress,
			Phase:             phase,
			Error:             runErrMsg,
			ConnectionMode:    mode,
			ActiveStreams:     activeStreams,
			DownloadMbps:      round1(downloadMbps),
			PeakDownloadMbps:  round1(peakDownloadMbps),
			FinalDownloadMbps: round1(finalDownloadMbps),
			UploadMbps:        round1(uploadMbps),
			PeakUploadMbps:    round1(peakUploadMbps),
			FinalUploadMbps:   round1(finalUploadMbps),
			PingMs:             round1(pingMs),
			BestPingMs:         round1(bestPingMs),
			MaxPingMs:          round1(maxPingMs),
			LatencyP50Ms:       round1(latencyP50Ms),
			LatencyP95Ms:       round1(latencyP95Ms),
			LatencyP99Ms:       round1(latencyP99Ms),
			LoadedPingMs:       round1(loadedPingMs),
			DownloadLatencyMs:  round1(downloadLatencyMs),
			DownloadLatencyP95: round1(downloadLatencyP95),
			UploadLatencyMs:    round1(uploadLatencyMs),
			UploadLatencyP95:   round1(uploadLatencyP95),
			BufferbloatGrade:   bufferbloatGrade,
			JitterMs:           round1(jitterMs),
			PacketLoss:        round1(packetLoss),
			TotalMB:           round1(float64(totalBytes.Load()) / (1024.0 * 1024.0)),
			ClientIP:          meta.ClientIP,
			ClientISP:         meta.ClientISP,
			ClientLocation:    meta.ClientLocation,
			ServerName:        meta.ServerName,
			ServerLocation:    meta.ServerLocation,
			DownloadHistory:   dCopy,
			UploadHistory:     uCopy,
			PingHistory:       pCopy,
			EdgePings:         edgeItems,
			UpdatedAt:         time.Now().Format("15:04:05"),
		}
	}

	emit := func() {
		if onUpdate != nil && ctx.Err() == nil {
			onUpdate(buildSnapshot())
		}
	}

	failWithError := func(msg string) {
		mu.Lock()
		phase = "error"
		completed = false
		runErrMsg = msg
		mu.Unlock()
		emit()
	}

	probeEdges := func() {
		var wg sync.WaitGroup
		for i := range edges {
			wg.Add(1)
			go func(idx int) {
				defer wg.Done()
				mu.Lock()
				ep := edges[idx].endpoint
				mu.Unlock()

				dialer := &net.Dialer{Timeout: 950 * time.Millisecond}
				t0 := time.Now()
				conn, err := dialer.DialContext(ctx, "tcp", ep)
				if err == nil {
					_ = conn.Close()
					rtt := float64(time.Since(t0).Microseconds()) / 1000.0

					mu.Lock()
					e := edges[idx]
					e.lastMs = rtt
					e.sumMs += rtt
					e.count++
					if e.count == 1 || rtt < e.bestMs {
						e.bestMs = rtt
					}
					e.status = "online"
					e.history = append(e.history, round1(rtt))
					if len(e.history) > 40 {
						e.history = e.history[len(e.history)-40:]
					}
					mu.Unlock()
				} else if ctx.Err() == nil {
					mu.Lock()
					if edges[idx].count == 0 {
						edges[idx].status = "timeout"
					}
					mu.Unlock()
				}
			}(i)
		}
		wg.Wait()
	}

	// Security preflight helper to detect captive portals or unsafe redirects on speed.cloudflare.com
	checkCaptivePortalOrRedirect := func(probeCtx context.Context, chosen speedEndpointCandidate) bool {
		pCtx, cancel := context.WithTimeout(probeCtx, 1500*time.Millisecond)
		defer cancel()

		pTracker := &connTracker{}
		defer pTracker.closeAll()
		pTr, pClient := newPinnedSpeedHTTP1Client(speedClientConfig{
			readBuf:    8 * 1024,
			writeBuf:   8 * 1024,
			tracker:    pTracker,
			network:    chosen.network,
			pinnedAddr: chosen.remoteAddr,
		})
		defer pTr.CloseIdleConnections()

		req, err := http.NewRequestWithContext(pCtx, http.MethodGet, "https://speed.cloudflare.com/__down?bytes=0", nil)
		if err != nil {
			return false
		}
		setSpeedBrowserHeaders(req)
		resp, doErr := pClient.Do(req)
		if doErr != nil {
			return strings.Contains(doErr.Error(), "blocked unsafe or off-origin redirect")
		}
		if resp != nil {
			_, _ = io.Copy(io.Discard, io.LimitReader(resp.Body, 4096))
			_ = resp.Body.Close()
			if resp.Request != nil && !isAllowedSpeedURL(resp.Request.URL) {
				return true
			}
			if resp.StatusCode >= 300 && resp.StatusCode < 400 {
				return true
			}
		}
		return false
	}

	// ------------------------------------------------------------------
	// STAGE 1: Fastest Stack/POP Discovery (IPv4 vs IPv6) + Idle Ping
	// ------------------------------------------------------------------
	phase = "ping"
	progress = 2

	var chosen speedEndpointCandidate
	var preflightWg sync.WaitGroup
	preflightWg.Add(2)
	go func() {
		defer preflightWg.Done()
		probeEdges()
	}()
	go func() {
		defer preflightWg.Done()
		chosen = selectOptimalSpeedEndpoint(ctx)
	}()
	preflightWg.Wait()

	if ctx.Err() != nil {
		return
	}
	if chosen.redirected || checkCaptivePortalOrRedirect(ctx, chosen) {
		failWithError("Blocked unsafe redirect or captive portal while connecting to benchmark server.")
		return
	}
	if chosen.ok {
		mu.Lock()
		meta = chosen.meta
		mu.Unlock()
	}
	emit()

	// Pure 1-RTT TCP SYN->SYN-ACK probe locked to the exact selected benchmark IP
	// (avoids measuring a different POP than the download/upload streams).
	probeDirectTCPRTT := func(probeCtx context.Context) (float64, bool) {
		if chosen.remoteAddr != "" {
			dialNet := chosen.network
			if dialNet == "" {
				dialNet = "tcp"
			}
			pCtx, cancel := context.WithTimeout(probeCtx, 900*time.Millisecond)
			dialer := &net.Dialer{Timeout: 850 * time.Millisecond}
			t0 := time.Now()
			conn, err := dialer.DialContext(pCtx, dialNet, chosen.remoteAddr)
			cancel()
			if err == nil {
				_ = conn.Close()
				rtt := float64(time.Since(t0).Microseconds()) / 1000.0
				if rtt > 0 {
					return rtt, true
				}
			}
			return 0, false
		}

		targets := [2]string{"1.1.1.1:443", "8.8.8.8:443"}
		for _, ep := range targets {
			pCtx, cancel := context.WithTimeout(probeCtx, 900*time.Millisecond)
			dialer := &net.Dialer{Timeout: 850 * time.Millisecond}
			t0 := time.Now()
			conn, err := dialer.DialContext(pCtx, "tcp", ep)
			cancel()
			if err == nil {
				_ = conn.Close()
				rtt := float64(time.Since(t0).Microseconds()) / 1000.0
				if rtt > 0 {
					return rtt, true
				}
			}
		}
		return 0, false
	}

	// Measure Idle Ping on a clean, unloaded link without concurrent background bursts
	idleSamples := make([]float64, 0, 14)
	idleAttempts := 0
	idleFailures := 0
	const totalIdleProbes = 12

	for r := 0; r < totalIdleProbes; r++ {
		select {
		case <-ctx.Done():
			return
		case <-time.After(150 * time.Millisecond):
		}

		idleAttempts++
		rtt, ok := probeDirectTCPRTT(ctx)

		mu.Lock()
		if ok && rtt > 0 {
			idleSamples = append(idleSamples, rtt)
			avg, best, mx, jit := computePingStats(idleSamples)
			pingMs = avg
			bestPingMs = best
			maxPingMs = mx
			jitterMs = jit
			latencyP50Ms = computePercentile(idleSamples, 50)
			latencyP95Ms = computePercentile(idleSamples, 95)
			latencyP99Ms = computePercentile(idleSamples, 99)
			pingHistory = append(pingHistory, round1(rtt))
			if len(pingHistory) > 40 {
				pingHistory = pingHistory[len(pingHistory)-40:]
			}
		} else {
			idleFailures++
		}
		if idleAttempts > 0 {
			packetLoss = (float64(idleFailures) / float64(idleAttempts)) * 100.0
		}
		progress = 3 + ((r + 1) * 9 / totalIdleProbes)
		mu.Unlock()
		emit()
	}

	onlineEdges := 0
	mu.Lock()
	for _, e := range edges {
		if e.status == "online" {
			onlineEdges++
		}
	}
	mu.Unlock()
	if len(idleSamples) == 0 && onlineEdges == 0 {
		failWithError("Unable to reach speed benchmark servers. Check your internet connection, proxy, or firewall.")
		return
	}

	progress = 12
	emit()

	// Helper to continuously track loaded ping (Download Latency / Upload Latency) using the same 1-RTT TCP yardstick
	startLoadedPingMonitor := func(pCtx context.Context, isUpload bool) {
		go func() {
			var loadedSamples []float64
			ticker := time.NewTicker(450 * time.Millisecond)
			defer ticker.Stop()
			var inFlight atomic.Bool
			for {
				select {
				case <-pCtx.Done():
					return
				case <-ticker.C:
					if !inFlight.CompareAndSwap(false, true) {
						continue
					}
					go func() {
						defer inFlight.Store(false)
						rtt, ok := probeDirectTCPRTT(pCtx)
						if !ok || rtt <= 0 || pCtx.Err() != nil {
							return
						}
						mu.Lock()
						loadedSamples = append(loadedSamples, rtt)
						avgLoaded, _, _, _ := computePingStats(loadedSamples)
						p95Loaded := computePercentile(loadedSamples, 95)
						loadedPingMs = avgLoaded
						if isUpload {
							uploadLatencyMs = avgLoaded
							uploadLatencyP95 = p95Loaded
						} else {
							downloadLatencyMs = avgLoaded
							downloadLatencyP95 = p95Loaded
						}
						if grade := ComputeBufferbloatGrade(pingMs, downloadLatencyMs, uploadLatencyMs); grade != "" {
							bufferbloatGrade = grade
						}
						mu.Unlock()
					}()
				}
			}
		}()
	}

	// ------------------------------------------------------------------
	// STAGE 2: Adaptive Multi-Stream Download (1.5s Warmup + 12.0s Steady)
	// ------------------------------------------------------------------
	phase = "download"
	mu.Lock()
	activeStreams = 1
	if mode == "multi" {
		activeStreams = 4
	}
	mu.Unlock()
	emit()

	downCtx, cancelDown := context.WithCancel(ctx)
	downTracker := &connTracker{}
	go func() {
		<-downCtx.Done()
		downTracker.closeAll()
	}()

	var downChunkBytes atomic.Int64
	downChunkBytes.Store(16_000_000) // Start large enough to prevent premature EOF gaps during initial calibration

	var downWindowBytes atomic.Int64
	var downWg sync.WaitGroup
	downStartGate := make(chan struct{})

	spawnDownloadWorker := func(workerID int, warmDone *sync.WaitGroup, gateCh <-chan struct{}) {
		downWg.Add(1)
		go func(id int, wDone *sync.WaitGroup) {
			defer downWg.Done()
			tr, cl := newPinnedSpeedHTTP1Client(speedClientConfig{
				readBuf:    256 * 1024,
				writeBuf:   32 * 1024,
				tracker:    downTracker,
				network:    chosen.network,
				pinnedAddr: chosen.remoteAddr,
			})
			defer tr.CloseIdleConnections()

			wCtx, wCancel := context.WithTimeout(downCtx, 1200*time.Millisecond)
			req, err := http.NewRequestWithContext(wCtx, http.MethodGet, "https://speed.cloudflare.com/__down?bytes=0", nil)
			if err == nil {
				setSpeedBrowserHeaders(req)
				if resp, rErr := cl.Do(req); rErr == nil && resp != nil {
					_, _ = io.Copy(io.Discard, resp.Body)
					_ = resp.Body.Close()
				}
			}
			wCancel()
			if wDone != nil {
				wDone.Done()
			}
			if gateCh != nil {
				select {
				case <-gateCh:
				case <-downCtx.Done():
					return
				}
			}

			buf := make([]byte, 256*1024)
			for downCtx.Err() == nil {
				// Stagger per-worker chunk sizes so keep-alive request turnarounds never align across all streams.
				baseChunk := downChunkBytes.Load()
				chunkSize := baseChunk + int64(id%4)*(baseChunk/8)
				targetURL := fmt.Sprintf("https://speed.cloudflare.com/__down?bytes=%d&w=%d_%d", chunkSize, id, time.Now().UnixNano())
				req, err := http.NewRequestWithContext(downCtx, http.MethodGet, targetURL, nil)
				if err != nil {
					return
				}
				setSpeedBrowserHeaders(req)
				resp, err := cl.Do(req)
				if err != nil {
					select {
					case <-downCtx.Done():
						return
					case <-time.After(150 * time.Millisecond):
						continue
					}
				}
				if resp.StatusCode != http.StatusOK || (resp.Request != nil && !isAllowedSpeedURL(resp.Request.URL)) {
					_, _ = io.Copy(io.Discard, io.LimitReader(resp.Body, 4096))
					_ = resp.Body.Close()
					select {
					case <-downCtx.Done():
						return
					case <-time.After(350 * time.Millisecond):
						continue
					}
				}
				for downCtx.Err() == nil {
					n, rErr := resp.Body.Read(buf)
					if n > 0 {
						downWindowBytes.Add(int64(n))
						totalBytes.Add(int64(n))
					}
					if rErr != nil {
						break
					}
				}
				_ = resp.Body.Close()
			}
		}(workerID, warmDone)
	}

	initialDownCount := 1
	if mode == "multi" {
		initialDownCount = 4
	}
	var warmWg sync.WaitGroup
	for s := 0; s < initialDownCount; s++ {
		warmWg.Add(1)
		spawnDownloadWorker(s, &warmWg, downStartGate)
	}
	warmWg.Wait()

	startLoadedPingMonitor(downCtx, false)

	downStart := time.Now()
	close(downStartGate)
	const downCalAt = 750 * time.Millisecond
	const downCalAt2 = 1600 * time.Millisecond
	const downWarmup = 3000 * time.Millisecond // Let calibrated streams stabilize past initial queue overshoot before steady slices
	const downSteadySlice = 500 * time.Millisecond
	const downSliceCount = 20 // 20 * 500ms = 10.0s steady window
	const downTotalDur = downWarmup + downSliceCount*downSteadySlice

	downWindow := newSpeedWindowTracker(downStart, downWarmup, downSteadySlice, downSliceCount)
	downTicker := time.NewTicker(140 * time.Millisecond)
	calibratedDown := false
	calibratedDown2 := false
	prevCalDownBytes := int64(0)
	prevCalDownAt := downStart
	currentDownStreams := initialDownCount
	emitCounter := 0

downLoop:
	for {
		select {
		case <-ctx.Done():
			cancelDown()
			downWg.Wait()
			downTicker.Stop()
			return
		case now := <-downTicker.C:
			elapsed := now.Sub(downStart)
			if !calibratedDown && elapsed >= downCalAt {
				calibratedDown = true
				curBytes := downWindowBytes.Load()
				calMbps := computeIntervalMbps(curBytes, elapsed.Seconds())
				prevCalDownBytes = curBytes
				prevCalDownAt = now

				targetStreams, targetChunk := computeDownloadPlan(calMbps, chosen.rttMs, mode)
				downChunkBytes.Store(targetChunk)
				if targetStreams > currentDownStreams {
					mu.Lock()
					activeStreams = targetStreams
					mu.Unlock()
					for s := currentDownStreams; s < targetStreams; s++ {
						spawnDownloadWorker(s, nil, nil)
					}
					currentDownStreams = targetStreams
				}
			} else if !calibratedDown2 && elapsed >= downCalAt2 {
				calibratedDown2 = true
				curBytes := downWindowBytes.Load()
				instMbps := computeIntervalMbps(curBytes-prevCalDownBytes, now.Sub(prevCalDownAt).Seconds())
				cumMbps := computeIntervalMbps(curBytes, elapsed.Seconds())
				targetStreams, targetChunk := computeDownloadPlan(math.Max(instMbps, cumMbps), chosen.rttMs, mode)
				if prevChunk := downChunkBytes.Load(); targetChunk > prevChunk {
					downChunkBytes.Store(targetChunk)
				}
				if targetStreams > currentDownStreams {
					mu.Lock()
					activeStreams = targetStreams
					mu.Unlock()
					for s := currentDownStreams; s < targetStreams; s++ {
						spawnDownloadWorker(s, nil, nil)
					}
					currentDownStreams = targetStreams
				}
			}

			live, pk, histVal, recHist := downWindow.update(now, downWindowBytes.Load())
			emitCounter++
			mu.Lock()
			downloadMbps = live
			peakDownloadMbps = pk
			if recHist && emitCounter%2 == 0 {
				downHistory = append(downHistory, round1(histVal))
				if len(downHistory) > 85 {
					downHistory = downHistory[len(downHistory)-85:]
				}
			}
			frac := math.Min(1.0, elapsed.Seconds()/downTotalDur.Seconds())
			progress = 12 + int(frac*44.0)
			mu.Unlock()

			emit()
			if elapsed >= downTotalDur && (len(downWindow.slices) >= downSliceCount || elapsed >= downTotalDur+400*time.Millisecond) {
				break downLoop
			}
		}
	}
	downTicker.Stop()

	cancelDown()
	downDone := make(chan struct{})
	go func() {
		downWg.Wait()
		close(downDone)
	}()
	select {
	case <-downDone:
	case <-time.After(700 * time.Millisecond):
	}

	if downWindowBytes.Load() == 0 {
		failWithError("Unable to download benchmark stream from CDN (blocked by proxy, captive portal, or firewall).")
		return
	}

	finalDownloadMbps = resolveSustainedSpeedScore(downWindow.peakMbps, downWindow.emaMbps, downWindow.slices)
	mu.Lock()
	downloadMbps = finalDownloadMbps
	if peakDownloadMbps < finalDownloadMbps {
		peakDownloadMbps = finalDownloadMbps
	}
	progress = 56
	mu.Unlock()
	emit()

	// Brief breather so download buffers clear cleanly before upload latency baseline
	select {
	case <-ctx.Done():
		return
	case <-time.After(450 * time.Millisecond):
	}

	// ------------------------------------------------------------------
	// STAGE 3: Self-Calibrating Multi-Stream Upload (2.8s Warmup + 10.0s Steady)
	// ------------------------------------------------------------------
	initialUpCount := 1
	if mode == "multi" {
		initialUpCount = 4
	}

	phase = "upload"
	mu.Lock()
	activeStreams = initialUpCount
	mu.Unlock()
	emit()

	upCtx, cancelUp := context.WithCancel(ctx)
	upTracker := &connTracker{}
	go func() {
		<-upCtx.Done()
		upTracker.closeAll()
	}()

	var upChunkSize atomic.Int64
	upChunkSize.Store(1 * 1024 * 1024) // Start at 1 MB so slow and fast links alike complete warm chunks cleanly
	var upSockWriteBuf atomic.Int32
	upSockWriteBuf.Store(64 * 1024) // Bounded SO_SNDBUF suppresses multi-megabyte OS buffer spikes

	var upWindowBytes atomic.Int64
	var upWg sync.WaitGroup
	upStartGate := make(chan struct{})

	spawnUploadWorker := func(workerID int, warmDone *sync.WaitGroup, gateCh <-chan struct{}) {
		upWg.Add(1)
		go func(id int, wDone *sync.WaitGroup) {
			defer upWg.Done()
			tr, cl := newPinnedSpeedHTTP1Client(speedClientConfig{
				readBuf:      32 * 1024,
				writeBuf:     32 * 1024,
				tracker:      upTracker,
				network:      chosen.network,
				pinnedAddr:   chosen.remoteAddr,
				sockWriteBuf: int(upSockWriteBuf.Load()),
			})
			defer tr.CloseIdleConnections()

			wCtx, wCancel := context.WithTimeout(upCtx, 1200*time.Millisecond)
			req, err := http.NewRequestWithContext(wCtx, http.MethodGet, "https://speed.cloudflare.com/__down?bytes=0", nil)
			if err == nil {
				setSpeedBrowserHeaders(req)
				if resp, rErr := cl.Do(req); rErr == nil && resp != nil {
					_, _ = io.Copy(io.Discard, io.LimitReader(resp.Body, 4096))
					_ = resp.Body.Close()
				}
			}
			wCancel()
			if wDone != nil {
				wDone.Done()
			}
			if gateCh != nil {
				select {
				case <-gateCh:
				case <-upCtx.Done():
					return
				}
				// Slight micro-stagger prevents simultaneous kernel SO_SNDBUF burst on t=0.
				if staggerDelay := time.Duration(id%4) * 35 * time.Millisecond; staggerDelay > 0 {
					select {
					case <-upCtx.Done():
						return
					case <-time.After(staggerDelay):
					}
				}
			}

			for upCtx.Err() == nil {
				baseChunk := upChunkSize.Load()
				staggerStep := baseChunk / 8
				if staggerStep < 128*1024 {
					staggerStep = 128 * 1024
				}
				chunkSz := baseChunk + int64(id%4)*staggerStep
				reader := &meteredUploadReader{
					ctx:     upCtx,
					counter: &upWindowBytes,
					total:   &totalBytes,
					remain:  chunkSz,
				}
				req, err := http.NewRequestWithContext(upCtx, http.MethodPost, "https://speed.cloudflare.com/__up", reader)
				if err != nil {
					return
				}
				req.ContentLength = chunkSz
				setSpeedBrowserHeaders(req)
				req.Header.Set("Content-Type", "application/octet-stream")
				resp, err := cl.Do(req)
				if err == nil && resp != nil {
					_, _ = io.Copy(io.Discard, io.LimitReader(resp.Body, 4096))
					_ = resp.Body.Close()
					if resp.StatusCode != http.StatusOK || (resp.Request != nil && !isAllowedSpeedURL(resp.Request.URL)) {
						select {
						case <-upCtx.Done():
							return
						case <-time.After(350 * time.Millisecond):
						}
					}
				} else {
					select {
					case <-upCtx.Done():
						return
					case <-time.After(150 * time.Millisecond):
					}
				}
			}
		}(workerID, warmDone)
	}

	var upWarmWg sync.WaitGroup
	for s := 0; s < initialUpCount; s++ {
		upWarmWg.Add(1)
		spawnUploadWorker(s, &upWarmWg, upStartGate)
	}
	upWarmWg.Wait()

	startLoadedPingMonitor(upCtx, true)

	upStart := time.Now()
	close(upStartGate)
	const upCalAt = 950 * time.Millisecond
	const upCalAt2 = 1800 * time.Millisecond
	const upWarmup = 2800 * time.Millisecond
	const upSteadySlice = 500 * time.Millisecond
	const upSliceCount = 20 // 20 * 500ms = 10.0s steady window
	const upTotalDur = upWarmup + upSliceCount*upSteadySlice

	upWindow := newSpeedWindowTracker(upStart, upWarmup, upSteadySlice, upSliceCount)
	upTicker := time.NewTicker(140 * time.Millisecond)
	calibratedUp := false
	calibratedUp2 := false
	prevCalUpBytes := int64(0)
	prevCalUpAt := upStart
	currentUpStreams := initialUpCount
	emitCounter = 0

upLoop:
	for {
		select {
		case <-ctx.Done():
			cancelUp()
			upWg.Wait()
			upTicker.Stop()
			return
		case now := <-upTicker.C:
			elapsed := now.Sub(upStart)
			if !calibratedUp && elapsed >= upCalAt {
				calibratedUp = true
				curBytes := upWindowBytes.Load()
				calUpMbps := computeIntervalMbps(curBytes, elapsed.Seconds())
				prevCalUpBytes = curBytes
				prevCalUpAt = now

				targetUp, targetChunk, targetSockBuf := computeUploadPlan(calUpMbps, chosen.rttMs, mode)
				upChunkSize.Store(targetChunk)
				upSockWriteBuf.Store(int32(targetSockBuf))
				upTracker.setWriteBufferAll(targetSockBuf)
				if targetUp > currentUpStreams {
					mu.Lock()
					activeStreams = targetUp
					mu.Unlock()
					for s := currentUpStreams; s < targetUp; s++ {
						spawnUploadWorker(s, nil, nil)
					}
					currentUpStreams = targetUp
				}
			} else if !calibratedUp2 && elapsed >= upCalAt2 {
				calibratedUp2 = true
				curBytes := upWindowBytes.Load()
				instMbps := computeIntervalMbps(curBytes-prevCalUpBytes, now.Sub(prevCalUpAt).Seconds())
				cumMbps := computeIntervalMbps(curBytes, elapsed.Seconds())
				targetUp, targetChunk, targetSockBuf := computeUploadPlan(math.Max(instMbps, cumMbps), chosen.rttMs, mode)
				if prevChunk := upChunkSize.Load(); targetChunk > prevChunk {
					upChunkSize.Store(targetChunk)
				}
				if prevBuf := int(upSockWriteBuf.Load()); targetSockBuf > prevBuf {
					upSockWriteBuf.Store(int32(targetSockBuf))
					upTracker.setWriteBufferAll(targetSockBuf)
				}
				if targetUp > currentUpStreams {
					mu.Lock()
					activeStreams = targetUp
					mu.Unlock()
					for s := currentUpStreams; s < targetUp; s++ {
						spawnUploadWorker(s, nil, nil)
					}
					currentUpStreams = targetUp
				}
			}

			live, pk, histVal, recHist := upWindow.update(now, upWindowBytes.Load())
			emitCounter++
			mu.Lock()
			uploadMbps = live
			peakUploadMbps = pk
			if recHist && emitCounter%2 == 0 {
				upHistory = append(upHistory, round1(histVal))
				if len(upHistory) > 85 {
					upHistory = upHistory[len(upHistory)-85:]
				}
			}
			frac := math.Min(1.0, elapsed.Seconds()/upTotalDur.Seconds())
			progress = 56 + int(frac*42.0)
			mu.Unlock()

			emit()
			if elapsed >= upTotalDur && (len(upWindow.slices) >= upSliceCount || elapsed >= upTotalDur+400*time.Millisecond) {
				break upLoop
			}
		}
	}
	upTicker.Stop()

	cancelUp()
	upDone := make(chan struct{})
	go func() {
		upWg.Wait()
		close(upDone)
	}()
	select {
	case <-upDone:
	case <-time.After(700 * time.Millisecond):
	}

	finalUploadMbps = resolveSustainedSpeedScore(upWindow.peakMbps, upWindow.emaMbps, upWindow.slices)
	mu.Lock()
	uploadMbps = finalUploadMbps
	if peakUploadMbps < finalUploadMbps {
		peakUploadMbps = finalUploadMbps
	}
	progress = 98
	mu.Unlock()
	emit()

	// Brief breather so upload buffers drain before refreshing Anycast Edge Matrix latencies
	select {
	case <-ctx.Done():
		return
	case <-time.After(250 * time.Millisecond):
	}

	// Final Anycast Edge Matrix refresh
	probeEdges()

	// ------------------------------------------------------------------
	// STAGE 4: Completion & Certified Scorecard
	// ------------------------------------------------------------------
	mu.Lock()
	phase = "complete"
	completed = true
	progress = 100
	mu.Unlock()
	emit()
}

// computePingStats calculates outlier-filtered mean latency, min/max RTT, and RFC 3550 consecutive jitter.
func computePingStats(samples []float64) (avg, best, worst, jitter float64) {
	if len(samples) == 0 {
		return 0, 0, 0, 0
	}

	sorted := make([]float64, len(samples))
	copy(sorted, samples)
	sort.Float64s(sorted)

	best = sorted[0]
	worst = sorted[len(sorted)-1]

	if len(samples) == 1 {
		return best, best, worst, 0
	}

	// Reject transient OS/radio/worker spikes before computing Ping and Jitter
	q25 := sorted[len(sorted)/4]
	median := sorted[len(sorted)/2]
	outlierCeiling := math.Max(median*1.65, q25+35.0)

	filtered := make([]float64, 0, len(samples))
	for _, v := range samples {
		if v <= outlierCeiling {
			filtered = append(filtered, v)
		}
	}
	if len(filtered) < 2 {
		keep := (len(sorted) * 7) / 10
		if keep < 2 {
			keep = len(sorted)
		}
		filtered = sorted[:keep]
	}

	var jitSum float64
	jitCount := 0
	for i := 1; i < len(filtered); i++ {
		jitSum += math.Abs(filtered[i] - filtered[i-1])
		jitCount++
	}
	if jitCount > 0 {
		jitter = jitSum / float64(jitCount)
	}

	// If multi-spike outliers were removed, average the clean filtered samples;
	// otherwise apply symmetric 10% top/bottom trim on sorted samples.
	outliersRemoved := len(samples) - len(filtered)
	if outliersRemoved >= 2 {
		sum := 0.0
		for _, v := range filtered {
			sum += v
		}
		avg = sum / float64(len(filtered))
		return avg, best, worst, jitter
	}

	trim := 0
	if len(sorted) >= 6 {
		trim = len(sorted) / 10
		if trim == 0 {
			trim = 1
		}
	}
	end := len(sorted) - trim
	if end <= trim {
		trim = 0
		end = len(sorted)
	}
	sum := 0.0
	for i := trim; i < end; i++ {
		sum += sorted[i]
	}
	avg = sum / float64(end-trim)
	return avg, best, worst, jitter
}

// resolveSustainedSpeedScore computes the certified sustained throughput using the middle-60% trimmed
// slice average (discarding slowest 30% and fastest 10% steady slices) to match report methodology,
// falling back cleanly to EMA and peak only if insufficient slices exist.
func resolveSustainedSpeedScore(peakMbps, emaMbps float64, slices []float64) float64 {
	if score := computeOoklaScore(slices); score > 0 {
		return score
	}
	if emaMbps > 0 {
		return round1(emaMbps)
	}
	if peakMbps > 0 {
		return round1(peakMbps)
	}
	return 0
}

// computeOoklaScore computes the sustained speed score following Ookla's single-test slice whitepaper:
// discards the slowest 30% and fastest 10% of steady-state time slices, then averages the middle 60%.
func computeOoklaScore(slices []float64) float64 {
	if len(slices) == 0 {
		return 0
	}
	sorted := make([]float64, len(slices))
	copy(sorted, slices)
	sort.Float64s(sorted)

	if len(sorted) < 5 {
		sum := 0.0
		cnt := 0
		for _, v := range sorted {
			if v > 0 {
				sum += v
				cnt++
			}
		}
		if cnt == 0 {
			return 0
		}
		return round1(sum / float64(cnt))
	}

	trimLow := int(math.Floor(float64(len(sorted)) * 0.30))
	trimHigh := int(math.Floor(float64(len(sorted)) * 0.10))
	endIdx := len(sorted) - trimHigh
	if endIdx <= trimLow {
		trimLow = 0
		endIdx = len(sorted)
	}

	sum := 0.0
	count := 0
	for i := trimLow; i < endIdx; i++ {
		sum += sorted[i]
		count++
	}
	if count == 0 {
		return 0
	}
	return round1(sum / float64(count))
}

// computeBenchmarkScore is retained for compatibility with trimmed sample scoring callers.
func computeBenchmarkScore(samples []float64, discardRampCount int) float64 {
	if len(samples) == 0 {
		return 0
	}
	steady := samples
	if discardRampCount > 0 && len(samples) > discardRampCount+4 {
		steady = samples[discardRampCount:]
	}

	valid := make([]float64, 0, len(steady))
	for _, s := range steady {
		if s > 0 {
			valid = append(valid, s)
		}
	}
	if len(valid) == 0 {
		return 0
	}
	return computeOoklaScore(valid)
}

// RunSpeedBenchmark runs a single complete Speedtest benchmark for one-shot callers.
func RunSpeedBenchmark() (SpeedReport, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 45*time.Second)
	defer cancel()
	var last SpeedSnapshot
	RunLiveSpeedBenchmark(ctx, func(snap SpeedSnapshot) {
		last = snap
	})
	last.Running = false
	return last, nil
}

func round1(val float64) float64 {
	return math.Round(val*10) / 10
}
