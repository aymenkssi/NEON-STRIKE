import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { GLView, type ExpoWebGLRenderingContext } from "expo-gl";
import * as Haptics from "expo-haptics";
import { GameEngine, type GameStats, type RunResult } from "../game/GameEngine";
import { levelReward, type LevelResult, type PlayerModifiers } from "../game/progression";
import { applyEvent, emptyStats, type MetaEvent, type PlayerStats } from "../game/meta";
import { sound } from "../audio/sound";
import { showInterstitialAtBreak, showRewarded } from "../ads";
import { colors, fonts } from "../theme";
import HUD from "./HUD";
import TouchControls from "./TouchControls";
import PauseMenu from "./PauseMenu";
import GameOver from "./GameOver";
import LevelComplete from "./LevelComplete";

type Props = {
  username: string;
  lookSensitivity: number;
  soundEnabled: boolean;
  startLevel: number;
  unlockedLevel: number;
  modifiers: PlayerModifiers;
  // Persists a finished level (stars + credits) and unlocks the next one.
  onLevelDone: (level: number, stars: number, credits: number) => void;
  onAddCredits: (credits: number) => void;
  // Stats of the play session (kills, levels…) for missions and achievements.
  onSession: (session: PlayerStats) => void;
  onExit: () => void;
};

const INITIAL: GameStats = {
  health: 100,
  maxHealth: 100,
  ammo: 5,
  maxAmmo: 5,
  reloading: false,
  score: 0,
  level: 1,
  wave: 1,
  totalWaves: 2,
  kills: 0,
  credits: 0,
  boss: null,
  weaponIndex: 0,
  weapons: [],
  sector: { index: 1, name: "NEON DISTRICT" },
  powerups: [],
};

