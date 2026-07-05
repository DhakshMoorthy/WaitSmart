import { Redirect } from "expo-router";
import { useAuthStore } from "../src/stores/auth";
import { LoadingScreen } from "../src/components/ui";

export default function IndexScreen() {
  const { isAuthenticated, isLoading, user } = useAuthStore();

  if (isLoading) {
    return <LoadingScreen message="Loading WaitSmart..." />;
  }

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  if (user?.role === "doctor") {
    return <Redirect href="/(doctor)/queue" />;
  }

  return <Redirect href="/(patient)/home" />;
}
