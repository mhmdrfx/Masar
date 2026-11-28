//go:build !windows

package mtr

import (
	"errors"
	"net"
	"runtime"
	"strings"
	"syscall"
)

const isWindowsHost = false

func setSocketTTL(rawConn syscall.RawConn, isIPv6 bool, ttl int) error {
	var sockErr error
	err := rawConn.Control(func(fd uintptr) {
		if isIPv6 {
			const ipprotoIPv6 = 41
			ipv6UnicastHops := 16
			if runtime.GOOS == "darwin" || strings.Contains(runtime.GOOS, "bsd") {
				ipv6UnicastHops = 4
			}
			sockErr = syscall.SetsockoptInt(int(fd), ipprotoIPv6, ipv6UnicastHops, ttl)
			return
		}
		sockErr = syscall.SetsockoptInt(int(fd), syscall.IPPROTO_IP, syscall.IP_TTL, ttl)
	})
	if err != nil {
		return err
	}
	return sockErr
}

func isConnRefused(err error) bool {
	return err != nil && errors.Is(err, syscall.ECONNREFUSED)
}

func isAddrInUse(err error) bool {
	return err != nil && errors.Is(err, syscall.EADDRINUSE)
}

func platformBindIP(isIPv6 bool) net.IP {
	if isIPv6 {
		return net.IPv6zero
	}
	return net.IPv4zero
}
