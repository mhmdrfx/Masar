//go:build !windows

package mtr

import "context"

func (e *Engine) runPlatform(ctx context.Context) error {
	return e.runSocketPlatform(ctx)
}
