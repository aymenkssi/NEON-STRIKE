import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, StyleSheet } from "react-native";
import { GLView, type ExpoWebGLRenderingContext } from "expo-gl";
import * as Haptics from "expo-haptics";
import { GameEngine, type GameStats } from "../game/GameEngine";
import { sound } from "../audio/sound";
import { showRewarded } from "../ads";
import HUD from "./HUD";
import TouchControls from "./TouchControls";
import PauseMenu from "./PauseMenu";
import GameOver from "./GameOver";

type Props = {
  username: string;
  lookSensitivity: number;
  soundEnabled: boolean;
  onExit: () => void;
};

const INITIAL: GameStats = { health: 100, ammo: 5, maxAmmo: 5, reloading: false, score: 0, wave: 1, kills: 0 };

export default function GameScreen({ username, lookSensitivity, soundEnabled, onExit }: Props) {
  const engineRef = useRef<GameEngine | null>(null);
  const [stats, setStats] = useState<GameStats>(INITIAL);
  const [status, setStatus] = useState<"playing" | "paused" | "gameover">("playing");
  const [result, setResult] = useState({ score: 0, wave: 1, kills: 0 });
  const [hitSignal, setHitSignal] = useState(0);
  const [damageSignal, setDamageSignal] = useState(0);
  const [canRevive, setCanRevive] = useState(true);

  useEffect(() => {
    sound.init().then(() => sound.setEnabled(soundEnabled));
    return () => {
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
            setStatus("gameover");
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
          },
          playSound: (n) => sound.play(n),
        },
        { lookSensitivity }
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
  const restart = () => {
    engineRef.current?.restart();
    setCanRevive(true);
    setStatus("playing");
  };
  const revive = () => {
    setCanRevive(false);
    showRewarded(() => {
      engineRef.current?.revive();
      setStatus("playing");
    });
  };

  return (
    <View style={styles.root}>
      <GLView style={StyleSheet.absoluteFill} onContextCreate={onContextCreate} />

      {status === "playing" && <TouchControls getEngine={getEngine} />}

      {status !== "gameover" && (
        <HUD stats={stats} hitSignal={hitSignal} damageSignal={damageSignal} onPause={pause} />
      )}

      {status === "paused" && <PauseMenu onResume={resume} onRestart={restart} onExit={onExit} />}

      {status === "gameover" && (
        <GameOver
          username={username}
          result={result}
          canRevive={canRevive}
          onRevive={revive}
          onRestart={restart}
          onExit={onExit}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#05070a" },
});
