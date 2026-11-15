package mtr

import (
	"encoding/binary"
	"strings"
	"testing"
	"time"
)

func TestExtractQuotedICMP(t *testing.T) {
	// Standard 20-byte IPv4 header (Version=4, IHL=5 -> 0x45) + 8-byte inner ICMP Echo header
	pkt := make([]byte, 28)
	pkt[0] = 0x45
	pkt[20] = 8 // ICMP Echo Request
	pkt[21] = 0
	binary.BigEndian.PutUint16(pkt[24:26], 0x4d53) // ID
	binary.BigEndian.PutUint16(pkt[26:28], 42)     // Seq

	id, seq, ok := extractQuotedICMP(pkt)
	if !ok {
		t.Fatalf("expected extractQuotedICMP to succeed on valid 28-byte quoted packet")
	}
	if id != 0x4d53 || seq != 42 {
		t.Fatalf("unexpected id/seq: got id=0x%x seq=%d, want id=0x4d53 seq=42", id, seq)
	}

	// IPv4 header with 4-byte option (IHL=6 -> 24 bytes) + 8-byte inner ICMP header
	pktOpt := make([]byte, 32)
	pktOpt[0] = 0x46
	binary.BigEndian.PutUint16(pktOpt[28:30], 0x1234)
	binary.BigEndian.PutUint16(pktOpt[30:32], 99)

	id2, seq2, ok2 := extractQuotedICMP(pktOpt)
	if !ok2 || id2 != 0x1234 || seq2 != 99 {
		t.Fatalf("failed with IPv4 options: ok=%v id=0x%x seq=%d", ok2, id2, seq2)
	}

	// Truncated packets must safely return false without panicking
	if _, _, okShort := extractQuotedICMP(pkt[:19]); okShort {
		t.Fatalf("expected false for packet shorter than 20 bytes")
	}
	if _, _, okTrunc := extractQuotedICMP(pkt[:27]); okTrunc {
		t.Fatalf("expected false when inner ICMP header is truncated")
	}
}

func TestClassifyLocalOrWellKnownIP(t *testing.T) {
	cases := []struct {
		ip       string
		wantOK   bool
		wantPart string
	}{
		{"127.0.0.1", true, "Localhost"},
		{"192.168.1.1", true, "Local LAN"},
		{"10.0.0.1", true, "Local LAN"},
		{"100.64.10.5", true, "Carrier-Grade NAT"},
		{"100.127.255.254", true, "Carrier-Grade NAT"},
		{"8.8.8.8", true, "Google"},
		{"1.1.1.1", true, "Cloudflare"},
		{"9.9.9.9", true, "Quad9"},
		{"93.184.216.34", false, ""},
		{"not-an-ip", false, ""},
	}

	for _, tc := range cases {
		info, ok := classifyLocalOrWellKnownIP(tc.ip)
		if ok != tc.wantOK {
			t.Errorf("classifyLocalOrWellKnownIP(%q) ok=%v, want %v", tc.ip, ok, tc.wantOK)
			continue
		}
		if tc.wantOK && !strings.Contains(info.location, tc.wantPart) {
			t.Errorf("classifyLocalOrWellKnownIP(%q) location=%q, want substring %q", tc.ip, info.location, tc.wantPart)
		}
	}
}

