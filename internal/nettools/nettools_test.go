package nettools

import (
	"context"
	"errors"
	"io"
	"net"
	"net/http"
	"net/url"
	"os"
	"sync/atomic"
	"testing"
	"time"
)

func TestDefaultScanPortsValid(t *testing.T) {
	ports := DefaultScanPorts()
	if len(ports) == 0 {
		t.Fatalf("DefaultScanPorts returned empty slice")
	}
	for _, p := range ports {
		if p < 1 || p > 65535 {
			t.Errorf("invalid TCP port %d in DefaultScanPorts", p)
		}
	}
}

func TestMeteredUploadReaderCountingAndCancellation(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	var winCounter, totalCounter atomic.Int64
	reader := &meteredUploadReader{
		ctx:     ctx,
		counter: &winCounter,
		total:   &totalCounter,
		remain:  1024,
	}

	buf := make([]byte, 400)
	n1, err1 := reader.Read(buf)
	if err1 != nil || n1 != 400 {
		t.Fatalf("first read: n=%d err=%v, want n=400 err=nil", n1, err1)
	}

	// Read remaining bytes until EOF
	rest, errAll := io.ReadAll(reader)
	if errAll != nil {
		t.Fatalf("ReadAll failed: %v", errAll)
	}
	if len(rest) != 624 || winCounter.Load() != 1024 || totalCounter.Load() != 1024 {
		t.Fatalf("byte accounting mismatch: rest=%d win=%d total=%d", len(rest), winCounter.Load(), totalCounter.Load())
	}

	// Verify immediate context cancellation
	cancelCtx, cancelNow := context.WithCancel(context.Background())
	cancelNow()
	canceledReader := &meteredUploadReader{
		ctx:     cancelCtx,
		counter: &winCounter,
		total:   &totalCounter,
		remain:  4096,
	}
	_, errCanceled := canceledReader.Read(buf)
	if !errors.Is(errCanceled, context.Canceled) {
		t.Fatalf("expected context.Canceled, got %v", errCanceled)
	}
}

func TestScanPortsLocalLoopback(t *testing.T) {
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Skipf("local TCP listener unavailable in test environment: %v", err)
	}
	defer ln.Close()

	go func() {
		for {
			conn, acceptErr := ln.Accept()
			if acceptErr != nil {
				return
			}
			_ = conn.Close()
		}
	}()

	openPort := ln.Addr().(*net.TCPAddr).Port

	// Probe once to check whether the current OS/sandbox environment permits outbound loopback TCP dials
	probeConn, probeErr := net.Dial("tcp", ln.Addr().String())
	if probeErr != nil {
		t.Skipf("outbound loopback TCP dial restricted in sandbox environment: %v", probeErr)
	}
	_ = probeConn.Close()

	// Reserve and immediately close a second port to guarantee a closed port
	closedLn, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Skipf("secondary TCP listener unavailable: %v", err)
	}
	closedPort := closedLn.Addr().(*net.TCPAddr).Port
	_ = closedLn.Close()

	report, err := ScanPorts("127.0.0.1", []int{openPort, closedPort})
	if err != nil {
		t.Fatalf("ScanPorts failed: %v", err)
	}
	if report.TotalPorts != 2 || report.OpenCount != 1 {
		t.Fatalf("unexpected scan counts: total=%d open=%d, results=%+v", report.TotalPorts, report.OpenCount, report.Results)
	}
	if report.Results[0].State != "open" || report.Results[1].State != "closed" {
		t.Fatalf("unexpected port states: %+v", report.Results)
	}
}

func TestComputeOoklaScoreTrimsSlowest30AndFastest10(t *testing.T) {
	// 20 slices: 6 slow outlier stalls (10..60), 12 steady (100), 2 high bursts (500, 900)
	slices := []float64{
		10, 20, 30, 40, 50, 60, // slowest 30% -> 6 slices
		100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, // middle 60% -> 12 slices
		500, 900, // fastest 10% -> 2 slices
	}
	score := computeOoklaScore(slices)
	if score != 100.0 {
		t.Fatalf("expected trimmed middle 60%% score 100.0, got %.1f", score)
	}
	if empty := computeOoklaScore(nil); empty != 0 {
		t.Fatalf("expected 0 for empty slices, got %.1f", empty)
	}
}

