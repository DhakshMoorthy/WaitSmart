import { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Card, Badge, LoadingScreen, EmptyState } from "../../src/components/ui";
import { colors, typography, spacing } from "../../src/theme";
import { api } from "../../src/services/api";

interface Doctor {
  id: string;
  name: string;
  specialization: string;
  qualification: string | null;
  queueStatus?: { nowServing: number | null; waiting: number };
}

export default function DoctorsScreen() {
  const router = useRouter();
  const { clinicId, clinicName } = useLocalSearchParams<{
    clinicId: string;
    clinicName: string;
  }>();
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDoctors();
  }, []);

  const fetchDoctors = async () => {
    try {
      const { data } = await api.get("/doctors", { params: { clinicId } });
      setDoctors(data.data);
    } catch {
      setDoctors([]);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <LoadingScreen message="Loading doctors..." />;

  if (doctors.length === 0) {
    return (
      <View style={styles.container}>
        <EmptyState
          title="No doctors available"
          description="No doctors are registered at this clinic yet."
          actionLabel="Go Back"
          onAction={() => router.back()}
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
        <Text style={styles.title}>Choose Doctor</Text>
        <Text style={styles.subtitle}>{clinicName}</Text>
      </View>

      <FlatList
        data={doctors}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <Card
            onPress={() =>
              router.push({
                pathname: "/(patient)/slots",
                params: {
                  doctorId: item.id,
                  doctorName: item.name,
                  clinicId: clinicId!,
                },
              })
            }
            style={styles.doctorCard}
          >
            <View style={styles.doctorRow}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {item.name.charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={styles.doctorInfo}>
                <Text style={styles.doctorName}>{item.name}</Text>
                <Text style={styles.specialization}>
                  {item.specialization}
                </Text>
                {item.qualification && (
                  <Text style={styles.qualification}>{item.qualification}</Text>
                )}
              </View>
            </View>
            {item.queueStatus && (
              <View style={styles.queueRow}>
                <Badge
                  label={`Serving #${item.queueStatus.nowServing || "-"}`}
                  variant="success"
                />
                <Badge
                  label={`${item.queueStatus.waiting} waiting`}
                  variant={item.queueStatus.waiting > 5 ? "warning" : "neutral"}
                />
              </View>
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
  doctorCard: {
    padding: spacing.lg,
  },
  doctorRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary[100],
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
  },
  avatarText: {
    ...typography.h3,
    color: colors.primary[700],
  },
  doctorInfo: {
    flex: 1,
  },
  doctorName: {
    ...typography.subtitle,
    color: colors.neutral[900],
  },
  specialization: {
    ...typography.bodySmall,
    color: colors.primary[600],
    marginTop: 2,
  },
  qualification: {
    ...typography.caption,
    color: colors.neutral[500],
    marginTop: 2,
  },
  queueRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.neutral[100],
  },
});
