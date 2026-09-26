import { useCallback, useEffect, useState } from "react";
import { storage } from "@/src/utils/storage";
import { setHapticsEnabled } from "@/src/utils/haptics";
import type { Difficulty } from "@/src/game/progression";

// Gameplay options of the Settings panel (and the difficulty picked in the level list).
export type Quality = "low" | "normal" | "high";
export const QUALITIES: Quality[] = ["low", "normal", "high"];

export type GameSettings = {
  difficulty: Difficulty;
  aimAssist: boolean;
  quality: Quality;
  vibration: boolean;
  invertY: boolean;
};

export const DEFAULT_SETTINGS: GameSettings = {
  difficulty: "normal",
  aimAssist: true,
  quality: "normal",
  vibration: true,
  invertY: false,
};

const KEY = "np_game_settings";

export function useGameSettings() {
  const [settings, setSettings] = useState<GameSettings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      const raw = await storage.getItem(KEY, null as string | null);
      let s = DEFAULT_SETTINGS;
      try {
        if (typeof raw === "string") s = { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
      } catch {}
      setSettings(s);
      setHapticsEnabled(s.vibration);
      setLoaded(true);
    })();
  }, []);

  const update = useCallback((patch: Partial<GameSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      storage.setItem(KEY, JSON.stringify(next));
      setHapticsEnabled(next.vibration);
      return next;
    });
  }, []);

  return { settings, loaded, update };
}
