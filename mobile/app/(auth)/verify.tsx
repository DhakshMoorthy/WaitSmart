import { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Button } from "../../src/components/ui";
import { colors, typography, spacing, radius } from "../../src/theme";
import { api } from "../../src/services/api";
import { useAuthStore } from "../../src/stores/auth";
import { storage } from "../../src/utils/storage";

const OTP_LENGTH = 6;

export default function VerifyScreen() {
  const router = useRouter();
  const { phone, devOtp: initialDevOtp } = useLocalSearchParams<{
    phone: string;
    devOtp?: string;
  }>();
  const { setTokens, setUser } = useAuthStore();

  const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(""));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [countdown, setCountdown] = useState(30);
  const [devOtp, setDevOtp] = useState(initialDevOtp ?? "");

  const inputs = useRef<(TextInput | null)[]>([]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleChange = (text: string, index: number) => {
    const newOtp = [...otp];
    newOtp[index] = text;
    setOtp(newOtp);

    if (text && index < OTP_LENGTH - 1) {
      inputs.current[index + 1]?.focus();
    }

    if (newOtp.every((d) => d !== "") && newOtp.join("").length === OTP_LENGTH) {
      handleVerify(newOtp.join(""));
    }
  };

  const handleKeyPress = (key: string, index: number) => {
    if (key === "Backspace" && !otp[index] && index > 0) {
      inputs.current[index - 1]?.focus();
      const newOtp = [...otp];
      newOtp[index - 1] = "";
      setOtp(newOtp);
    }
  };

  const handleVerify = async (code?: string) => {
    const otpCode = code || otp.join("");
    if (otpCode.length !== OTP_LENGTH) {
      setError("Enter the complete 6-digit code");
      return;
    }

    setError("");
    setLoading(true);

    try {
      const { data } = await api.post("/auth/otp/verify", {
        phone,
        otp: otpCode,
      });

      // Auth endpoints return tokens at the top level (not wrapped in { data })
      const { accessToken, refreshToken, user } = data;
      setTokens(accessToken, refreshToken);
      setUser({
        id: user.id,
        email: user.email,
        name: user.name,
        phone: user.phone ?? phone,
        role: user.role,
        tenantId: user.tenantId ?? null,
        doctorId: user.doctorId ?? null,
      });
      await storage.setTokens(accessToken, refreshToken);

      if (user.role === "doctor") {
        router.replace("/(doctor)/queue");
      } else {
        router.replace("/(patient)/home");
      }
    } catch (err: any) {
      setError(err.response?.data?.message || "Invalid OTP. Try again.");
      setOtp(Array(OTP_LENGTH).fill(""));
      inputs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (countdown > 0) return;
    try {
      const { data } = await api.post("/auth/otp/send", { phone });
      if (data.devOtp) setDevOtp(data.devOtp);
      setOtp(Array(OTP_LENGTH).fill(""));
      setCountdown(30);
    } catch {
      setError("Failed to resend OTP");
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={styles.content}>
        <Text style={styles.title}>Verify OTP</Text>
        <Text style={styles.subtitle}>
          Enter the 6-digit code sent to{"\n"}
          <Text style={styles.phone}>{phone}</Text>
        </Text>

        {!!devOtp && (
          <View style={styles.devBanner}>
            <Text style={styles.devLabel}>Dev mode — no SMS. Your OTP is:</Text>
            <Text style={styles.devCode}>{devOtp}</Text>
          </View>
        )}

        <View style={styles.otpRow}>
          {otp.map((digit, i) => (
            <TextInput
              key={i}
              ref={(ref) => { inputs.current[i] = ref; }}
              style={[
                styles.otpInput,
                digit && styles.otpInputFilled,
                error && styles.otpInputError,
              ]}
              value={digit}
              onChangeText={(text) => handleChange(text.slice(-1), i)}
              onKeyPress={({ nativeEvent }) => handleKeyPress(nativeEvent.key, i)}
              keyboardType="number-pad"
              maxLength={1}
              selectTextOnFocus
            />
          ))}
        </View>

        {error && <Text style={styles.error}>{error}</Text>}

        <Button
          title="Verify"
          onPress={() => handleVerify()}
          loading={loading}
          disabled={otp.some((d) => !d)}
          size="lg"
          style={styles.button}
        />

        <TouchableOpacity onPress={handleResend} disabled={countdown > 0}>
          <Text style={[styles.resend, countdown > 0 && styles.resendDisabled]}>
            {countdown > 0 ? `Resend in ${countdown}s` : "Resend OTP"}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral[0],
  },
  content: {
    flex: 1,
    justifyContent: "center",
    padding: spacing["2xl"],
  },
  title: {
    ...typography.h2,
    color: colors.neutral[900],
    textAlign: "center",
  },
  subtitle: {
    ...typography.body,
    color: colors.neutral[500],
    textAlign: "center",
    marginTop: spacing.sm,
    marginBottom: spacing["3xl"],
  },
  phone: {
    color: colors.neutral[800],
    fontWeight: "600",
  },
  devBanner: {
    backgroundColor: colors.primary[50],
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.primary[200],
    padding: spacing.lg,
    marginBottom: spacing["2xl"],
    alignItems: "center",
  },
  devLabel: {
    ...typography.bodySmall,
    color: colors.neutral[600],
    marginBottom: spacing.xs,
  },
  devCode: {
    fontSize: 28,
    fontWeight: "700",
    letterSpacing: 6,
    color: colors.primary[700],
  },
  otpRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: spacing.sm,
    marginBottom: spacing["2xl"],
  },
  otpInput: {
    width: 48,
    height: 56,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.neutral[200],
    backgroundColor: colors.neutral[50],
    textAlign: "center",
    fontSize: 22,
    fontWeight: "700",
    color: colors.neutral[900],
  },
  otpInputFilled: {
    borderColor: colors.primary[500],
    backgroundColor: colors.primary[50],
  },
  otpInputError: {
    borderColor: colors.danger[500],
    backgroundColor: colors.danger[50],
  },
  error: {
    ...typography.bodySmall,
    color: colors.danger[600],
    textAlign: "center",
    marginBottom: spacing.lg,
  },
  button: {
    marginBottom: spacing.xl,
  },
  resend: {
    ...typography.body,
    color: colors.primary[600],
    textAlign: "center",
    fontWeight: "500",
  },
  resendDisabled: {
    color: colors.neutral[400],
  },
});
