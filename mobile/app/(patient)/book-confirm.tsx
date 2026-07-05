import { useState } from "react";
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
import { Button, Input, Card } from "../../src/components/ui";
import { colors, typography, spacing } from "../../src/theme";
import { api } from "../../src/services/api";
import { useAuthStore } from "../../src/stores/auth";

export default function BookConfirmScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const { doctorId, doctorName, clinicId, slotId, slotTime, date } =
    useLocalSearchParams<{
      doctorId: string;
      doctorName: string;
      clinicId: string;
      slotId: string;
      slotTime: string;
      date: string;
    }>();

  const [patientName, setPatientName] = useState(user?.name || "");
  const [patientPhone, setPatientPhone] = useState(user?.phone || "");
  const [symptoms, setSymptoms] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleBook = async () => {
    if (!patientName.trim()) {
      setError("Patient name is required");
      return;
    }

    setError("");
    setLoading(true);

    try {
      const { data } = await api.post("/book", {
        clinicId,
        doctorId,
        slotId,
        patientName: patientName.trim(),
        patientPhone: patientPhone.trim(),
        symptoms: symptoms.trim() || undefined,
      });

      router.replace({
        pathname: "/(patient)/ticket",
        params: {
          appointmentId: data.data.id,
          tokenNumber: String(data.data.tokenNumber),
          doctorName: doctorName!,
          slotTime: slotTime!,
          date: date!,
          status: data.data.status,
          doctorId: doctorId!,
        },
      });
    } catch (err: any) {
      setError(err.response?.data?.message || "Booking failed. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Confirm Booking</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Card style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Appointment Details</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Doctor</Text>
            <Text style={styles.summaryValue}>{doctorName}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Date</Text>
            <Text style={styles.summaryValue}>
              {dayjs(date).format("ddd, MMM D, YYYY")}
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Time</Text>
            <Text style={styles.summaryValue}>
              {dayjs.utc(slotTime).format("h:mm A")}
            </Text>
          </View>
        </Card>

        <View style={styles.form}>
          <Input
            label="Patient Name"
            placeholder="Full name"
            value={patientName}
            onChangeText={setPatientName}
          />
          <Input
            label="Phone Number"
            placeholder="+91 9876543210"
            keyboardType="phone-pad"
            value={patientPhone}
            onChangeText={setPatientPhone}
          />
          <Input
            label="Symptoms (optional)"
            placeholder="Describe your symptoms briefly..."
            multiline
            numberOfLines={3}
            value={symptoms}
            onChangeText={setSymptoms}
            containerStyle={styles.symptomsInput}
          />
        </View>

        {error && <Text style={styles.error}>{error}</Text>}

        <Button
          title="Confirm & Book"
          onPress={handleBook}
          loading={loading}
          size="lg"
        />
      </ScrollView>
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
  content: {
    padding: spacing.xl,
  },
  summaryCard: {
    marginBottom: spacing["2xl"],
    padding: spacing.lg,
  },
  summaryTitle: {
    ...typography.subtitle,
    color: colors.neutral[800],
    marginBottom: spacing.md,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
  },
  summaryLabel: {
    ...typography.bodySmall,
    color: colors.neutral[500],
  },
  summaryValue: {
    ...typography.bodySmall,
    color: colors.neutral[900],
    fontWeight: "500",
  },
  form: {
    marginBottom: spacing.lg,
  },
  symptomsInput: {
    marginBottom: spacing.sm,
  },
  error: {
    ...typography.bodySmall,
    color: colors.danger[600],
    textAlign: "center",
    marginBottom: spacing.lg,
  },
});
