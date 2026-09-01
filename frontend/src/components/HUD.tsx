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

type Props = {
  stats: GameStats;
  hitSignal: number;
  damageSignal: number;
  onPause: () => void;
};

export default function HUD({ stats, hitSignal, damageSignal, onPause }: Props) {
  const insets = useSafeAreaInsets();
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

  const healthColor =
    stats.health > 50 ? colors.brand : stats.health > 25 ? colors.warning : colors.error;

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
          <Text style={styles.waveText}>WAVE {stats.wave}</Text>
        </View>
        <View style={styles.healthBar}>
          <View style={[styles.healthFill, { width: `${stats.health}%`, backgroundColor: healthColor }]} />
        </View>
        <Text style={[styles.healthLabel, { color: healthColor }]}>{stats.health} HP</Text>
      </View>

      {/* Top-right: score + kills + pause */}
      <View style={[styles.topRight, { right: padR, top: padT }]} pointerEvents="box-none">
        <View style={{ alignItems: "flex-end" }} pointerEvents="none">
          <Text style={styles.scoreText}>{stats.score.toLocaleString()}</Text>
          <View style={styles.killRow}>
            <MaterialCommunityIcons name="target" size={13} color={colors.onSurfaceSecondary} />
            <Text style={styles.killText}>{stats.kills} KILLS</Text>
          </View>
        </View>
        <Pressable testID="pause-button" onPress={onPause} style={styles.pauseBtn}>
          <MaterialCommunityIcons name="pause" size={22} color={colors.onSurface} />
        </Pressable>
      </View>

      {/* Crosshair + hit marker */}
      <View style={styles.center} pointerEvents="none">
        <View style={styles.crossDot} />
        <Animated.View style={[styles.hitMarker, hitStyle]} />
      </View>

      {/* Bottom-right ammo (above fire btn area) */}
      <View style={[styles.ammoBox, { right: padR }]} pointerEvents="none">
        {stats.reloading ? (
          <Text style={styles.reloadText}>RELOADING…</Text>
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
});
