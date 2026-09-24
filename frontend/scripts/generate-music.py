#!/usr/bin/env python3
"""Generates Neon Strike's original synthwave loops (menu + combat) as seamless WAV files.

Usage:  python3 scripts/generate-music.py      (needs numpy)
Writes: assets/sounds/music_menu.wav, assets/sounds/music_game.wav

Everything is synthesized here (band-limited saws/squares, noise drums, echo), so the
music has no licensing constraints. Each track renders an exact number of bars; the
tail that rings past the loop point is folded back onto the start, so it loops cleanly.
"""
import math
import wave
from pathlib import Path

import numpy as np

SR = 22050
OUT = Path(__file__).resolve().parent.parent / "assets" / "sounds"
rng = np.random.default_rng(42)

NOTE = {n: i for i, n in enumerate(["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"])}


def freq(name: str) -> float:
    """'A3' -> 220 Hz."""
    pitch, octave = name[:-1], int(name[-1])
    return 440.0 * 2 ** ((NOTE[pitch] + 12 * (octave + 1) - 69) / 12)


def env_adsr(n, a, d, s, r):
    a, d, r = int(a * SR), int(d * SR), int(r * SR)
    e = np.full(n, s, dtype=np.float64)
    if a:
        e[: min(a, n)] = np.linspace(0, 1, a)[: min(a, n)]
    if d and a < n:
        seg = np.linspace(1, s, d)[: max(0, min(d, n - a))]
        e[a : a + len(seg)] = seg
    if r:
        e[-min(r, n) :] *= np.linspace(1, 0, min(r, n))
    return e


def saw(f, n, harmonics=14, bright=1.0):
    t = np.arange(n) / SR
    out = np.zeros(n)
    for k in range(1, harmonics + 1):
        if f * k > SR / 2.2:
            break
        out += np.sin(2 * np.pi * f * k * t) / k * (bright ** (k - 1))
    return out * 0.6


def square(f, n, harmonics=9):
    t = np.arange(n) / SR
    out = np.zeros(n)
    for k in range(1, harmonics * 2, 2):
        if f * k > SR / 2.2:
            break
        out += np.sin(2 * np.pi * f * k * t) / k
    return out * 0.8


class Track:
    def __init__(self, bpm, bars):
        self.beat = 60.0 / bpm
        self.length = int(round(bars * 4 * self.beat * SR))
        self.buf = np.zeros(self.length + SR * 4)  # room for tails

    def at(self, beat_pos):
        return int(round(beat_pos * self.beat * SR))

    def add(self, start_beat, signal, gain=1.0):
        i = self.at(start_beat)
        self.buf[i : i + len(signal)] += signal * gain

    def render(self, echo=None):
        buf = self.buf
        if echo:  # simple feedback echo: (delay_beats, feedback, mix)
            d = self.at(echo[0])
            wet = np.zeros_like(buf)
            tap = buf.copy()
            for _ in range(5):
                tap = np.concatenate([np.zeros(d), tap[:-d]]) * echo[1]
                wet += tap
            buf = buf + wet * echo[2]
        loop = buf[: self.length].copy()
        tail = buf[self.length :]
        loop[: len(tail)] += tail[: len(loop)]  # fold the tail onto the start: seamless loop
        loop = np.tanh(loop * 1.2)
        loop = loop / (np.max(np.abs(loop)) + 1e-9) * 0.89
        # Ramp the last ~6 ms so the final sample meets the first one: no click at the seam.
        n = int(0.006 * SR)
        loop[-n:] += np.linspace(0, 1, n) * (loop[0] - loop[-1])
        return loop


def kick(n=0.35):
    k = int(n * SR)
    t = np.arange(k) / SR
    f = 45 + 110 * np.exp(-t * 30)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 9)


def snare(n=0.25):
    k = int(n * SR)
    t = np.arange(k) / SR
    noise = rng.uniform(-1, 1, k)
    noise = np.convolve(noise, np.ones(3) / 3, mode="same")
    return (noise * 0.7 + np.sin(2 * np.pi * 190 * t) * 0.4) * np.exp(-t * 16)


def hat(n=0.06, open_=False):
    k = int((0.2 if open_ else n) * SR)
    t = np.arange(k) / SR
    noise = rng.uniform(-1, 1, k)
    noise = noise - np.convolve(noise, np.ones(4) / 4, mode="same")  # crude high-pass
    return noise * np.exp(-t * (18 if open_ else 60))


