import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { BlurView } from "expo-blur";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { colors, fonts, spacing, radius } from "../theme";
import { useT } from "@/src/i18n";

type Props = {
  onResume: () => void;
  onRestart: () => void;
  onExit: () => void;
};

export default function PauseMenu({ onResume, onRestart, onExit }: Props) {
  const t = useT();
  return (
    <BlurView intensity={40} tint="dark" style={styles.overlay} testID="pause-menu">
      <View style={styles.panel}>
        <Text style={styles.title}>{t("pause.title")}</Text>
        <Pressable testID="resume-button" style={[styles.btn, styles.primary]} onPress={onResume}>
          <MaterialCommunityIcons name="play" size={22} color={colors.onBrand} />
          <Text style={[styles.btnText, { color: colors.onBrand }]}>{t("pause.resume")}</Text>
        </Pressable>
        <Pressable testID="pause-restart-button" style={[styles.btn, styles.secondary]} onPress={onRestart}>
          <MaterialCommunityIcons name="restart" size={22} color={colors.brand} />
          <Text style={[styles.btnText, { color: colors.brand }]}>{t("pause.restart")}</Text>
        </Pressable>
        <Pressable testID="pause-exit-button" style={[styles.btn, styles.ghost]} onPress={onExit}>
          <MaterialCommunityIcons name="home" size={22} color={colors.onSurfaceSecondary} />
          <Text style={[styles.btnText, { color: colors.onSurfaceSecondary }]}>{t("pause.mainMenu")}</Text>
        </Pressable>
      </View>
    </BlurView>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", zIndex: 40 },
  panel: {
    width: 320,
    backgroundColor: "rgba(13,15,18,0.85)",
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    alignItems: "center",
    gap: spacing.sm,
  },
  title: { color: colors.brand, fontFamily: fonts.display, fontSize: 32, letterSpacing: 4, marginBottom: spacing.sm },
  btn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    width: "100%",
    height: 50,
    borderRadius: radius.md,
    borderWidth: 2,
  },
  primary: { backgroundColor: colors.brand, borderColor: colors.brand },
  secondary: { backgroundColor: "transparent", borderColor: colors.brand },
  ghost: { backgroundColor: "transparent", borderColor: colors.border },
  btnText: { fontFamily: fonts.display, fontSize: 16, letterSpacing: 1 },
});
