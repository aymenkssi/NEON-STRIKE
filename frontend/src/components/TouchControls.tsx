import React, { useCallback, useRef } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { useAnimatedStyle, useSharedValue, runOnJS } from "react-native-reanimated";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { colors, fonts } from "../theme";
import type { GameEngine } from "../game/GameEngine";

type Props = { getEngine: () => GameEngine | null };

const KNOB_MAX = 55;

export default function TouchControls({ getEngine }: Props) {
  const baseX = useSharedValue(0);
  const baseY = useSharedValue(0);
  const knobX = useSharedValue(0);
  const knobY = useSharedValue(0);
  const active = useSharedValue(0);
  const fireInterval = useRef<any>(null);

  const move = useCallback(
    (x: number, y: number, sprint: boolean) => {
      getEngine()?.setMove(x, y, sprint);
    },
    [getEngine]
  );
  const endMove = useCallback(() => {
    getEngine()?.setMove(0, 0, false);
  }, [getEngine]);
  const look = useCallback(
    (dx: number, dy: number) => {
      getEngine()?.applyLook(dx, dy);
    },
    [getEngine]
  );

  const joystick = Gesture.Pan()
    .minDistance(0)
    .onBegin((e) => {
      baseX.value = e.x;
      baseY.value = e.y;
      knobX.value = e.x;
      knobY.value = e.y;
      active.value = 1;
    })
    .onUpdate((e) => {
      const dx = e.x - baseX.value;
      const dy = e.y - baseY.value;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const clamped = Math.min(dist, KNOB_MAX);
      const ang = Math.atan2(dy, dx);
      knobX.value = baseX.value + Math.cos(ang) * clamped;
      knobY.value = baseY.value + Math.sin(ang) * clamped;
      const mag = clamped / KNOB_MAX;
      runOnJS(move)(mag * Math.cos(ang), -mag * Math.sin(ang), mag > 0.85);
    })
    .onFinalize(() => {
      active.value = 0;
      runOnJS(endMove)();
    });

  const lookPan = Gesture.Pan()
    .minDistance(0)
    .onChange((e) => {
      runOnJS(look)(e.changeX, e.changeY);
    });

  const ringStyle = useAnimatedStyle(() => ({
    opacity: active.value,
    transform: [{ translateX: baseX.value - 45 }, { translateY: baseY.value - 45 }],
  }));
  const knobStyle = useAnimatedStyle(() => ({
    opacity: active.value,
    transform: [{ translateX: knobX.value - 28 }, { translateY: knobY.value - 28 }],
  }));

  const startFire = () => {
    const e = getEngine();
    if (!e) return;
    e.shoot();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
    if (fireInterval.current) clearInterval(fireInterval.current);
    fireInterval.current = setInterval(() => {
      getEngine()?.shoot();
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }, 380);
  };
  const stopFire = () => {
    if (fireInterval.current) {
      clearInterval(fireInterval.current);
      fireInterval.current = null;
    }
  };

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {/* Movement joystick zone (left) */}
      <GestureDetector gesture={joystick}>
        <View style={styles.joyZone}>
          <Animated.View style={[styles.ring, ringStyle]} pointerEvents="none" />
          <Animated.View style={[styles.knob, knobStyle]} pointerEvents="none" />
        </View>
      </GestureDetector>

      {/* Look zone (right) */}
      <GestureDetector gesture={lookPan}>
        <View style={styles.lookZone} />
      </GestureDetector>

      {/* Combat buttons (right, over look zone) */}
      <Pressable
        testID="jump-button"
        onPressIn={() => {
          getEngine()?.jumpDown();
          Haptics.selectionAsync().catch(() => {});
        }}
        onPressOut={() => getEngine()?.jumpUp()}
        style={({ pressed }) => [styles.jumpBtn, pressed && styles.pressed]}
      >
        <MaterialCommunityIcons name="arrow-up-bold" size={26} color={colors.brandSecondary} />
        <Text style={styles.smallLabel}>JUMP</Text>
      </Pressable>

      <Pressable
        testID="reload-button"
        onPress={() => {
          getEngine()?.reload();
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        }}
        style={({ pressed }) => [styles.reloadBtn, pressed && styles.pressed]}
      >
        <MaterialCommunityIcons name="reload" size={24} color={colors.warning} />
        <Text style={styles.smallLabel}>RELOAD</Text>
      </Pressable>

      <Pressable
        testID="fire-button"
        onPressIn={startFire}
        onPressOut={stopFire}
        style={({ pressed }) => [styles.fireBtn, pressed && styles.firePressed]}
      >
        <MaterialCommunityIcons name="pistol" size={40} color="#fff" />
        <Text style={styles.fireLabel}>FIRE</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  joyZone: { position: "absolute", left: 0, top: 0, bottom: 0, width: "45%" },
  lookZone: { position: "absolute", right: 0, top: 0, bottom: 0, width: "55%" },
  ring: {
    position: "absolute",
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 2,
    borderColor: "rgba(57,255,20,0.35)",
    backgroundColor: "rgba(57,255,20,0.05)",
  },
  knob: {
    position: "absolute",
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(57,255,20,0.25)",
    borderWidth: 2,
    borderColor: "rgba(57,255,20,0.6)",
  },
  fireBtn: {
    position: "absolute",
    right: 32,
    bottom: 28,
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,0,60,0.28)",
    borderWidth: 2.5,
    borderColor: colors.brand,
  },
  firePressed: { backgroundColor: "rgba(255,0,60,0.6)" },
  jumpBtn: {
    position: "absolute",
    right: 150,
    bottom: 40,
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,255,255,0.12)",
    borderWidth: 2,
    borderColor: "rgba(0,255,255,0.5)",
  },
  reloadBtn: {
    position: "absolute",
    right: 140,
    bottom: 120,
    width: 62,
    height: 62,
    borderRadius: 31,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,176,0,0.12)",
    borderWidth: 2,
    borderColor: "rgba(255,176,0,0.5)",
  },
  pressed: { opacity: 0.7 },
  smallLabel: { color: colors.onSurfaceSecondary, fontFamily: fonts.displayMed, fontSize: 9, marginTop: 1, letterSpacing: 1 },
  fireLabel: { color: "#fff", fontFamily: fonts.display, fontSize: 12, letterSpacing: 1.5, marginTop: -2 },
});
