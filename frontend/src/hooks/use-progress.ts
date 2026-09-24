import { useCallback, useEffect, useRef, useState } from "react";
import { storage } from "@/src/utils/storage";
import {
  DAILY_REWARDS,
  MAX_LEVEL,
  NO_UPGRADES,
  dailyStatus,
  dayKey,
  upgradeCost,
  type UpgradeKey,
  type UpgradeLevels,
} from "@/src/game/progression";

// One JSON blob keeps the save atomic (storage values are primitives only).
const KEY = "np_progress_v1";

export type Progress = {
  credits: number;
  unlockedLevel: number; // highest playable level
  stars: Record<string, number>; // level -> best stars (1..3)
  upgrades: UpgradeLevels;
  dailyLast: string; // dayKey of the last claim, "" if never
  dailyStreak: number;
};

const DEFAULT: Progress = {
  credits: 0,
  unlockedLevel: 1,
  stars: {},
  upgrades: NO_UPGRADES,
  dailyLast: "",
  dailyStreak: 0,
};

function parse(raw: string | null): Progress {
  if (!raw) return DEFAULT;
  try {
    const p = JSON.parse(raw);
    return { ...DEFAULT, ...p, upgrades: { ...NO_UPGRADES, ...(p.upgrades || {}) } };
  } catch {
    return DEFAULT;
  }
}

export function useProgress() {
  const [progress, setProgress] = useState<Progress>(DEFAULT);
  const [loaded, setLoaded] = useState(false);
  const ref = useRef(progress);

  useEffect(() => {
    (async () => {
      const raw = await storage.getItem(KEY, null as string | null);
      const p = parse(typeof raw === "string" ? raw : null);
      ref.current = p;
      setProgress(p);
      setLoaded(true);
    })();
  }, []);

  const update = useCallback((fn: (p: Progress) => Progress) => {
    const next = fn(ref.current);
    ref.current = next;
    setProgress(next);
    storage.setItem(KEY, JSON.stringify(next));
    return next;
  }, []);

  const addCredits = useCallback(
    (amount: number) => update((p) => ({ ...p, credits: p.credits + Math.max(0, Math.round(amount)) })),
    [update]
  );

  const completeLevel = useCallback(
    (level: number, stars: number, credits: number) =>
      update((p) => ({
        ...p,
        credits: p.credits + credits,
        unlockedLevel: Math.max(p.unlockedLevel, Math.min(level + 1, MAX_LEVEL)),
        stars: { ...p.stars, [level]: Math.max(p.stars[level] || 0, stars) },
      })),
    [update]
  );

  const buyUpgrade = useCallback(
    (key: UpgradeKey) => {
      const cur = ref.current.upgrades[key];
      const cost = upgradeCost(cur);
      if (cost === null || ref.current.credits < cost) return false;
      update((p) => ({ ...p, credits: p.credits - cost, upgrades: { ...p.upgrades, [key]: cur + 1 } }));
      return true;
    },
    [update]
  );

  const claimDaily = useCallback(() => {
    const today = dayKey();
    const st = dailyStatus(ref.current.dailyLast, ref.current.dailyStreak, today);
    if (!st.canClaim) return 0;
    const amount = DAILY_REWARDS[st.dayIndex];
    update((p) => ({ ...p, credits: p.credits + amount, dailyLast: today, dailyStreak: st.dayIndex + 1 }));
    return amount;
  }, [update]);

  return { progress, loaded, addCredits, completeLevel, buyUpgrade, claimDaily };
}
