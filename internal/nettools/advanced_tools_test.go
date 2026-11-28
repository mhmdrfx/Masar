package nettools

import (
	"bytes"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/tls"
	"crypto/x509"
	"crypto/x509/pkix"
	"io"
	"math/big"
	"net"
	"net/http"
	"testing"
	"time"

	"golang.org/x/net/dns/dnsmessage"
)

func TestComputeBufferbloatGrade(t *testing.T) {
	tests := []struct {
		idle, down, up float64
		want           string
	}{
		{0, 20, 25, ""},
		{20, 0, 0, ""},
		{20, 23, 24, "A+"},
		{20, 42, 45, "A"},
		{20, 55, 78, "B"},
		{20, 120, 180, "C"},
		{20, 250, 350, "D"},
		{20, 490, 510, "F"},
	}
	for _, tc := range tests {
		if got := ComputeBufferbloatGrade(tc.idle, tc.down, tc.up); got != tc.want {
			t.Fatalf("ComputeBufferbloatGrade(%.1f, %.1f, %.1f) = %q, want %q", tc.idle, tc.down, tc.up, got, tc.want)
		}
	}
}

func TestComputePercentile(t *testing.T) {
	samples := []float64{10, 20, 30, 40, 50, 60, 70, 80, 90, 100}
	if p50 := computePercentile(samples, 50); p50 != 55.0 {
		t.Fatalf("expected p50=55.0, got %.1f", p50)
	}
	if p95 := computePercentile(samples, 95); p95 < 95.0 || p95 > 96.0 {
		t.Fatalf("expected p95 around 95.5, got %.1f", p95)
	}
	if p0 := computePercentile(nil, 95); p0 != 0 {
		t.Fatalf("expected 0 on empty slice, got %.1f", p0)
	}
}

func TestParsePortSpec(t *testing.T) {
	ports, err := ParsePortSpec("443, 80, 8000-8002, 80")
	if err != nil {
		t.Fatalf("ParsePortSpec failed: %v", err)
	}
	want := []int{80, 443, 8000, 8001, 8002}
	if len(ports) != len(want) {
		t.Fatalf("got %v, want %v", ports, want)
	}
	for i := range want {
		if ports[i] != want[i] {
			t.Fatalf("ports[%d]=%d, want %d", i, ports[i], want[i])
		}
	}

	if webPorts, err := ParsePortSpec("web"); err != nil || len(webPorts) == 0 {
		t.Fatalf("web preset failed: %v %v", webPorts, err)
	}
	if _, err := ParsePortSpec("1-500"); err == nil {
		t.Fatalf("expected error for exceeding maxCustomPort limit")
	}
	if _, err := ParsePortSpec("abc"); err == nil {
		t.Fatalf("expected error for invalid port token")
	}
}

type roundTripFunc func(*http.Request) (*http.Response, error)

func (f roundTripFunc) RoundTrip(r *http.Request) (*http.Response, error) { return f(r) }

