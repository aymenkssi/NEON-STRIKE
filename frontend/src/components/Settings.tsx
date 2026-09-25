import React from "react";
import { View, Text, StyleSheet, Pressable, Switch, ScrollView } from "react-native";
import { BlurView } from "expo-blur";
import Slider from "@react-native-community/slider";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { colors, fonts, spacing, radius } from "../theme";
import { isPrivacyOptionsRequired, showPrivacyOptions } from "../ads";
import AccountSection from "./AccountSection";
import type { AuthMode } from "./AuthForm";
import type { CloudStatus } from "../hooks/use-progress";
import type { AccountState } from "../hooks/use-account";
import { LANGS, LANG_NAMES, setLang, useLang, useT } from "@/src/i18n";

type Props = {
  lookSensitivity: number;
  setLookSensitivity: (v: number) => void;
  soundEnabled: boolean;
  setSoundEnabled: (v: boolean) => void;
  musicEnabled: boolean;
  setMusicEnabled: (v: boolean) => void;
  musicVolume: number;
  setMusicVolume: (v: number) => void;
  account: AccountState;
  cloudStatus: CloudStatus;
  onSignedIn: (username: string, mode: AuthMode) => Promise<void>;
  onLogout: () => Promise<void>;
  onDeleted: () => Promise<void>;
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
  account,
  cloudStatus,
  onSignedIn,
  onLogout,
  onDeleted,
  onClose,
}: Props) {
  const pct = Math.round(((lookSensitivity - MIN) / (MAX - MIN)) * 100);
  const t = useT();
  const lang = useLang();

  return (
    <BlurView intensity={50} tint="dark" style={styles.overlay} testID="settings-modal">
      <View style={styles.modal}>
        <View style={styles.header}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <MaterialCommunityIcons name="cog" size={22} color={colors.brand} />
            <Text style={styles.title}>{t("settings.title")}</Text>
          </View>
          <Pressable testID="settings-close" onPress={onClose} style={styles.closeBtn} hitSlop={10}>
            <MaterialCommunityIcons name="close" size={22} color={colors.onSurface} />
          </Pressable>
        </View>

        <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <AccountSection account={account} cloudStatus={cloudStatus} onSignedIn={onSignedIn} onLogout={onLogout} onDeleted={onDeleted} />
        <View style={[styles.row, styles.toggleRow]}>
          <Text style={styles.label}>{t("settings.language")}</Text>
          <View style={styles.langs}>
            {LANGS.map((l) => (
              <Pressable
                key={l}
                testID={`lang-${l}`}
                onPress={() => setLang(l)}
                style={[styles.langBtn, lang === l && styles.langActive]}
              >
                <Text style={[styles.langText, lang === l && { color: colors.onBrand }]}>{LANG_NAMES[l]}</Text>
              </Pressable>
            ))}
          </View>
        </View>
        <View style={styles.row}>
          <View style={styles.rowLabel}>
            <Text style={styles.label}>{t("settings.sensitivity")}</Text>
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
          <Text style={styles.label}>{t("settings.sound")}</Text>
          <Switch
            testID="sound-toggle"
            value={soundEnabled}
            onValueChange={setSoundEnabled}
            trackColor={{ false: colors.surfaceTertiary, true: colors.brandTertiary }}
            thumbColor={soundEnabled ? colors.brand : colors.onSurfaceTertiary}
          />
        </View>

        <View style={[styles.row, styles.toggleRow]}>
          <Text style={styles.label}>{t("settings.music")}</Text>
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
              <Text style={styles.label}>{t("settings.musicVolume")}</Text>
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



        {isPrivacyOptionsRequired() && (
          <Pressable testID="privacy-options" onPress={showPrivacyOptions} style={[styles.row, styles.toggleRow]}>
            <Text style={styles.label}>{t("settings.adPrivacy")}</Text>
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
  langs: { flexDirection: "row", gap: 6 },
  langBtn: {
    height: 30,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  langActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  langText: { color: colors.onSurfaceSecondary, fontFamily: fonts.displaySemi, fontSize: 13, letterSpacing: 0.5 },
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
