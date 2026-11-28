package mtr

import (
	"encoding/binary"
	"net"
	"testing"
	"time"
)

func TestComputeMOSGrades(t *testing.T) {
	hdScore, hdGrade := ComputeMOS(12.0, 1.0, 0.0)
	if hdScore < 4.3 || hdScore > 4.5 || hdGrade != "HD" {
		t.Fatalf("expected fiber HD score >=4.3, got %.2f (%s)", hdScore, hdGrade)
	}

	goodScore, goodGrade := ComputeMOS(135.0, 8.0, 0.5)
	if goodScore < 4.0 || goodScore >= 4.3 || goodGrade != "Good" {
		t.Fatalf("expected Good MOS [4.0..4.3), got %.2f (%s)", goodScore, goodGrade)
	}

	badScore, badGrade := ComputeMOS(350.0, 55.0, 15.0)
	if badScore >= 3.1 || badGrade != "Bad" {
		t.Fatalf("expected Bad MOS <3.1, got %.2f (%s)", badScore, badGrade)
	}
}

func TestParseTargetAndPort(t *testing.T) {
	tests := []struct {
		raw      string
		mode     string
		wantHost string
		wantPort int
	}{
		{"1.1.1.1", ProbeICMP, "1.1.1.1", 0},
		{"1.1.1.1", ProbeTCP, "1.1.1.1", 443},
		{"1.1.1.1", ProbeUDP, "1.1.1.1", 33434},
		{"https://example.com:8443/path", ProbeTCP, "example.com", 8443},
		{"[2001:4860:4860::8888]:853", ProbeTCP, "2001:4860:4860::8888", 853},
		{"2001:4860:4860::8888", ProbeTCP, "2001:4860:4860::8888", 443},
	}

	for _, tc := range tests {
		h, p := parseTargetAndPort(tc.raw, tc.mode)
		if h != tc.wantHost || p != tc.wantPort {
			t.Fatalf("parseTargetAndPort(%q, %q) = (%q, %d), want (%q, %d)", tc.raw, tc.mode, h, p, tc.wantHost, tc.wantPort)
		}
	}
}

func TestExtractQuotedL4Ports(t *testing.T) {
	// IPv4 with 24-byte header (IHL=6) + inner TCP src=50123 dst=443
	v4 := make([]byte, 32)
	v4[0] = 0x46
	v4[9] = 6
	binary.BigEndian.PutUint16(v4[24:26], 50123)
	binary.BigEndian.PutUint16(v4[26:28], 443)

	proto, sp, dp, ok := extractQuotedL4Ports(false, v4)
	if !ok || proto != 6 || sp != 50123 || dp != 443 {
		t.Fatalf("IPv4 TCP parse = (%d,%d,%d,%v), want (6,50123,443,true)", proto, sp, dp, ok)
	}

	// IPv6 with 40-byte header + inner UDP src=41000 dst=33435
	v6 := make([]byte, 48)
	v6[0] = 0x60
	v6[6] = 17
	binary.BigEndian.PutUint16(v6[40:42], 41000)
	binary.BigEndian.PutUint16(v6[42:44], 33435)

	proto, sp, dp, ok = extractQuotedL4Ports(true, v6)
	if !ok || proto != 17 || sp != 41000 || dp != 33435 {
		t.Fatalf("IPv6 UDP parse = (%d,%d,%d,%v), want (17,41000,33435,true)", proto, sp, dp, ok)
	}

	if _, _, _, bad := extractQuotedL4Ports(false, make([]byte, 16)); bad {
		t.Fatalf("expected truncated IPv4 packet to return ok=false")
	}
	if _, _, _, bad := extractQuotedL4Ports(true, make([]byte, 43)); bad {
		t.Fatalf("expected truncated IPv6 packet to return ok=false")
	}
}

func TestHybridTCPDestSamplingAndSnapshot(t *testing.T) {
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Skipf("loopback TCP listen unavailable: %v", err)
	}
	defer ln.Close()

	doneCh := make(chan struct{})
	go func() {
		defer close(doneCh)
		for {
			c, aErr := ln.Accept()
			if aErr != nil {
				return
			}
			_ = c.Close()
		}
	}()

	eng, err := NewEngineWithMode(ln.Addr().String(), ProbeTCP, nil)
	if err != nil {
		t.Fatalf("NewEngineWithMode failed: %v", err)
	}
	eng.setHybridTCP("TCP-MTR :test (Hybrid)")

	// Simulate discovered hop 1 intermediate router + dest on hop 2
	eng.mu.Lock()
	eng.hops[1].sent = 1
	eng.applyHopSample(eng.hops[1], 1, "192.168.1.1", 1.2, false)
	eng.mu.Unlock()

	pickedTTL := eng.pickHybridDestTTL()
	if pickedTTL != 2 {
		t.Fatalf("expected hybrid dest TTL 2 after hop 1 responded, got %d", pickedTTL)
	}

	start := time.Now()
	rttMs := 3.4
	if c, dErr := net.DialTimeout("tcp", ln.Addr().String(), 500*time.Millisecond); dErr != nil {
		if !isPermissionError(dErr) {
			t.Fatalf("dial loopback server failed: %v", dErr)
		}
		t.Logf("sandbox blocked loopback dial (%v); exercising sample recording path directly", dErr)
	} else {
		_ = c.Close()
		rttMs = float64(time.Since(start).Microseconds()) / 1000.0
		if rttMs < 0.05 {
			rttMs = 0.05
		}
	}

	eng.mu.Lock()
	eng.hops[pickedTTL].sent = 1
	eng.mu.Unlock()
	eng.recordDirectDestSample(pickedTTL, "127.0.0.1", rttMs)

	snap := eng.Snapshot()
	if snap.Protocol != "TCP-MTR :test (Hybrid)" {
		t.Fatalf("unexpected protocol %q", snap.Protocol)
	}
	if len(snap.Hops) != 2 || !snap.Hops[1].ReachedDest {
		t.Fatalf("expected 2 hops stopping at destination, got %+v", snap.Hops)
	}
	if snap.MOSScore < 4.0 || snap.MOSGrade == "" {
		t.Fatalf("expected healthy route MOS >=4.0 on loopback, got %.2f (%s)", snap.MOSScore, snap.MOSGrade)
	}
}
