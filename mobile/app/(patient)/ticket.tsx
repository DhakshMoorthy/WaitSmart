import { useEffect } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";

dayjs.extend(utc);
import { Button, Card, Badge } from "../../src/components/ui";
import { colors, typography, spacing, radius } from "../../src/theme";
import { useQueueStore } from "../../src/stores/queue";
import {
  connectSocket,
  subscribeToQueue,
  getSocket,
  SOCKET_EVENTS,
} from "../../src/services/socket";

export default function TicketScreen() {
  const router = useRouter();
  const { appointmentId, tokenNumber, doctorName, slotTime, date, status, doctorId } =
    useLocalSearchParams<{
      appointmentId: string;
      tokenNumber: string;
      doctorName: string;
      slotTime: string;
      date: string;
      status: string;
      doctorId: string;
    }>();

  const queueState = useQueueStore();

  useEffect(() => {
    connectSocket();
    subscribeToQueue(doctorId!);

    const socket = getSocket();
    socket.on(SOCKET_EVENTS.QUEUE_UPDATE, (data) => {
      if (data.doctorId === doctorId) {
        queueState.setQueueData(data);
      }
    });

    return () => {
      socket.off(SOCKET_EVENTS.QUEUE_UPDATE);
    };
  }, [doctorId]);

  const nowServing = queueState.nowServing;
  const myToken = Number(tokenNumber);
  const position = nowServing ? myToken - nowServing : null;
  const isMyTurn = position !== null && position <= 0;

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.successIcon}>✅</Text>
        <Text style={styles.title}>Booking Confirmed!</Text>

        <Card style={styles.tokenCard}>
          <Text style={styles.tokenLabel}>Your Token</Text>
          <Text style={styles.tokenNumber}>{tokenNumber}</Text>
          <Badge
            label={isMyTurn ? "Your turn!" : status || "Waiting"}
            variant={isMyTurn ? "success" : "primary"}
          />
        </Card>

        <Card style={styles.detailsCard}>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Doctor</Text>
            <Text style={styles.detailValue}>{doctorName}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Date</Text>
            <Text style={styles.detailValue}>
              {dayjs(date).format("ddd, MMM D")}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Time</Text>
            <Text style={styles.detailValue}>
              {dayjs.utc(slotTime).format("h:mm A")}
            </Text>
          </View>
          {nowServing && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Now Serving</Text>
              <Text style={styles.detailValue}>#{nowServing}</Text>
            </View>
          )}
          {position !== null && position > 0 && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Your Position</Text>
              <Text style={[styles.detailValue, styles.positionValue]}>
                {position} ahead of you
              </Text>
            </View>
          )}
        </Card>

        {isMyTurn && (
          <Card style={styles.alertCard}>
            <Text style={styles.alertText}>
              🎉 It's your turn! Please proceed to the doctor's cabin.
            </Text>
          </Card>
        )}
      </View>

      <View style={styles.footer}>
        <Button
          title="Back to Home"
          onPress={() => router.replace("/(patient)/home")}
          variant="outline"
          size="lg"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral[50],
  },
  content: {
    flex: 1,
    padding: spacing.xl,
    paddingTop: spacing["5xl"],
    alignItems: "center",
  },
  successIcon: {
    fontSize: 48,
    marginBottom: spacing.lg,
  },
  title: {
    ...typography.h2,
    color: colors.neutral[900],
    marginBottom: spacing["2xl"],
  },
  tokenCard: {
    alignItems: "center",
    padding: spacing["2xl"],
    marginBottom: spacing.xl,
    width: "100%",
  },
  tokenLabel: {
    ...typography.caption,
    color: colors.neutral[500],
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  tokenNumber: {
    fontSize: 64,
    fontWeight: "800",
    color: colors.primary[600],
    marginVertical: spacing.sm,
  },
  detailsCard: {
    width: "100%",
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[50],
  },
  detailLabel: {
    ...typography.bodySmall,
    color: colors.neutral[500],
  },
  detailValue: {
    ...typography.bodySmall,
    color: colors.neutral[900],
    fontWeight: "500",
  },
  positionValue: {
    color: colors.warning[600],
  },
  alertCard: {
    width: "100%",
    backgroundColor: colors.success[50],
    borderColor: colors.success[100],
    padding: spacing.lg,
  },
  alertText: {
    ...typography.body,
    color: colors.success[700],
    textAlign: "center",
    fontWeight: "500",
  },
  footer: {
    padding: spacing.xl,
  },
});
