package main

import (
	"net/http"
	"net/url"
	"strings"
	"sync"
	"testing"

	"masar/internal/mtr"
	"masar/internal/nettools"
)

func TestStartStopSpeedBenchmarkConcurrencySafety(t *testing.T) {
	a := NewApp()
	defer a.StopSpeedBenchmark()

	var wg sync.WaitGroup
	for i := 0; i < 6; i++ {
		wg.Add(1)
		go func(idx int) {
			defer wg.Done()
			mode := "multi"
			if idx%2 == 1 {
				mode = "single"
			}
			_ = a.StartSpeedBenchmarkWithMode(mode)
			if idx%3 == 0 {
				a.StopSpeedBenchmark()
			}
		}(i)
	}
	wg.Wait()

	a.StopSpeedBenchmark()
	if a.IsSpeedRunning() {
		t.Fatalf("expected IsSpeedRunning() == false after final StopSpeedBenchmark")
	}
	snap := a.GetLastSpeedSnapshot()
	if snap.Running {
		t.Fatalf("expected last snapshot Running == false after StopSpeedBenchmark")
	}
	if snap.Seq == 0 {
		t.Fatalf("expected monotonic snap.Seq > 0 after lifecycle transitions")
	}
}

func TestBuildSpeedHTMLReportEscapesUntrustedFields(t *testing.T) {
	xssPayload := `<script>alert("xss")</script>`
	snap := nettools.SpeedSnapshot{
		Completed:         true,
		FinalDownloadMbps: 120.5,
		FinalUploadMbps:   65.2,
		PingMs:            18.4,
		DownloadLatencyMs: 24.0,
		UploadLatencyMs:   29.0,
		ClientISP:         xssPayload,
		ServerName:        xssPayload,
		EdgePings: []nettools.EdgePingItem{
			{
				Provider: xssPayload,
				Endpoint: "1.1.1.1:443",
				AvgMs:    18.0,
				BestMs:   16.0,
				Status:   "timeout",
			},
		},
	}

	htmlOut := BuildSpeedHTMLReport(snap, "en")
	if strings.Contains(htmlOut, xssPayload) {
		t.Fatalf("unescaped XSS payload found in generated speed report HTML")
	}
	if !strings.Contains(htmlOut, "&lt;script&gt;alert(&#34;xss&#34;)&lt;/script&gt;") {
		t.Fatalf("expected HTML-escaped payload in generated report")
	}
	if !strings.Contains(htmlOut, "#fee2e2") {
		t.Fatalf("expected non-online edge status pill to render error/timeout styling")
	}
	if strings.Contains(htmlOut, "20.8 ms") || strings.Contains(htmlOut, "22.5 ms") {
		t.Fatalf("unexpected fabricated loaded latency offset in report")
	}
	if !strings.Contains(htmlOut, `fill="#ffffff" stroke="#e2e8f0"`) {
		t.Fatalf("expected original bright white Masar badge logo in speed HTML report")
	}
}

func TestStartStopTraceConcurrencySafety(t *testing.T) {
	a := NewApp()
	defer a.StopTrace()

	var wg sync.WaitGroup
	for i := 0; i < 6; i++ {
		wg.Add(1)
		go func(idx int) {
			defer wg.Done()
			_ = a.StartTrace("1.1.1.1")
			if idx%2 == 0 {
				a.StopTrace()
			}
		}(i)
	}
	wg.Wait()

	a.StopTrace()
	if a.IsRunning() {
		t.Fatalf("expected IsRunning() == false after final StopTrace")
	}
}

func TestBuildDetailedCSVReportSanitizesFormulaInjection(t *testing.T) {
	snap := mtr.TraceSnapshot{
		Target:     "=cmd|' /C calc'!A0",
		ResolvedIP: "1.1.1.1",
		Hops: []mtr.HopStat{
			{
				Hop:      1,
				IP:       "192.168.1.1",
				Hostname: "@SUM(1+1)*cmd|' /C calc'!A0",
				Location: "+malicious-loc",
				ASN:      "-AS13335",
				Sent:     10,
				Received: 10,
			},
		},
	}

	csvOut := BuildDetailedCSVReport(snap, "en")
	if !strings.Contains(csvOut, "'=cmd|") {
		t.Fatalf("expected formula-injected target to be prefixed with single quote in CSV")
	}
	if !strings.Contains(csvOut, "'@SUM(1+1)") {
		t.Fatalf("expected formula-injected hostname to be prefixed with single quote in CSV")
	}
	if !strings.Contains(csvOut, "'+malicious-loc") {
		t.Fatalf("expected formula-injected location to be prefixed with single quote in CSV")
	}
	if !strings.Contains(csvOut, "'-AS13335") {
		t.Fatalf("expected formula-injected ASN to be prefixed with single quote in CSV")
	}
}

func TestUpdaterSecurityHardening(t *testing.T) {
	if got := sanitizeVersionFilenameToken("../../evil/1.2.0"); got != "evil1.2.0" {
		t.Fatalf("expected path traversal characters stripped from version token, got %q", got)
	}

	if updateHTTPClient.CheckRedirect == nil {
		t.Fatalf("expected updateHTTPClient.CheckRedirect to be configured")
	}

	httpReq := &http.Request{URL: &url.URL{Scheme: "http", Host: "github.com"}}
	if err := updateHTTPClient.CheckRedirect(httpReq, nil); err == nil {
		t.Fatalf("expected CheckRedirect to reject non-HTTPS redirect")
	}

	evilHostReq := &http.Request{URL: &url.URL{Scheme: "https", Host: "evil.example.com"}}
	if err := updateHTTPClient.CheckRedirect(evilHostReq, nil); err == nil {
		t.Fatalf("expected CheckRedirect to reject untrusted redirect host")
	}

	validAssetReq := &http.Request{URL: &url.URL{Scheme: "https", Host: "objects.githubusercontent.com"}}
	if err := updateHTTPClient.CheckRedirect(validAssetReq, nil); err != nil {
		t.Fatalf("expected CheckRedirect to allow trusted GitHub asset redirect, got %v", err)
	}
}
