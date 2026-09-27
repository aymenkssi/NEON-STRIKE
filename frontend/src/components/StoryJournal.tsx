import React, { useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { colors, fonts, spacing, radius } from "../theme";
import { ACTS, actProgress, comicsOf, docKey, docsOfAct, type Act, type ActReward, type EpisodeRun, type StoryState } from "../game/story";
import { cityOfLevel } from "../game/cities";
import { outfit as outfitOf, skinTitle } from "../game/skins";
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
  episodes: EpisodeRun[];
  onPlayEpisode: (run: EpisodeRun) => void;
  onReplayEpisode: (run: EpisodeRun, part: "intro" | "outro") => void;
};

export default function StoryJournal({ story, stars, unlockedLevel, credits, onReplay, onClaim, onPlay, onClose, episodes, onPlayEpisode, onReplayEpisode }: Props) {
  const t = useT();
  const [docsAct, setDocsAct] = useState<Act | null>(null);
  let done = 0;
  let total = 0;
  for (const a of ACTS) {
    const p = actProgress(a, stars);
    done += p.done;
    total += p.total;
  }
  const percent = Math.round((done / total) * 100);
  const rewardText = (a: Act | { reward?: ActReward }) => {
    const r = a.reward!;
    const items = [t("story.creditsN", { n: formatNumber(r.credits) })];
    if (r.skin) items.push(skinTitle(r.skin, t));
    for (const h of r.heroes ?? []) items.push(t(outfitOf(h).heroName));
    return t("story.reward", { items: items.join(" + ") });
  };
  const replayLabel = (a: Act, id: string): Key => (id === a.intro ? "story.replayIntro" : id === a.outro ? "story.replayOutro" : "story.replayMid");

  if (docsAct) {
    const levels = docsOfAct(docsAct);
    return (
      <Panel title={t("story.docsTitle", { n: docsAct.n })} icon="file-document-outline" credits={credits} onClose={() => setDocsAct(null)} testID="story-docs">
        <ScrollView contentContainerStyle={styles.docs} showsVerticalScrollIndicator={false}>
          {levels.map((l) => {
            const found = story.docs.includes(l);
            return (
              <View key={l} style={[styles.doc, !found && styles.docLocked]} testID={`story-doc-${l}`}>
                <View style={styles.docHead}>
                  <MaterialCommunityIcons name={found ? "file-document-outline" : "file-hidden"} size={16} color={found ? "#00e5ff" : colors.onSurfaceTertiary} />
                  <Text style={[styles.docLevel, found && { color: "#00e5ff" }]}>{t("story.docLevel", { level: l })}</Text>
                </View>
                <Text style={[styles.docText, !found && { color: colors.onSurfaceTertiary }]}>{found ? t(docKey(l)) : t("story.docLocked", { level: l })}</Text>
              </View>
            );
          })}
        </ScrollView>
      </Panel>
    );
  }

  return (
    <Panel title={t("story.title")} icon="book-open-variant" credits={credits} onClose={onClose} testID="story-journal">
      <View style={styles.head}>
        <Text style={styles.headText} testID="story-percent">{t("story.progress", { n: percent })}</Text>
        <View style={styles.bar}>
          <View style={[styles.fill, { width: `${percent}%` }]} />
        </View>
        <Text style={styles.meta}>{t(episodes.length ? "story.episodesHint" : "story.docHint")}</Text>
      </View>
      <ScrollView horizontal contentContainerStyle={styles.row} showsHorizontalScrollIndicator={false}>
        {/* Episodes first: they are the news of the season. */}
        {episodes.map((e) => {
          const fresh = !story.epSeen.includes(e.id);
          const claimed = story.epClaimed.includes(e.id);
          return (
            <View key={e.id} style={[styles.card, styles.epCard]} testID={`story-ep-${e.number}`}>
              <View style={styles.cardTop}>
                <Text style={[styles.actTag, styles.epTag]}>{t("story.episodeN", { n: e.number })}</Text>
                {fresh ? <Text style={styles.newTag}>{t("story.new")}</Text> : claimed ? <MaterialCommunityIcons name="check-decagram" size={18} color={colors.brand} /> : null}
              </View>
              <Text style={styles.title} numberOfLines={1}>{e.title}</Text>
              <Text style={styles.meta}>{t("story.episodeLevel", { level: e.level, city: t(cityOfLevel(e.level).name) })}</Text>
              {!!e.tagline && <Text style={styles.tag} numberOfLines={2}>{e.tagline}</Text>}
              <Text style={[styles.reward, claimed && { color: colors.brand }]} numberOfLines={2}>
                {claimed ? "✓ " + t("story.rewardDone") : rewardText(e)}
              </Text>
              <View style={[styles.actions, { marginTop: "auto" }]}>
                <Pressable testID={`story-play-ep-${e.number}`} style={[styles.btn, { backgroundColor: colors.skins }]} onPress={() => onPlayEpisode(e)}>
                  <Text style={[styles.btnText, { color: "#1a0014" }]}>{t("story.playEpisode")}</Text>
                </Pressable>
                {!fresh && (
                  <View style={styles.replays}>
                    <Pressable testID={`story-replay-ep-${e.number}`} style={styles.ghost} onPress={() => onReplayEpisode(e, "intro")}>
                      <MaterialCommunityIcons name="replay" size={14} color={colors.onSurfaceSecondary} />
                      <Text style={styles.ghostText}>{t("story.replayEpisode")}</Text>
                    </Pressable>
                  </View>
                )}
              </View>
            </View>
          );
        })}
        {ACTS.map((a) => {
          const p = actProgress(a, stars);
          const complete = p.done >= p.total;
          const claimed = story.claimed.includes(a.n);
          const docs = docsOfAct(a).filter((l) => story.docs.includes(l)).length;
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
              <Text style={styles.meta}>{t("story.levels", { a: a.levels[0], b: a.levels[1], city: (a.cities ?? [a.city]).map((c) => t(CITIES[c].name)).join(" · ") })}</Text>
              <Text style={styles.tag} numberOfLines={2}>{t(a.tagline)}</Text>
              {a.ready ? (
                <>
                  <View style={styles.bar}>
                    <View style={[styles.fill, { width: `${(p.done / p.total) * 100}%` }]} />
                  </View>
                  <Text style={styles.meta}>{t("story.cleared", { done: p.done, total: p.total })}</Text>
                  <Pressable style={styles.docsRow} onPress={() => setDocsAct(a)} testID={`story-docs-${a.n}`}>
                    <MaterialCommunityIcons name="file-document-outline" size={14} color="#00e5ff" />
                    <Text style={styles.docsText}>{t("story.docs", { n: docs, total: p.total })}</Text>
                    <Text style={styles.docsRead}>{t("story.readDocs")} ›</Text>
                  </Pressable>
                  {a.reward && (
                    <Text style={[styles.reward, claimed && { color: colors.brand }]} numberOfLines={2}>
                      {claimed ? "✓ " + t("story.rewardDone") : rewardText(a)}
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
                      {comicsOf(a)
                        .filter((id, k) => k === 0 || story.seen.includes(id))
                        .map((id) => (
                          <Pressable key={id} testID={`story-replay-${id}`} style={styles.ghost} onPress={() => onReplay(id, a)}>
                            <MaterialCommunityIcons name="replay" size={14} color={colors.onSurfaceSecondary} />
                            <Text style={styles.ghostText}>{t(replayLabel(a, id))}</Text>
                          </Pressable>
                        ))}
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
  head: { gap: 3, marginBottom: 6 },
  headText: { color: colors.onSurface, fontFamily: fonts.displaySemi, fontSize: 14, letterSpacing: 1 },
  bar: { height: 6, borderRadius: 3, backgroundColor: colors.surfaceTertiary, overflow: "hidden" },
  fill: { height: "100%", backgroundColor: colors.warning },
  row: { gap: spacing.sm, paddingBottom: 4 },
  card: { width: 205, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.warning, backgroundColor: colors.surfaceSecondary, padding: spacing.sm, gap: 4 },
  cardSoon: { borderColor: colors.border, opacity: 0.75 },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  actTag: { color: colors.onWarning, backgroundColor: colors.warning, fontFamily: fonts.display, fontSize: 11, letterSpacing: 2, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 3, overflow: "hidden" },
  title: { color: colors.onSurface, fontFamily: fonts.display, fontSize: 18, letterSpacing: 1, flexShrink: 0, lineHeight: 22 },
  meta: { color: colors.onSurfaceSecondary, fontFamily: fonts.text, fontSize: 11 },
  tag: { color: colors.onSurfaceSecondary, fontFamily: fonts.text, fontSize: 12, lineHeight: 16 },
  reward: { color: colors.warning, fontFamily: fonts.textMed, fontSize: 11 },
  actions: { gap: 6, marginTop: 2 },
  btn: { height: 34, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
  btnText: { fontFamily: fonts.display, fontSize: 14, letterSpacing: 1.5 },
  replays: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  ghost: { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 6, paddingVertical: 3, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border },
  ghostText: { color: colors.onSurfaceSecondary, fontFamily: fonts.textMed, fontSize: 10 },
  epCard: { borderColor: colors.skins, backgroundColor: "rgba(255,92,214,0.06)" },
  epTag: { backgroundColor: colors.skins, color: "#1a0014" },
  newTag: { color: "#fff", backgroundColor: colors.error, fontFamily: fonts.display, fontSize: 10, letterSpacing: 1.5, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 3, overflow: "hidden" },
  docsRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  docsText: { color: "#00e5ff", fontFamily: fonts.textMed, fontSize: 11, flex: 1 },
  docsRead: { color: "#00e5ff", fontFamily: fonts.display, fontSize: 12, letterSpacing: 1 },
  docs: { gap: spacing.sm, paddingBottom: spacing.sm },
  doc: { borderRadius: radius.md, borderWidth: 1, borderColor: "rgba(0,229,255,0.4)", backgroundColor: "rgba(0,229,255,0.06)", padding: spacing.sm, gap: 4 },
  docLocked: { borderColor: colors.border, backgroundColor: colors.surfaceSecondary },
  docHead: { flexDirection: "row", alignItems: "center", gap: 6 },
  docLevel: { color: colors.onSurfaceTertiary, fontFamily: fonts.display, fontSize: 12, letterSpacing: 1.5 },
  docText: { color: colors.onSurface, fontFamily: fonts.textMed, fontSize: 13, lineHeight: 18 },
  soon: { color: colors.onSurfaceTertiary, fontFamily: fonts.display, fontSize: 14, letterSpacing: 2, marginTop: "auto" },
});
