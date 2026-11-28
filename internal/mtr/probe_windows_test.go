//go:build windows

package mtr

import (
	"context"
	"encoding/binary"
	"errors"
	"net"
	"testing"
	"time"

	"golang.org/x/sys/windows"
)

func TestParseWindowsICMPReplyLayouts(t *testing.T) {
	// IPv4 ICMP_ECHO_REPLY: Address [4]byte, Status uint32, RoundTripTime uint32
	buf4 := make([]byte, 64)
	copy(buf4[0:4], net.IPv4(198, 51, 100, 1).To4())
	binary.LittleEndian.PutUint32(buf4[4:8], ipTTLExpiredTransit)
	binary.LittleEndian.PutUint32(buf4[8:12], 14)

	peer4, status4, ok4 := parseWindowsICMP4Reply(buf4, 1, nil)
	if !ok4 || peer4 != "198.51.100.1" || status4 != ipTTLExpiredTransit {
		t.Fatalf("parseWindowsICMP4Reply got (%q, %d, %v)", peer4, status4, ok4)
	}

	// Timeout case (ret=0 without TTL expired errno)
	if _, _, okTimeout := parseWindowsICMP4Reply(buf4, 0, nil); okTimeout {
		t.Fatalf("expected timeout when ret=0")
	}

	// IPv6 ICMPV6_ECHO_REPLY (pshpack1: 26-byte IPV6_ADDRESS_EX + Status(4) + RTT(4))
	buf6 := make([]byte, 64)
	wantIP6 := net.ParseIP("2001:db8::1").To16()
	copy(buf6[6:22], wantIP6)
	binary.LittleEndian.PutUint32(buf6[26:30], ipTTLExpiredTransit)
	binary.LittleEndian.PutUint32(buf6[30:34], 9)

	peer6, status6, ok6 := parseWindowsICMP6Reply(buf6, 1, nil)
	if !ok6 || peer6 != "2001:db8::1" || status6 != ipTTLExpiredTransit {
		t.Fatalf("parseWindowsICMP6Reply got (%q, %d, %v)", peer6, status6, ok6)
	}
}

func TestWindowsUnprivilegedLoopbackProbe(t *testing.T) {
	hRaw, _, hErr := procIcmpCreateFile.Call()
	if hRaw == 0 || hRaw == uintptr(windows.InvalidHandle) {
		if errors.Is(hErr, windows.ERROR_ACCESS_DENIED) {
			t.Skip("sandboxed environment blocks IcmpCreateFile (ERROR_ACCESS_DENIED)")
		}
		t.Fatalf("IcmpCreateFile failed unexpectedly: %v", hErr)
	}
	_, _, _ = procIcmpClose.Call(hRaw)

	eng, err := NewEngine("127.0.0.1", nil)
	if err != nil {
		t.Fatalf("NewEngine failed: %v", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 1500*time.Millisecond)
	defer cancel()

	errCh := make(chan error, 1)
	go func() {
		errCh <- eng.Run(ctx)
	}()

	deadline := time.Now().Add(1200 * time.Millisecond)
	for time.Now().Before(deadline) {
		snap := eng.Snapshot()
		if len(snap.Hops) > 0 && snap.Hops[0].Received > 0 && snap.Hops[0].IP == "127.0.0.1" {
			cancel()
			if runErr := <-errCh; runErr != nil {
				t.Fatalf("Engine.Run returned error: %v", runErr)
			}
			return
		}
		time.Sleep(40 * time.Millisecond)
	}

	cancel()
	<-errCh
	t.Fatalf("expected unprivileged Windows IcmpSendEcho2 to probe 127.0.0.1 cleanly: %+v", eng.Snapshot())
}
