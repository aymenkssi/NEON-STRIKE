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
  type Difficulty,
  type UpgradeKey,
  type UpgradeLevels,
} from "@/src/game/progression";
import { DEFAULT_SKINS, ownsSkin, skinPrice, OUTFITS, type SkinState } from "@/src/game/skins";
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
  nightmare: Record<string, boolean>; // levels cleared in Nightmare (red skull)
  skins: SkinState;
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
  nightmare: {},
  skins: DEFAULT_SKINS,
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
    const skins = { ...DEFAULT_SKINS, ...(p.skins || {}) };
    skins.owned = Array.isArray(skins.owned) ? skins.owned.filter((id: unknown) => typeof id === "string") : [];
    return { ...DEFAULT, ...p, upgrades: { ...NO_UPGRADES, ...(p.upgrades || {}) }, stats, nightmare: { ...(p.nightmare || {}) }, skins };
  } catch {
    return DEFAULT;
  }
}

// cloudEnabled: only signed-in accounts sync online; guests keep everything on the phone.
export function useProgress(cloudEnabled: boolean) {
  const [progress, setProgress] = useState<Progress>(DEFAULT);
  const [loaded, setLoaded] = useState(false);
  const [cloud, setCloud] = useState<CloudStatus>("off");
  const ref = useRef(progress);
  const pushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const enabled = useRef(false);
  enabled.current = cloudAvailable && cloudEnabled;

  const replace = useCallback((p: Progress) => {
    ref.current = p;
    setProgress(p);
    storage.setItem(KEY, JSON.stringify(p));
  }, []);

  const push = useCallback(async () => {
    if (!enabled.current) return;
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
      if (!enabled.current) return false;
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
    })();
    // Upload right away when the app goes to the background.
    const sub = AppState.addEventListener("change", (state) => {
      if (state !== "active" && pushTimer.current) push();
    });
    return () => sub.remove();
  }, [push]);

  // Sync when an account is (or becomes) active; show "off" for guests.
  useEffect(() => {
    if (!loaded) return;
    if (cloudAvailable && cloudEnabled) syncFromCloud();
    else setCloud("off");
  }, [loaded, cloudEnabled, syncFromCloud]);

  // Logout: upload pending changes, then start again from a blank progress on this phone.
  // keepPending=false (account deleted): drop unsent changes instead of pushing them.
  const resetLocal = useCallback(async (keepPending = true) => {
    if (keepPending && pushTimer.current) await push();
    if (pushTimer.current) clearTimeout(pushTimer.current);
    pushTimer.current = null;
    replace(DEFAULT);
  }, [push, replace]);

  const update = useCallback(
    (fn: (p: Progress) => Progress) => {
      const next = { ...fn(ref.current), updatedAt: Date.now() };
      replace(next);
      if (enabled.current) {
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
    (level: number, stars: number, credits: number, difficulty: Difficulty = "normal") =>
      update((p) => ({
        ...p,
        credits: p.credits + credits,
        unlockedLevel: Math.max(p.unlockedLevel, Math.min(level + 1, MAX_LEVEL)),
        stars: { ...p.stars, [level]: Math.max(p.stars[level] || 0, stars) },
        nightmare: difficulty === "nightmare" ? { ...p.nightmare, [level]: true } : p.nightmare,
      })),
    [update]
  );

  // Skins: buying equips at once; returns false when the player cannot afford it.
  const buySkin = useCallback(
    (id: string) => {
      const price = skinPrice(id);
      const cur = ref.current;
      if (price === null) return false;
      if (ownsSkin(cur.skins, id)) return true;
      if (cur.credits < price) return false;
      update((p) => ({ ...p, credits: p.credits - price, skins: equipped({ ...p.skins, owned: [...p.skins.owned, id] }, id) }));
      return true;
    },
    [update]
  );

  // Season rewards: the Champion skin is added (and equipped) with the credits.
  const grantSeasonReward = useCallback(
    (credits: number, skin: string | null) =>
      update((p) => {
        const owned = skin && !p.skins.owned.includes(skin) ? [...p.skins.owned, skin] : p.skins.owned;
        const skins = skin ? equipped({ ...p.skins, owned }, skin) : p.skins;
        return { ...p, credits: p.credits + Math.max(0, Math.round(credits)), skins };
      }),
    [update]
  );

  const equipSkin = useCallback(
    (id: string) => {
      if (!ownsSkin(ref.current.skins, id)) return;
      update((p) => ({ ...p, skins: equipped(p.skins, id) }));
    },
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
    resetLocal,
    addCredits,
    completeLevel,
    buyUpgrade,
    claimDaily,
    recordSession,
    claimMission,
    claimAchievement,
    buySkin,
    equipSkin,
    grantSeasonReward,
  };
}

function equipped(s: SkinState, id: string): SkinState {
  return OUTFITS.some((o) => o.id === id) ? { ...s, outfit: id } : { ...s, weapon: id };
}
