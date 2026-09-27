import React from "react";
import { View, Text, StyleSheet, Pressable, BackHandler, Platform } from "react-native";
import { BlurView } from "expo-blur";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { colors, fonts, spacing, radius } from "../theme";
import { useT } from "@/src/i18n";

// Closing the app is an Android thing: iOS apps never quit themselves (App Store rules).
export const canQuitApp = Platform.OS !== "ios";

export function quitApp() {
  BackHandler.exitApp();
}

type Props = { onCancel: () => void };

export default function ExitConfirm({ onCancel }: Props) {
  const t = useT();
  return (
    <BlurView intensity={50} tint="dark" style={styles.overlay} testID="exit-confirm">
      <View style={styles.modal}>
        <MaterialCommunityIcons name="power" size={36} color={colors.error} />
        <Text style={styles.title}>{t("exit.title")}</Text>
        <Text style={styles.text}>{t("exit.text")}</Text>
        <View style={styles.row}>
          <Pressable testID="exit-cancel" style={[styles.btn, styles.ghost]} onPress={onCancel}>
            <Text style={[styles.btnText, { color: colors.onSurfaceSecondary }]}>{t("common.cancel")}</Text>
          </Pressable>
          <Pressable testID="exit-quit" style={[styles.btn, styles.quit]} onPress={quitApp}>
            <Text style={[styles.btnText, { color: colors.onError }]}>{t("exit.confirm")}</Text>
          </Pressable>
        </View>
      </View>
    </BlurView>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", zIndex: 60 },
  modal: {
    width: "46%",
    maxWidth: 400,
    backgroundColor: "rgba(13,15,18,0.95)",
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.error,
    padding: spacing.lg,
    alignItems: "center",
    gap: spacing.sm,
  },
  title: { color: colors.onSurface, fontFamily: fonts.display, fontSize: 20, letterSpacing: 1.5, textAlign: "center" },
  text: { color: colors.onSurfaceSecondary, fontFamily: fonts.textMed, fontSize: 14, textAlign: "center" },
  row: { flexDirection: "row", gap: spacing.sm, alignSelf: "stretch", marginTop: spacing.xs },
  btn: { flex: 1, height: 44, borderRadius: radius.md, alignItems: "center", justifyContent: "center", borderWidth: 2 },
  ghost: { borderColor: colors.border },
  quit: { backgroundColor: colors.error, borderColor: colors.error },
  btnText: { fontFamily: fonts.display, fontSize: 15, letterSpacing: 1.5 },
});
