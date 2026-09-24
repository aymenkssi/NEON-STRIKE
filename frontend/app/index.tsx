import React, { useEffect, useState } from "react";
import { View, StyleSheet, StatusBar } from "react-native";
import { storage } from "@/src/utils/storage";
import MainMenu from "@/src/components/MainMenu";
import GameScreen from "@/src/components/GameScreen";
import { useProgress } from "@/src/hooks/use-progress";
import { modifiersFrom } from "@/src/game/progression";
import { initStore } from "@/src/iap";
import { music } from "@/src/audio/music";
import { setRemotePacks } from "@/src/iap/catalog";
import { fetchRemoteConfig, loadCachedConfig, type RemoteMessage } from "@/src/api/config";

const KEYS = {
  username: "np_username",
  lookSens: "np_look_sensitivity",
  sound: "np_sound_enabled",
  music: "np_music_enabled",
  musicVolume: "np_music_volume",
};

export default function Index() {
  const [ready, setReady] = useState(false);
  const [screen, setScreen] = useState<"menu" | "game">("menu");
  const [username, setUsername] = useState("PLAYER");
  const [lookSensitivity, setLookSensitivity] = useState(0.008);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [musicEnabled, setMusicEnabled] = useState(true);
  const [musicVolume, setMusicVolume] = useState(0.5);
  const [level, setLevel] = useState(1);
  const {
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
  } = useProgress();

  useEffect(() => {
    (async () => {
      const u = await storage.getItem(KEYS.username, "PLAYER");
      const s = await storage.getItem(KEYS.lookSens, 0.008);
      const snd = await storage.getItem(KEYS.sound, true);
      const mus = await storage.getItem(KEYS.music, true);
      const vol = await storage.getItem(KEYS.musicVolume, 0.5);
      if (u) setUsername(u);
      if (typeof s === "number") setLookSensitivity(s);
      if (typeof snd === "boolean") setSoundEnabled(snd);
      if (typeof mus === "boolean") setMusicEnabled(mus);
      if (typeof vol === "number") setMusicVolume(vol);
      setReady(true);
    })();
  }, []);

  // Menu theme on the menu, combat theme in game (cross-faded by the music manager).
  useEffect(() => {
    if (!ready) return;
    music.setVolume(musicVolume);
    music.setEnabled(musicEnabled);
    music.play(screen === "menu" ? "menu" : "game");
  }, [ready, screen, musicEnabled, musicVolume]);

  // Shop packs and player messages from the admin page (cached packs first, then live config).
  const [messages, setMessages] = useState<RemoteMessage[]>([]);
  useEffect(() => {
    (async () => {
      const cached = await loadCachedConfig();
      if (cached) setRemotePacks(cached.packs);
      const live = await fetchRemoteConfig();
      if (live) {
        setRemotePacks(live.packs);
        setMessages(live.messages);
      }
    })();
  }, []);

  // Connect to Google Play only once the save is loaded, so purchased credits are added to it.
  useEffect(() => {
    if (loaded) initStore(addCredits);
  }, [loaded, addCredits]);

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
  const updateMusic = (v: boolean) => {
    setMusicEnabled(v);
    storage.setItem(KEYS.music, v);
  };
  const updateMusicVolume = (v: number) => {
    setMusicVolume(v);
    storage.setItem(KEYS.musicVolume, v);
  };

  const startGame = (lvl: number) => {
    if (!username || !username.trim()) updateUsername("PLAYER");
    setLevel(lvl);
    setScreen("game");
  };

  if (!ready || !loaded) return <View style={styles.root} />;

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
          musicEnabled={musicEnabled}
          setMusicEnabled={updateMusic}
          musicVolume={musicVolume}
          setMusicVolume={updateMusicVolume}
          cloudStatus={cloud}
          onRecovered={async (name) => {
            updateUsername(name);
            await syncFromCloud(true);
          }}
          progress={progress}
          onBuyUpgrade={buyUpgrade}
          onClaimDaily={claimDaily}
          onClaimMission={claimMission}
          onClaimAchievement={claimAchievement}
          onPlay={startGame}
          messages={messages}
        />
      ) : (
        <GameScreen
          username={username && username.trim() ? username.trim() : "PLAYER"}
          lookSensitivity={lookSensitivity}
          soundEnabled={soundEnabled}
          startLevel={level}
          unlockedLevel={progress.unlockedLevel}
          modifiers={modifiersFrom(progress.upgrades)}
          onLevelDone={completeLevel}
          onAddCredits={addCredits}
          onSession={recordSession}
          onExit={() => setScreen("menu")}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#05070a" },
});
