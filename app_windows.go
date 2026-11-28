//go:build windows

package main

import (
	"encoding/binary"
	"math"
	"sync"
	"syscall"
	"unsafe"
)

var (
	chimeOnce       sync.Once
	startupChimeWAV []byte
)

func setWindowsAppUserModelID() {
	shell32 := syscall.NewLazyDLL("shell32.dll")
	proc := shell32.NewProc("SetCurrentProcessExplicitAppUserModelID")
	if proc != nil && proc.Find() == nil {
		appID, err := syscall.UTF16PtrFromString("mhmdrfx.Masar")
		if err == nil {
			proc.Call(uintptr(unsafe.Pointer(appID)))
		}
	}
}

// buildCalmStartupChimeWAV synthesizes a soft, velvety ambient chime (44.1kHz 16-bit stereo PCM WAV)
// using a warm two-pulse Rhodes/Marimba interval (F4 -> C5, 329.63Hz / 392.00Hz / 523.25Hz) with gentle low-register warmth.
func buildCalmStartupChimeWAV() []byte {
	const sampleRate = 44100
	const durationSec = 1.45
	numSamples := int(sampleRate * durationSec)
	dataSize := numSamples * 4 // 2 channels * 2 bytes per sample
	buf := make([]byte, 44+dataSize)

	// RIFF WAV header
	copy(buf[0:4], "RIFF")
	binary.LittleEndian.PutUint32(buf[4:8], uint32(36+dataSize))
	copy(buf[8:12], "WAVE")
	copy(buf[12:16], "fmt ")
	binary.LittleEndian.PutUint32(buf[16:20], 16) // PCM chunk size
	binary.LittleEndian.PutUint16(buf[20:22], 1)  // PCM format
	binary.LittleEndian.PutUint16(buf[22:24], 2)  // Stereo
	binary.LittleEndian.PutUint32(buf[24:28], sampleRate)
	binary.LittleEndian.PutUint32(buf[28:32], sampleRate*4)
	binary.LittleEndian.PutUint16(buf[32:34], 4)  // Block align
	binary.LittleEndian.PutUint16(buf[34:36], 16) // 16-bit
	copy(buf[36:40], "data")
	binary.LittleEndian.PutUint32(buf[40:44], uint32(dataSize))

	type toneNote struct {
		freq  float64
		start float64
		decay float64
		ampL  float64
		ampR  float64
		sub   float64
	}

	// Soft, warm two-step ambient marimba/electric-piano interval (C4/G4 -> E4/B4)
	// Low frequencies only (no piercing highs), smooth cosine attack, natural woody decay.
	notes := []toneNote{
		{freq: 261.63, start: 0.00, decay: 3.4, ampL: 0.36, ampR: 0.32, sub: 0.18}, // C4 warm root
		{freq: 392.00, start: 0.00, decay: 3.8, ampL: 0.22, ampR: 0.26, sub: 0.10}, // G4 soft fifth
		{freq: 329.63, start: 0.16, decay: 3.2, ampL: 0.28, ampR: 0.32, sub: 0.14}, // E4 gentle third
		{freq: 493.88, start: 0.16, decay: 3.6, ampL: 0.20, ampR: 0.18, sub: 0.08}, // B4 warm major 7th
	}

	const masterGain = 0.14 // Very calm, soft studio level
	offset := 44
	for i := 0; i < numSamples; i++ {
		t := float64(i) / float64(sampleRate)
		var left, right float64

		for _, n := range notes {
			nt := t - n.start
			if nt <= 0 {
				continue
			}
			// Soft 38ms raised-cosine attack (zero click, warm mallet feel)
			attack := 1.0
			if nt < 0.038 {
				attack = 0.5 * (1.0 - math.Cos(math.Pi*(nt/0.038)))
			}
			env := attack * math.Exp(-nt*n.decay)
			// Fundamental + warm sub-octave (no bright upper harmonics)
			sig := math.Sin(2.0*math.Pi*n.freq*nt) + n.sub*math.Sin(math.Pi*n.freq*nt)
			left += sig * env * n.ampL
			right += sig * env * n.ampR
		}

		// Smooth cosine fade-out over the last 250ms
		if rem := durationSec - t; rem < 0.25 {
			tail := 0.5 * (1.0 - math.Cos(math.Pi*math.Max(0, rem/0.25)))
			left *= tail
			right *= tail
		}

		sL := int16(math.Max(-1.0, math.Min(1.0, left*masterGain)) * 32767.0)
		sR := int16(math.Max(-1.0, math.Min(1.0, right*masterGain)) * 32767.0)
		binary.LittleEndian.PutUint16(buf[offset:offset+2], uint16(sL))
		binary.LittleEndian.PutUint16(buf[offset+2:offset+4], uint16(sR))
		offset += 4
	}

	return buf
}

func playNativeStartupChime() {
	chimeOnce.Do(func() {
		startupChimeWAV = buildCalmStartupChimeWAV()
	})
	if len(startupChimeWAV) == 0 {
		return
	}
	winmm := syscall.NewLazyDLL("winmm.dll")
	playSound := winmm.NewProc("PlaySoundW")
	if playSound != nil && playSound.Find() == nil {
		// SND_ASYNC (0x0001) | SND_NODEFAULT (0x0002) | SND_MEMORY (0x0004)
		const flags = 0x0001 | 0x0002 | 0x0004
		_, _, _ = playSound.Call(
			uintptr(unsafe.Pointer(&startupChimeWAV[0])),
			0,
			flags,
		)
	}
}
