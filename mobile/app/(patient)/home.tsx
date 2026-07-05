import { View, Text, StyleSheet, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { useAuthStore } from "../../src/stores/auth";
import { Button, Card } from "../../src/components/ui";
import { colors, typography, spacing } from "../../src/theme";

export default function PatientHome() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.greeting}>
          Hello, {user?.name || "there"} 👋
        </Text>
        <Text style={styles.subGreeting}>
          How are you feeling today?
        </Text>
      </View>

      <Card style={styles.bookingCard}>
        <Text style={styles.cardTitle}>Book an Appointment</Text>
        <Text style={styles.cardDesc}>
          Find a clinic, choose your doctor, and book a slot instantly.
        </Text>
        <Button
          title="Book Now"
          onPress={() => router.push("/(patient)/clinics")}
          size="md"
          style={styles.bookButton}
        />
      </Card>

      <View style={styles.quickActions}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.actionGrid}>
          <Card
            onPress={() => router.push("/(patient)/bookings")}
            style={styles.actionCard}
          >
            <Text style={styles.actionIcon}>📋</Text>
            <Text style={styles.actionLabel}>My Bookings</Text>
          </Card>
          <Card
            onPress={() => router.push("/(patient)/profile")}
            style={styles.actionCard}
          >
            <Text style={styles.actionIcon}>👤</Text>
            <Text style={styles.actionLabel}>Profile</Text>
          </Card>
        </View>
      </View>

      <View style={styles.infoSection}>
        <Text style={styles.sectionTitle}>How it works</Text>
        {[
          { step: "1", text: "Select a clinic near you" },
          { step: "2", text: "Choose your doctor & time slot" },
          { step: "3", text: "Get your token number instantly" },
          { step: "4", text: "Track your queue position live" },
        ].map((item) => (
          <View key={item.step} style={styles.stepRow}>
            <View style={styles.stepBadge}>
              <Text style={styles.stepNum}>{item.step}</Text>
            </View>
            <Text style={styles.stepText}>{item.text}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral[50],
  },
  content: {
    padding: spacing.xl,
    paddingTop: spacing["5xl"],
  },
  header: {
    marginBottom: spacing["2xl"],
  },
  greeting: {
    ...typography.h2,
    color: colors.neutral[900],
  },
  subGreeting: {
    ...typography.body,
    color: colors.neutral[500],
    marginTop: spacing.xs,
  },
  bookingCard: {
    backgroundColor: colors.primary[600],
    padding: spacing.xl,
    marginBottom: spacing["2xl"],
  },
  cardTitle: {
    ...typography.h3,
    color: "#FFFFFF",
  },
  cardDesc: {
    ...typography.body,
    color: colors.primary[100],
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  bookButton: {
    backgroundColor: "#FFFFFF",
  },
  quickActions: {
    marginBottom: spacing["2xl"],
  },
  sectionTitle: {
    ...typography.subtitle,
    color: colors.neutral[800],
    marginBottom: spacing.md,
  },
  actionGrid: {
    flexDirection: "row",
    gap: spacing.md,
  },
  actionCard: {
    flex: 1,
    alignItems: "center",
    padding: spacing.lg,
  },
  actionIcon: {
    fontSize: 28,
    marginBottom: spacing.sm,
  },
  actionLabel: {
    ...typography.bodySmall,
    color: colors.neutral[700],
    fontWeight: "500",
  },
  infoSection: {
    marginBottom: spacing["3xl"],
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  stepBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary[50],
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
  },
  stepNum: {
    ...typography.bodySmall,
    color: colors.primary[700],
    fontWeight: "700",
  },
  stepText: {
    ...typography.body,
    color: colors.neutral[700],
  },
});
