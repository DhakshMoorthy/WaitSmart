import React from "react";
import { View, ActivityIndicator, StyleSheet, Text } from "react-native";
import { colors, typography, spacing } from "../../theme";

interface LoadingScreenProps {
  message?: string;
}

export function LoadingScreen({ message }: LoadingScreenProps) {
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={colors.primary[600]} />
      {message && <Text style={styles.message}>{message}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.neutral[0],
  },
  message: {
    ...typography.body,
    color: colors.neutral[500],
    marginTop: spacing.lg,
  },
});