func TestComputePingStatsAndJitter(t *testing.T) {
	samples := []float64{10, 12, 10, 12, 10, 12, 10, 12, 10, 90} // 90 is transient spike
	avg, best, worst, jit := computePingStats(samples)
	if best != 10 || worst != 90 {
		t.Fatalf("unexpected min/max: best=%.1f worst=%.1f", best, worst)
	}
	// Sorted with trim=1 drops one lowest (10) and highest (90), leaving {10,10,10,10,12,12,12,12} -> avg 11.0
	if avg != 11.0 {
		t.Fatalf("expected trimmed ping avg 11.0, got %.1f", avg)
	}
	if jit != 2.0 {
		t.Fatalf("expected spike-filtered consecutive jitter 2.0, got %.1f", jit)
	}

	// Multi-spike scenario (e.g. 32.6ms baseline with transient 350-410ms stalls)
	multiSpike := []float64{32.6, 380.0, 33.0, 410.0, 32.8, 33.2, 32.9, 350.0, 33.1, 32.7}
	avg2, best2, _, jit2 := computePingStats(multiSpike)
	if best2 != 32.6 {
		t.Fatalf("expected best2=32.6, got %.1f", best2)
	}
	if avg2 < 32.5 || avg2 > 34.0 {
		t.Fatalf("expected multi-spike filtered Ping ~32.9ms, got %.1f", avg2)
	}
	if jit2 <= 0 || jit2 > 1.5 {
		t.Fatalf("expected multi-spike filtered Jitter < 1.5ms, got %.1f", jit2)
	}
}

func TestSpeedWindowTrackerWarmupAndSlicing(t *testing.T) {
	start := time.Now()
	wt := newSpeedWindowTracker(start, 1000*time.Millisecond, 500*time.Millisecond, 4)

	var totalBytes int64
	// Simulate 1.0s warmup + 2.0s steady phase at constant 80 Mbps (10 MB/s = 1,000,000 bytes per 100ms)
	for i := 1; i <= 32; i++ {
		now := start.Add(time.Duration(i*100) * time.Millisecond)
		totalBytes += 1_000_000 // 1 MB per 100ms => 80 Mbps
		wt.update(now, totalBytes)
	}

	if len(wt.slices) != 4 {
		t.Fatalf("expected 4 steady slices after warmup, got %d (%v)", len(wt.slices), wt.slices)
	}
	score := computeOoklaScore(wt.slices)
	if score < 78.0 || score > 82.0 {
		t.Fatalf("expected steady ~80.0 Mbps score, got %.1f (slices=%v)", score, wt.slices)
	}
}

func TestParseSpeedMetaJSONHandlesObjectAndStringColo(t *testing.T) {
	objJSON := []byte(`{
		"hostname":"speed.cloudflare.com",
		"clientIp":"2001:16a2:f87d::1",
		"asn":25019,
		"asOrganization":"STC, Jeddah Residential-Fixed-Broadband",
		"country":"SA",
		"city":"Jeddah",
		"colo":{"iata":"MRS","city":"Marseille","cca2":"FR"}
	}`)
	metaObj, ok := parseSpeedMetaJSON(objJSON)
	if !ok {
		t.Fatalf("expected object colo meta to parse successfully")
	}
	if metaObj.ClientISP != "STC, Jeddah Residential-Fixed-Broadband" ||
		metaObj.ClientIP != "2001:16a2:f87d::1" ||
		metaObj.ClientLocation != "Jeddah, SA" ||
		metaObj.ServerName != "Cloudflare Anycast (MRS)" ||
		metaObj.ServerLocation != "Marseille, FR • Anycast Edge" {
		t.Fatalf("unexpected parsed object meta: %+v", metaObj)
	}

	strJSON := []byte(`{"clientIp":"1.2.3.4","asn":123,"city":"Riyadh","country":"SA","colo":"RUH"}`)
	metaStr, ok := parseSpeedMetaJSON(strJSON)
	if !ok {
		t.Fatalf("expected string colo meta to parse successfully")
	}
	if metaStr.ClientISP != "AS123" || metaStr.ServerName != "Cloudflare Anycast (RUH)" {
		t.Fatalf("unexpected parsed string meta: %+v", metaStr)
	}
}

