import { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { Button, Input } from "../../src/components/ui";
import { colors, typography, spacing } from "../../src/theme";
import { api } from "../../src/services/api";

export default function LoginScreen() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSendOtp = async () => {
    const cleaned = phone.replace(/\s/g, "");
    if (cleaned.length < 10) {
      setError("Enter a valid 10-digit phone number");
      return;
    }

    setError("");
    setLoading(true);

    try {
      const fullPhone = cleaned.startsWith("+91") ? cleaned : `+91${cleaned}`;
      const { data } = await api.post("/auth/otp/send", { phone: fullPhone });
      router.push({
        pathname: "/(auth)/verify",
        params: {
          phone: fullPhone,
          // Local/dev only — no real SMS, so the API returns the code for the UI
          ...(data.devOtp ? { devOtp: data.devOtp } : {}),
        },
      });
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to send OTP. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={styles.logo}>WaitSmart</Text>
          <Text style={styles.tagline}>
            Skip the wait, not the care
          </Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.title}>Welcome</Text>
          <Text style={styles.subtitle}>
            Enter your phone number to get started
          </Text>

          <Input
            label="Phone Number"
            placeholder="9876543210"
            keyboardType="phone-pad"
            value={phone}
            onChangeText={setPhone}
            error={error}
            maxLength={13}
            leftIcon={
              <Text style={styles.countryCode}>+91</Text>
            }
          />

          <Button
            title="Send OTP"
            onPress={handleSendOtp}
            loading={loading}
            disabled={phone.replace(/\s/g, "").length < 10}
            size="lg"
          />
        </View>

        <Text style={styles.terms}>
          By continuing, you agree to our Terms of Service and Privacy Policy
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral[0],
  },
  scroll: {
    flexGrow: 1,
    justifyContent: "center",
    padding: spacing["2xl"],
  },
  header: {
    alignItems: "center",
    marginBottom: spacing["4xl"],
  },
  logo: {
    ...typography.h1,
    color: colors.primary[600],
    fontSize: 36,
  },
  tagline: {
    ...typography.body,
    color: colors.neutral[500],
    marginTop: spacing.sm,
  },
  form: {
    marginBottom: spacing["3xl"],
  },
  title: {
    ...typography.h2,
    color: colors.neutral[900],
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.body,
    color: colors.neutral[500],
    marginBottom: spacing["2xl"],
  },
  countryCode: {
    ...typography.body,
    color: colors.neutral[600],
    fontWeight: "500",
  },
  terms: {
    ...typography.caption,
    color: colors.neutral[400],
    textAlign: "center",
    paddingHorizontal: spacing.lg,
  },
});
