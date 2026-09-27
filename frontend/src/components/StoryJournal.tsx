import React from "react";
import { View, Text, StyleSheet, Pressable, ScrollView } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { colors, fonts, spacing, radius } from "../theme";
import { ACTS, actProgress, type Act, type StoryState } from "../game/story";
import { CITIES } from "../game/cities";
import { formatNumber, useT, type Key } from "@/src/i18n";
import Panel from "./Panel";

// Story journal: the acts of "L'Épidémie Néon", their progress, comic pages to watch again,
// the act rewards, and the acts still to come.
type Props = {
  story: StoryState;
  stars: Record<string, number>;
  unlockedLevel: number;
  credits: number;
  onReplay: (id: string, act: Act) => void;
  onClaim: (act: Act) => void;
  onPlay: (level: number) => void;
  onClose: () => void;
};

export default function StoryJournal({ story, stars, unlockedLevel, credits, onReplay, onClaim, onPlay, onClose }: Props) {
  const t = useT();
  let done = 0;
  let total = 0;
  for (const a of ACTS) {
    const p = actProgress(a, stars);
    done += p.done;
    total += p.total;
  }
  const percent = Math.round((done / total) * 100);

  return (
    <Panel title={t("story.title")} icon="book-open-variant" credits={credits} onClose={onClose} testID="story-journal">
      <View style={styles.head}>
        <Text style={styles.headText} testID="story-percent">{t("story.progress", { n: percent })}</Text>
        <View style={styles.bar}>
          <View style={[styles.fill, { width: `${percent}%` }]} />
        </View>
      </View>
      <ScrollView horizontal contentContainerStyle={styles.row} showsHorizontalScrollIndicator={false}>
        {ACTS.map((a) => {
          const p = actProgress(a, stars);
          const complete = p.done >= p.total;
          const claimed = story.claimed.includes(a.n);
          const firstOpen = Math.min(Math.max(a.levels[0], Math.min(unlockedLevel, a.levels[1])), a.levels[1]);
          return (
            <View key={a.n} style={[styles.card, !a.ready && styles.cardSoon]} testID={`story-act-${a.n}`}>
              <View style={styles.cardTop}>
                <Text style={[styles.actTag, !a.ready && { backgroundColor: colors.surfaceTertiary, color: colors.onSurfaceSecondary }]}>{t("story.actN", { n: a.n })}</Text>
                {!a.ready ? (
                  <MaterialCommunityIcons name="lock" size={16} color={colors.onSurfaceTertiary} />
                ) : complete ? (
                  <MaterialCommunityIcons name="check-decagram" size={18} color={colors.brand} />
                ) : null}
              </View>
              <Text style={styles.title} numberOfLines={1}>{t(a.title)}</Text>
              <Text style={styles.meta}>{t("story.levels", { a: a.levels[0], b: a.levels[1], city: t(CITIES[a.city].name) })}</Text>
              <Text style={styles.tag} numberOfLines={3}>{t(a.tagline)}</Text>
              {a.ready ? (
                <>
                  <View style={styles.bar}>
                    <View style={[styles.fill, { width: `${(p.done / p.total) * 100}%` }]} />
                  </View>
                  <Text style={styles.meta}>{t("story.cleared", { done: p.done, total: p.total })}</Text>
                  {a.reward && (
                    <Text style={[styles.reward, claimed && { color: colors.brand }]}>
                      {claimed ? "✓ " + t("story.rewardDone") : t("story.reward", { credits: formatNumber(a.reward.credits), skin: t(`skin.${a.reward.skin}` as Key) })}
                    </Text>
                  )}
                  <View style={styles.actions}>
                    {complete && a.reward && !claimed ? (
                      <Pressable testID={`story-claim-${a.n}`} style={[styles.btn, { backgroundColor: colors.warning }]} onPress={() => onClaim(a)}>
                        <Text style={[styles.btnText, { color: colors.onWarning }]}>{t("story.claim")}</Text>
                      </Pressable>
                    ) : (
                      <Pressable testID={`story-play-${a.n}`} style={[styles.btn, { backgroundColor: colors.brand }]} onPress={() => onPlay(firstOpen)}>
                        <Text style={[styles.btnText, { color: colors.onBrand }]}>{t("story.play")}</Text>
                      </Pressable>
                    )}
                    <View style={styles.replays}>
                      {a.intro && (
                        <Pressable testID={`story-replay-intro-${a.n}`} style={styles.ghost} onPress={() => onReplay(a.intro!, a)}>
                          <MaterialCommunityIcons name="replay" size={14} color={colors.onSurfaceSecondary} />
                          <Text style={styles.ghostText}>{t("story.replayIntro")}</Text>
                        </Pressable>
                      )}
                      {a.outro && story.seen.includes(a.outro) && (
                        <Pressable testID={`story-replay-outro-${a.n}`} style={styles.ghost} onPress={() => onReplay(a.outro!, a)}>
                          <MaterialCommunityIcons name="replay" size={14} color={colors.onSurfaceSecondary} />
                          <Text style={styles.ghostText}>{t("story.replayOutro")}</Text>
                        </Pressable>
                      )}
                    </View>
                  </View>
                </>
              ) : (
                <Text style={styles.soon}>{t("story.soon")}</Text>
              )}
            </View>
          );
        })}
      </ScrollView>
    </Panel>
  );
}

const styles = StyleSheet.create({
  head: { gap: 4, marginBottom: spacing.sm },
  headText: { color: colors.onSurface, fontFamily: fonts.displaySemi, fontSize: 14, letterSpacing: 1 },
  bar: { height: 6, borderRadius: 3, backgroundColor: colors.surfaceTertiary, overflow: "hidden" },
  fill: { height: "100%", backgroundColor: colors.warning },
  row: { gap: spacing.sm, paddingBottom: 4 },
  card: { width: 205, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.warning, backgroundColor: colors.surfaceSecondary, padding: spacing.sm, gap: 5 },
  cardSoon: { borderColor: colors.border, opacity: 0.75 },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  actTag: { color: colors.onWarning, backgroundColor: colors.warning, fontFamily: fonts.display, fontSize: 11, letterSpacing: 2, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 3, overflow: "hidden" },
  title: { color: colors.onSurface, fontFamily: fonts.display, fontSize: 18, letterSpacing: 1 },
  meta: { color: colors.onSurfaceSecondary, fontFamily: fonts.text, fontSize: 11 },
  tag: { color: colors.onSurfaceSecondary, fontFamily: fonts.text, fontSize: 12, lineHeight: 16 },
  reward: { color: colors.warning, fontFamily: fonts.textMed, fontSize: 11 },
  actions: { gap: 6, marginTop: 2 },
  btn: { height: 34, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
  btnText: { fontFamily: fonts.display, fontSize: 14, letterSpacing: 1.5 },
  replays: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  ghost: { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 6, paddingVertical: 3, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border },
  ghostText: { color: colors.onSurfaceSecondary, fontFamily: fonts.textMed, fontSize: 10 },
  soon: { color: colors.onSurfaceTertiary, fontFamily: fonts.display, fontSize: 14, letterSpacing: 2, marginTop: "auto" },
});
