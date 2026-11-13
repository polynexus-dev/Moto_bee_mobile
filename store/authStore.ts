// store/authStore.ts

import { AppUser } from '../types';
import { create } from 'zustand';
import { teardownPushNotifications } from '../utils/services/notificationService';
import {
    getAuthToken,
    getStoredUser,
    clearAuthData,
    updateStoredUser,
} from '../utils/services/authService';

interface AuthState {
    user: AppUser | null;
    token: string | null;
    isHydrated: boolean;
    hydrate: () => Promise<void>;
    setAuth: (token: string, user: AppUser) => void;
    logout: () => Promise<void>;
    updateUser: (partial: Partial<AppUser>) => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
    user: null,
    token: null,
    isHydrated: false,

    hydrate: async () => {
        try {
            const token = await getAuthToken();
            const user = await getStoredUser();
            if (token && user) {
                set({ token, user });
            } else {
                set({ token: null, user: null });
            }
        } catch (e) {
            set({ token: null, user: null });
        } finally {
            set({ isHydrated: true });
        }
    },

    setAuth: (token, user) => {
        set({ token, user });
    },

    logout: async () => {
        teardownPushNotifications();
        await clearAuthData();
        set({ token: null, user: null });
    },

    updateUser: async (partial) => {
        const updated = await updateStoredUser(partial);
        if (updated) {
            set({ user: updated });
        }
    },
}));