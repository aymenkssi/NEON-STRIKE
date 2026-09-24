import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, Pressable, type LayoutChangeEvent, type StyleProp, type ViewStyle } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { useAnimatedStyle, useSharedValue, runOnJS, withTiming } from "react-native-reanimated";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { colors, fonts } from "../theme";
import type { FireMode, GameEngine } from "../game/GameEngine";
import { useT, type Key } from "@/src/i18n";

type Props = { getEngine: () => GameEngine | null; fireMode: FireMode; fireModes: FireMode[] };

const MODE_UI: Record<FireMode, { icon: string; label: Key }> = {
  single: { icon: "numeric-1-circle-outline", label: "fire.short.single" },
  burst: { icon: "dots-horizontal-circle-outline", label: "fire.short.burst" },
  auto: { icon: "infinity", label: "fire.short.auto" },
};

const KNOB_MAX = 55;
const RING = 120; // joystick diameter
const SPRINT_AT = 0.85; // push beyond 85% of the radius to sprint

export default function TouchControls({ getEngine, fireMode, fireModes }: Props) {
  const insets = useSafeAreaInsets();
  const t = useT();
  // Resting spot of the joystick (bottom-left of the left zone), set once the zone is measured.
  const homeX = useSharedValue(Math.max(insets.left, 24) + RING / 2 + 16);
  const homeY = useSharedValue(300);
  const baseX = useSharedValue(homeX.value);
  const baseY = useSharedValue(homeY.value);
  const knobX = useSharedValue(homeX.value);
  const knobY = useSharedValue(homeY.value);
  const active = useSharedValue(0);
  const sprinting = useSharedValue(0);

  const onJoyLayout = (e: LayoutChangeEvent) => {
    const { height } = e.nativeEvent.layout;
    homeY.value = height - Math.max(insets.bottom, 16) - RING / 2 - 20;
    if (!active.value) {
      baseX.value = knobX.value = homeX.value;
      baseY.value = knobY.value = homeY.value;
    }
  };

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
      // Touching near the joystick grabs it where it is; anywhere else in the left zone
      // moves it under the thumb (so the player never has to aim for it).
      const nearHome = Math.hypot(e.x - homeX.value, e.y - homeY.value) < RING * 0.75;
      baseX.value = nearHome ? homeX.value : e.x;
      baseY.value = nearHome ? homeY.value : e.y;
      knobX.value = e.x;
      knobY.value = e.y;
      active.value = withTiming(1, { duration: 80 });
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
      sprinting.value = mag > SPRINT_AT ? 1 : 0;
      runOnJS(move)(mag * Math.cos(ang), -mag * Math.sin(ang), mag > SPRINT_AT);
    })
    .onFinalize(() => {
      active.value = withTiming(0, { duration: 150 });
      sprinting.value = 0;
      baseX.value = withTiming(homeX.value, { duration: 150 });
      baseY.value = withTiming(homeY.value, { duration: 150 });
      knobX.value = withTiming(homeX.value, { duration: 150 });
      knobY.value = withTiming(homeY.value, { duration: 150 });
      runOnJS(endMove)();
    });

  const lookPan = Gesture.Pan()
    .minDistance(0)
    .onChange((e) => {
      runOnJS(look)(e.changeX, e.changeY);
    });

  // Always visible: dimmed at rest, bright while used, amber while sprinting.
  const ringStyle = useAnimatedStyle(() => ({
    opacity: 0.55 + active.value * 0.45,
    borderColor: sprinting.value ? "rgba(255,176,0,0.8)" : "rgba(57,255,20,0.45)",
    transform: [{ translateX: baseX.value - RING / 2 }, { translateY: baseY.value - RING / 2 }],
  }));
  const knobStyle = useAnimatedStyle(() => ({
    opacity: 0.7 + active.value * 0.3,
    backgroundColor: sprinting.value ? "rgba(255,176,0,0.45)" : "rgba(57,255,20,0.3)",
    borderColor: sprinting.value ? "rgba(255,176,0,0.95)" : "rgba(57,255,20,0.75)",
    transform: [{ translateX: knobX.value - 30 }, { translateY: knobY.value - 30 }],
  }));
  const sprintStyle = useAnimatedStyle(() => ({
    opacity: sprinting.value,
    transform: [{ translateX: baseX.value - 40 }, { translateY: baseY.value - RING / 2 - 26 }],
  }));

  // The engine times the shots (tap, 3-round burst or auto while held) from the weapon's fire mode.
  const startFire = () => {
    getEngine()?.pullTrigger();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
  };
  const stopFire = () => getEngine()?.releaseTrigger();

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {/* Movement joystick zone (left) */}
      <GestureDetector gesture={joystick}>
        <View style={styles.joyZone} onLayout={onJoyLayout} testID="joystick-zone">
          <Animated.View style={[styles.ring, ringStyle]} pointerEvents="none" testID="joystick">
            {/* Direction ticks */}
            <View style={[styles.tick, { top: 6, left: RING / 2 - 3 }]} />
            <View style={[styles.tick, { bottom: 6, left: RING / 2 - 3 }]} />
            <View style={[styles.tick, { left: 6, top: RING / 2 - 3 }]} />
            <View style={[styles.tick, { right: 6, top: RING / 2 - 3 }]} />
          </Animated.View>
          <Animated.View style={[styles.knob, knobStyle]} pointerEvents="none">
            <MaterialCommunityIcons name="cursor-move" size={22} color="rgba(255,255,255,0.8)" />
          </Animated.View>
          <Animated.View style={[styles.sprintTag, sprintStyle]} pointerEvents="none">
            <Text style={styles.sprintText}>SPRINT</Text>
          </Animated.View>
        </View>
      </GestureDetector>

      {/* Look zone (right) */}
      <GestureDetector gesture={lookPan}>
        <View style={styles.lookZone} />
      </GestureDetector>

      {/* Combat buttons (right, over look zone) */}
      <HoldButton
        testID="jump-button"
        onDown={() => {
          getEngine()?.jumpDown();
          Haptics.selectionAsync().catch(() => {});
        }}
        onUp={() => getEngine()?.jumpUp()}
        style={styles.jumpBtn}
        pressedStyle={styles.pressed}
      >
        <MaterialCommunityIcons name="arrow-up-bold" size={26} color={colors.brandSecondary} />
        <Text style={styles.smallLabel}>JUMP</Text>
      </HoldButton>

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

      {fireModes.length > 1 && (
        <Pressable
          testID="fire-mode-button"
          onPress={() => {
            getEngine()?.cycleFireMode();
            Haptics.selectionAsync().catch(() => {});
          }}
          hitSlop={6}
          style={({ pressed }) => [styles.modeBtn, pressed && styles.pressed]}
        >
          <MaterialCommunityIcons name={MODE_UI[fireMode].icon as any} size={16} color={colors.brandSecondary} />
          <Text style={styles.modeText} testID="fire-mode-label">
            {t(MODE_UI[fireMode].label)}
          </Text>
        </Pressable>
      )}

      <HoldButton testID="fire-button" onDown={startFire} onUp={stopFire} style={styles.fireBtn} pressedStyle={styles.firePressed}>
        <MaterialCommunityIcons name="pistol" size={40} color="#fff" />
        <Text style={styles.fireLabel}>FIRE</Text>
      </HoldButton>
    </View>
  );
}