func TestLiveSpeedBenchmarkIntegration(t *testing.T) {
	if os.Getenv("MASAR_LIVE_SPEED_TEST") != "1" {
		t.Skip("set MASAR_LIVE_SPEED_TEST=1 to run live Cloudflare speed benchmark integration test")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 45*time.Second)
	defer cancel()

	meta := FetchSpeedMeta(ctx)
	t.Logf("meta=%+v", meta)
	if meta.ClientIP == "" || meta.ClientISP == "" {
		t.Fatalf("expected non-empty ClientIP and ClientISP from FetchSpeedMeta, got %+v", meta)
	}

	var lastSnap SpeedSnapshot
	var downSamples []float64
	var upSamples []float64

	RunLiveSpeedBenchmarkWithMode(ctx, "multi", func(snap SpeedSnapshot) {
		lastSnap = snap
		if snap.Phase == "download" && snap.DownloadMbps > 0 {
			downSamples = append(downSamples, snap.DownloadMbps)
		}
		if snap.Phase == "upload" && snap.UploadMbps > 0 {
			upSamples = append(upSamples, snap.UploadMbps)
		}
	})

	t.Logf("final: completed=%v mode=%s ping=%.2fms down=%.2fMbps(peak=%.2f) up=%.2fMbps(peak=%.2f) downSamples=%d upSamples=%d",
		lastSnap.Completed, lastSnap.ConnectionMode, lastSnap.PingMs,
		lastSnap.FinalDownloadMbps, lastSnap.PeakDownloadMbps,
		lastSnap.FinalUploadMbps, lastSnap.PeakUploadMbps,
		len(downSamples), len(upSamples))
	if len(downSamples) > 0 {
		t.Logf("down progression: %v", downSamples)
	}
	if len(upSamples) > 0 {
		t.Logf("up progression: %v", upSamples)
	}

	if !lastSnap.Completed {
		t.Fatalf("expected benchmark Completed=true, got phase=%s progress=%d", lastSnap.Phase, lastSnap.Progress)
	}
	if lastSnap.FinalDownloadMbps <= 0 || lastSnap.PeakDownloadMbps < lastSnap.FinalDownloadMbps {
		t.Fatalf("expected FinalDownloadMbps > 0 and <= Peak, got final=%.2f peak=%.2f",
			lastSnap.FinalDownloadMbps, lastSnap.PeakDownloadMbps)
	}
	if lastSnap.FinalUploadMbps <= 0 || lastSnap.PeakUploadMbps < lastSnap.FinalUploadMbps {
		t.Fatalf("expected FinalUploadMbps > 0 and <= Peak, got final=%.2f peak=%.2f",
			lastSnap.FinalUploadMbps, lastSnap.PeakUploadMbps)
	}
	if len(downSamples) >= 4 {
		tailMin := downSamples[len(downSamples)-1]
		for _, v := range downSamples[len(downSamples)/2:] {
			if v < tailMin {
				tailMin = v
			}
		}
		if tailMin < lastSnap.PeakDownloadMbps*0.2 {
			t.Fatalf("download collapsed late in test: peak=%.2f tailMin=%.2f samples=%v",
				lastSnap.PeakDownloadMbps, tailMin, downSamples)
		}
	}
	if len(upSamples) >= 4 {
		tailMin := upSamples[len(upSamples)-1]
		for _, v := range upSamples[len(upSamples)/2:] {
			if v < tailMin {
				tailMin = v
			}
		}
		if tailMin < lastSnap.PeakUploadMbps*0.25 {
			t.Fatalf("upload collapsed late in test: peak=%.2f tailMin=%.2f samples=%v",
				lastSnap.PeakUploadMbps, tailMin, upSamples)
		}
		// Ensure upload starts smoothly rather than spiking on initial buffer fill and dipping >30%
		if upSamples[0] > upSamples[1]*1.35 && upSamples[1] > 0 {
			t.Fatalf("upload showed initial buffer spike & dip: samples=%v", upSamples)
		}
	}
}

