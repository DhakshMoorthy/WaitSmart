import { View, Text, StyleSheet, ScrollView, Alert } from "react-native";
import { useRouter } from "expo-router";
import { useAuthStore } from "../../src/stores/auth";
import { Button, Card } from "../../src/components/ui";
import { colors, typography, spacing, radius } from "../../src/theme";
import { disconnectSocket } from "../../src/services/socket";

export default function ProfileScreen() {
  const router = useRouter();
  const { user, logout } = useAuthStore();

  const handleLogout = () => {
    Alert.alert("Logout", "Are you sure you want to logout?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Logout",
        style: "destructive",
        onPress: async () => {
          disconnectSocket();
          await logout();
          router.replace("/(auth)/login");
        },
      },
    ]);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>Profile</Text>
      </View>

      <View style={styles.avatarSection}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {user?.name?.charAt(0)?.toUpperCase() || "?"}
          </Text>
        </View>
        <Text style={styles.userName}>{user?.name || "Patient"}</Text>
        <Text style={styles.userRole}>{user?.role || "patient"}</Text>
      </View>

      <Card style={styles.infoCard}>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Email</Text>
          <Text style={styles.infoValue}>{user?.email || "Not set"}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Phone</Text>
          <Text style={styles.infoValue}>{user?.phone || "Not set"}</Text>
        </View>
        <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
          <Text style={styles.infoLabel}>Role</Text>
          <Text style={styles.infoValue}>{user?.role || "patient"}</Text>
        </View>
      </Card>

      <View style={styles.actions}>
        <Button
          title="Logout"
          onPress={handleLogout}
          variant="danger"
          size="lg"
        />
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
  avatarSection: {
    alignItems: "center",
    paddingVertical: spacing["3xl"],
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primary[100],
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  avatarText: {
    fontSize: 32,
    fontWeight: "700",
    color: colors.primary[700],
  },
  userName: {
    ...typography.h3,
    color: colors.neutral[900],
  },
  userRole: {
    ...typography.bodySmall,
    color: colors.neutral[500],
    textTransform: "capitalize",
    marginTop: spacing.xs,
  },
  infoCard: {
    marginHorizontal: spacing.xl,
    padding: spacing.lg,
    marginBottom: spacing["2xl"],
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[50],
  },
  infoLabel: {
    ...typography.body,
    color: colors.neutral[500],
  },
  infoValue: {
    ...typography.body,
    color: colors.neutral[900],
    fontWeight: "500",
  },
  actions: {
    paddingHorizontal: spacing.xl,
  },
});