export default function GameScreen({
  username,
  lookSensitivity,
  soundEnabled,
  startLevel,
  unlockedLevel,
  modifiers,
  onLevelDone,
  onAddCredits,
  onSession,
  onExit,
}: Props) {
  const engineRef = useRef<GameEngine | null>(null);
  const [stats, setStats] = useState<GameStats>(INITIAL);
  const [status, setStatus] = useState<"playing" | "paused" | "gameover" | "complete">("playing");
  const [result, setResult] = useState<RunResult>({ score: 0, level: startLevel, kills: 0, credits: 0 });
  const [levelResult, setLevelResult] = useState<LevelResult | null>(null);
  // Credits picked up before dying are paid out when the player leaves the game-over screen
  // (not on revive, which continues the level and pays through the level reward instead).
  const pendingRunCredits = useRef(0);
  const latest = useRef({ unlockedLevel, modifiers, onLevelDone, onSession });
  latest.current = { unlockedLevel, modifiers, onLevelDone, onSession };

  // Events are batched and saved at natural breaks (level end, death, exit).
  const session = useRef<PlayerStats>(emptyStats());
  const track = useCallback((e: MetaEvent) => {
    session.current = applyEvent(session.current, e);
  }, []);
  const flushSession = useCallback(() => {
    const s = session.current;
    if (s.kills || s.levels || s.deaths || s.powerups) latest.current.onSession(s);
    session.current = emptyStats();
  }, []);
  const [hitSignal, setHitSignal] = useState(0);
  const [damageSignal, setDamageSignal] = useState(0);
  const [canRevive, setCanRevive] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<any>(null);

  const notify = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 1600);
  }, []);

  useEffect(() => {
    sound.init().then(() => sound.setEnabled(soundEnabled));
    return () => {
      flushSession();
      engineRef.current?.dispose();
      engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    sound.setEnabled(soundEnabled);
  }, [soundEnabled]);

  useEffect(() => {
    if (engineRef.current) engineRef.current.lookSensitivity = lookSensitivity;
  }, [lookSensitivity]);

  const onContextCreate = useCallback(
    (gl: ExpoWebGLRenderingContext) => {
      engineRef.current = new GameEngine(
        gl,
        {
          onStats: setStats,
          onHitMarker: () => setHitSignal((v) => v + 1),
          onDamage: () => {
            setDamageSignal((v) => v + 1);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
          },
          onGameOver: (r) => {
            setResult(r);
            pendingRunCredits.current = r.credits;
            flushSession();
            setStatus("gameover");
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
          },
          onLevelComplete: (r) => {
            const reward = levelReward(r);
            latest.current.onLevelDone(r.level, reward.stars, reward.total);
            track({ type: "level", stars: reward.stars });
            flushSession();
            setLevelResult(r);
            setStatus("complete");
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          },
          onNotify: notify,
          playSound: (n) => sound.play(n),
          onEvent: track,
        },
        { lookSensitivity, level: startLevel, unlockedLevel, modifiers }
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const getEngine = useCallback(() => engineRef.current, []);

  const pause = () => {
    engineRef.current?.pause();
    setStatus("paused");
  };
  const resume = () => {
    engineRef.current?.resume();
    setStatus("playing");
  };
  const payPendingCredits = () => {
    if (pendingRunCredits.current > 0) onAddCredits(pendingRunCredits.current);
    pendingRunCredits.current = 0;
  };
  const restart = () => {
    payPendingCredits();
    engineRef.current?.startLevel(stats.level, {
      keepRun: false,
      unlockedLevel: latest.current.unlockedLevel,
      modifiers: latest.current.modifiers,
    });
    setCanRevive(true);
    setStatus("playing");
  };
  const nextLevel = () => {
    const next = (levelResult?.level ?? stats.level) + 1;
    engineRef.current?.startLevel(next, {
      keepRun: true,
      unlockedLevel: Math.max(latest.current.unlockedLevel, next),
      modifiers: latest.current.modifiers,
    });
    setLevelResult(null);
    setCanRevive(true);
    setStatus("playing");
  };
  const exit = () => {
    payPendingCredits();
    onExit();
  };
  // Leaving a level-complete / game-over screen is a natural break: maybe show an interstitial first.
  const atBreak = (fn: () => void) => () => showInterstitialAtBreak(fn);
  const revive = () => {
    setCanRevive(false);
    showRewarded(() => {
      pendingRunCredits.current = 0;
      engineRef.current?.revive();
      setStatus("playing");
    });
  };

  return (
    <View style={styles.root}>
      <GLView style={StyleSheet.absoluteFill} onContextCreate={onContextCreate} />

      {status === "playing" && <TouchControls getEngine={getEngine} />}

      {(status === "playing" || status === "paused") && (
        <HUD
          stats={stats}
          hitSignal={hitSignal}
          damageSignal={damageSignal}
          onPause={pause}
          onSwitchWeapon={(i) => engineRef.current?.switchWeapon(i)}
        />
      )}

      {toast && status === "playing" && (
        <View style={styles.toastWrap} pointerEvents="none">
          <View style={styles.toast}>
            <Text style={styles.toastText}>{toast}</Text>
          </View>
        </View>
      )}

      {status === "paused" && <PauseMenu onResume={resume} onRestart={restart} onExit={onExit} />}

      {status === "gameover" && (
        <GameOver
          username={username}
          result={result}
          canRevive={canRevive}
          onRevive={revive}
          onRestart={atBreak(restart)}
          onExit={atBreak(exit)}
        />
      )}

      {status === "complete" && levelResult && (
        <LevelComplete
          result={levelResult}
          onDoubleCredits={onAddCredits}
          onNext={atBreak(nextLevel)}
          onExit={atBreak(onExit)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#05070a" },
  toastWrap: { position: "absolute", top: "22%", left: 0, right: 0, alignItems: "center" },
  toast: {
    backgroundColor: "rgba(13,15,18,0.85)",
    borderWidth: 1.5,
    borderColor: colors.brand,
    borderRadius: 8,
    paddingHorizontal: 18,
    paddingVertical: 8,
  },
  toastText: { color: colors.brand, fontFamily: fonts.display, fontSize: 16, letterSpacing: 1.5 },
});