func TestResolveSustainedSpeedScoreUsesTrimmedMean(t *testing.T) {
	// Trimmed middle-60% mean from steady slices MUST govern final sustained score rather than peak burst outliers
	slices := []float64{
		10, 20, 30, 40, 50, 60,
		100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100,
		500, 900,
	}
	if got := resolveSustainedSpeedScore(900.0, 145.0, slices); got != 100.0 {
		t.Fatalf("expected middle-60%% trimmed mean 100.0, got %.1f", got)
	}
	if got := resolveSustainedSpeedScore(99.64, 82.44, nil); got != 82.4 {
		t.Fatalf("expected ema fallback 82.4 when slices empty, got %.1f", got)
	}
	if got := resolveSustainedSpeedScore(99.64, 0, nil); got != 99.6 {
		t.Fatalf("expected peak fallback 99.6 when slices and ema empty, got %.1f", got)
	}
}

func TestClassifyPortDialError(t *testing.T) {
	if got := classifyPortDialError(context.DeadlineExceeded); got != "filtered" {
		t.Errorf("expected DeadlineExceeded to classify as filtered, got %q", got)
	}
	if got := classifyPortDialError(os.ErrDeadlineExceeded); got != "filtered" {
		t.Errorf("expected ErrDeadlineExceeded to classify as filtered, got %q", got)
	}
	if got := classifyPortDialError(errors.New("connection refused")); got != "closed" {
		t.Errorf("expected connection refused to classify as closed, got %q", got)
	}
}

func TestSpeedHTTPClientBlocksOffOriginAndDowngradeRedirects(t *testing.T) {
	tr, cl := newSpeedHTTP1Client(8*1024, 8*1024, nil)
	defer tr.CloseIdleConnections()

	cases := []struct {
		rawURL string
		wantOK bool
	}{
		{"https://speed.cloudflare.com/__down?bytes=1024", true},
		{"https://1.1.1.1/cdn-cgi/trace", true},
		{"http://speed.cloudflare.com/__down?bytes=1024", false},
		{"https://127.0.0.1/__down", false},
		{"http://192.168.1.1/login", false},
		{"https://evil.example.com/payload", false},
		{"https://user@speed.cloudflare.com/__down", false},
	}

	for _, tc := range cases {
		u, err := url.Parse(tc.rawURL)
		if err != nil {
			t.Fatalf("url.Parse(%q) error: %v", tc.rawURL, err)
		}
		if got := isAllowedSpeedURL(u); got != tc.wantOK {
			t.Errorf("isAllowedSpeedURL(%q) = %v, want %v", tc.rawURL, got, tc.wantOK)
		}
		req, _ := http.NewRequest(http.MethodGet, tc.rawURL, nil)
		chkErr := cl.CheckRedirect(req, []*http.Request{req})
		if tc.wantOK && chkErr != nil {
			t.Errorf("CheckRedirect(%q) unexpectedly blocked: %v", tc.rawURL, chkErr)
		}
		if !tc.wantOK && chkErr == nil {
			t.Errorf("CheckRedirect(%q) failed to block unsafe target", tc.rawURL)
		}
	}

	// Excess redirect chain must also be blocked even on allowed host
	validReq, _ := http.NewRequest(http.MethodGet, "https://speed.cloudflare.com/__down", nil)
	if err := cl.CheckRedirect(validReq, []*http.Request{validReq, validReq}); err == nil {
		t.Fatalf("expected CheckRedirect to reject redirect chain len >= 2")
	}
}

