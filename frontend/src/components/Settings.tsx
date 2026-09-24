import React from "react";
import { View, Text, StyleSheet, Pressable, Switch, ScrollView } from "react-native";
import { BlurView } from "expo-blur";
import Slider from "@react-native-community/slider";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { colors, fonts, spacing, radius } from "../theme";
import { isPrivacyOptionsRequired, showPrivacyOptions } from "../ads";
import CloudSave from "./CloudSave";
import type { CloudStatus } from "../hooks/use-progress";

type Props = {
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
  onClose: () => void;
};

const MIN = 0.003;
const MAX = 0.02;

export default function Settings({
  lookSensitivity,
  setLookSensitivity,
  soundEnabled,
  setSoundEnabled,
  musicEnabled,
  setMusicEnabled,
  musicVolume,
  setMusicVolume,
  cloudStatus,
  onRecovered,
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

        <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
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

        <View style={[styles.row, styles.toggleRow]}>
          <Text style={styles.label}>Musique</Text>
          <Switch
            testID="music-toggle"
            value={musicEnabled}
            onValueChange={setMusicEnabled}
            trackColor={{ false: colors.surfaceTertiary, true: colors.brandTertiary }}
            thumbColor={musicEnabled ? colors.brand : colors.onSurfaceTertiary}
          />
        </View>

        {musicEnabled && (
          <View style={styles.row}>
            <View style={styles.rowLabel}>
              <Text style={styles.label}>Volume de la musique</Text>
              <Text style={styles.value}>{Math.round(musicVolume * 100)}%</Text>
            </View>
            <Slider
              testID="music-volume"
              style={{ width: "100%", height: 40 }}
              minimumValue={0}
              maximumValue={1}
              value={musicVolume}
              onSlidingComplete={setMusicVolume}
              minimumTrackTintColor={colors.brand}
              maximumTrackTintColor={colors.surfaceTertiary}
              thumbTintColor={colors.brand}
            />
          </View>
        )}

        <CloudSave status={cloudStatus} onRecovered={onRecovered} />

        {isPrivacyOptionsRequired() && (
          <Pressable testID="privacy-options" onPress={showPrivacyOptions} style={[styles.row, styles.toggleRow]}>
            <Text style={styles.label}>Confidentialité des annonces</Text>
            <MaterialCommunityIcons name="chevron-right" size={22} color={colors.onSurfaceSecondary} />
          </Pressable>
        )}

        </ScrollView>

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
    maxHeight: "94%",
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
  scroll: { flexShrink: 1 },
  row: { marginBottom: spacing.md },
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