// Reacts on touch down with no delay: Pressable ignores taps shorter than its press delay on the
// web, which loses quick shots. Uses the plain responder system, like Pressable on Android.
function HoldButton(p: {
  testID?: string;
  onDown: () => void;
  onUp: () => void;
  style: StyleProp<ViewStyle>;
  pressedStyle: StyleProp<ViewStyle>;
  children: React.ReactNode;
}) {
  const [pressed, setPressed] = useState(false);
  const up = () => {
    setPressed(false);
    p.onUp();
  };
  return (
    <View
      testID={p.testID}
      accessibilityRole="button"
      style={[p.style, pressed && p.pressedStyle]}
      onStartShouldSetResponder={() => true}
      onResponderTerminationRequest={() => false}
      onResponderGrant={() => {
        setPressed(true);
        p.onDown();
      }}
      onResponderRelease={up}
      onResponderTerminate={up}
    >
      {p.children}
    </View>
  );
}

const styles = StyleSheet.create({
  joyZone: { position: "absolute", left: 0, top: 0, bottom: 0, width: "45%" },
  lookZone: { position: "absolute", right: 0, top: 0, bottom: 0, width: "55%" },
  ring: {
    position: "absolute",
    width: RING,
    height: RING,
    borderRadius: RING / 2,
    borderWidth: 2,
    backgroundColor: "rgba(13,15,18,0.35)",
  },
  tick: { position: "absolute", width: 6, height: 6, borderRadius: 3, backgroundColor: "rgba(57,255,20,0.5)" },
  knob: {
    position: "absolute",
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  sprintTag: {
    position: "absolute",
    width: 80,
    alignItems: "center",
  },
  sprintText: { color: colors.warning, fontFamily: fonts.display, fontSize: 13, letterSpacing: 2 },
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
  modeBtn: {
    position: "absolute",
    right: 30,
    bottom: 176,
    height: 32,
    paddingHorizontal: 10,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(13,15,18,0.7)",
    borderWidth: 1.5,
    borderColor: "rgba(0,255,255,0.55)",
  },
  modeText: { color: colors.brandSecondary, fontFamily: fonts.display, fontSize: 12, letterSpacing: 1 },
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
