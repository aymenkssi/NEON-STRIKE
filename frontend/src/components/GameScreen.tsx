import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, BackHandler } from "react-native";
import { GLView, type ExpoWebGLRenderingContext } from "expo-gl";
import * as Haptics from "@/src/utils/haptics";
import { GameEngine, type EngineOptions, type GameStats, type RunResult } from "../game/GameEngine";
import { levelReward, type Difficulty, type LevelResult, type PlayerModifiers } from "../game/progression";
import { applyEvent, emptyStats, type MetaEvent, type PlayerStats } from "../game/meta";
import { sound } from "../audio/sound";
import { submitRunScore } from "../api/leaderboard";
import { showInterstitialAtBreak, showRewarded } from "../ads";
import { colors, fonts } from "../theme";
import HUD from "./HUD";
import TouchControls from "./TouchControls";
import PauseMenu from "./PauseMenu";
import GameOver from "./GameOver";
import LevelComplete from "./LevelComplete";
import StoryComic from "./StoryComic";
import RadioLine from "./RadioLine";
import { RADIO, actEndingAt, type Act, type ActReward, type Line, type StoryState } from "../game/story";

type Props = {
  username: string;
  guest: boolean;
  lookSensitivity: number;
  soundEnabled: boolean;
  startLevel: number;
  unlockedLevel: number;
  modifiers: PlayerModifiers;
  difficulty: Difficulty;
  options: EngineOptions; // aim assist, invert Y, graphics quality, skins
  // Persists a finished level (stars + credits) and unlocks the next one.
  onLevelDone: (level: number, stars: number, credits: number, difficulty: Difficulty) => void;
  onAddCredits: (credits: number) => void;
  // Rounds left per weapon (limited ammo), saved at the end of a level, on death and on exit.
  onAmmo: (stock: Record<string, number>) => void;
  // Stats of the play session (kills, levels…) for missions and achievements.
  onSession: (session: PlayerStats) => void;
  onExit: () => void;
  // Story mode: comic pages already seen, and the act rewards.
  story: StoryState;
  onComicSeen: (id: string) => void;
  onClaimAct: (n: number) => ActReward | null;
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
  fireMode: "single",
  fireModes: ["single"],
  sector: { index: 1, name: "PARIS" },
  powerups: [],
  difficulty: "normal",
  grenades: 3,
  reserve: null,
  aiming: false,
};

export default function GameScreen({
  username,
  guest,
  lookSensitivity,
  soundEnabled,
  startLevel,
  unlockedLevel,
  modifiers,
  difficulty,
  options,
  onLevelDone,
  onAddCredits,
  onAmmo,
  onSession,
  onExit,
  story,
  onComicSeen,
  onClaimAct,
}: Props) {
  const engineRef = useRef<GameEngine | null>(null);
  const [stats, setStats] = useState<GameStats>(INITIAL);
  const [status, setStatus] = useState<"playing" | "paused" | "gameover" | "complete" | "story">("playing");
  // End of a story act: its closing comic (and reward) before going on.
  const [ending, setEnding] = useState<{ act: Act; reward: ActReward | null; then: () => void } | null>(null);
  const storyRef = useRef(story);
  storyRef.current = story;
  // Radio line of the story shown at the top of the screen for a few seconds.
  const [radio, setRadio] = useState<Line | null>(null);
  const radioTimer = useRef<any>(null);
  const say = useCallback((line?: Line) => {
    if (!line) return;
    setRadio(line);
    if (radioTimer.current) clearTimeout(radioTimer.current);
    radioTimer.current = setTimeout(() => setRadio(null), 6000);
  }, []);
  const [result, setResult] = useState<RunResult>({ score: 0, level: startLevel, kills: 0, credits: 0 });
  const [levelResult, setLevelResult] = useState<LevelResult | null>(null);
  // Credits picked up before dying are paid out when the player leaves the game-over screen
  // (not on revive, which continues the level and pays through the level reward instead).
  const pendingRunCredits = useRef(0);
  const latest = useRef({ unlockedLevel, modifiers, onLevelDone, onSession, onAmmo });
  latest.current = { unlockedLevel, modifiers, onLevelDone, onSession, onAmmo };

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
    toastTimer.current = setTimeout(() => setToast(null), Math.max(1600, msg.length * 60));
  }, []);

  useEffect(() => {
    sound.init().then(() => sound.setEnabled(soundEnabled));
    return () => {
      flushSession();
      if (engineRef.current) latest.current.onAmmo(engineRef.current.ammoStock());
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
            latest.current.onLevelDone(r.level, reward.stars, reward.total, r.difficulty ?? "normal");
            // Accounts: every level cleared counts for the leaderboard (not only a game over).
            if (!guest) submitRunScore({ name: username, score: r.score, level: r.level, kills: r.runKills ?? r.kills }).catch(() => {});
            track({ type: "level", stars: reward.stars });
            flushSession();
            setLevelResult(r);
            setStatus("complete");
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          },
          onNotify: notify,
          playSound: (n) => sound.play(n),
          onEvent: track,
          onAmmo: (stock) => latest.current.onAmmo(stock),
        },
        { lookSensitivity, level: startLevel, unlockedLevel, modifiers, difficulty, options }
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
  // Android back button in game: pause (the pause menu offers menu / quit).
  const statusRef = useRef(status);
  statusRef.current = status;
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (statusRef.current === "playing") {
        engineRef.current?.pause();
        setStatus("paused");
      }
      return true;
    });
    return () => sub.remove();
  }, []);
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
  // After the last level of a story act: the closing comic and the reward come first.
  const afterLevel = (fn: () => void) => () => {
    const act = levelResult ? actEndingAt(levelResult.level) : null;
    const s = storyRef.current;
    if (act?.outro && (!s.seen.includes(act.outro) || (act.reward && !s.claimed.includes(act.n)))) {
      setEnding({ act, reward: act.reward && !s.claimed.includes(act.n) ? act.reward : null, then: fn });
      setStatus("story");
    } else fn();
  };
  const endStory = () => {
    if (!ending) return;
    if (ending.act.outro) onComicSeen(ending.act.outro);
    const then = ending.then;
    setEnding(null);
    then();
  };

  // Story radio: a line when a level starts and when its boss shows up.
  const radioLevel = useRef(0);
  useEffect(() => {
    if (stats === INITIAL || status !== "playing" || radioLevel.current === stats.level) return;
    radioLevel.current = stats.level;
    const lvl = stats.level;
    setTimeout(() => say(RADIO[lvl]?.start), 1200);
  }, [stats, status, say]);
  const bossUp = !!stats.boss;
  useEffect(() => {
    if (bossUp) say(RADIO[stats.level]?.boss);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bossUp]);
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

      {status === "playing" && <TouchControls getEngine={getEngine} fireMode={stats.fireMode} fireModes={stats.fireModes} grenades={stats.grenades} aiming={stats.aiming} />}

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

      {radio && status === "playing" && <RadioLine line={radio} />}

      {status === "paused" && <PauseMenu onResume={resume} onRestart={restart} onExit={onExit} />}

      {status === "gameover" && (
        <GameOver
          username={username}
          guest={guest}
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
          onNext={afterLevel(atBreak(nextLevel))}
          onExit={afterLevel(atBreak(onExit))}
        />
      )}

      {status === "story" && ending?.act.outro && (
        <StoryComic
          id={ending.act.outro}
          act={ending.act}
          reward={ending.reward}
          onClaim={() => onClaimAct(ending.act.n)}
          onDone={endStory}
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