func TestSpeedWindowTrackerSuppressesInitialBufferPrefillSpike(t *testing.T) {
	t0 := time.Now()
	st := newSpeedWindowTracker(t0, 2800*time.Millisecond, 500*time.Millisecond, 20)

	// Simulate synchronous 400KB SO_SNDBUF prefill in the first 120ms,
	// then steady ~80 Mbps wire transfer (1.4 MB every 140ms).
	totalBytes := int64(400_000)
	live1, pk1, _, _ := st.update(t0.Add(120*time.Millisecond), totalBytes)
	if pk1 != 0 {
		t.Fatalf("peakMbps should remain 0 during warmup, got %.2f", pk1)
	}
	if live1 > 20 {
		t.Fatalf("expected warmup smoothing floor to suppress t=120ms buffer burst, got %.2f Mbps", live1)
	}

	prevLive := live1
	for i := 2; i <= 15; i++ {
		totalBytes += 1_400_000 // ~80 Mbps per 140ms tick
		curLive, _, _, _ := st.update(t0.Add(time.Duration(i*140)*time.Millisecond), totalBytes)
		if curLive+0.5 < prevLive {
			t.Fatalf("unexpected dip during monotonic ramp/steady transfer at tick %d: prev=%.2f cur=%.2f", i, prevLive, curLive)
		}
		prevLive = curLive
	}
}

func TestMeteredUploadReaderCapsChunkSlice(t *testing.T) {
	ctx := context.Background()
	var win, tot atomic.Int64
	r := &meteredUploadReader{ctx: ctx, counter: &win, total: &tot, remain: 100_000}
	buf := make([]byte, 64*1024)
	n, err := r.Read(buf)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if n > 16*1024 || n <= 0 {
		t.Fatalf("expected capped read <= 16KB for smooth metering, got %d", n)
	}
}

func TestChooseOptimalEndpointPrefersLowerRTTAndIPv4TieBreaker(t *testing.T) {
	// Scenario 1: IPv4 reaches local POP (15.2ms) while IPv6 routes to Marseille (58.4ms) -> pick IPv4
	localV4 := speedEndpointCandidate{network: "tcp4", remoteAddr: "104.16.132.229:443", rttMs: 15.2, ok: true}
	euV6 := speedEndpointCandidate{network: "tcp6", remoteAddr: "[2606:4700::1]:443", rttMs: 58.4, ok: true}
	best, ok := chooseOptimalEndpoint(localV4, euV6)
	if !ok || best.network != "tcp4" {
		t.Fatalf("expected tcp4 (15.2ms) to beat tcp6 (58.4ms), got ok=%v net=%s", ok, best.network)
	}

	// Scenario 2: IPv6 is decisively closer (11.0ms vs 42.0ms) -> pick IPv6
	slowV4 := speedEndpointCandidate{network: "tcp4", remoteAddr: "104.16.132.229:443", rttMs: 42.0, ok: true}
	fastV6 := speedEndpointCandidate{network: "tcp6", remoteAddr: "[2606:4700::1]:443", rttMs: 11.0, ok: true}
	best2, ok2 := chooseOptimalEndpoint(slowV4, fastV6)
	if !ok2 || best2.network != "tcp6" {
		t.Fatalf("expected tcp6 (11.0ms) to beat tcp4 (42.0ms), got ok=%v net=%s", ok2, best2.network)
	}

	// Scenario 3: Near-tie (<= 3.0ms) favors tcp4 for stability
	tieV4 := speedEndpointCandidate{network: "tcp4", remoteAddr: "104.16.132.229:443", rttMs: 15.5, ok: true}
	tieV6 := speedEndpointCandidate{network: "tcp6", remoteAddr: "[2606:4700::1]:443", rttMs: 13.5, ok: true}
	best3, ok3 := chooseOptimalEndpoint(tieV4, tieV6)
	if !ok3 || best3.network != "tcp4" {
		t.Fatalf("expected near-tie to favor tcp4, got ok=%v net=%s", ok3, best3.network)
	}

	// Scenario 4: Single-stack IPv6 only
	failedV4 := speedEndpointCandidate{network: "tcp4", ok: false}
	best4, ok4 := chooseOptimalEndpoint(failedV4, euV6)
	if !ok4 || best4.network != "tcp6" {
		t.Fatalf("expected fallback to valid tcp6 candidate, got ok=%v net=%s", ok4, best4.network)
	}

	// Scenario 5: Redirected portal stops benchmark immediately
	portalV6 := speedEndpointCandidate{network: "tcp6", redirected: true}
	best5, ok5 := chooseOptimalEndpoint(localV4, portalV6)
	if ok5 || !best5.redirected {
		t.Fatalf("expected captive redirect to reject endpoint race, got ok=%v redirected=%v", ok5, best5.redirected)
	}
}

