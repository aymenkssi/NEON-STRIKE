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

type Props = {
  username: string;
  setUsername: (v: string) => void;
  lookSensitivity: number;
  setLookSensitivity: (v: number) => void;
  soundEnabled: boolean;
  setSoundEnabled: (v: boolean) => void;
  onPlay: () => void;
};

const COVER = require("../../assets/images/neon-cover.png");

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
      <Image source={COVER} style={StyleSheet.absoluteFill} contentFit="cover" transition={250} />
      <LinearGradient
        colors={["transparent", "rgba(7,11,18,0.35)", "rgba(7,11,18,0.95)"]}
        locations={[0, 0.45, 1]}
        style={StyleSheet.absoluteFill}
      />

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
              <Text style={styles.playText}>JOUER</Text>
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
  playText: { color: colors.onBrand, fontFamily: fonts.display, fontSize: 22, letterSpacing: 2 },
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
