import { useState, useEffect } from "react";
import { View, Text, StyleSheet, FlatList } from "react-native";
import { useRouter } from "expo-router";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";

dayjs.extend(utc);
import { Card, Badge, LoadingScreen, EmptyState } from "../../src/components/ui";
import { colors, typography, spacing } from "../../src/theme";
import { api } from "../../src/services/api";

interface Booking {
  id: string;
  tokenNumber: number;
  status: string;
  doctorName: string;
  slotTime: string;
  date: string;
  doctorId: string;
}

export default function BookingsScreen() {
  const router = useRouter();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBookings();
  }, []);

  const fetchBookings = async () => {
    try {
      const { data } = await api.get("/patients/history");
      setBookings(data.data || []);
    } catch {
      setBookings([]);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <LoadingScreen message="Loading bookings..." />;

  const statusVariant = (status: string) => {
    switch (status) {
      case "waiting": return "primary";
      case "in-cabin": return "success";
      case "done": return "neutral";
      case "cancelled":
      case "no-show": return "danger";
      default: return "neutral";
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>My Bookings</Text>
      </View>

      {bookings.length === 0 ? (
        <EmptyState
          title="No bookings yet"
          description="Your appointment history will appear here."
          actionLabel="Book Now"
          onAction={() => router.push("/(patient)/clinics")}
        />
      ) : (
        <FlatList
          data={bookings}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <Card
              onPress={() => {
                if (item.status === "waiting") {
                  router.push({
                    pathname: "/(patient)/ticket",
                    params: {
                      appointmentId: item.id,
                      tokenNumber: String(item.tokenNumber),
                      doctorName: item.doctorName,
                      slotTime: item.slotTime,
                      date: item.date,
                      status: item.status,
                      doctorId: item.doctorId,
                    },
                  });
                }
              }}
              style={styles.bookingCard}
            >
              <View style={styles.cardHeader}>
                <View style={styles.tokenBadge}>
                  <Text style={styles.tokenText}>#{item.tokenNumber}</Text>
                </View>
                <Badge label={item.status} variant={statusVariant(item.status)} />
              </View>
              <Text style={styles.doctorName}>{item.doctorName}</Text>
              <Text style={styles.dateText}>
                {item.date ? dayjs(item.date).format("MMM D, YYYY") : "—"}
                {item.slotTime
                  ? ` • ${dayjs.utc(item.slotTime).format("h:mm A")}`
                  : ""}
              </Text>
            </Card>
          )}
        />
      )}
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
  list: {
    padding: spacing.xl,
    gap: spacing.md,
  },
  bookingCard: {
    padding: spacing.lg,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  tokenBadge: {
    backgroundColor: colors.primary[50],
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 6,
  },
  tokenText: {
    ...typography.subtitle,
    color: colors.primary[700],
  },
  doctorName: {
    ...typography.subtitle,
    color: colors.neutral[900],
  },
  dateText: {
    ...typography.bodySmall,
    color: colors.neutral[500],
    marginTop: spacing.xs,
  },
});