func TestAnnotateSpeedMetaTransport(t *testing.T) {
	base := SpeedMeta{ServerName: "Cloudflare Anycast (JED)", ServerLocation: "Jeddah, SA • Anycast Edge"}
	v4 := annotateSpeedMetaTransport(base, "tcp4")
	if v4.ServerLocation != "Jeddah, SA • Anycast IPv4" {
		t.Fatalf("unexpected tcp4 annotated location: %q", v4.ServerLocation)
	}
	v6 := annotateSpeedMetaTransport(base, "tcp6")
	if v6.ServerLocation != "Jeddah, SA • Anycast IPv6" {
		t.Fatalf("unexpected tcp6 annotated location: %q", v6.ServerLocation)
	}
}

func TestResolvePinnedSpeedDialTargetOnlyPinsBenchmarkHost(t *testing.T) {
	pinned := "104.16.132.229:443"
	if got := resolvePinnedSpeedDialTarget("speed.cloudflare.com:443", pinned); got != pinned {
		t.Fatalf("expected speed.cloudflare.com:443 to dial %q, got %q", pinned, got)
	}
	if got := resolvePinnedSpeedDialTarget("evil.example.com:443", pinned); got != "evil.example.com:443" {
		t.Fatalf("non-benchmark host must not be rewritten, got %q", got)
	}
}

func TestComputeDownloadAndUploadPlanScaling(t *testing.T) {
	// ~94 Mbps fiber on low RTT -> continuous chunks with 6 streams download / 8 upload + 64KB write buffer
	dlStreams, dlChunk := computeDownloadPlan(94.0, 14.0, "multi")
	if dlStreams != 6 || dlChunk != 40_000_000 {
		t.Fatalf("unexpected low-RTT multi download plan: streams=%d chunk=%d", dlStreams, dlChunk)
	}
	// High RTT BDP boost adds +2 parallel streams
	dlStreamsHighRTT, _ := computeDownloadPlan(94.0, 58.0, "multi")
	if dlStreamsHighRTT != 8 {
		t.Fatalf("expected +2 BDP stream boost for 58ms RTT, got streams=%d", dlStreamsHighRTT)
	}

	ulStreams, ulChunk, ulSockBuf := computeUploadPlan(94.0, 14.0, "multi")
	if ulStreams != 8 || ulChunk != 10*1024*1024 || ulSockBuf != 64*1024 {
		t.Fatalf("unexpected upload plan: streams=%d chunk=%d sockBuf=%d", ulStreams, ulChunk, ulSockBuf)
	}

	// Single-connection mode always keeps 1 stream
	sStreams, _ := computeDownloadPlan(500.0, 60.0, "single")
	usStreams, _, _ := computeUploadPlan(500.0, 60.0, "single")
	if sStreams != 1 || usStreams != 1 {
		t.Fatalf("single mode must always keep 1 stream, got dl=%d ul=%d", sStreams, usStreams)
	}
}

func TestComputeIntervalMbps(t *testing.T) {
	// 11,750,000 bytes in 1.0s => 94.0 Mbps
	got := computeIntervalMbps(11_750_000, 1.0)
	if got < 93.9 || got > 94.1 {
		t.Fatalf("expected ~94.0 Mbps, got %.3f", got)
	}
	if z := computeIntervalMbps(1000, 0); z != 0 {
		t.Fatalf("expected 0 for zero duration, got %.3f", z)
	}
}
