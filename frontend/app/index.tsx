import React, { useEffect, useState } from "react";
import { View, StyleSheet, StatusBar } from "react-native";
import { storage } from "@/src/utils/storage";
import MainMenu from "@/src/components/MainMenu";
import GameScreen from "@/src/components/GameScreen";

const KEYS = {
  username: "np_username",
  lookSens: "np_look_sensitivity",
  sound: "np_sound_enabled",
};

export default function Index() {
  const [ready, setReady] = useState(false);
  const [screen, setScreen] = useState<"menu" | "game">("menu");
  const [username, setUsername] = useState("PLAYER");
  const [lookSensitivity, setLookSensitivity] = useState(0.008);
  const [soundEnabled, setSoundEnabled] = useState(true);

  useEffect(() => {
    (async () => {
      const u = await storage.getItem(KEYS.username, "PLAYER");
      const s = await storage.getItem(KEYS.lookSens, 0.008);
      const snd = await storage.getItem(KEYS.sound, true);
      if (u) setUsername(u);
      if (typeof s === "number") setLookSensitivity(s);
      if (typeof snd === "boolean") setSoundEnabled(snd);
      setReady(true);
    })();
  }, []);

  const updateUsername = (v: string) => {
    setUsername(v);
    storage.setItem(KEYS.username, v);
  };
  const updateLookSens = (v: number) => {
    setLookSensitivity(v);
    storage.setItem(KEYS.lookSens, v);
  };
  const updateSound = (v: boolean) => {
    setSoundEnabled(v);
    storage.setItem(KEYS.sound, v);
  };

  const startGame = () => {
    if (!username || !username.trim()) updateUsername("PLAYER");
    setScreen("game");
  };

  if (!ready) return <View style={styles.root} />;

  return (
    <View style={styles.root}>
      <StatusBar hidden />
      {screen === "menu" ? (
        <MainMenu
          username={username}
          setUsername={updateUsername}
          lookSensitivity={lookSensitivity}
          setLookSensitivity={updateLookSens}
          soundEnabled={soundEnabled}
          setSoundEnabled={updateSound}
          onPlay={startGame}
        />
      ) : (
        <GameScreen
          username={username && username.trim() ? username.trim() : "PLAYER"}
          lookSensitivity={lookSensitivity}
          soundEnabled={soundEnabled}
          onExit={() => setScreen("menu")}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#05070a" },
});
