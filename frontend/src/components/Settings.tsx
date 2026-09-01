import React from "react";
import { View, Text, StyleSheet, Pressable, Switch } from "react-native";
import { BlurView } from "expo-blur";
import Slider from "@react-native-community/slider";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { colors, fonts, spacing, radius } from "../theme";

type Props = {
  lookSensitivity: number;
  setLookSensitivity: (v: number) => void;
  soundEnabled: boolean;
  setSoundEnabled: (v: boolean) => void;
  onClose: () => void;
};

const MIN = 0.003;
const MAX = 0.02;

export default function Settings({
  lookSensitivity,
  setLookSensitivity,
  soundEnabled,
  setSoundEnabled,
  onClose,
}: Props) {
  const pct = Math.round(((lookSensitivity - MIN) / (MAX - MIN)) * 100);

  return (
    <BlurView intensity={50} tint="dark" style={styles.overlay} testID="settings-modal">
      <View style={styles.modal}>
        <View style={styles.header}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <MaterialCommunityIcons name="cog" size={22} color={colors.brand} />
            <Text style={styles.title}>RÉGLAGES</Text>
          </View>
          <Pressable testID="settings-close" onPress={onClose} style={styles.closeBtn} hitSlop={10}>
            <MaterialCommunityIcons name="close" size={22} color={colors.onSurface} />
          </Pressable>
        </View>

        <View style={styles.row}>
          <View style={styles.rowLabel}>
            <Text style={styles.label}>Sensibilité de visée</Text>
            <Text style={styles.value}>{pct}%</Text>
          </View>
          <Slider
            testID="sensitivity-slider"
            style={{ width: "100%", height: 40 }}
            minimumValue={MIN}
            maximumValue={MAX}
            value={lookSensitivity}
            onValueChange={setLookSensitivity}
            minimumTrackTintColor={colors.brand}
            maximumTrackTintColor={colors.surfaceTertiary}
            thumbTintColor={colors.brand}
          />
        </View>

        <View style={[styles.row, styles.toggleRow]}>
          <Text style={styles.label}>Effets sonores</Text>
          <Switch
            testID="sound-toggle"
            value={soundEnabled}
            onValueChange={setSoundEnabled}
            trackColor={{ false: colors.surfaceTertiary, true: colors.brandTertiary }}
            thumbColor={soundEnabled ? colors.brand : colors.onSurfaceTertiary}
          />
        </View>

        <Pressable testID="settings-back" onPress={onClose} style={styles.backBtn}>
          <Text style={styles.backText}>OK</Text>
        </Pressable>
      </View>
    </BlurView>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", zIndex: 30 },
  modal: {
    width: "62%",
    maxWidth: 480,
    backgroundColor: "rgba(13,15,18,0.9)",
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.lg,
  },
  title: { color: colors.onSurface, fontFamily: fonts.display, fontSize: 20, letterSpacing: 2 },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: colors.surfaceSecondary,
    alignItems: "center",
    justifyContent: "center",
  },
  row: { marginBottom: spacing.lg },
  rowLabel: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.xs },
  toggleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  label: { color: colors.onSurface, fontFamily: fonts.textMed, fontSize: 15 },
  value: { color: colors.brand, fontFamily: fonts.display, fontSize: 16 },
  backBtn: {
    height: 48,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.brand,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.sm,
  },
  backText: { color: colors.onBrand, fontFamily: fonts.display, fontSize: 16, letterSpacing: 2 },
});
