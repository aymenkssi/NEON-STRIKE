import React, { useEffect } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { colors, fonts } from "../theme";
import type { GameStats } from "../game/GameEngine";
import { POWERUPS } from "../game/content";
import { formatNumber, useT } from "@/src/i18n";

const POWERUP_ICONS = { rage: "fire", haste: "run-fast", infinite: "infinity" } as const;
const hex = (n: number) => `#${n.toString(16).padStart(6, "0")}`;
const WEAPON_ICONS: Record<string, string> = {
  SG: "pistol",
  SMG: "pistol",
  AR: "pistol",
  RG: "flash",
  MG: "fan",
  GL: "bomb",
};

type Props = {
  stats: GameStats;
  hitSignal: number;
  damageSignal: number;
  onPause: () => void;
  onSwitchWeapon: (index: number) => void;
};

export default function HUD({ stats, hitSignal, damageSignal, onPause, onSwitchWeapon }: Props) {
  const insets = useSafeAreaInsets();
  const t = useT();
  const hitScale = useSharedValue(0);
  const dmgOpacity = useSharedValue(0);

  useEffect(() => {
    if (hitSignal === 0) return;
    hitScale.value = withSequence(withTiming(1, { duration: 60 }), withTiming(0, { duration: 160 }));
  }, [hitSignal]);

  useEffect(() => {
    if (damageSignal === 0) return;
    dmgOpacity.value = withSequence(withTiming(0.6, { duration: 60 }), withTiming(0, { duration: 350 }));
  }, [damageSignal]);

  const hitStyle = useAnimatedStyle(() => ({
    opacity: hitScale.value,
    transform: [{ rotate: "45deg" }, { scale: 0.6 + hitScale.value * 0.9 }],
  }));
  const dmgStyle = useAnimatedStyle(() => ({ opacity: dmgOpacity.value }));

  const healthPct = stats.maxHealth > 0 ? (stats.health / stats.maxHealth) * 100 : 0;
  const healthColor = healthPct > 50 ? colors.brand : healthPct > 25 ? colors.warning : colors.error;

  const padL = Math.max(insets.left, 16);
  const padR = Math.max(insets.right, 16);
  const padT = Math.max(insets.top, 12);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {/* Damage vignette */}
      <Animated.View pointerEvents="none" style={[styles.vignette, dmgStyle]} />

      {/* Top-left: health + wave */}
      <View style={[styles.topLeft, { left: padL, top: padT }]} pointerEvents="none">
        <View style={styles.waveRow}>
          <MaterialCommunityIcons name="skull" size={16} color={colors.brand} />
          <Text style={styles.waveText}>
            {t("hud.levelWave", { n: stats.level, w: stats.wave, max: stats.totalWaves })}
          </Text>
        </View>
        <View style={styles.healthBar}>
          <View style={[styles.healthFill, { width: `${healthPct}%`, backgroundColor: healthColor }]} />
        </View>
        <Text style={[styles.healthLabel, { color: healthColor }]}>
          {t("hud.hp", { hp: stats.health, max: stats.maxHealth })}
        </Text>
        {stats.powerups.length > 0 && (
          <View style={styles.powerRow} testID="hud-powerups">
            {stats.powerups.map((p) => (
              <View key={p.kind} style={[styles.powerChip, { borderColor: hex(POWERUPS[p.kind].color) }]}>
                <MaterialCommunityIcons name={POWERUP_ICONS[p.kind]} size={14} color={hex(POWERUPS[p.kind].color)} />
                <Text style={[styles.powerText, { color: hex(POWERUPS[p.kind].color) }]}>{p.remaining}s</Text>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* Top-right: score + kills + pause */}
      <View style={[styles.topRight, { right: padR, top: padT }]} pointerEvents="box-none">
        <View style={{ alignItems: "flex-end" }} pointerEvents="none">
          <Text style={styles.scoreText}>{formatNumber(stats.score)}</Text>
          <View style={styles.killRow}>
            <MaterialCommunityIcons name="target" size={13} color={colors.onSurfaceSecondary} />
            <Text style={styles.killText}>{t("hud.kills", { n: stats.kills })}</Text>
          </View>
          <View style={styles.killRow}>
            <MaterialCommunityIcons name="circle-multiple" size={13} color={colors.warning} />
            <Text style={[styles.killText, { color: colors.warning }]}>+{stats.credits}</Text>
          </View>
        </View>
        <Pressable testID="pause-button" onPress={onPause} style={styles.pauseBtn}>
          <MaterialCommunityIcons name="pause" size={22} color={colors.onSurface} />
        </Pressable>
      </View>

      {/* Top-center: weapon switcher */}
      <View style={[styles.weaponRow, { top: padT }]} pointerEvents="box-none">
        {stats.weapons.map((w, i) => {
          const selected = i === stats.weaponIndex;
          // Unlocked weapons + only the next locked one, so the row fits on small screens.
          const firstLocked = stats.weapons.findIndex((x) => !x.unlocked);
          if (!w.unlocked && i !== firstLocked) return null;
          return (
            <Pressable
              key={w.short}
              testID={`weapon-${w.short}`}
              disabled={!w.unlocked}
              onPress={() => onSwitchWeapon(i)}
              style={[
                styles.weaponChip,
                selected && styles.weaponChipActive,
                !w.unlocked && styles.weaponChipLocked,
              ]}
            >
              {w.unlocked ? (
                <>
                  <MaterialCommunityIcons
                    name={(WEAPON_ICONS[w.short] ?? "pistol") as any}
                    size={16}
                    color={selected ? colors.onBrand : colors.onSurfaceSecondary}
                  />
                  <Text style={[styles.weaponChipText, selected && { color: colors.onBrand }]}>{w.short}</Text>
                </>
              ) : (
                <>
                  <MaterialCommunityIcons name="lock" size={14} color={colors.onSurfaceTertiary} />
                  <Text style={styles.weaponLockText}>NIV{w.unlockLevel}</Text>
                </>
              )}
            </Pressable>
          );
        })}
      </View>

      {/* Boss health */}
      {stats.boss && (
        <View style={[styles.bossWrap, { top: padT + 44 }]} pointerEvents="none" testID="boss-bar">
          <Text style={styles.bossLabel}>BOSS</Text>
          <View style={styles.bossBar}>
            <View style={[styles.bossFill, { width: `${(stats.boss.health / stats.boss.max) * 100}%` }]} />
          </View>
        </View>
      )}

      {/* Crosshair + hit marker */}
      <View style={styles.center} pointerEvents="none">
        <View style={styles.crossDot} />
        <Animated.View style={[styles.hitMarker, hitStyle]} />
      </View>

      {/* Bottom-right ammo (above fire btn area) */}
      <View style={[styles.ammoBox, { right: padR }]} pointerEvents="none">
        {stats.reloading ? (
          <Text style={styles.reloadText}>{t("hud.reloading")}</Text>
        ) : (
          <Text style={styles.ammoText}>
            {stats.ammo}
            <Text style={styles.ammoMax}>/{stats.maxAmmo}</Text>
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  vignette: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 26,
    borderColor: colors.error,
  },
  topLeft: { position: "absolute", gap: 4 },
  waveRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  waveText: { color: colors.brand, fontFamily: fonts.display, fontSize: 16, letterSpacing: 1.5 },
  healthBar: {
    width: 180,
    height: 12,
    backgroundColor: colors.surfaceTertiary,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
    marginTop: 2,
  },
  healthFill: { height: "100%", borderRadius: 2 },
  healthLabel: { fontFamily: fonts.displaySemi, fontSize: 12, letterSpacing: 1 },
  powerRow: { flexDirection: "row", gap: 6, marginTop: 4 },
  powerChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 6,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    backgroundColor: "rgba(13,15,18,0.7)",
  },
  powerText: { fontFamily: fonts.display, fontSize: 12, fontVariant: ["tabular-nums"] },
  topRight: { position: "absolute", flexDirection: "row", alignItems: "flex-start", gap: 12 },
  scoreText: { color: colors.onSurface, fontFamily: fonts.display, fontSize: 30, letterSpacing: 1, lineHeight: 32 },
  killRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 1 },
  killText: { color: colors.onSurfaceSecondary, fontFamily: fonts.displayMed, fontSize: 11, letterSpacing: 1 },
  pauseBtn: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  center: {
    position: "absolute",
    top: "50%",
    left: "50%",
    width: 40,
    height: 40,
    marginLeft: -20,
    marginTop: -20,
    alignItems: "center",
    justifyContent: "center",
  },
  crossDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.error,
  },
  hitMarker: {
    position: "absolute",
    width: 22,
    height: 22,
    borderWidth: 2,
    borderColor: "#fff",
  },
  ammoBox: { position: "absolute", bottom: 132, alignItems: "flex-end" },
  ammoText: { color: colors.onSurface, fontFamily: fonts.display, fontSize: 44, letterSpacing: 1 },
  ammoMax: { color: colors.onSurfaceTertiary, fontSize: 22 },
  reloadText: { color: colors.warning, fontFamily: fonts.displaySemi, fontSize: 18, letterSpacing: 1 },
  bossWrap: { position: "absolute", alignSelf: "center", alignItems: "center", gap: 2 },
  bossLabel: { color: colors.error, fontFamily: fonts.display, fontSize: 13, letterSpacing: 3 },
  bossBar: {
    width: 260,
    height: 10,
    backgroundColor: colors.surfaceTertiary,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: colors.error,
    overflow: "hidden",
  },
  bossFill: { height: "100%", backgroundColor: colors.error },
  weaponRow: {
    position: "absolute",
    alignSelf: "center",
    flexDirection: "row",
    gap: 8,
  },
  weaponChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    height: 34,
    paddingHorizontal: 9,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSecondary,
  },
  weaponChipActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  weaponChipLocked: { opacity: 0.5 },
  weaponChipText: { color: colors.onSurfaceSecondary, fontFamily: fonts.display, fontSize: 14, letterSpacing: 1 },
  weaponLockText: { color: colors.onSurfaceTertiary, fontFamily: fonts.displayMed, fontSize: 11, letterSpacing: 1 },
});
