import React, { useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { colors, fonts, spacing, radius } from "../theme";
import { achievementView, missionView, missionsForDay } from "../game/meta";
import { dayKey } from "../game/progression";
import type { Progress } from "../hooks/use-progress";
import Panel from "./Panel";

type Props = {
  progress: Progress;
  onClaimMission: (id: string) => number;
  onClaimAchievement: (id: string) => number;
  onClose: () => void;
};

type Tab = "missions" | "achievements" | "stats";

// Number of rewards waiting to be claimed (menu badge).
export function claimableGoals(p: Progress): number {
  const missions = missionView(missionsForDay(p.missions, dayKey(), p.unlockedLevel));
  const achievements = achievementView(p, p.achievementsClaimed);
  return [...missions, ...achievements].filter((x) => x.done && !x.claimed).length;
}

function hoursToMidnight() {
  const now = new Date();
  const next = new Date(now);
  next.setHours(24, 0, 0, 0);
  const h = Math.floor((next.getTime() - now.getTime()) / 3600000);
  const m = Math.floor(((next.getTime() - now.getTime()) % 3600000) / 60000);
  return h > 0 ? `${h} h ${m} min` : `${m} min`;
}

export default function Goals({ progress, onClaimMission, onClaimAchievement, onClose }: Props) {
  const [tab, setTab] = useState<Tab>("missions");
  const missions = missionView(missionsForDay(progress.missions, dayKey(), progress.unlockedLevel));
  const achievements = achievementView(progress, progress.achievementsClaimed).sort(
    (a, b) => rank(a) - rank(b) || b.value / b.target - a.value / a.target
  );
  const badge = (list: { done: boolean; claimed: boolean }[]) => list.filter((x) => x.done && !x.claimed).length;

  const claim = (fn: (id: string) => number, id: string) => {
    if (fn(id) > 0) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  };

  return (
    <Panel title="OBJECTIFS" icon="flag-checkered" credits={progress.credits} onClose={onClose} testID="goals">
      <View style={styles.tabs}>
        <TabButton label="MISSIONS DU JOUR" active={tab === "missions"} count={badge(missions)} onPress={() => setTab("missions")} testID="tab-missions" />
        <TabButton label="SUCCÈS" active={tab === "achievements"} count={badge(achievements)} onPress={() => setTab("achievements")} testID="tab-achievements" />
        <TabButton label="STATS" active={tab === "stats"} onPress={() => setTab("stats")} testID="tab-stats" />
      </View>

      <ScrollView style={styles.body} contentContainerStyle={{ gap: spacing.sm, paddingBottom: spacing.sm }} showsVerticalScrollIndicator={false}>
        {tab === "missions" && (
          <>
            {missions.map((m) => (
              <GoalRow
                key={m.id}
                icon="flag-variant"
                title={m.text}
                value={m.value}
                target={m.target}
                reward={m.reward}
                done={m.done}
                claimed={m.claimed}
                onClaim={() => claim(onClaimMission, m.id)}
                testID={`mission-${m.id}`}
              />
            ))}
            <Text style={styles.hint}>Nouvelles missions dans {hoursToMidnight()}.</Text>
          </>
        )}

        {tab === "achievements" &&
          achievements.map((a) => (
            <GoalRow
              key={a.id}
              icon={a.icon}
              title={a.title}
              subtitle={a.text}
              value={a.value}
              target={a.target}
              reward={a.reward}
              done={a.done}
              claimed={a.claimed}
              onClaim={() => claim(onClaimAchievement, a.id)}
              testID={`achievement-${a.id}`}
            />
          ))}

        {tab === "stats" && <StatsGrid progress={progress} />}
      </ScrollView>
    </Panel>
  );
}

// Claimable first, then in progress, then already claimed.
const rank = (a: { done: boolean; claimed: boolean }) => (a.done && !a.claimed ? 0 : !a.done ? 1 : 2);

function TabButton({ label, active, count, onPress, testID }: { label: string; active: boolean; count?: number; onPress: () => void; testID?: string }) {
  return (
    <Pressable onPress={onPress} style={[styles.tab, active && styles.tabActive]} testID={testID}>
      <Text style={[styles.tabText, active && { color: colors.onBrand }]}>{label}</Text>
      {!!count && (
        <View style={styles.tabBadge}>
          <Text style={styles.tabBadgeText}>{count}</Text>
        </View>
      )}
    </Pressable>
  );
}

function GoalRow(p: {
  icon: string;
  title: string;
  subtitle?: string;
  value: number;
  target: number;
  reward: number;
  done: boolean;
  claimed: boolean;
  onClaim: () => void;
  testID?: string;
}) {
  const pct = Math.min(1, p.value / p.target);
  return (
    <View style={[styles.row, p.claimed && { opacity: 0.55 }]} testID={p.testID}>
      <MaterialCommunityIcons name={p.icon as any} size={24} color={p.done ? colors.brand : colors.brandSecondary} />
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={styles.rowTitle}>{p.title}</Text>
        {p.subtitle && <Text style={styles.rowSub}>{p.subtitle}</Text>}
        <View style={styles.bar}>
          <View style={[styles.barFill, { width: `${pct * 100}%`, backgroundColor: p.done ? colors.brand : colors.brandSecondary }]} />
        </View>
        <Text style={styles.rowSub}>
          {p.value.toLocaleString()} / {p.target.toLocaleString()}
        </Text>
      </View>
      {p.claimed ? (
        <MaterialCommunityIcons name="check-circle" size={26} color={colors.brand} />
      ) : (
        <Pressable disabled={!p.done} onPress={p.onClaim} style={[styles.claim, !p.done && styles.claimOff]} testID={p.testID ? `${p.testID}-claim` : undefined}>
          <MaterialCommunityIcons name="circle-multiple" size={15} color={p.done ? colors.onWarning : colors.onSurfaceTertiary} />
          <Text style={[styles.claimText, !p.done && { color: colors.onSurfaceTertiary }]}>{p.reward}</Text>
        </Pressable>
      )}
    </View>
  );
}

function StatsGrid({ progress }: { progress: Progress }) {
  const s = progress.stats;
  const stars = Object.values(progress.stars).reduce((a, b) => a + b, 0);
  const hsRate = s.kills ? Math.round((s.headshots / s.kills) * 100) : 0;
  const tiles: [string, string, string][] = [
    ["skull", "Zombies éliminés", s.kills.toLocaleString()],
    ["target", "Tirs à la tête", `${s.headshots.toLocaleString()} (${hsRate} %)`],
    ["crown", "Boss vaincus", String(s.bosses)],
    ["flag-checkered", "Niveaux terminés", String(s.levels)],
    ["star", "Étoiles", `${stars} / 90`],
    ["lightning-bolt", "Meilleur combo", `×${s.bestCombo}`],
    ["bomb", "Victimes d'explosions", String(s.explosionKills)],
    ["flash", "Bonus ramassés", String(s.powerups)],
    ["run-fast", "Coureurs", String(s.byKind.runner)],
    ["shield", "Blindés", String(s.byKind.tank)],
    ["grave-stone", "Morts", String(s.deaths)],
    ["map-marker", "Niveau atteint", `${progress.unlockedLevel} / 30`],
  ];
  return (
    <View style={styles.grid} testID="stats-grid">
      {tiles.map(([icon, label, value]) => (
        <View key={label} style={styles.tile}>
          <MaterialCommunityIcons name={icon as any} size={18} color={colors.brandSecondary} />
          <Text style={styles.tileValue}>{value}</Text>
          <Text style={styles.tileLabel}>{label}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  tabs: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.sm, flexWrap: "wrap" },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 34,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSecondary,
  },
  tabActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  tabText: { color: colors.onSurfaceSecondary, fontFamily: fonts.display, fontSize: 14, letterSpacing: 1 },
  tabBadge: { minWidth: 18, height: 18, borderRadius: 9, backgroundColor: colors.error, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 },
  tabBadgeText: { color: "#fff", fontFamily: fonts.display, fontSize: 11 },
  body: { maxHeight: 250 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  rowTitle: { color: colors.onSurface, fontFamily: fonts.display, fontSize: 16, letterSpacing: 0.5 },
  rowSub: { color: colors.onSurfaceSecondary, fontFamily: fonts.text, fontSize: 12 },
  bar: { height: 6, borderRadius: 3, backgroundColor: colors.surfaceTertiary, overflow: "hidden", marginTop: 2 },
  barFill: { height: "100%", borderRadius: 3 },
  claim: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    height: 36,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    backgroundColor: colors.warning,
  },
  claimOff: { backgroundColor: colors.surfaceTertiary },
  claimText: { color: colors.onWarning, fontFamily: fonts.display, fontSize: 15, fontVariant: ["tabular-nums"] },
  hint: { color: colors.onSurfaceSecondary, fontFamily: fonts.text, fontSize: 12, textAlign: "center", marginTop: spacing.xs },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, justifyContent: "center" },
  tile: {
    width: 150,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    gap: 2,
  },
  tileValue: { color: colors.onSurface, fontFamily: fonts.display, fontSize: 20, fontVariant: ["tabular-nums"] },
  tileLabel: { color: colors.onSurfaceSecondary, fontFamily: fonts.text, fontSize: 12 },
});
