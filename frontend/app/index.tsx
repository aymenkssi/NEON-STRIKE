import React, { useEffect, useMemo, useState } from "react";
import { View, StyleSheet, StatusBar } from "react-native";
import { storage } from "@/src/utils/storage";
import MainMenu from "@/src/components/MainMenu";
import GameScreen from "@/src/components/GameScreen";
import { useProgress } from "@/src/hooks/use-progress";
import { useAccount } from "@/src/hooks/use-account";
import { useGameSettings } from "@/src/hooks/use-game-settings";
import { logoutAccount } from "@/src/api/account";
import Welcome from "@/src/components/Welcome";
import type { AuthMode } from "@/src/components/AuthForm";
import { modifiersFrom } from "@/src/game/progression";
import { initStore } from "@/src/iap";
import { reportSession } from "@/src/api/session";
import { flushPendingScore } from "@/src/api/leaderboard";
import { music } from "@/src/audio/music";
import { setRemotePacks } from "@/src/iap/catalog";
import { setRemoteWeapons } from "@/src/game/armory";
import { fetchRemoteConfig, loadCachedConfig, type RemoteMessage } from "@/src/api/config";
import { getLang, useT } from "@/src/i18n";
import StoryComic from "@/src/components/StoryComic";
import { actOfLevel, episodeFrom, introBefore, type Act, type EpisodeRun, type RemoteEpisode } from "@/src/game/story";

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
  // Story comic shown over the menu (act opening before its first level, or replay from the journal).
  // (or an episode published from the admin page: its opening or ending).
  const [comic, setComic] = useState<{ id: string; act?: Act; episode?: { run: EpisodeRun; part: "intro" | "outro" }; then?: () => void } | null>(null);
  // Episode being played (null: campaign level).
  const [episode, setEpisode] = useState<EpisodeRun | null>(null);
  const [remoteEpisodes, setRemoteEpisodes] = useState<RemoteEpisode[]>([]);
  const { account, loaded: accountLoaded, playAsGuest, signedIn, signedOut } = useAccount();
  const { settings: gameSettings, loaded: settingsLoaded, update: updateGameSettings } = useGameSettings();
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
    buySkin,
    equipSkin,
    grantSeasonReward,
    markComicSeen,
    claimActReward,
    markDocFound,
    markEpisodeSeen,
    claimEpisodeReward,
    buyWeapon,
    toggleLoadout,
    buyAmmo,
    setAmmoStock,
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
      if (cached) {
        setRemotePacks(cached.packs);
        setRemoteWeapons(cached.weapons);
        setRemoteEpisodes(cached.episodes ?? []);
      }
      const live = await fetchRemoteConfig();
      if (live) {
        setRemotePacks(live.packs);
        setRemoteWeapons(live.weapons);
        setMessages(live.messages);
        setRemoteEpisodes(live.episodes ?? []);
      }
    })();
  }, []);

  // Connect to Google Play only once the save is loaded, so purchased credits are added to it.
  // Once the player has chosen guest or account: counts the visit in the admin statistics.
  useEffect(() => {
    if (accountLoaded && account.mode !== "unset") reportSession();
    // A score that could not be sent last time (no network) is sent now.
    if (accountLoaded && account.mode === "account" && account.username) flushPendingScore(account.username);
  }, [accountLoaded, account.mode, account.username]);

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
  // Account deleted on the server (session already cleared): back to the welcome screen.
  const onDeleted = async () => {
    await resetLocal(false);
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

  const lang = getLang();
  const episodes = useMemo(
    () => remoteEpisodes.map((e) => episodeFrom(e, lang)).filter((e): e is EpisodeRun => !!e),
    [remoteEpisodes, lang]
  );
  const startEpisode = (run: EpisodeRun) => {
    const go = () => {
      setEpisode(run);
      setLevel(run.level);
      setScreen("game");
    };
    if (!progress.story.epSeen.includes(run.id)) setComic({ id: run.id, episode: { run, part: "intro" }, then: go });
    else go();
  };
  const startGame = (lvl: number) => {
    const go = () => {
      setEpisode(null);
      setLevel(lvl);
      setScreen("game");
    };
    const intro = introBefore(lvl, progress.story.seen);
    const act = actOfLevel(lvl);
    if (intro && act) setComic({ id: intro, act, then: go });
    else go();
  };
  const closeComic = () => {
    if (!comic) return;
    if (comic.episode) {
      if (comic.episode.part === "intro") markEpisodeSeen(comic.episode.run.id);
    } else markComicSeen(comic.id);
    setComic(null);
    comic.then?.();
  };

  if (!ready || !loaded || !accountLoaded || !settingsLoaded) return <View style={styles.root} />;

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
          onDeleted={onDeleted}
          progress={progress}
          onBuyUpgrade={buyUpgrade}
          onClaimDaily={claimDaily}
          onClaimMission={claimMission}
          onClaimAchievement={claimAchievement}
          onPlay={startGame}
          messages={messages}
          gameSettings={gameSettings}
          onGameSettings={updateGameSettings}
          onBuySkin={buySkin}
          onEquipSkin={equipSkin}
          onSeasonReward={grantSeasonReward}
          onBuyWeapon={buyWeapon}
          onToggleLoadout={toggleLoadout}
          onBuyAmmo={buyAmmo}
          onReplayComic={(id, act) => setComic({ id, act })}
          episodes={episodes}
          onPlayEpisode={startEpisode}
          onReplayEpisode={(run, part) => setComic({ id: run.id + part, episode: { run, part } })}
          onClaimAct={(act) => claimActReward(act.n)}
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
          difficulty={gameSettings.difficulty}
          options={{
            loadout: progress.armory.loadout,
            ammo: progress.armory.ammo,
            aimAssist: gameSettings.aimAssist,
            invertY: gameSettings.invertY,
            view: gameSettings.view,
            quality: gameSettings.quality,
            weaponSkin: progress.skins.weapon,
            outfit: progress.skins.outfit,
            docsFound: progress.story.docs,
            episodeBoss: episode?.boss,
          }}
          episode={episode ?? undefined}
          onClaimEpisode={claimEpisodeReward}
          onLevelDone={completeLevel}
          onAddCredits={addCredits}
          onAmmo={setAmmoStock}
          story={progress.story}
          onComicSeen={markComicSeen}
          onClaimAct={claimActReward}
          onDocFound={markDocFound}
          ownedSkins={progress.skins.owned}
          onSession={recordSession}
          onExit={() => setScreen("menu")}
        />
      )}
      {comic && <StoryComic key={comic.id} id={comic.episode ? undefined : comic.id} act={comic.act} episode={comic.episode} onDone={closeComic} />}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#05070a" },
});
