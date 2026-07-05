import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors, typography, spacing } from "../../theme";
import { Button } from "./Button";

interface EmptyStateProps {
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: React.ReactNode;
}

export function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
  icon,
}: EmptyStateProps) {
  return (
    <View style={styles.container}>
      {icon && <View style={styles.iconContainer}>{icon}</View>}
      <Text style={styles.title}>{title}</Text>
      {description && <Text style={styles.description}>{description}</Text>}
      {actionLabel && onAction && (
        <Button
          title={actionLabel}
          onPress={onAction}
          variant="secondary"
          size="sm"
          style={styles.button}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing["3xl"],
  },
  iconContainer: {
    marginBottom: spacing.lg,
  },
  title: {
    ...typography.subtitle,
    color: colors.neutral[800],
    textAlign: "center",
  },
  description: {
    ...typography.body,
    color: colors.neutral[500],
    textAlign: "center",
    marginTop: spacing.sm,
  },
  button: {
    marginTop: spacing.xl,
  },
});
