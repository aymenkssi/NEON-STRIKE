import React, { useState } from "react";
import { View, Text, StyleSheet, Pressable, TextInput, Platform } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { colors, fonts, spacing, radius } from "../theme";
import AdBanner from "../ads/AdBanner";
import Leaderboard from "./Leaderboard";
import Settings from "./Settings";

type Props = {
  username: string;
  setUsername: (v: string) => void;
  lookSensitivity: number;
  setLookSensitivity: (v: number) => void;
  soundEnabled: boolean;
  setSoundEnabled: (v: boolean) => void;
  onPlay: () => void;
};

const BG =
  "https://images.unsplash.com/photo-1656066460503-c18400ba761e?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA4Mzl8MHwxfHNlYXJjaHwxfHxkYXJrJTIwbmVvbiUyMHpvbWJpZSUyMHNpbGhvdWV0dGV8ZW58MHx8fHwxNzg4MjY5ODE1fDA&ixlib=rb-4.1.0&q=85";

export default function MainMenu(props: Props) {
  const { username, setUsername, onPlay } = props;
  const insets = useSafeAreaInsets();
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const play = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    onPlay();
  };

  return (
    <View style={styles.root}>
      {/* Background */}
      <Image source={{ uri: BG }} style={StyleSheet.absoluteFill} contentFit="cover" transition={300} />
      <LinearGradient
        colors={["rgba(5,7,10,0.97)", "rgba(5,7,10,0.6)", "rgba(5,7,10,0.35)"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={StyleSheet.absoluteFill}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <View style={[styles.panelWrap, { paddingLeft: Math.max(insets.left, 24) + 8, paddingTop: Math.max(insets.top, 16) }]}>
          <BlurView intensity={30} tint="dark" style={styles.panel}>
            <Text style={styles.kicker}>SURVIVAL FPS</Text>
            <Text style={styles.title}>NEON</Text>
            <Text style={styles.title2}>PROTOCOL</Text>
            <View style={styles.accentBar} />

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

            <Pressable testID="play-button" style={[styles.btn, styles.playBtn]} onPress={play}>
              <MaterialCommunityIcons name="play" size={24} color={colors.onBrand} />
              <Text style={[styles.btnText, { color: colors.onBrand }]}>JOUER</Text>
            </Pressable>

            <View style={styles.rowBtns}>
              <Pressable
                testID="open-leaderboard"
                style={[styles.btn, styles.ghostBtn, { flex: 1 }]}
                onPress={() => setShowLeaderboard(true)}
              >
                <MaterialCommunityIcons name="trophy" size={18} color={colors.brand} />
                <Text style={[styles.btnTextSm, { color: colors.brand }]}>CLASSEMENT</Text>
              </Pressable>
              <Pressable
                testID="open-settings"
                style={[styles.btn, styles.ghostBtn, { flex: 1 }]}
                onPress={() => setShowSettings(true)}
              >
                <MaterialCommunityIcons name="cog" size={18} color={colors.onSurfaceSecondary} />
                <Text style={[styles.btnTextSm, { color: colors.onSurfaceSecondary }]}>RÉGLAGES</Text>
              </Pressable>
            </View>
          </BlurView>
        </View>
      </KeyboardAvoidingView>

      <View style={[styles.adWrap, { bottom: Math.max(insets.bottom, 8) }]} pointerEvents="box-none">
        <AdBanner testID="menu-ad" />
      </View>

      {showLeaderboard && <Leaderboard username={username} onClose={() => setShowLeaderboard(false)} />}
      {showSettings && (
        <Settings
          lookSensitivity={props.lookSensitivity}
          setLookSensitivity={props.setLookSensitivity}
          soundEnabled={props.soundEnabled}
          setSoundEnabled={props.setSoundEnabled}
          onClose={() => setShowSettings(false)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  panelWrap: { flex: 1, justifyContent: "center", alignItems: "flex-start", paddingBottom: 60 },
  panel: {
    width: 340,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
    padding: spacing.lg,
    backgroundColor: "rgba(13,15,18,0.55)",
  },
  kicker: { color: colors.brandSecondary, fontFamily: fonts.displaySemi, fontSize: 12, letterSpacing: 4 },
  title: { color: colors.onSurface, fontFamily: fonts.display, fontSize: 48, letterSpacing: 2, lineHeight: 48 },
  title2: { color: colors.brand, fontFamily: fonts.display, fontSize: 48, letterSpacing: 2, lineHeight: 48, textShadowColor: colors.brand, textShadowRadius: 16 },
  accentBar: { width: 64, height: 4, backgroundColor: colors.brand, borderRadius: 2, marginTop: spacing.sm, marginBottom: spacing.md },
  inputLabel: { color: colors.onSurfaceSecondary, fontFamily: fonts.displayMed, fontSize: 11, letterSpacing: 2, marginBottom: 6 },
  input: {
    height: 46,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    color: colors.onSurface,
    fontFamily: fonts.display,
    fontSize: 18,
    letterSpacing: 2,
    marginBottom: spacing.md,
  },
  btn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 52,
    borderRadius: radius.md,
    borderWidth: 2,
  },
  playBtn: { backgroundColor: colors.brand, borderColor: colors.brand },
  ghostBtn: { backgroundColor: "transparent", borderColor: colors.border, height: 46 },
  rowBtns: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm },
  btnText: { fontFamily: fonts.display, fontSize: 20, letterSpacing: 2 },
  btnTextSm: { fontFamily: fonts.display, fontSize: 13, letterSpacing: 1 },
  adWrap: { position: "absolute", left: 0, right: 0, alignItems: "center" },
});
