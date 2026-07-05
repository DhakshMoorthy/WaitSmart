import { useState, useEffect } from "react";
import { View, Text, StyleSheet, ScrollView, Alert } from "react-native";
import { Card, Badge, LoadingScreen, Button } from "../../src/components/ui";
import { colors, typography, spacing } from "../../src/theme";
import { api } from "../../src/services/api";
import { useAuthStore } from "../../src/stores/auth";

interface Schedule {
  id: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  slotDurationMinutes: number;
}

interface Break {
  id: string;
  startDate: string;
  endDate: string;
  reason: string | null;
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function ScheduleScreen() {
  const user = useAuthStore((s) => s.user);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [breaks, setBreaks] = useState<Break[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const doctorId = user?.doctorId;
    if (!doctorId) {
      setLoading(false);
      Alert.alert("Error", "No doctor profile linked to this account.");
      return;
    }
    try {
      const [schedRes, breakRes] = await Promise.all([
        api.get(`/doctors/${doctorId}/schedules`),
        api.get(`/doctors/${doctorId}/breaks`),
      ]);
      setSchedules(schedRes.data.data || []);
      setBreaks(breakRes.data.data || []);
    } catch {
      Alert.alert("Error", "Failed to load schedule");
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <LoadingScreen message="Loading schedule..." />;

  const sortedSchedules = [...schedules].sort(
    (a, b) => a.dayOfWeek - b.dayOfWeek
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>My Schedule</Text>
        <Text style={styles.subtitle}>Manage your weekly availability</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Weekly Hours</Text>
        {sortedSchedules.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Text style={styles.emptyText}>
              No schedule configured. Contact your admin to set up your hours.
            </Text>
          </Card>
        ) : (
          sortedSchedules.map((sched) => (
            <Card key={sched.id} style={styles.scheduleCard}>
              <View style={styles.scheduleRow}>
                <Badge label={DAY_NAMES[sched.dayOfWeek]} variant="primary" />
                <Text style={styles.scheduleTime}>
                  {sched.startTime} – {sched.endTime}
                </Text>
                <Text style={styles.slotDuration}>
                  {sched.slotDurationMinutes}min slots
                </Text>
              </View>
            </Card>
          ))
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Upcoming Breaks</Text>
        {breaks.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Text style={styles.emptyText}>No breaks scheduled.</Text>
          </Card>
        ) : (
          breaks.map((brk) => (
            <Card key={brk.id} style={styles.breakCard}>
              <View style={styles.breakRow}>
                <View>
                  <Text style={styles.breakDates}>
                    {brk.startDate} → {brk.endDate}
                  </Text>
                  {brk.reason && (
                    <Text style={styles.breakReason}>{brk.reason}</Text>
                  )}
                </View>
                <Badge label="Break" variant="warning" />
              </View>
            </Card>
          ))
        )}
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
    paddingBottom: spacing["4xl"],
  },
  header: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing["5xl"],
    paddingBottom: spacing.lg,
    backgroundColor: colors.neutral[0],
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[100],
  },
  title: {
    ...typography.h2,
    color: colors.neutral[900],
  },
  subtitle: {
    ...typography.bodySmall,
    color: colors.neutral[500],
    marginTop: spacing.xs,
  },
  section: {
    padding: spacing.xl,
  },
  sectionTitle: {
    ...typography.subtitle,
    color: colors.neutral[800],
    marginBottom: spacing.md,
  },
  scheduleCard: {
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  scheduleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  scheduleTime: {
    ...typography.body,
    color: colors.neutral[800],
    flex: 1,
  },
  slotDuration: {
    ...typography.caption,
    color: colors.neutral[500],
  },
  breakCard: {
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  breakRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  breakDates: {
    ...typography.body,
    color: colors.neutral[800],
  },
  breakReason: {
    ...typography.caption,
    color: colors.neutral[500],
    marginTop: 2,
  },
  emptyCard: {
    padding: spacing.lg,
    alignItems: "center",
  },
  emptyText: {
    ...typography.body,
    color: colors.neutral[500],
    textAlign: "center",
  },
});
