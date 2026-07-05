import { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";

dayjs.extend(utc);
import { Button, LoadingScreen, Card } from "../../src/components/ui";
import { colors, typography, spacing, radius } from "../../src/theme";
import { api } from "../../src/services/api";

interface Slot {
  id: string;
  slotIndex: number;
  slotTime: string;
  status: "available" | "booked" | "cancelled";
}

export default function SlotsScreen() {
  const router = useRouter();
  const { doctorId, doctorName, clinicId } = useLocalSearchParams<{
    doctorId: string;
    doctorName: string;
    clinicId: string;
  }>();

  const [selectedDate, setSelectedDate] = useState(dayjs().format("YYYY-MM-DD"));
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [loading, setLoading] = useState(true);

  const dates = Array.from({ length: 7 }, (_, i) => dayjs().add(i, "day"));

  useEffect(() => {
    fetchSlots();
  }, [selectedDate]);

  const fetchSlots = async () => {
    setLoading(true);
    setSelectedSlot(null);
    try {
      const { data } = await api.get("/avail", {
        params: { doctorId, date: selectedDate },
      });
      setSlots(data.data.slots || []);
    } catch {
      setSlots([]);
    } finally {
      setLoading(false);
    }
  };

  const availableSlots = slots.filter((s) => s.status === "available");

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Pick a Slot</Text>
        <Text style={styles.subtitle}>{doctorName}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.dateScroll}
          contentContainerStyle={styles.dateRow}
        >
          {dates.map((date) => {
            const dateStr = date.format("YYYY-MM-DD");
            const isActive = dateStr === selectedDate;
            return (
              <TouchableOpacity
                key={dateStr}
                onPress={() => setSelectedDate(dateStr)}
                style={[styles.dateChip, isActive && styles.dateChipActive]}
              >
                <Text
                  style={[styles.dateDay, isActive && styles.dateDayActive]}
                >
                  {date.format("ddd")}
                </Text>
                <Text
                  style={[styles.dateNum, isActive && styles.dateNumActive]}
                >
                  {date.format("DD")}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {loading ? (
          <LoadingScreen message="Checking availability..." />
        ) : availableSlots.length === 0 ? (
          <View style={styles.emptySlots}>
            <Text style={styles.emptyText}>No available slots for this date</Text>
            <Text style={styles.emptyHint}>Try another date</Text>
          </View>
        ) : (
          <View style={styles.slotsGrid}>
            {availableSlots.map((slot) => {
              const isSelected = selectedSlot?.id === slot.id;
              return (
                <TouchableOpacity
                  key={slot.id}
                  onPress={() => setSelectedSlot(slot)}
                  style={[styles.slotChip, isSelected && styles.slotChipActive]}
                >
                  <Text
                    style={[
                      styles.slotTime,
                      isSelected && styles.slotTimeActive,
                    ]}
                  >
                    {dayjs.utc(slot.slotTime).format("h:mm A")}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>

      {selectedSlot && (
        <View style={styles.footer}>
          <Card style={styles.selectedCard}>
            <Text style={styles.selectedLabel}>Selected</Text>
            <Text style={styles.selectedTime}>
              {dayjs(selectedDate).format("ddd, MMM D")} at{" "}
              {dayjs.utc(selectedSlot.slotTime).format("h:mm A")}
            </Text>
          </Card>
          <Button
            title="Continue to Book"
            onPress={() =>
              router.push({
                pathname: "/(patient)/book-confirm",
                params: {
                  doctorId: doctorId!,
                  doctorName: doctorName!,
                  clinicId: clinicId!,
                  slotId: selectedSlot.id,
                  slotTime: selectedSlot.slotTime,
                  date: selectedDate,
                },
              })
            }
            size="lg"
          />
        </View>
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
  back: {
    ...typography.body,
    color: colors.primary[600],
    marginBottom: spacing.sm,
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
  scrollContent: {
    paddingBottom: 200,
  },
  dateScroll: {
    marginTop: spacing.lg,
  },
  dateRow: {
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
  },
  dateChip: {
    alignItems: "center",
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.neutral[0],
    borderWidth: 1,
    borderColor: colors.neutral[200],
    minWidth: 56,
  },
  dateChipActive: {
    backgroundColor: colors.primary[600],
    borderColor: colors.primary[600],
  },
  dateDay: {
    ...typography.caption,
    color: colors.neutral[500],
    marginBottom: 2,
  },
  dateDayActive: {
    color: colors.primary[100],
  },
  dateNum: {
    ...typography.subtitle,
    color: colors.neutral[800],
  },
  dateNumActive: {
    color: "#FFFFFF",
  },
  emptySlots: {
    alignItems: "center",
    padding: spacing["4xl"],
  },
  emptyText: {
    ...typography.subtitle,
    color: colors.neutral[600],
  },
  emptyHint: {
    ...typography.bodySmall,
    color: colors.neutral[400],
    marginTop: spacing.xs,
  },
  slotsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    padding: spacing.xl,
    gap: spacing.sm,
  },
  slotChip: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.neutral[0],
    borderWidth: 1.5,
    borderColor: colors.neutral[200],
  },
  slotChipActive: {
    backgroundColor: colors.primary[50],
    borderColor: colors.primary[500],
  },
  slotTime: {
    ...typography.bodySmall,
    fontWeight: "500",
    color: colors.neutral[700],
  },
  slotTimeActive: {
    color: colors.primary[700],
  },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: spacing.xl,
    backgroundColor: colors.neutral[0],
    borderTopWidth: 1,
    borderTopColor: colors.neutral[100],
  },
  selectedCard: {
    marginBottom: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.primary[50],
    borderColor: colors.primary[100],
  },
  selectedLabel: {
    ...typography.caption,
    color: colors.primary[600],
    fontWeight: "600",
  },
  selectedTime: {
    ...typography.subtitle,
    color: colors.primary[800],
    marginTop: 2,
  },
});
