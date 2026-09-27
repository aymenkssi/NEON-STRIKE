import React, { useState } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "@/src/utils/haptics";
import { colors, fonts, spacing, radius } from "../theme";
import { COMICS, type Act, type ActReward, type Panel, type SceneId, type Speaker } from "../game/story";
import { formatNumber, useT, type Key } from "@/src/i18n";
import ComicStage from "./ComicStage";

// Comic pages of the story: one panel at a time (art + caption or speech bubble), tap to go on.
// With `reward`, a last page shows the act reward and a button to collect it.
type Props = {
  id: string;
  act: Act;
  reward?: ActReward | null;
  onClaim?: () => void;
  onDone: () => void;
};

const SPEAKER: Record<Speaker, { icon: string; color: string }> = {
  narrator: { icon: "book-open-variant", color: colors.warning },
  max: { icon: "account", color: "#5b8def" },
  radio: { icon: "radio-handheld", color: colors.brand },
  rex: { icon: "radio-handheld", color: "#9bbf5a" },
  guardian: { icon: "shield-alert", color: "#00ffff" },
};

type Deco = { icon: string; size: number; color: string; x: string; y: string; rot?: number };
const SCENES: Record<SceneId, { colors: [string, string]; decos: Deco[]; label?: string }> = {
  lab: {
    colors: ["#06112a", "#15416b"],
    label: "HELIX CORP · NÉON-X",
    decos: [
      { icon: "city-variant", size: 90, color: "#0f2a48", x: "2%", y: "58%" },
      { icon: "city-variant", size: 90, color: "#0f2a48", x: "60%", y: "58%" },
      { icon: "flask-round-bottom-outline", size: 110, color: "#00e5ff", x: "36%", y: "22%" },
      { icon: "lightning-bolt", size: 54, color: "#ffe14d", x: "70%", y: "10%", rot: 15 },
      { icon: "star-four-points", size: 26, color: "#ff5cd6", x: "20%", y: "14%" },
    ],
  },
  leak: {
    colors: ["#1c0306", "#6b0f1a"],
    label: "ALERTE · FUITE",
    decos: [
      { icon: "city-variant", size: 100, color: "#2a0409", x: "0%", y: "55%" },
      { icon: "city-variant", size: 100, color: "#2a0409", x: "58%", y: "55%" },
      { icon: "biohazard", size: 120, color: "#9dff2e", x: "34%", y: "16%" },
      { icon: "alert", size: 40, color: "#ffd23a", x: "8%", y: "10%", rot: -12 },
      { icon: "eye", size: 30, color: "#fff35c", x: "76%", y: "22%" },
      { icon: "eye", size: 24, color: "#fff35c", x: "84%", y: "36%" },
    ],
  },
  radio: {
    colors: ["#04120a", "#0f3a24"],
    decos: [
      { icon: "access-point", size: 70, color: "#1f6a3f", x: "62%", y: "8%" },
      { icon: "radio-handheld", size: 120, color: "#39ff14", x: "32%", y: "18%", rot: -10 },
      { icon: "waveform", size: 50, color: "#1f6a3f", x: "8%", y: "60%" },
    ],
  },
  tower: {
    colors: ["#07041a", "#3d0a4d"],
    label: "TOUR HELIX",
    decos: [
      { icon: "city-variant", size: 90, color: "#1b0b2b", x: "0%", y: "60%" },
      { icon: "office-building", size: 150, color: "#ff5cd6", x: "33%", y: "6%" },
      { icon: "star-four-points", size: 30, color: "#00ffff", x: "72%", y: "12%" },
      { icon: "star-four-points", size: 18, color: "#fff35c", x: "18%", y: "24%" },
    ],
  },
  badge: {
    colors: ["#081421", "#15324e"],
    label: "SÉCURITÉ HELIX · NIVEAU 5",
    decos: [
      { icon: "shield-account", size: 130, color: "#00ffff", x: "33%", y: "14%" },
      { icon: "card-account-details-outline", size: 44, color: "#2e5b86", x: "8%", y: "62%", rot: -14 },
    ],
  },
};

