import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, FlatList, ActivityIndicator } from "react-native";
import { BlurView } from "expo-blur";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { colors, fonts, spacing, radius } from "../theme";
import { fetchLeaderboard, fetchMyRank, type LeaderboardRow } from "../api/leaderboard";
import { currentSeason, daysLeft, fetchMySeason, fetchSeason, type MySeason } from "../api/seasons";
import { formatNumber, useT, type Key } from "@/src/i18n";

type Tab = "season" | "all";
type Props = { username: string; guest: boolean; initialTab?: Tab; onSeasonInfo?: () => void; onClose: () => void };
type Row = { key: string; rank: number; name: string; level: number; score: number; badge: number | null; mine: boolean };

// Trophy of the players who finished in the top 5 of a monthly season.
export function SeasonBadge({ rank, size = 14 }: { rank: number | null | undefined; size?: number }) {
  if (!rank) return null;
  const color = rank === 1 ? "#FFD700" : rank === 2 ? "#C0C0C0" : rank === 3 ? "#CD7F32" : colors.brandSecondary;
  return <MaterialCommunityIcons name="trophy" size={size} color={color} testID={`badge-${rank}`} />;
}

export default function Leaderboard({ username, guest, initialTab = "season", onSeasonInfo, onClose }: Props) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [state, setState] = useState<"loading" | "done" | "error">("loading");
  const [rows, setRows] = useState<Row[]>([]);
  const [me, setMe] = useState<Row | null>(null);
  const [mySeason, setMySeason] = useState<MySeason | null>(null);
  const t = useT();
  const cur = currentSeason();
  const left = daysLeft(cur.end);

  const load = async (which: Tab) => {
    setState("loading");
    setMe(null);
    try {
      if (which === "season") {
        const s = await fetchSeason(50);
        setRows(s.top.map((r) => ({ key: `${r.rank}-${r.name}`, rank: r.rank, name: r.name, level: r.level, score: r.score, badge: r.badge, mine: !guest && r.name === username })));
        setState("done");
        if (!guest) fetchMySeason(username).then(setMySeason, () => setMySeason(null));
      } else {
        const data: LeaderboardRow[] = await fetchLeaderboard(50);
        setRows(data.map((r) => ({ key: r.id, rank: r.rank, name: r.name, level: r.level, score: r.score, badge: r.badge ?? null, mine: !guest && r.name === username })));
        setState("done");
        if (!guest)
          fetchMyRank(username).then(
            (m) => setMe(m ? { key: m.id, rank: m.rank, name: m.name, level: m.level, score: m.score, badge: m.badge ?? null, mine: true } : null),
            () => setMe(null)
          );
      }
    } catch {
      setState("error");
    }
  };

  useEffect(() => {
    load(tab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const medal = (rank: number) =>
    rank === 1 ? "#FFD700" : rank === 2 ? "#C0C0C0" : rank === 3 ? "#CD7F32" : colors.onSurfaceTertiary;

  return (
    <BlurView intensity={50} tint="dark" style={styles.overlay} testID="leaderboard-modal">
      <View style={styles.modal}>
        <View style={styles.header}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <MaterialCommunityIcons name="trophy" size={22} color={colors.brand} />
            <Text style={styles.title}>{t("board.title")}</Text>
          </View>
          <View style={styles.tabs}>
            {(["season", "all"] as Tab[]).map((k) => (
              <Pressable key={k} testID={`board-tab-${k}`} onPress={() => setTab(k)} style={[styles.tab, tab === k && styles.tabOn]}>
                <Text style={[styles.tabText, tab === k && { color: colors.onBrand }]}>{t(k === "season" ? "board.season" : "board.allTime")}</Text>
              </Pressable>
            ))}
          </View>
          <Pressable testID="leaderboard-close" onPress={onClose} style={styles.closeBtn} hitSlop={10}>
            <MaterialCommunityIcons name="close" size={22} color={colors.onSurface} />
          </Pressable>
        </View>

        {tab === "season" && (
          <View style={styles.seasonBox} testID="season-info">
            <View style={styles.seasonHead}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Text style={styles.seasonName}>{t(`season.m${cur.month}` as Key)}</Text>
                {onSeasonInfo && (
                  <Pressable testID="season-info-open" onPress={onSeasonInfo} hitSlop={10}>
                    <MaterialCommunityIcons name="help-circle-outline" size={18} color={colors.warning} />
                  </Pressable>
                )}
              </View>
              <Text style={styles.seasonLeft}>{left <= 1 ? t("season.lastDay") : t("season.endsIn", { n: left })}</Text>
            </View>
            <Text style={styles.seasonRewards}>{t("season.rewardsLine")}</Text>
            {!guest && mySeason && (
              <Text style={styles.seasonMine} testID="season-mine">
                {mySeason.excluded
                  ? t("season.excluded")
                  : mySeason.rank
                    ? t("season.mine", { rank: mySeason.rank, score: formatNumber(mySeason.score ?? 0) })
                    : t("season.noScore")}
              </Text>
            )}
          </View>
        )}
        {state === "loading" && (
          <View style={styles.centerBox}>
            <ActivityIndicator color={colors.brand} size="large" />
          </View>
        )}
        {state === "error" && (
          <View style={styles.centerBox}>
            <Text style={styles.dim}>{t("board.error")}</Text>
            <Pressable onPress={() => load(tab)} style={styles.retry} testID="leaderboard-retry">
              <Text style={styles.retryText}>{t("common.retry")}</Text>
            </Pressable>
          </View>
        )}
        {state === "done" && rows.length === 0 && (
          <View style={styles.centerBox}>
            <Text style={styles.dim}>{t(tab === "season" ? "season.empty" : "board.empty")}</Text>
          </View>
        )}
        {state === "done" && rows.length > 0 && (
          <FlatList
            data={rows}
            keyExtractor={(item) => item.key}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: spacing.md }}
            renderItem={({ item }) => {
              const isMe = item.mine;
              return (
                <View style={[styles.row, isMe && styles.meRow]}>
                  <Text style={[styles.rank, { color: medal(item.rank) }]}>#{item.rank}</Text>
                  <View style={styles.nameCell}>
                    <Text style={[styles.name, isMe && { color: colors.brand }]} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <SeasonBadge rank={item.badge} />
                  </View>
                  <Text style={styles.wave}>N{item.level}</Text>
                  <Text style={[styles.score, isMe && { color: colors.brand }]}>
                    {item.score.toLocaleString()}
                  </Text>
                </View>
              );
            }}
          />
        )}
        {guest && (
          <Text style={styles.guestNote} testID="leaderboard-guest">
            {t(tab === "season" ? "season.guest" : "board.guest")}
          </Text>
        )}
        {state === "done" && tab === "all" && me && !rows.some((r) => r.mine) && (
          <View style={[styles.row, styles.meRow]} testID="leaderboard-me">
            <Text style={[styles.rank, { color: colors.onSurfaceSecondary }]}>#{me.rank}</Text>
            <Text style={[styles.name, { color: colors.brand }]} numberOfLines={1}>
              {me.name} {t("board.you")}
            </Text>
            <Text style={styles.wave}>N{me.level}</Text>
            <Text style={[styles.score, { color: colors.brand }]}>{me.score.toLocaleString()}</Text>
          </View>
        )}
      </View>
    </BlurView>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", zIndex: 30 },
  modal: {
    width: "72%",
    maxWidth: 560,
    height: "82%",
    backgroundColor: "rgba(13,15,18,0.88)",
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
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
  centerBox: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.md },
  guestNote: { color: colors.warning, fontFamily: fonts.textMed, fontSize: 12, textAlign: "center", paddingTop: spacing.sm },
  dim: { color: colors.onSurfaceSecondary, fontFamily: fonts.text, fontSize: 14 },
  retry: { paddingHorizontal: spacing.lg, height: 40, borderRadius: radius.md, borderWidth: 2, borderColor: colors.brand, justifyContent: "center" },
  retryText: { color: colors.brand, fontFamily: fonts.display, fontSize: 14, letterSpacing: 1 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
    gap: spacing.sm,
  },
  meRow: { backgroundColor: colors.surfaceTertiary },
  rank: { width: 48, fontFamily: fonts.display, fontSize: 16 },
  name: { flexShrink: 1, color: colors.onSurface, fontFamily: fonts.textMed, fontSize: 15 },
  nameCell: { flex: 1, flexDirection: "row", alignItems: "center", gap: 6 },
  tabs: { flexDirection: "row", gap: 6, marginLeft: "auto", marginRight: spacing.sm },
  tab: { height: 30, paddingHorizontal: 12, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border, justifyContent: "center" },
  tabOn: { backgroundColor: colors.warning, borderColor: colors.warning },
  tabText: { color: colors.onSurfaceSecondary, fontFamily: fonts.display, fontSize: 12, letterSpacing: 1 },
  seasonBox: { borderRadius: radius.md, borderWidth: 1, borderColor: "rgba(255,176,0,0.4)", backgroundColor: "rgba(255,176,0,0.07)", padding: spacing.sm, marginBottom: spacing.sm, gap: 2 },
  seasonHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  seasonName: { color: colors.warning, fontFamily: fonts.display, fontSize: 16, letterSpacing: 1 },
  seasonLeft: { color: colors.onSurface, fontFamily: fonts.display, fontSize: 13, letterSpacing: 1 },
  seasonRewards: { color: colors.onSurfaceSecondary, fontFamily: fonts.text, fontSize: 12 },
  seasonMine: { color: colors.brand, fontFamily: fonts.textMed, fontSize: 13 },
  wave: { width: 46, color: colors.onSurfaceSecondary, fontFamily: fonts.displayMed, fontSize: 13, textAlign: "center" },
  score: { width: 84, color: colors.onSurface, fontFamily: fonts.display, fontSize: 17, textAlign: "right" },
});
