import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from "expo-audio";

const FILES: Record<string, number> = {
  shotgun: require("../../assets/sounds/shotgun.wav"),
  empty: require("../../assets/sounds/empty.wav"),
  reload: require("../../assets/sounds/reload.wav"),
  hit: require("../../assets/sounds/hit.wav"),
  zombie: require("../../assets/sounds/zombie.wav"),
  wave: require("../../assets/sounds/wave.wav"),
  gameover: require("../../assets/sounds/gameover.wav"),
};

const VOLUMES: Record<string, number> = {
  shotgun: 0.9,
  empty: 0.5,
  reload: 0.7,
  hit: 0.6,
  zombie: 0.5,
  wave: 0.7,
  gameover: 0.9,
};

class SoundManager {
  private players: Record<string, AudioPlayer> = {};
  private ready = false;
  enabled = true;

  async init() {
    if (this.ready) return;
    try {
      await setAudioModeAsync({ playsInSilentMode: true });
    } catch {}
    for (const key of Object.keys(FILES)) {
      try {
        const p = createAudioPlayer(FILES[key]);
        p.volume = VOLUMES[key] ?? 0.7;
        this.players[key] = p;
      } catch {}
    }
    this.ready = true;
  }

  setEnabled(v: boolean) {
    this.enabled = v;
  }

  play(name: string) {
    if (!this.enabled) return;
    const p = this.players[name];
    if (!p) return;
    try {
      p.seekTo(0);
      p.play();
    } catch {}
  }

  dispose() {
    for (const key of Object.keys(this.players)) {
      try {
        this.players[key].remove();
      } catch {}
    }
    this.players = {};
    this.ready = false;
  }
}

export const sound = new SoundManager();
