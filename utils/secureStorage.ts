import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const secureStorage = {
    async getItem(key: string): Promise<string | null> {
        try {
            if (Platform.OS === 'web') {
                return await AsyncStorage.getItem(key);
            }
            return await SecureStore.getItemAsync(key);
        } catch {
            return await AsyncStorage.getItem(key);
        }
    },

    async setItem(key: string, value: string): Promise<void> {
        try {
            if (Platform.OS === 'web') {
                await AsyncStorage.setItem(key, value);
                return;
            }
            await SecureStore.setItemAsync(key, value);
        } catch {
            await AsyncStorage.setItem(key, value);
        }
    },

    async deleteItem(key: string): Promise<void> {
        try {
            if (Platform.OS === 'web') {
                await AsyncStorage.removeItem(key);
                return;
            }
            await SecureStore.deleteItemAsync(key);
        } catch {
            await AsyncStorage.removeItem(key);
        }
    },
};
