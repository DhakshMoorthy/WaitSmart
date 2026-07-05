import { useState, useEffect } from "react";
import { View, Text, StyleSheet, FlatList, Alert } from "react-native";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";

dayjs.extend(utc);
import { Button, Card, Badge, LoadingScreen } from "../../src/components/ui";
import { colors, typography, spacing } from "../../src/theme";
import { api } from "../../src/services/api";
import { useAuthStore } from "../../src/stores/auth";
import { useQueueStore } from "../../src/stores/queue";
import {
  connectSocket,
  subscribeToQueue,
  getSocket,
  SOCKET_EVENTS,
} from "../../src/services/socket";

interface QueuePatient {
  id: string;
  tokenNumber: number;
  patientName: string;
  symptoms: string | null;
  status: string;
  slotTime: string;
}

export default function DoctorQueueScreen() {
  const user = useAuthStore((s) => s.user);
  const doctorId = user?.doctorId;
  const queueStore = useQueueStore();
  const [patients, setPatients] = useState<QueuePatient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const today = dayjs().format("YYYY-MM-DD");

  useEffect(() => {
    if (!doctorId) {
      setLoading(false);
      setError("No doctor profile linked to this account.");
      return;
    }

    fetchQueue();
    connectSocket();
    subscribeToQueue(doctorId);

    const socket = getSocket();
    const onUpdate = () => {
      fetchQueue();
    };
    socket.on(SOCKET_EVENTS.QUEUE_UPDATE, onUpdate);
    socket.on(SOCKET_EVENTS.BOOKING_CREATED, onUpdate);

    return () => {
      socket.off(SOCKET_EVENTS.QUEUE_UPDATE, onUpdate);
      socket.off(SOCKET_EVENTS.BOOKING_CREATED, onUpdate);
    };
  }, [doctorId]);

  const fetchQueue = async () => {
    if (!doctorId) return;
    try {
      const { data } = await api.get("/avail", {
        params: { doctorId, date: today },
      });
      const slots = data.data?.slots || [];
      const booked = slots
        .filter((s: any) => s.status === "booked" && s.appointment)
        .map((s: any) => ({
          id: s.appointment.id,
          tokenNumber: s.appointment.tokenNumber,
          patientName: s.appointment.patientName,
          symptoms: s.appointment.symptoms,
          status: s.appointment.status,
          slotTime: s.slotTime,
        }))
        .sort((a: QueuePatient, b: QueuePatient) => a.tokenNumber - b.tokenNumber);
      setPatients(booked);
      setError("");
    } catch (err: any) {
      setPatients([]);
      setError(err.response?.data?.message || "Failed to load queue");
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (action: "next" | "skip" | "no-show" | "done") => {
    if (!doctorId) return;
    setActionLoading(action);
    try {
      await api.post(`/admin/${action}`, {
        doctorId,
        date: today,
      });
      await fetchQueue();
    } catch (err: any) {
      Alert.alert("Error", err.response?.data?.message || `Failed to ${action}`);
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) return <LoadingScreen message="Loading queue..." />;

  if (error && patients.length === 0) {
    return (
      <View style={[styles.container, styles.emptyQueue]}>
        <Text style={styles.emptyText}>{error}</Text>
      </View>
    );
  }

  const waiting = patients.filter((p) => p.status === "waiting");
  const current = patients.find((p) => p.status === "in-cabin");

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Today's Queue</Text>
        <Text style={styles.subtitle}>
          {dayjs().format("dddd, MMM D, YYYY")}
        </Text>
      </View>

      {current && (
        <Card style={styles.currentCard}>
          <Text style={styles.currentLabel}>NOW SEEING</Text>
          <View style={styles.currentRow}>
            <Text style={styles.currentToken}>#{current.tokenNumber}</Text>
            <View style={styles.currentInfo}>
              <Text style={styles.currentName}>{current.patientName}</Text>
              {current.symptoms && (
                <Text style={styles.currentSymptoms}>{current.symptoms}</Text>
              )}
            </View>
          </View>
          <View style={styles.actionRow}>
            <Button
              title="Done"
              onPress={() => handleAction("done")}
              loading={actionLoading === "done"}
              variant="primary"
              size="sm"
              style={styles.actionBtn}
            />
            <Button
              title="Skip"
              onPress={() => handleAction("skip")}
              loading={actionLoading === "skip"}
              variant="outline"
              size="sm"
              style={styles.actionBtn}
            />
            <Button
              title="No Show"
              onPress={() => handleAction("no-show")}
              loading={actionLoading === "no-show"}
              variant="ghost"
              size="sm"
              style={styles.actionBtn}
            />
          </View>
        </Card>
      )}

      {!current && waiting.length > 0 && (
        <View style={styles.nextSection}>
          <Button
            title="Call Next Patient"
            onPress={() => handleAction("next")}
            loading={actionLoading === "next"}
            size="lg"
            style={styles.nextButton}
          />
        </View>
      )}

      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={styles.statNum}>{waiting.length}</Text>
          <Text style={styles.statLabel}>Waiting</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statNum}>
            {patients.filter((p) => p.status === "done").length}
          </Text>
          <Text style={styles.statLabel}>Completed</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statNum}>{patients.length}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
      </View>

      <FlatList
        data={waiting}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          waiting.length > 0 ? (
            <Text style={styles.listTitle}>Waiting ({waiting.length})</Text>
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.emptyQueue}>
            <Text style={styles.emptyText}>No patients waiting</Text>
          </View>
        }
        renderItem={({ item }) => (
          <Card style={styles.patientCard}>
            <View style={styles.patientRow}>
              <View style={styles.tokenBadge}>
                <Text style={styles.tokenText}>#{item.tokenNumber}</Text>
              </View>
              <View style={styles.patientInfo}>
                <Text style={styles.patientName}>{item.patientName}</Text>
                <Text style={styles.patientTime}>
                  {dayjs.utc(item.slotTime).format("h:mm A")}
                  {item.symptoms ? ` • ${item.symptoms}` : ""}
                </Text>
              </View>
              <Badge label="Waiting" variant="primary" />
            </View>
          </Card>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral[50],
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
  currentCard: {
    margin: spacing.xl,
    padding: spacing.lg,
    backgroundColor: colors.success[50],
    borderColor: colors.success[100],
  },
  currentLabel: {
    ...typography.caption,
    color: colors.success[700],
    fontWeight: "700",
    letterSpacing: 1,
    marginBottom: spacing.sm,
  },
  currentRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  currentToken: {
    fontSize: 32,
    fontWeight: "800",
    color: colors.success[700],
    marginRight: spacing.lg,
  },
  currentInfo: {
    flex: 1,
  },
  currentName: {
    ...typography.subtitle,
    color: colors.neutral[900],
  },
  currentSymptoms: {
    ...typography.bodySmall,
    color: colors.neutral[600],
    marginTop: 2,
  },
  actionRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  actionBtn: {
    flex: 1,
  },
  nextSection: {
    padding: spacing.xl,
  },
  nextButton: {
    backgroundColor: colors.success[600],
  },
  statsRow: {
    flexDirection: "row",
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.lg,
    gap: spacing.md,
  },
  stat: {
    flex: 1,
    backgroundColor: colors.neutral[0],
    borderRadius: 10,
    padding: spacing.md,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.neutral[100],
  },
  statNum: {
    ...typography.h3,
    color: colors.primary[600],
  },
  statLabel: {
    ...typography.caption,
    color: colors.neutral[500],
    marginTop: 2,
  },
  list: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing["3xl"],
  },
  listTitle: {
    ...typography.subtitle,
    color: colors.neutral[700],
    marginBottom: spacing.md,
  },
  emptyQueue: {
    alignItems: "center",
    padding: spacing["3xl"],
  },
  emptyText: {
    ...typography.body,
    color: colors.neutral[400],
  },
  patientCard: {
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  patientRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  tokenBadge: {
    backgroundColor: colors.primary[50],
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 6,
    marginRight: spacing.md,
  },
  tokenText: {
    ...typography.subtitle,
    color: colors.primary[700],
    fontSize: 14,
  },
  patientInfo: {
    flex: 1,
  },
  patientName: {
    ...typography.body,
    color: colors.neutral[900],
    fontWeight: "500",
  },
  patientTime: {
    ...typography.caption,
    color: colors.neutral[500],
    marginTop: 2,
  },
});