func TestSilentRouterLossFilteringAndSharedCache(t *testing.T) {
	eng, err := NewEngine("8.8.8.8", nil)
	if err != nil {
		t.Fatalf("NewEngine failed: %v", err)
	}

	// Seed shared metadata cache to verify cross-engine instant lookup
	sharedMetaMu.Lock()
	sharedDNS["80.231.100.1"] = cachedDNSRecord{
		hostname:  "core-router.example.net",
		expiresAt: time.Now().Add(10 * time.Minute),
	}
	sharedGeo["80.231.100.1"] = cachedGeoRecord{
		info:      geoInfo{location: "DE • Frankfurt", asn: "AS6453 TATA"},
		expiresAt: time.Now().Add(10 * time.Minute),
	}
	sharedMetaMu.Unlock()

	eng.mu.Lock()
	eng.maxDestTTL = 4
	// Hop 1: Healthy home router
	eng.hops[1].ip = "192.168.1.1"
	eng.hops[1].sent = 10
	eng.hops[1].received = 10
	eng.hops[1].sumMs = 15.0
	eng.hops[1].lastMs = 1.5
	eng.hops[1].bestMs = 1.2
	eng.hops[1].worstMs = 2.0

	// Hop 2: Silent ISP transit router (0 replies, filtering ICMP Time-Exceeded)
	eng.hops[2].ip = ""
	eng.hops[2].sent = 10
	eng.hops[2].received = 0

	// Hop 3: International transit router (cached in sharedGeo & sharedDNS)
	eng.hops[3].ip = "80.231.100.1"
	eng.hops[3].sent = 10
	eng.hops[3].received = 10
	eng.hops[3].sumMs = 280.0
	eng.hops[3].lastMs = 28.0

	// Hop 4: Final target destination with 0% loss
	eng.hops[4].ip = "8.8.8.8"
	eng.hops[4].sent = 10
	eng.hops[4].received = 10
	eng.hops[4].sumMs = 320.0
	eng.hops[4].lastMs = 32.0
	eng.hops[4].reachedDest = true
	eng.mu.Unlock()

	snap := eng.Snapshot()
	if len(snap.Hops) != 4 {
		t.Fatalf("expected 4 hops in snapshot, got %d", len(snap.Hops))
	}

	// Hop 2 MUST report 0% loss because downstream hops 3 and 4 are responding cleanly
	if snap.Hops[1].LossPercent != 0 {
		t.Errorf("silent transit hop 2 reported %.1f%% loss; want 0.0%%", snap.Hops[1].LossPercent)
	}

	// Hop 3 MUST pick up shared DNS & Geo cache immediately
	if snap.Hops[2].Hostname != "core-router.example.net" || snap.Hops[2].Location != "DE • Frankfurt" {
		t.Errorf("shared cache miss on hop 3: hostname=%q location=%q", snap.Hops[2].Hostname, snap.Hops[2].Location)
	}

	if snap.Health.Severity != "healthy" {
		t.Errorf("expected overall severity 'healthy', got %q (%s)", snap.Health.Severity, snap.Health.Status)
	}
}

