import { Platform } from "react-native";

const KEYS = {
  ACCESS_TOKEN: "ws_access_token",
  REFRESH_TOKEN: "ws_refresh_token",
  USER_DATA: "ws_user_data",
} as const;

async function getItem(key: string): Promise<string | null> {
  if (Platform.OS === "web") {
    return localStorage.getItem(key);
  }
  const SecureStore = await import("expo-secure-store");
  return SecureStore.getItemAsync(key);
}

async function setItem(key: string, value: string): Promise<void> {
  if (Platform.OS === "web") {
    localStorage.setItem(key, value);
    return;
  }
  const SecureStore = await import("expo-secure-store");
  await SecureStore.setItemAsync(key, value);
}

async function deleteItem(key: string): Promise<void> {
  if (Platform.OS === "web") {
    localStorage.removeItem(key);
    return;
  }
  const SecureStore = await import("expo-secure-store");
  await SecureStore.deleteItemAsync(key);
}

export const storage = {
  async getAccessToken(): Promise<string | null> {
    return getItem(KEYS.ACCESS_TOKEN);
  },

  async getRefreshToken(): Promise<string | null> {
    return getItem(KEYS.REFRESH_TOKEN);
  },

  async setTokens(access: string, refresh: string): Promise<void> {
    await setItem(KEYS.ACCESS_TOKEN, access);
    await setItem(KEYS.REFRESH_TOKEN, refresh);
  },

  async clearTokens(): Promise<void> {
    await deleteItem(KEYS.ACCESS_TOKEN);
    await deleteItem(KEYS.REFRESH_TOKEN);
  },

  async getUserData(): Promise<string | null> {
    return getItem(KEYS.USER_DATA);
  },

  async setUserData(data: string): Promise<void> {
    await setItem(KEYS.USER_DATA, data);
  },

  async clearAll(): Promise<void> {
    await deleteItem(KEYS.ACCESS_TOKEN);
    await deleteItem(KEYS.REFRESH_TOKEN);
    await deleteItem(KEYS.USER_DATA);
  },
};
