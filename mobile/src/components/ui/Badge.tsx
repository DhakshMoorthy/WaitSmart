import React from "react";
import { View, Text, StyleSheet, ViewStyle } from "react-native";
import { colors, typography, spacing, radius } from "../../theme";

type BadgeVariant = "primary" | "success" | "warning" | "danger" | "neutral";

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  style?: ViewStyle;
}

export function Badge({ label, variant = "primary", style }: BadgeProps) {
  return (
    <View style={[styles.base, variantStyles[variant], style]}>
      <Text style={[styles.text, variantTextStyles[variant]]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    alignSelf: "flex-start",
  },
  text: {
    ...typography.caption,
    fontWeight: "600",
  },
});

const variantStyles: Record<BadgeVariant, ViewStyle> = {
  primary: { backgroundColor: colors.primary[50] },
  success: { backgroundColor: colors.success[50] },
  warning: { backgroundColor: colors.warning[50] },
  danger: { backgroundColor: colors.danger[50] },
  neutral: { backgroundColor: colors.neutral[100] },
};

const variantTextStyles: Record<BadgeVariant, { color: string }> = {
  primary: { color: colors.primary[700] },
  success: { color: colors.success[700] },
  warning: { color: colors.warning[600] },
  danger: { color: colors.danger[700] },
  neutral: { color: colors.neutral[600] },
};