func TestEvaluateHealthScenarios(t *testing.T) {
	// 1. Healthy route even when Hop 1 (Local Router) drops ICMP completely
	silentRouterHealthyDest := []HopStat{
		{Hop: 1, IP: "", Sent: 10, Received: 0, LossPercent: 0},
		{Hop: 2, IP: "10.20.30.1", Sent: 10, Received: 10, LossPercent: 0, AvgMs: 8.5, JitterMs: 1.1},
		{Hop: 3, IP: "1.1.1.1", Sent: 10, Received: 10, LossPercent: 0, AvgMs: 18.2, JitterMs: 1.4, ReachedDest: true},
	}
	res1 := EvaluateHealth(silentRouterHealthyDest)
	if res1.Severity != "healthy" || res1.CulpritHop != 0 {
		t.Errorf("silent Hop 1 falsely triggered health alert: %+v", res1)
	}

	// 2. Local Wi-Fi / Router packet loss on Hop 1
	localIssue := []HopStat{
		{Hop: 1, IP: "192.168.1.1", Sent: 20, Received: 16, LossPercent: 20.0, AvgMs: 45.0, JitterMs: 12.0},
		{Hop: 2, IP: "1.1.1.1", Sent: 20, Received: 16, LossPercent: 20.0, AvgMs: 65.0, ReachedDest: true},
	}
	res2 := EvaluateHealth(localIssue)
	if res2.CulpritHop != 1 || !strings.Contains(res2.Status, "Local Network") {
		t.Errorf("expected Hop 1 Local Network diagnosis, got: %+v", res2)
	}

	// 3. Clean Hop 1, degraded ISP Gateway on Hop 2
	ispIssue := []HopStat{
		{Hop: 1, IP: "192.168.1.1", Sent: 20, Received: 20, LossPercent: 0.0, AvgMs: 1.8, JitterMs: 0.3},
		{Hop: 2, IP: "100.64.1.1", Sent: 20, Received: 17, LossPercent: 15.0, AvgMs: 95.0, JitterMs: 18.0},
		{Hop: 3, IP: "8.8.8.8", Sent: 20, Received: 17, LossPercent: 15.0, AvgMs: 112.0, ReachedDest: true},
	}
	res3 := EvaluateHealth(ispIssue)
	if res3.CulpritHop != 2 || !strings.Contains(res3.Status, "ISP / Backbone") {
		t.Errorf("expected Hop 2 ISP diagnosis, got: %+v", res3)
	}

	// 4. Clean Hop 1 & ISP, degraded downstream target on Hop 5
	transitIssue := []HopStat{
		{Hop: 1, IP: "192.168.1.1", Sent: 20, Received: 20, LossPercent: 0.0, AvgMs: 1.5},
		{Hop: 2, IP: "100.64.1.1", Sent: 20, Received: 20, LossPercent: 0.0, AvgMs: 7.2},
		{Hop: 5, IP: "8.8.8.8", Sent: 20, Received: 18, LossPercent: 10.0, AvgMs: 185.0, ReachedDest: true},
	}
	res4 := EvaluateHealth(transitIssue)
	if res4.CulpritHop != 5 || !strings.Contains(res4.Status, "Downstream Transit") {
		t.Errorf("expected Hop 5 Downstream Transit diagnosis, got: %+v", res4)
	}

	// 5. Intermediate transit Hop 4 loses 15% AND destination Hop 6 loses 15% -> pinpoint Hop 4
	correlatedTransitIssue := []HopStat{
		{Hop: 1, IP: "192.168.1.1", Sent: 20, Received: 20, LossPercent: 0.0, AvgMs: 1.5},
		{Hop: 2, IP: "100.64.1.1", Sent: 20, Received: 20, LossPercent: 0.0, AvgMs: 7.2},
		{Hop: 4, IP: "198.51.100.4", Sent: 20, Received: 17, LossPercent: 15.0, AvgMs: 42.0},
		{Hop: 6, IP: "8.8.8.8", Sent: 20, Received: 17, LossPercent: 15.0, AvgMs: 48.0, ReachedDest: true},
	}
	res5 := EvaluateHealth(correlatedTransitIssue)
	if res5.CulpritHop != 4 {
		t.Errorf("expected downstream-correlated bottleneck on Hop 4, got: %+v", res5)
	}

	// 6. Intermediate Hop 4 shows 20% ICMP rate-limiting, but destination Hop 6 has 0% loss -> healthy
	icmpRateLimitedTransit := []HopStat{
		{Hop: 1, IP: "192.168.1.1", Sent: 20, Received: 20, LossPercent: 0.0, AvgMs: 1.5},
		{Hop: 2, IP: "100.64.1.1", Sent: 20, Received: 20, LossPercent: 0.0, AvgMs: 7.2},
		{Hop: 4, IP: "198.51.100.4", Sent: 20, Received: 16, LossPercent: 20.0, AvgMs: 42.0},
		{Hop: 6, IP: "8.8.8.8", Sent: 20, Received: 20, LossPercent: 0.0, AvgMs: 45.0, ReachedDest: true},
	}
	res6 := EvaluateHealth(icmpRateLimitedTransit)
	if res6.Severity != "healthy" || res6.CulpritHop != 0 {
		t.Errorf("ICMP rate-limiting at intermediate hop falsely alerted: %+v", res6)
	}
}

