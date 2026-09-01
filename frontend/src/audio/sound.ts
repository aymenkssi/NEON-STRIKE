import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from "expo-audio";

const FILES: Record<string, number> = {
  shotgun: require("../../assets/sounds/shotgun.wav"),
  smg: require("../../assets/sounds/smg.wav"),
  rifle: require("../../assets/sounds/rifle.wav"),
  empty: require("../../assets/sounds/empty.wav"),
  reload: require("../../assets/sounds/reload.wav"),
  hit: require("../../assets/sounds/hit.wav"),
  zombie: require("../../assets/sounds/zombie.wav"),
  wave: require("../../assets/sounds/wave.wav"),
  gameover: require("../../assets/sounds/gameover.wav"),
  pickup: require("../../assets/sounds/pickup.wav"),
  switch: require("../../assets/sounds/switch.wav"),
};

const VOLUMES: Record<string, number> = {
  shotgun: 0.95,
  smg: 0.7,
  rifle: 0.85,
  empty: 0.5,
  reload: 0.7,
  hit: 0.6,
  zombie: 0.5,
  wave: 0.7,
  gameover: 0.9,
  pickup: 0.8,
  switch: 0.7,
};

// Rapid-fire sounds need several players so overlapping shots each start
// instantly instead of restarting a single player (which causes desync).
const POOL_SIZE: Record<string, number> = {
  shotgun: 4,
  smg: 6,
  rifle: 5,
  hit: 3,
};

class SoundManager {
  private pools: Record<string, AudioPlayer[]> = {};
  private next: Record<string, number> = {};
  private ready = false;
  enabled = true;

  async init() {
    if (this.ready) return;
    try {
      await setAudioModeAsync({ playsInSilentMode: true });
    } catch {}
    for (const key of Object.keys(FILES)) {
      const count = POOL_SIZE[key] ?? 1;
      const players: AudioPlayer[] = [];
      for (let i = 0; i < count; i++) {
        try {
          const p = createAudioPlayer(FILES[key]);
          p.volume = VOLUMES[key] ?? 0.7;
          players.push(p);
        } catch {}
      }
      this.pools[key] = players;
      this.next[key] = 0;
    }
    this.ready = true;
  }

  setEnabled(v: boolean) {
    this.enabled = v;
  }

  play(name: string) {
    if (!this.enabled) return;
    const pool = this.pools[name];
    if (!pool || pool.length === 0) return;
    const idx = this.next[name] % pool.length;
    this.next[name] = idx + 1;
    const p = pool[idx];
    try {
      p.seekTo(0);
      p.play();
    } catch {}
  }

  dispose() {
    for (const key of Object.keys(this.pools)) {
      for (const p of this.pools[key]) {
        try {
          p.remove();
        } catch {}
      }
    }
    this.pools = {};
    this.ready = false;
  }
}

export const sound = new SoundManager();