def pad(chord, beats, beat_len):
    n = int(beats * beat_len * SR)
    sig = np.zeros(n)
    for note in chord:
        f = freq(note)
        for det in (-0.004, 0.004):  # detuned pair for width
            sig += saw(f * (1 + det), n, harmonics=8, bright=0.72)
    return sig * env_adsr(n, 0.6, 0.4, 0.8, 0.8) / len(chord)


def pluck(note, beat_len, length=0.5, kind="square"):
    n = int(length * beat_len * SR)
    f = freq(note)
    sig = square(f, n, 6) if kind == "square" else saw(f, n, 10, 0.8)
    return sig * env_adsr(n, 0.003, 0.12, 0.25, 0.05)


def bass(note, beats, beat_len):
    n = int(beats * beat_len * SR)
    f = freq(note)
    sig = saw(f, n, 10, 0.75) + np.sin(2 * np.pi * f / 2 * np.arange(n) / SR) * 0.5
    return sig * env_adsr(n, 0.005, 0.08, 0.7, 0.03)


def write(path, data):
    pcm = (np.clip(data, -1, 1) * 32767).astype("<i2")
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())
    print(f"{path.name}: {len(data) / SR:.1f}s, {path.stat().st_size // 1024} KB")


def menu_theme():
    """'Neon Nights' — 96 BPM, A minor, 16 bars: Am F C G, calm and wide."""
    tr = Track(96, 16)
    b = tr.beat
    prog = [
        (["A3", "C4", "E4"], "A1", ["A4", "C5", "E5", "C5"]),
        (["F3", "A3", "C4"], "F1", ["F4", "A4", "C5", "A4"]),
        (["C3", "E3", "G3"], "C2", ["G4", "C5", "E5", "C5"]),
        (["G3", "B3", "D4"], "G1", ["G4", "B4", "D5", "B4"]),
    ]
    for bar in range(16):
        chord, root, arp = prog[(bar // 2) % 4] if bar < 8 else prog[bar % 4]
        start = bar * 4
        if bar % 2 == 0 or bar >= 8:
            tr.add(start, pad(chord, 4 if bar >= 8 else 8, b), 0.55)
        for eighth in range(8):  # soft pulsing bass
            tr.add(start + eighth * 0.5, bass(root, 0.45, b), 0.35 if eighth % 2 == 0 else 0.22)
        if bar >= 4:  # arpeggio enters after 4 bars
            for s in range(16):
                tr.add(start + s * 0.25, pluck(arp[s % 4], b, 0.4), 0.16 if bar < 8 else 0.2)
        if bar >= 8:  # light drums in the second half
            for beat in range(4):
                if beat in (0, 2):
                    tr.add(start + beat, kick(), 0.5)
                if beat in (1, 3):
                    tr.add(start + beat, snare(), 0.22)
                tr.add(start + beat + 0.5, hat(), 0.12)
    return tr.render(echo=(0.75, 0.35, 0.35))


def game_theme():
    """'Grid Assault' — 128 BPM, D minor, 16 bars: Dm Bb F C, driving and tense."""
    tr = Track(128, 16)
    b = tr.beat
    prog = [("D2", ["D3", "F3", "A3"], ["D5", "A4", "F4", "A4"]),
            ("A#1", ["A#2", "D3", "F3"], ["D5", "A#4", "F4", "A#4"]),
            ("F2", ["F3", "A3", "C4"], ["C5", "A4", "F4", "A4"]),
            ("C2", ["C3", "E3", "G3"], ["E5", "C5", "G4", "C5"])]
    for bar in range(16):
        root, chord, lead = prog[bar % 4]
        start = bar * 4
        for s in range(16):  # 16th-note bass with an off-beat octave jump
            note = root if s % 4 != 2 else root[:-1] + str(int(root[-1]) + 1)
            tr.add(start + s * 0.25, bass(note, 0.22, b), 0.42)
        tr.add(start, pad(chord, 4, b), 0.3)
        for beat in range(4):
            tr.add(start + beat, kick(0.3), 0.8)
            if beat in (1, 3):
                tr.add(start + beat, snare(), 0.45)
            tr.add(start + beat + 0.5, hat(open_=beat == 3), 0.16)
            tr.add(start + beat + 0.25, hat(), 0.08)
            tr.add(start + beat + 0.75, hat(), 0.08)
        if bar >= 8:  # lead stabs in the second half
            for s in (0, 3, 6, 8, 10, 13):
                tr.add(start + s * 0.25, pluck(lead[s % 4], b, 0.6, kind="saw"), 0.22)
    return tr.render(echo=(0.75, 0.3, 0.25))


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    write(OUT / "music_menu.wav", menu_theme())
    write(OUT / "music_game.wav", game_theme())
