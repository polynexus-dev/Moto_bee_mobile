import api from '../api';
import {
    setupAndroidChannel,
    requestNotificationPermissions,
    getDevicePushToken,
    isExpoGo,
} from '../notifications';
import type * as NotificationsType from 'expo-notifications';

let _tokenRefreshSub: NotificationsType.Subscription | null = null;

// ─────────────────────────────────────────────────────────────────────────────
// SAVE TOKEN TO DJANGO BACKEND
// firebase-admin uses this token to send targeted FCM pushes server-side.
// ─────────────────────────────────────────────────────────────────────────────
async function saveTokenToBackend(token: string): Promise<void> {
    try {
        await api.post('/users/push-token/', { push_token: token });
        console.log('[Notifications] Token saved to backend.');
    } catch (e: any) {
        if (e?.response?.status === 404) {
            console.warn('[Notifications] /users/push-token/ endpoint not found.');
        } else {
            console.warn('[Notifications] Failed to save token:', e);
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// FULL SETUP — call once after user logs in
// permissions → android channel → token → backend save → refresh listener
// ─────────────────────────────────────────────────────────────────────────────
export async function setupPushNotifications(): Promise<string | null> {
    if (isExpoGo) return null;
    const permitted = await requestNotificationPermissions();
    if (!permitted) return null;

    await setupAndroidChannel();

    const token = await getDevicePushToken();
    if (!token) return null;

    await saveTokenToBackend(token);

    // Remove old listener before attaching a new one (e.g. after re-login)
    _tokenRefreshSub?.remove();
    try {
        const Notif = require('expo-notifications');
        _tokenRefreshSub = Notif.addPushTokenListener(async (newToken: any) => {
            console.log('[Notifications] Token refreshed:', newToken.data);
            await saveTokenToBackend(newToken.data);
        });
    } catch {
        // Guard for Expo Go
    }

    return token;
}

// ─────────────────────────────────────────────────────────────────────────────
// TEARDOWN — call on logout to stop the token refresh listener
// ─────────────────────────────────────────────────────────────────────────────
export function teardownPushNotifications(): void {
    _tokenRefreshSub?.remove();
    _tokenRefreshSub = null;
    console.log('[Notifications] Teardown complete.');
}