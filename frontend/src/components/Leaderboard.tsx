import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, FlatList, ActivityIndicator } from "react-native";
import { BlurView } from "expo-blur";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { colors, fonts, spacing, radius } from "../theme";
import { fetchLeaderboard, type LeaderboardRow } from "../api/leaderboard";

type Props = { username: string; onClose: () => void };

export default function Leaderboard({ username, onClose }: Props) {
  const [state, setState] = useState<"loading" | "done" | "error">("loading");
  const [rows, setRows] = useState<LeaderboardRow[]>([]);

  const load = async () => {
    setState("loading");
    try {
      const data = await fetchLeaderboard(50);
      setRows(data);
      setState("done");
    } catch {
      setState("error");
    }
  };

  useEffect(() => {
    load();
  }, []);

  const medal = (rank: number) =>
    rank === 1 ? "#FFD700" : rank === 2 ? "#C0C0C0" : rank === 3 ? "#CD7F32" : colors.onSurfaceTertiary;

  return (
    <BlurView intensity={50} tint="dark" style={styles.overlay} testID="leaderboard-modal">
      <View style={styles.modal}>
        <View style={styles.header}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <MaterialCommunityIcons name="trophy" size={22} color={colors.brand} />
            <Text style={styles.title}>TOP SURVIVORS</Text>
          </View>
          <Pressable testID="leaderboard-close" onPress={onClose} style={styles.closeBtn} hitSlop={10}>
            <MaterialCommunityIcons name="close" size={22} color={colors.onSurface} />
          </Pressable>
        </View>

        {state === "loading" && (
          <View style={styles.centerBox}>
            <ActivityIndicator color={colors.brand} size="large" />
          </View>
        )}
        {state === "error" && (
          <View style={styles.centerBox}>
            <Text style={styles.dim}>Impossible de charger le classement.</Text>
            <Pressable onPress={load} style={styles.retry} testID="leaderboard-retry">
              <Text style={styles.retryText}>RÉESSAYER</Text>
            </Pressable>
          </View>
        )}
        {state === "done" && rows.length === 0 && (
          <View style={styles.centerBox}>
            <Text style={styles.dim}>Aucun survivant. Soyez le premier.</Text>
          </View>
        )}
        {state === "done" && rows.length > 0 && (
          <FlatList
            data={rows}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: spacing.md }}
            renderItem={({ item }) => {
              const isMe = item.name === username;
              return (
                <View style={[styles.row, isMe && styles.meRow]}>
                  <Text style={[styles.rank, { color: medal(item.rank) }]}>#{item.rank}</Text>
                  <Text style={[styles.name, isMe && { color: colors.brand }]} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={styles.wave}>W{item.wave}</Text>
                  <Text style={[styles.score, isMe && { color: colors.brand }]}>
                    {item.score.toLocaleString()}
                  </Text>
                </View>
              );
            }}
          />
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
  name: { flex: 1, color: colors.onSurface, fontFamily: fonts.textMed, fontSize: 15 },
  wave: { width: 46, color: colors.onSurfaceSecondary, fontFamily: fonts.displayMed, fontSize: 13, textAlign: "center" },
  score: { width: 84, color: colors.onSurface, fontFamily: fonts.display, fontSize: 17, textAlign: "right" },
});
