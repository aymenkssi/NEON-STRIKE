import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { cloudAvailable, fetchSave, pushSave } from "@/src/api/cloud";
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
import {
  ACHIEVEMENTS,
  advanceMissions,
  achievementView,
  emptyStats,
  mergeStats,
  missionView,
  missionsForDay,
  type MissionState,
  type PlayerStats,
} from "@/src/game/meta";

// One JSON blob keeps the save atomic (storage values are primitives only).
const KEY = "np_progress_v1";

export type Progress = {
  credits: number;
  unlockedLevel: number; // highest playable level
  stars: Record<string, number>; // level -> best stars (1..3)
  upgrades: UpgradeLevels;
  dailyLast: string; // dayKey of the last claim, "" if never
  dailyStreak: number;
  stats: PlayerStats;
  missions: MissionState | null;
  achievementsClaimed: string[];
  updatedAt: number; // ms of the last change, decides which save wins when syncing
};

const DEFAULT: Progress = {
  credits: 0,
  unlockedLevel: 1,
  stars: {},
  upgrades: NO_UPGRADES,
  dailyLast: "",
  dailyStreak: 0,
  stats: emptyStats(),
  missions: null,
  achievementsClaimed: [],
  updatedAt: 0,
};

const PUSH_DELAY_MS = 4000;

export type CloudStatus = "off" | "syncing" | "synced" | "offline";

function parse(raw: string | null): Progress {
  if (!raw) return DEFAULT;
  try {
    return fromObject(JSON.parse(raw));
  } catch {
    return DEFAULT;
  }
}

function fromObject(p: any): Progress {
  try {
    // Older saves have no stats/missions: fill every missing field from the defaults.
    const stats = { ...emptyStats(), ...(p.stats || {}) };
    stats.byKind = { ...emptyStats().byKind, ...(p.stats?.byKind || {}) };
    return { ...DEFAULT, ...p, upgrades: { ...NO_UPGRADES, ...(p.upgrades || {}) }, stats };
  } catch {
    return DEFAULT;
  }
}

export function useProgress() {
  const [progress, setProgress] = useState<Progress>(DEFAULT);
  const [loaded, setLoaded] = useState(false);
  const [cloud, setCloud] = useState<CloudStatus>(cloudAvailable ? "syncing" : "off");
  const ref = useRef(progress);
  const pushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const replace = useCallback((p: Progress) => {
    ref.current = p;
    setProgress(p);
    storage.setItem(KEY, JSON.stringify(p));
  }, []);

  const push = useCallback(async () => {
    if (!cloudAvailable) return;
    if (pushTimer.current) clearTimeout(pushTimer.current);
    pushTimer.current = null;
    try {
      await pushSave(ref.current, ref.current.updatedAt);
      setCloud("synced");
    } catch {
      setCloud("offline");
    }
  }, []);

  // Downloads the online save and keeps it if it is newer than this phone's (or when forced,
  // after a recovery code was used). Otherwise uploads the local one.
  const syncFromCloud = useCallback(
    async (force = false) => {
      if (!cloudAvailable) return false;
      setCloud("syncing");
      try {
        const remote = await fetchSave();
        if (remote && (force || remote.updated_at > ref.current.updatedAt)) {
          replace({ ...fromObject(remote.data), updatedAt: remote.updated_at });
          setCloud("synced");
          return true;
        }
        await push();
        return false;
      } catch {
        setCloud("offline");
        return false;
      }
    },
    [push, replace]
  );

  useEffect(() => {
    (async () => {
      const raw = await storage.getItem(KEY, null as string | null);
      const p = parse(typeof raw === "string" ? raw : null);
      ref.current = p;
      setProgress(p);
      setLoaded(true);
      syncFromCloud();
    })();
    // Upload right away when the app goes to the background.
    const sub = AppState.addEventListener("change", (state) => {
      if (state !== "active" && pushTimer.current) push();
    });
    return () => sub.remove();
  }, [push, syncFromCloud]);

  const update = useCallback(
    (fn: (p: Progress) => Progress) => {
      const next = { ...fn(ref.current), updatedAt: Date.now() };
      replace(next);
      if (cloudAvailable) {
        if (pushTimer.current) clearTimeout(pushTimer.current);
        pushTimer.current = setTimeout(push, PUSH_DELAY_MS);
      }
      return next;
    },
    [push, replace]
  );

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

  // Adds a play session (kills, levels…) to lifetime stats and today's missions.
  const recordSession = useCallback(
    (session: PlayerStats) =>
      update((p) => {
        const missions = missionsForDay(p.missions, dayKey(), p.unlockedLevel);
        return { ...p, stats: mergeStats(p.stats, session), missions: advanceMissions(missions, session) };
      }),
    [update]
  );

  const claimMission = useCallback(
    (id: string) => {
      const m = missionView(missionsForDay(ref.current.missions, dayKey(), ref.current.unlockedLevel)).find((x) => x.id === id);
      if (!m || !m.done || m.claimed) return 0;
      update((p) => {
        const missions = missionsForDay(p.missions, dayKey(), p.unlockedLevel);
        return { ...p, credits: p.credits + m.reward, missions: { ...missions, claimed: [...missions.claimed, id] } };
      });
      return m.reward;
    },
    [update]
  );

  const claimAchievement = useCallback(
    (id: string) => {
      const a = achievementView(ref.current, ref.current.achievementsClaimed).find((x) => x.id === id);
      if (!a || !a.done || a.claimed || !ACHIEVEMENTS.some((x) => x.id === id)) return 0;
      update((p) => ({ ...p, credits: p.credits + a.reward, achievementsClaimed: [...p.achievementsClaimed, id] }));
      return a.reward;
    },
    [update]
  );

  return {
    progress,
    loaded,
    cloud,
    syncFromCloud,
    addCredits,
    completeLevel,
    buyUpgrade,
    claimDaily,
    recordSession,
    claimMission,
    claimAchievement,
  };
}
