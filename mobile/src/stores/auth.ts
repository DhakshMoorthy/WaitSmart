import { create } from "zustand";
import type { Role } from "@waitsmart/shared";
import { storage } from "../utils/storage";

interface User {
  id: string;
  email: string;
  name: string;
  phone: string;
  role: Role;
  tenantId: string | null;
  /** Present when role is doctor — doctors table id (not users.id) */
  doctorId?: string | null;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  setTokens: (access: string, refresh: string) => void;
  setUser: (user: User) => void;
  logout: () => void;
  hydrate: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  isAuthenticated: false,
  isLoading: true,

  setTokens(access, refresh) {
    set({ accessToken: access, refreshToken: refresh, isAuthenticated: true });
  },

  setUser(user) {
    set({ user });
    storage.setUserData(JSON.stringify(user));
  },

  async logout() {
    set({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
    });
    await storage.clearAll();
  },

  async hydrate() {
    try {
      const [access, refresh, userData] = await Promise.all([
        storage.getAccessToken(),
        storage.getRefreshToken(),
        storage.getUserData(),
      ]);

      if (access && refresh) {
        const user = userData ? JSON.parse(userData) : null;
        set({
          accessToken: access,
          refreshToken: refresh,
          user,
          isAuthenticated: true,
          isLoading: false,
        });
      } else {
        set({ isLoading: false });
      }
    } catch {
      set({ isLoading: false });
    }
  },
}));
