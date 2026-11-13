// app/index.tsx
import React from 'react';
import { Redirect } from 'expo-router';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { useAuthStore } from '../store/authStore';

export default function Index() {
    const { token, user, isHydrated } = useAuthStore();

    if (!isHydrated) {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" color="#FF6B35" />
            </View>
        );
    }

    if (!token || !user) {
        return <Redirect href="/(auth)/login" />;
    }

    if (user.role === 'owner') {
        return <Redirect href="/(owner)" />;
    }

    return <Redirect href="/(customer)/home" />;
}

const styles = StyleSheet.create({
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#FF6B35',
    },
});