export default function StoryComic({ id, act, reward, onClaim, onDone }: Props) {
  const t = useT();
  const panels: Panel[] = COMICS[id] ?? [];
  const [i, setI] = useState(0);
  const [claimed, setClaimed] = useState(false);
  const onReward = !!reward && i >= panels.length;
  const count = panels.length + (reward ? 1 : 0);

  const next = () => {
    Haptics.selectionAsync().catch(() => {});
    if (i + 1 < count) setI(i + 1);
    else onDone();
  };
  const skip = () => (reward ? setI(panels.length) : onDone());

  const p = panels[Math.min(i, panels.length - 1)];
  const who = SPEAKER[p?.who ?? "narrator"];
  const stage = onReward
    ? { bg: 0x1a1406, actors: [{ hero: reward!.skin, weapon: "m4", x: 0, turn: 0.35 }] }
    : p && "stage" in p.art
      ? p.art.stage
      : null;
  const scene = !onReward && p && "scene" in p.art ? SCENES[p.art.scene] : null;

  return (
    <View style={styles.overlay} testID="story-comic">
      <View style={styles.top}>
        <Text style={styles.actTag}>{t("story.actN", { n: act.n })}</Text>
        <Text style={styles.actTitle}>{t(act.title)}</Text>
        <View style={{ flex: 1 }} />
        {!onReward && (
          <Pressable testID="story-skip" onPress={skip} hitSlop={10} style={styles.skip}>
            <Text style={styles.skipText}>{t("story.skip")}</Text>
            <MaterialCommunityIcons name="skip-next" size={18} color={colors.onSurfaceSecondary} />
          </Pressable>
        )}
      </View>

      <Pressable style={styles.page} onPress={onReward ? undefined : next} testID="story-page">
        <View style={styles.art}>
          {stage && <ComicStage actors={stage.actors} bg={stage.bg} night={"night" in stage ? stage.night : true} />}
          {scene && (
            <LinearGradient colors={scene.colors} style={StyleSheet.absoluteFill}>
              {scene.decos.map((d, k) => (
                <MaterialCommunityIcons
                  key={k}
                  name={d.icon as any}
                  size={d.size}
                  color={d.color}
                  style={{ position: "absolute", left: d.x as any, top: d.y as any, transform: [{ rotate: `${d.rot ?? 0}deg` }] }}
                />
              ))}
              {scene.label && <Text style={styles.sceneLabel}>{scene.label}</Text>}
            </LinearGradient>
          )}
          <View style={styles.halftone} pointerEvents="none" />
        </View>

        {onReward ? (
          <View style={styles.side}>
            <Text style={styles.done} testID="story-act-done">{t("story.actDone", { n: act.n })}</Text>
            <View style={styles.rewardRow}>
              <MaterialCommunityIcons name="circle-multiple" size={22} color={colors.warning} />
              <Text style={styles.rewardText}>+{formatNumber(reward!.credits)}</Text>
            </View>
            <View style={styles.rewardRow}>
              <MaterialCommunityIcons name="tshirt-crew" size={22} color={colors.skins} />
              <Text style={[styles.rewardText, { color: colors.skins }]}>{t(`skin.${reward!.skin}` as Key)}</Text>
            </View>
            {claimed && <Text style={styles.equipped}>{t("story.equipped", { skin: t(`skin.${reward!.skin}` as Key) })}</Text>}
            <Text style={styles.soon}>{t("story.toBeContinued")}</Text>
            <Pressable
              testID={claimed ? "story-finish" : "story-claim"}
              style={[styles.btn, { backgroundColor: claimed ? colors.brand : colors.warning }]}
              onPress={() => {
                if (claimed) return onDone();
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
                onClaim?.();
                setClaimed(true);
              }}
            >
              <Text style={[styles.btnText, { color: claimed ? colors.onBrand : colors.onWarning }]}>{t(claimed ? "story.end" : "story.claim")}</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.side}>
            {p?.who !== "narrator" && (
              <View style={[styles.speaker, { borderColor: who.color }]}>
                <MaterialCommunityIcons name={who.icon as any} size={16} color={who.color} />
                <Text style={[styles.speakerText, { color: who.color }]}>{t(`story.who.${p?.who}` as Key)}</Text>
              </View>
            )}
            <View style={p?.who === "narrator" ? styles.caption : styles.bubble} testID="story-text">
              {p?.who !== "narrator" && <View style={styles.tail} />}
              <Text style={p?.who === "narrator" ? styles.captionText : styles.bubbleText}>{p ? t(p.text) : ""}</Text>
            </View>
            <Text style={styles.tap}>{t("story.tap")}</Text>
          </View>
        )}
      </Pressable>

      <View style={styles.bottom}>
        <View style={styles.dots}>
          {Array.from({ length: count }, (_, k) => (
            <View key={k} style={[styles.dot, k === i && styles.dotOn]} />
          ))}
        </View>
        {!onReward && (
          <Pressable testID="story-next" onPress={next} style={styles.next}>
            <Text style={styles.nextText}>{t(i + 1 < count ? "story.next" : "story.end")}</Text>
            <MaterialCommunityIcons name="chevron-right" size={20} color={colors.onBrand} />
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "#05060a", zIndex: 60, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, gap: spacing.sm },
  top: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  actTag: { color: colors.onWarning, backgroundColor: colors.warning, fontFamily: fonts.display, fontSize: 13, letterSpacing: 2, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, overflow: "hidden" },
  actTitle: { color: colors.onSurface, fontFamily: fonts.display, fontSize: 18, letterSpacing: 2 },
  skip: { flexDirection: "row", alignItems: "center", gap: 2, paddingHorizontal: 8, paddingVertical: 4 },
  skipText: { color: colors.onSurfaceSecondary, fontFamily: fonts.displaySemi, fontSize: 13, letterSpacing: 1 },
  page: { flex: 1, flexDirection: "row", gap: spacing.md, minHeight: 0 },
  art: { flex: 1.25, borderRadius: 6, borderWidth: 3, borderColor: "#f2efe6", overflow: "hidden", backgroundColor: "#111" },
  halftone: { ...StyleSheet.absoluteFillObject, borderWidth: 6, borderColor: "rgba(0,0,0,0.25)" },
  sceneLabel: { position: "absolute", left: 10, top: 8, color: "rgba(255,255,255,0.85)", fontFamily: fonts.display, fontSize: 12, letterSpacing: 2, backgroundColor: "rgba(0,0,0,0.35)", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 3 },
  side: { flex: 1, justifyContent: "center", gap: spacing.sm },
  speaker: { flexDirection: "row", alignSelf: "flex-start", alignItems: "center", gap: 6, borderWidth: 1.5, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 3 },
  speakerText: { fontFamily: fonts.display, fontSize: 13, letterSpacing: 1.5 },
  bubble: { backgroundColor: "#fbfaf5", borderRadius: 18, borderWidth: 3, borderColor: "#111", padding: 14 },
  tail: { position: "absolute", left: -14, top: 18, width: 0, height: 0, borderTopWidth: 8, borderBottomWidth: 8, borderRightWidth: 14, borderTopColor: "transparent", borderBottomColor: "transparent", borderRightColor: "#111" },
  bubbleText: { color: "#111", fontFamily: fonts.textMed, fontSize: 16, lineHeight: 22 },
  caption: { backgroundColor: "#ffe14d", borderWidth: 3, borderColor: "#111", padding: 12, transform: [{ rotate: "-1deg" }] },
  captionText: { color: "#1a1400", fontFamily: fonts.textMed, fontSize: 15, lineHeight: 21 },
  tap: { color: colors.onSurfaceTertiary, fontFamily: fonts.text, fontSize: 11 },
  bottom: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", height: 36 },
  dots: { flexDirection: "row", gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.surfaceTertiary },
  dotOn: { backgroundColor: colors.warning, width: 20 },
  next: { flexDirection: "row", alignItems: "center", gap: 2, backgroundColor: colors.brand, borderRadius: radius.md, paddingLeft: 14, paddingRight: 8, height: 34 },
  nextText: { color: colors.onBrand, fontFamily: fonts.display, fontSize: 14, letterSpacing: 1.5 },
  done: { color: colors.warning, fontFamily: fonts.display, fontSize: 24, letterSpacing: 2 },
  rewardRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  rewardText: { color: colors.warning, fontFamily: fonts.display, fontSize: 20, letterSpacing: 1 },
  equipped: { color: colors.brand, fontFamily: fonts.textMed, fontSize: 13 },
  soon: { color: colors.onSurfaceSecondary, fontFamily: fonts.text, fontSize: 12 },
  btn: { height: 44, borderRadius: radius.md, alignItems: "center", justifyContent: "center", marginTop: 4 },
  btnText: { fontFamily: fonts.display, fontSize: 17, letterSpacing: 1.5 },
});
