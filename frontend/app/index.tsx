import React, { useEffect, useState } from "react";
import { View, StyleSheet, StatusBar } from "react-native";
import { storage } from "@/src/utils/storage";
import MainMenu from "@/src/components/MainMenu";
import GameScreen from "@/src/components/GameScreen";
import { useProgress } from "@/src/hooks/use-progress";
import { useAccount } from "@/src/hooks/use-account";
import { logoutAccount } from "@/src/api/account";
import Welcome from "@/src/components/Welcome";
import type { AuthMode } from "@/src/components/AuthForm";
import { modifiersFrom } from "@/src/game/progression";
import { initStore } from "@/src/iap";
import { reportSession } from "@/src/api/session";
import { music } from "@/src/audio/music";
import { setRemotePacks } from "@/src/iap/catalog";
import { fetchRemoteConfig, loadCachedConfig, type RemoteMessage } from "@/src/api/config";
import { useT } from "@/src/i18n";

const KEYS = {
  lookSens: "np_look_sensitivity",
  sound: "np_sound_enabled",
  music: "np_music_enabled",
  musicVolume: "np_music_volume",
};

export default function Index() {
  const [ready, setReady] = useState(false);
  const [screen, setScreen] = useState<"menu" | "game">("menu");
  const [lookSensitivity, setLookSensitivity] = useState(0.008);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [musicEnabled, setMusicEnabled] = useState(true);
  const [musicVolume, setMusicVolume] = useState(0.5);
  const [level, setLevel] = useState(1);
  const { account, loaded: accountLoaded, playAsGuest, signedIn, signedOut } = useAccount();
  const isGuest = account.mode !== "account";
  const t = useT();
  const {
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
  } = useProgress(account.mode === "account");

  useEffect(() => {
    (async () => {
      const s = await storage.getItem(KEYS.lookSens, 0.008);
      const snd = await storage.getItem(KEYS.sound, true);
      const mus = await storage.getItem(KEYS.music, true);
      const vol = await storage.getItem(KEYS.musicVolume, 0.5);
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
  // Once the player has chosen guest or account: counts the visit in the admin statistics.
  useEffect(() => {
    if (accountLoaded && account.mode !== "unset") reportSession();
  }, [accountLoaded, account.mode]);

  useEffect(() => {
    if (loaded) initStore(addCredits);
  }, [loaded, addCredits]);

  // New account: this phone's progress is uploaded. Login: the account's online save replaces it.
  const onSignedIn = async (name: string, mode: AuthMode) => {
    signedIn(name);
    await syncFromCloud(mode === "login");
  };
  // Logout: pending changes are pushed, then this phone goes back to the welcome screen.
  const onLogout = async () => {
    await resetLocal();
    await logoutAccount();
    signedOut();
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
    setLevel(lvl);
    setScreen("game");
  };

  if (!ready || !loaded || !accountLoaded) return <View style={styles.root} />;

  if (account.mode === "unset") {
    return (
      <View style={styles.root}>
        <StatusBar hidden />
        <Welcome onGuest={playAsGuest} onSignedIn={onSignedIn} />
      </View>
    );
  }

  const username = account.username ?? t("common.guestName");

  return (
    <View style={styles.root}>
      <StatusBar hidden />
      {screen === "menu" ? (
        <MainMenu
          username={username}
          account={account}
          lookSensitivity={lookSensitivity}
          setLookSensitivity={updateLookSens}
          soundEnabled={soundEnabled}
          setSoundEnabled={updateSound}
          musicEnabled={musicEnabled}
          setMusicEnabled={updateMusic}
          musicVolume={musicVolume}
          setMusicVolume={updateMusicVolume}
          cloudStatus={cloud}
          onSignedIn={onSignedIn}
          onLogout={onLogout}
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
          username={username}
          guest={isGuest}
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
