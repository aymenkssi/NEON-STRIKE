import React, { useState } from "react";
import { View, Text, StyleSheet, Pressable, TextInput, Platform } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { colors, fonts, spacing, radius } from "../theme";
import AdBanner from "../ads/AdBanner";
import Leaderboard from "./Leaderboard";
import Settings from "./Settings";
import LevelSelect from "./LevelSelect";
import Arsenal from "./Arsenal";
import DailyReward from "./DailyReward";
import CreditBadge from "./CreditBadge";
import Shop from "./Shop";
import PlayerMessage from "./PlayerMessage";
import Goals, { claimableGoals } from "./Goals";
import { useMessageQueue } from "../hooks/use-message-queue";
import type { RemoteMessage } from "../api/config";
import { dailyStatus, type UpgradeKey } from "../game/progression";
import type { CloudStatus, Progress } from "../hooks/use-progress";

type Props = {
  username: string;
  setUsername: (v: string) => void;
  lookSensitivity: number;
  setLookSensitivity: (v: number) => void;
  soundEnabled: boolean;
  setSoundEnabled: (v: boolean) => void;
  musicEnabled: boolean;
  setMusicEnabled: (v: boolean) => void;
  musicVolume: number;
  setMusicVolume: (v: number) => void;
  cloudStatus: CloudStatus;
  onRecovered: (name: string) => Promise<void>;
  progress: Progress;
  onBuyUpgrade: (key: UpgradeKey) => boolean;
  onClaimDaily: () => number;
  onClaimMission: (id: string) => number;
  onClaimAchievement: (id: string) => number;
  onPlay: (level: number) => void;
  messages: RemoteMessage[];
};

// Auto-open the daily reward once per app launch, not every time the menu mounts.
let dailyAutoShown = false;

const COVER = require("../../assets/images/neon-cover.png");

