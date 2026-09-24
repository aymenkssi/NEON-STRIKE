// Background music: one looping track per screen (menu / combat) with short cross-fades.
// Pauses while the app is in the background. Separate from sound effects (src/audio/sound.ts).
import { AppState, Platform } from "react-native";
import { createAudioPlayer, type AudioPlayer } from "expo-audio";

export type MusicTrack = "menu" | "game";

const FILES: Record<MusicTrack, number> = {
  menu: require("../../assets/sounds/music_menu.wav"),
  game: require("../../assets/sounds/music_game.wav"),
};

const FADE_MS = 700;
const FADE_STEPS = 14;

class MusicManager {
  private players: Partial<Record<MusicTrack, AudioPlayer>> = {};
  private current: MusicTrack | null = null;
  private wanted: MusicTrack | null = null;
  private enabled = true;
  private volume = 0.5;
  private fades: Partial<Record<MusicTrack, ReturnType<typeof setInterval>>> = {};
  private started = false;
  // Browsers block audio until the first user gesture; native apps can start right away.
  private unlocked = Platform.OS !== "web";

  constructor() {
    AppState.addEventListener("change", (state) => {
      if (state === "active") this.resume();
      else this.pauseAll();
    });
    // Browsers refuse to start audio before a user gesture: retry on the first tap.
    if (Platform.OS === "web" && typeof document !== "undefined") {
      const unlock = () => {
        document.removeEventListener("pointerdown", unlock);
        this.unlocked = true;
        if (this.wanted && this.enabled) {
          this.current = this.wanted;
          this.startTrack(this.wanted, true);
        }
      };
      document.addEventListener("pointerdown", unlock);
    }
  }

  private player(track: MusicTrack): AudioPlayer | null {
    if (!this.players[track]) {
      try {
        const p = createAudioPlayer(FILES[track]);
        p.loop = true;
        p.volume = 0;
        this.players[track] = p;
      } catch {
        return null;
      }
    }
    return this.players[track] ?? null;
  }

  private fade(track: MusicTrack, to: number, then?: () => void) {
    const p = this.player(track);
    if (!p) return;
    const existing = this.fades[track];
    if (existing) clearInterval(existing);
    const from = p.volume;
    let step = 0;
    this.fades[track] = setInterval(() => {
      step++;
      try {
        p.volume = from + ((to - from) * step) / FADE_STEPS;
      } catch {}
      if (step >= FADE_STEPS) {
        clearInterval(this.fades[track]!);
        delete this.fades[track];
        then?.();
      }
    }, FADE_MS / FADE_STEPS);
  }

  private startTrack(track: MusicTrack, restart: boolean) {
    const p = this.player(track);
    if (!p) return;
    try {
      if (restart) p.seekTo(0);
      // On the web play() returns a promise that rejects until the first user gesture.
      const r: any = p.play();
      r?.catch?.(() => {});
      this.started = true;
    } catch {}
    this.fade(track, this.volume);
  }

  // Switches to a track (cross-fade). Calling it again with the same track does nothing.
  play(track: MusicTrack) {
    this.wanted = track;
    if (!this.enabled || !this.unlocked || this.current === track) return;
    const previous = this.current;
    this.current = track;
    if (previous) {
      this.fade(previous, 0, () => {
        try {
          this.players[previous]?.pause();
        } catch {}
      });
    }
    this.startTrack(track, true);
  }

  setEnabled(v: boolean) {
    this.enabled = v;
    if (!v) {
      this.pauseAll();
      this.current = null;
    } else if (this.wanted) {
      this.play(this.wanted);
    }
  }

  setVolume(v: number) {
    this.volume = Math.max(0, Math.min(1, v));
    if (this.current && this.enabled) {
      try {
        const p = this.players[this.current];
        if (p) p.volume = this.volume;
      } catch {}
    }
  }

  private pauseAll() {
    for (const p of Object.values(this.players)) {
      try {
        p?.pause();
      } catch {}
    }
  }

  private resume() {
    if (!this.enabled || !this.current || !this.started) return;
    try {
      const r: any = this.players[this.current]?.play();
      r?.catch?.(() => {});
    } catch {}
  }
}

export const music = new MusicManager();
