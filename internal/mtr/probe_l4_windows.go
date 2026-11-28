//go:build windows

package mtr

import (
	"errors"
	"net"
	"runtime"
	"syscall"

	"golang.org/x/sys/windows"
)

const isWindowsHost = true

func setSocketTTL(rawConn syscall.RawConn, isIPv6 bool, ttl int) error {
	var sockErr error
	err := rawConn.Control(func(fd uintptr) {
		handle := windows.Handle(fd)
		if isIPv6 {
			const (
				ipprotoIPv6     = 41
				ipv6UnicastHops = 4
			)
			sockErr = windows.SetsockoptInt(handle, ipprotoIPv6, ipv6UnicastHops, ttl)
			return
		}
		sockErr = windows.SetsockoptInt(handle, windows.IPPROTO_IP, windows.IP_TTL, ttl)
	})
	if err != nil {
		return err
	}
	return sockErr
}

func isConnRefused(err error) bool {
	if err == nil {
		return false
	}
	return errors.Is(err, windows.WSAECONNREFUSED) || errors.Is(err, syscall.ECONNREFUSED)
}

func isAddrInUse(err error) bool {
	if err == nil {
		return false
	}
	return errors.Is(err, windows.WSAEADDRINUSE) || errors.Is(err, syscall.EADDRINUSE)
}

func platformBindIP(isIPv6 bool) net.IP {
	_ = runtime.GOOS
	if isIPv6 {
		return net.IPv6zero
	}
	return net.IPv4zero
}