export default function MainMenu(props: Props) {
  const { username, setUsername, onPlay } = props;
  const insets = useSafeAreaInsets();
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showLevels, setShowLevels] = useState(false);
  const [showArsenal, setShowArsenal] = useState(false);
  const [showShop, setShowShop] = useState(false);
  const [showGoals, setShowGoals] = useState(false);
  const { progress } = props;
  const dailyReady = dailyStatus(progress.dailyLast, progress.dailyStreak).canClaim;
  const [showDaily, setShowDaily] = useState(() => {
    if (dailyAutoShown || !dailyReady) return false;
    dailyAutoShown = true;
    return true;
  });

  const { next: message, dismiss } = useMessageQueue(props.messages);
  // One overlay at a time: messages wait until the daily reward and other windows are closed.
  const overlayOpen = showDaily || showLevels || showArsenal || showShop || showLeaderboard || showSettings || showGoals;
  const goalsReady = claimableGoals(progress);

  const play = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setShowLevels(true);
  };

  return (
    <View style={styles.root}>
      <Image source={COVER} style={StyleSheet.absoluteFill} contentFit="cover" transition={250} />
      <LinearGradient
        colors={["transparent", "rgba(7,11,18,0.35)", "rgba(7,11,18,0.95)"]}
        locations={[0, 0.45, 1]}
        style={StyleSheet.absoluteFill}
      />

      <View
        style={[styles.topBar, { top: Math.max(insets.top, 12), right: Math.max(insets.right, 20) }]}
        pointerEvents="box-none"
      >
        <CreditBadge amount={progress.credits} testID="menu-credits" onPress={() => setShowShop(true)} />
        <Pressable testID="open-daily" style={styles.topBtn} onPress={() => setShowDaily(true)}>
          <MaterialCommunityIcons name="gift" size={20} color={colors.warning} />
          {dailyReady && <View style={styles.dot} />}
        </Pressable>
        <Pressable testID="open-goals" style={[styles.topBtn, styles.goalsBtn]} onPress={() => setShowGoals(true)}>
          <MaterialCommunityIcons name="flag-checkered" size={18} color={colors.brand} />
          <Text style={styles.goalsText}>OBJECTIFS</Text>
          {goalsReady > 0 && (
            <View style={styles.countBadge}>
              <Text style={styles.countText}>{goalsReady}</Text>
            </View>
          )}
        </Pressable>
        <Pressable testID="open-arsenal" style={[styles.topBtn, styles.arsenalBtn]} onPress={() => setShowArsenal(true)}>
          <MaterialCommunityIcons name="store" size={18} color={colors.brandSecondary} />
          <Text style={styles.arsenalText}>ARSENAL</Text>
        </Pressable>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <View
          style={[
            styles.bottomBar,
            { paddingBottom: Math.max(insets.bottom, 10), paddingLeft: Math.max(insets.left, 20), paddingRight: Math.max(insets.right, 20) },
          ]}
        >
          <View style={styles.actionRow}>
            <View style={styles.inputWrap}>
              <Text style={styles.inputLabel}>NOM DE SURVIVANT</Text>
              <TextInput
                testID="username-input"
                value={username}
                onChangeText={(t) => setUsername(t.slice(0, 16))}
                placeholder="PLAYER"
                placeholderTextColor={colors.onSurfaceTertiary}
                style={styles.input}
                maxLength={16}
                autoCapitalize="characters"
                returnKeyType="done"
              />
            </View>

            <Pressable testID="play-button" style={styles.playBtn} onPress={play}>
              <MaterialCommunityIcons name="play" size={26} color={colors.onBrand} />
              <View>
                <Text style={styles.playText}>JOUER</Text>
                <Text style={styles.playSub}>NIVEAU {progress.unlockedLevel}</Text>
              </View>
            </Pressable>

            <Pressable testID="open-leaderboard" style={styles.iconBtn} onPress={() => setShowLeaderboard(true)}>
              <MaterialCommunityIcons name="trophy" size={24} color={colors.brand} />
            </Pressable>
            <Pressable testID="open-settings" style={styles.iconBtn} onPress={() => setShowSettings(true)}>
              <MaterialCommunityIcons name="cog" size={24} color={colors.onSurface} />
            </Pressable>
          </View>

          <View style={styles.adWrap} pointerEvents="box-none">
            <AdBanner testID="menu-ad" />
          </View>
        </View>
      </KeyboardAvoidingView>

      {showLevels && (
        <LevelSelect
          unlockedLevel={progress.unlockedLevel}
          stars={progress.stars}
          credits={progress.credits}
          onSelect={(lvl) => {
            setShowLevels(false);
            onPlay(lvl);
          }}
          onClose={() => setShowLevels(false)}
        />
      )}
      {showArsenal && (
        <Arsenal
          credits={progress.credits}
          upgrades={progress.upgrades}
          onBuy={props.onBuyUpgrade}
          onOpenShop={() => setShowShop(true)}
          onClose={() => setShowArsenal(false)}
        />
      )}
      {showShop && <Shop credits={progress.credits} onClose={() => setShowShop(false)} />}
      {showGoals && (
        <Goals
          progress={progress}
          onClaimMission={props.onClaimMission}
          onClaimAchievement={props.onClaimAchievement}
          onClose={() => setShowGoals(false)}
        />
      )}
      {message && !overlayOpen && (
        <PlayerMessage message={message} onClose={() => dismiss(message.id)} onOpenShop={() => setShowShop(true)} />
      )}
      {showDaily && (
        <DailyReward
          credits={progress.credits}
          lastClaim={progress.dailyLast}
          streak={progress.dailyStreak}
          onClaim={props.onClaimDaily}
          onClose={() => setShowDaily(false)}
        />
      )}
      {showLeaderboard && <Leaderboard username={username} onClose={() => setShowLeaderboard(false)} />}
      {showSettings && (
        <Settings
          lookSensitivity={props.lookSensitivity}
          setLookSensitivity={props.setLookSensitivity}
          soundEnabled={props.soundEnabled}
          setSoundEnabled={props.setSoundEnabled}
          musicEnabled={props.musicEnabled}
          setMusicEnabled={props.setMusicEnabled}
          musicVolume={props.musicVolume}
          setMusicVolume={props.setMusicVolume}
          cloudStatus={props.cloudStatus}
          onRecovered={props.onRecovered}
          onClose={() => setShowSettings(false)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  bottomBar: { flex: 1, justifyContent: "flex-end", gap: spacing.sm },
  actionRow: { flexDirection: "row", alignItems: "flex-end", gap: spacing.md },
  inputWrap: { flex: 1, maxWidth: 300 },
  inputLabel: { color: colors.brandSecondary, fontFamily: fonts.displaySemi, fontSize: 11, letterSpacing: 2, marginBottom: 5 },
  input: {
    height: 50,
    borderRadius: radius.md,
    backgroundColor: "rgba(13,15,18,0.8)",
    borderWidth: 1.5,
    borderColor: colors.brandSecondary,
    paddingHorizontal: spacing.md,
    color: colors.onSurface,
    fontFamily: fonts.display,
    fontSize: 20,
    letterSpacing: 2,
  },
  playBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 50,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.md,
    backgroundColor: colors.brand,
    borderWidth: 2,
    borderColor: colors.brand,
  },
  playText: { color: colors.onBrand, fontFamily: fonts.display, fontSize: 22, letterSpacing: 2, lineHeight: 24 },
  playSub: { color: colors.onBrand, fontFamily: fonts.displaySemi, fontSize: 10, letterSpacing: 1.5, opacity: 0.7, lineHeight: 12 },
  topBar: { position: "absolute", flexDirection: "row", alignItems: "center", gap: spacing.sm, zIndex: 5 },
  topBtn: {
    height: 34,
    minWidth: 34,
    paddingHorizontal: 8,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(13,15,18,0.85)",
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  goalsBtn: { flexDirection: "row", gap: 6, borderColor: "rgba(57,255,20,0.45)" },
  goalsText: { color: colors.brand, fontFamily: fonts.display, fontSize: 14, letterSpacing: 1.5 },
  countBadge: {
    position: "absolute",
    top: -7,
    right: -7,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: colors.error,
    alignItems: "center",
    justifyContent: "center",
  },
  countText: { color: "#fff", fontFamily: fonts.display, fontSize: 11 },
  arsenalBtn: { flexDirection: "row", gap: 6, borderColor: "rgba(0,255,255,0.45)" },
  arsenalText: { color: colors.brandSecondary, fontFamily: fonts.display, fontSize: 14, letterSpacing: 1.5 },
  dot: { position: "absolute", top: 4, right: 4, width: 8, height: 8, borderRadius: 4, backgroundColor: colors.error },
  iconBtn: {
    width: 50,
    height: 50,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(13,15,18,0.8)",
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  adWrap: { alignItems: "center" },
});