func TestECMPMaxDestTTLRecoveryAndCacheExpiration(t *testing.T) {
	eng, err := NewEngine("2001:4860:4860::8888", nil)
	if err != nil {
		t.Fatalf("NewEngine IPv6 failed: %v", err)
	}
	if !eng.isIPv6 || eng.Snapshot().IPVersion != 6 || eng.Snapshot().Protocol != "ICMPv6" {
		t.Fatalf("expected IPv6 engine metadata, got %+v", eng.Snapshot())
	}

	// ECMP multi-responder stability on Hop 3
	eng.mu.Lock()
	eng.inFlight[1] = probeRecord{ttl: 3, sentAt: time.Now().Add(-10 * time.Millisecond)}
	eng.inFlight[2] = probeRecord{ttl: 3, sentAt: time.Now().Add(-12 * time.Millisecond)}
	eng.inFlight[3] = probeRecord{ttl: 3, sentAt: time.Now().Add(-11 * time.Millisecond)}
	eng.hops[3].sent = 3
	eng.mu.Unlock()

	eng.recordReply(1, "198.51.100.10", time.Now(), false)
	eng.recordReply(2, "198.51.100.11", time.Now(), false)
	eng.recordReply(3, "198.51.100.10", time.Now(), false)

	snap := eng.Snapshot()
	if len(snap.Hops) < 3 || snap.Hops[2].IP != "198.51.100.10" {
		t.Fatalf("expected dominant ECMP IP 198.51.100.10, got hop=%+v", snap.Hops)
	}
	if len(snap.Hops[2].AltIPs) != 1 || snap.Hops[2].AltIPs[0] != "198.51.100.11" {
		t.Fatalf("expected secondary ECMP AltIPs [198.51.100.11], got %+v", snap.Hops[2].AltIPs)
	}

	// Bidirectional maxDestTTL recovery after 2 missed destination sweeps
	eng.mu.Lock()
	eng.maxDestTTL = 5
	eng.hops[5].reachedDest = true
	eng.destSeenRound = false
	eng.mu.Unlock()

	if got := eng.beginSweepRound(); got != 5 {
		t.Fatalf("first missed round should keep limit 5 while waiting confirmation, got %d", got)
	}
	if got := eng.beginSweepRound(); got != MaxHops {
		t.Fatalf("second consecutive missed round must expand maxDestTTL back to %d, got %d", MaxHops, got)
	}
	if eng.hops[5].reachedDest {
		t.Fatalf("expected stale reachedDest flag on hop 5 to be cleared upon route expansion")
	}

	// Cache expiration enforcement
	sharedMetaMu.Lock()
	sharedDNS["198.51.100.99"] = cachedDNSRecord{hostname: "stale.example", expiresAt: time.Now().Add(-1 * time.Second)}
	sharedGeo["198.51.100.99"] = cachedGeoRecord{info: geoInfo{location: "OLD"}, expiresAt: time.Now().Add(-1 * time.Second)}
	sharedMetaMu.Unlock()

	if got := eng.lookupCachedHostname("198.51.100.99"); got != "" {
		t.Errorf("expected expired DNS cache entry to return empty string, got %q", got)
	}
	if got := eng.lookupCachedGeo("198.51.100.99"); got.location != "" {
		t.Errorf("expected expired Geo cache entry to return empty location, got %+v", got)
	}
}

func TestBuildTeamCymruQuery(t *testing.T) {
	q4, ok4 := buildTeamCymruQuery([]byte{1, 2, 3, 4})
	if !ok4 || q4 != "4.3.2.1.origin.asn.cymru.com" {
		t.Errorf("IPv4 Cymru query got %q (ok=%v)", q4, ok4)
	}
	q6, ok6 := buildTeamCymruQuery([]byte{0x20, 0x01, 0x48, 0x60, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0x88, 0x88})
	if !ok6 || !strings.HasSuffix(q6, ".origin6.asn.cymru.com") || !strings.HasPrefix(q6, "8.8.8.8.") {
		t.Errorf("IPv6 Cymru query got %q (ok=%v)", q6, ok6)
	}
}