func TestLookupDNSWireDoHRecordsAndDNSSEC(t *testing.T) {
	mockClient := &http.Client{
		Transport: roundTripFunc(func(req *http.Request) (*http.Response, error) {
			if req.Header.Get("Content-Type") != "application/dns-message" {
				t.Fatalf("expected application/dns-message Content-Type, got %q", req.Header.Get("Content-Type"))
			}
			body, _ := io.ReadAll(req.Body)
			var p dnsmessage.Parser
			hdr, err := p.Start(body)
			if err != nil {
				t.Fatalf("invalid wire query: %v", err)
			}
			q, err := p.Question()
			if err != nil {
				t.Fatalf("missing question: %v", err)
			}

			respMsg := dnsmessage.Message{
				Header: dnsmessage.Header{
					ID:               hdr.ID,
					Response:         true,
					RecursionDesired: true,
					AuthenticData:    true,
				},
				Questions: []dnsmessage.Question{q},
			}
			ansHdr := dnsmessage.ResourceHeader{
				Name:  q.Name,
				Type:  q.Type,
				Class: dnsmessage.ClassINET,
				TTL:   300,
			}
			switch q.Type {
			case dnsmessage.TypeA:
				respMsg.Answers = []dnsmessage.Resource{{Header: ansHdr, Body: &dnsmessage.AResource{A: [4]byte{1, 1, 1, 1}}}}
			case dnsmessage.TypeAAAA:
				var v6 [16]byte
				copy(v6[:], net.ParseIP("2606:4700:4700::1111").To16())
				respMsg.Answers = []dnsmessage.Resource{{Header: ansHdr, Body: &dnsmessage.AAAAResource{AAAA: v6}}}
			case dnsmessage.TypeSOA:
				respMsg.Answers = []dnsmessage.Resource{{
					Header: ansHdr,
					Body: &dnsmessage.SOAResource{
						NS:      dnsmessage.MustNewName("ns1.example.com."),
						MBox:    dnsmessage.MustNewName("hostmaster.example.com."),
						Serial:  2026111501,
						Refresh: 3600,
					},
				}}
			case dnsmessage.Type(257): // CAA: flags=0, tag="issue", val="letsencrypt.org"
				caaWire := append([]byte{0, 5}, []byte("issueletsencrypt.org")...)
				respMsg.Answers = []dnsmessage.Resource{{Header: ansHdr, Body: &dnsmessage.UnknownResource{Type: 257, Data: caaWire}}}
			}
			packed, err := respMsg.Pack()
			if err != nil {
				t.Fatalf("pack mock response failed: %v", err)
			}
			return &http.Response{
				StatusCode: http.StatusOK,
				Header:     http.Header{"Content-Type": []string{"application/dns-message"}},
				Body:       io.NopCloser(bytes.NewReader(packed)),
			}, nil
		}),
	}

	rep, err := lookupDNSWireWithClient("example.com", "1.1.1.1 (Cloudflare DoH)", "https://mock.local/dns-query", "", mockClient)
	if err != nil {
		t.Fatalf("lookupDNSWireWithClient failed: %v", err)
	}
	if !rep.UseDoH || !rep.DNSSECValidated {
		t.Fatalf("expected UseDoH=true and DNSSECValidated=true, got %+v", rep)
	}
	seen := map[string]DNSRecordItem{}
	for _, r := range rep.Records {
		seen[r.Type] = r
	}
	if seen["A"].Value != "1.1.1.1" || seen["A"].TTL != 300 {
		t.Fatalf("unexpected A record: %+v", seen["A"])
	}
	if seen["AAAA"].Value != "2606:4700:4700::1111" {
		t.Fatalf("unexpected AAAA record: %+v", seen["AAAA"])
	}
	if seen["SOA"].TTL != 300 || seen["CAA"].Value != `0 issue "letsencrypt.org"` {
		t.Fatalf("unexpected SOA/CAA records: SOA=%+v CAA=%+v", seen["SOA"], seen["CAA"])
	}
}

func TestBuildTLSCertReportInMemoryPipe(t *testing.T) {
	priv, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		t.Fatalf("key gen failed: %v", err)
	}
	tmpl := x509.Certificate{
		SerialNumber: big.NewInt(42),
		Subject:      pkix.Name{CommonName: "masar.test"},
		DNSNames:     []string{"masar.test", "www.masar.test"},
		NotBefore:    time.Now().Add(-24 * time.Hour),
		NotAfter:     time.Now().Add(30 * 24 * time.Hour),
		KeyUsage:     x509.KeyUsageDigitalSignature,
		ExtKeyUsage:  []x509.ExtKeyUsage{x509.ExtKeyUsageServerAuth},
	}
	derBytes, err := x509.CreateCertificate(rand.Reader, &tmpl, &tmpl, &priv.PublicKey, priv)
	if err != nil {
		t.Fatalf("CreateCertificate failed: %v", err)
	}
	cert := tls.Certificate{
		Certificate: [][]byte{derBytes},
		PrivateKey:  priv,
	}

	cConn, sConn := net.Pipe()
	serverErr := make(chan error, 1)
	go func() {
		srv := tls.Server(sConn, &tls.Config{Certificates: []tls.Certificate{cert}})
		hErr := srv.Handshake()
		_ = sConn.Close()
		serverErr <- hErr
	}()

	cli := tls.Client(cConn, &tls.Config{ServerName: "masar.test", InsecureSkipVerify: true})
	start := time.Now()
	if err := cli.Handshake(); err != nil {
		t.Fatalf("in-memory TLS handshake failed: %v", err)
	}
	hsMs := float64(time.Since(start).Microseconds()) / 1000.0
	state := cli.ConnectionState()
	_ = cConn.Close()
	<-serverErr

	rep := buildTLSCertReportFromState("masar.test", 443, state, hsMs, false, "self-signed test")
	if rep.Subject != "masar.test" || len(rep.SANs) != 2 || rep.DaysRemaining < 28 || rep.Verified {
		t.Fatalf("unexpected TLS report: %+v", rep)
	}
}
