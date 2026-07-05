import { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
} from "react-native";
import { useRouter } from "expo-router";
import { Card, LoadingScreen, EmptyState } from "../../src/components/ui";
import { colors, typography, spacing } from "../../src/theme";
import { api } from "../../src/services/api";

interface Clinic {
  id: string;
  name: string;
  address: string;
  hours: string | null;
}

export default function ClinicsScreen() {
  const router = useRouter();
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchClinics();
  }, []);

  const fetchClinics = async () => {
    try {
      const { data } = await api.get("/clinics");
      setClinics(data.data);
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to load clinics");
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <LoadingScreen message="Loading clinics..." />;

  if (error || clinics.length === 0) {
    return (
      <View style={styles.container}>
        <EmptyState
          title={error || "No clinics found"}
          description="No clinics are available for your area right now."
          actionLabel="Retry"
          onAction={fetchClinics}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Select Clinic</Text>
        <Text style={styles.subtitle}>
          {clinics.length} clinic{clinics.length > 1 ? "s" : ""} available
        </Text>
      </View>

      <FlatList
        data={clinics}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <Card
            onPress={() =>
              router.push({
                pathname: "/(patient)/doctors",
                params: { clinicId: item.id, clinicName: item.name },
              })
            }
            style={styles.clinicCard}
          >
            <Text style={styles.clinicName}>{item.name}</Text>
            <Text style={styles.clinicAddress}>{item.address}</Text>
            {!!item.hours && (
              <Text style={styles.clinicHours}>🕐 {item.hours}</Text>
            )}
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
  list: {
    padding: spacing.xl,
    gap: spacing.md,
  },
  clinicCard: {
    padding: spacing.lg,
  },
  clinicName: {
    ...typography.subtitle,
    color: colors.neutral[900],
  },
  clinicAddress: {
    ...typography.bodySmall,
    color: colors.neutral[500],
    marginTop: spacing.xs,
  },
  clinicHours: {
    ...typography.caption,
    color: colors.primary[600],
    marginTop: spacing.sm,
  },
});
