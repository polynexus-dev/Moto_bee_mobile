import React, { useState, useCallback, useEffect } from 'react';
import {
    View, FlatList, Text, StyleSheet,
    ActivityIndicator, TouchableOpacity, TextInput
} from 'react-native';
import { useFocusEffect, useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import Ionicons from '@expo/vector-icons/Ionicons';
import { getAllGarages } from '../../../utils/services/garageService';
import { getDistanceKm } from '../../../utils/distance';
import { Garage } from '../../../types';
import GarageCard from '../../../components/GarageCard';
import Toast from '../../../components/Toast';
import { useToast } from '../../../hooks/useToast';
import { Colors, Typography, Spacing, Radius, Shadow } from '../../../constants/theme';

function garageHasService(g: Garage, targetService: string): boolean {
    if (!targetService) return true;
    const q = targetService.toLowerCase().trim();

    if (g.name.toLowerCase().includes(q) || g.address.toLowerCase().includes(q)) return true;

    let keywords = [q];
    if (q === 'battery') keywords.push('battery check', 'battery replacement', 'battery change');
    if (q === 'brakes' || q === 'brake') keywords.push('brake', 'disc brake', 'brake shoes', 'brake cables', 'brake fluid', 'brake adjustment');
    if (q === 'lights' || q === 'light') keywords.push('light', 'head light', 'tail light', 'indicator', 'headlight');
    if (q === 'clutch') keywords.push('clutch', 'clutch repair');
    if (q === 'tyres' || q === 'tyre') keywords.push('tyre', 'tire', 'puncture', 'alignment', 'wheel');
    if (q === 'spare parts') keywords.push('part', 'spare', 'repair', 'servicing');
    if (q === 'washing' || q === 'wash') keywords.push('wash', 'foam wash', 'detailing');

    const bikeServ = g.services?.bike ?? [];
    const scootyServ = g.services?.scooty ?? [];
    const bikePrices = Object.keys(g.service_prices?.bike ?? {});
    const scootyPrices = Object.keys(g.service_prices?.scooty ?? {});

    const allServices = [...bikeServ, ...scootyServ, ...bikePrices, ...scootyPrices].map(s => s.toLowerCase());

    if (allServices.length === 0) return true;

    return allServices.some(s => keywords.some(k => s.includes(k)));
}

export default function NearbyGaragesScreen() {
    const { service: serviceParam } = useLocalSearchParams<{ service?: string }>();
    const [garages, setGarages] = useState<Garage[]>([]);
    const [filtered, setFiltered] = useState<Garage[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const insets = useSafeAreaInsets();
    const [activeService, setActiveService] = useState<string | null>(serviceParam || null);
    const { toast, showToast, hideToast } = useToast();
    const router = useRouter();

    useEffect(() => {
        if (serviceParam) {
            setActiveService(serviceParam);
        }
    }, [serviceParam]);

    useFocusEffect(useCallback(() => { load(); }, [activeService]));

    const load = async () => {
        setLoading(true);
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            const all = await getAllGarages();

            let resultList = all;
            if (status === 'granted') {
                const loc = await Location.getCurrentPositionAsync({});
                const { latitude, longitude } = loc.coords;
                resultList = all
                    .map((g) => ({
                        ...g,
                        distanceKm: g.latitude != null && g.longitude != null
                            ? getDistanceKm(latitude, longitude, g.latitude, g.longitude)
                            : undefined,
                    }))
                    .sort((a, b) => (a.distanceKm ?? 99) - (b.distanceKm ?? 99));
            }

            setGarages(resultList);

            let res = resultList;
            if (activeService) {
                res = res.filter(g => garageHasService(g, activeService));
            }
            if (search.trim()) {
                res = res.filter(g =>
                    g.name.toLowerCase().includes(search.toLowerCase()) ||
                    g.address.toLowerCase().includes(search.toLowerCase())
                );
            }
            setFiltered(res);
        } catch (e: any) {
            showToast(e?.response?.data?.detail ?? 'Failed to load garages.', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = (text: string) => {
        setSearch(text);
        let res = garages;
        if (activeService) {
            res = res.filter(g => garageHasService(g, activeService));
        }
        if (text.trim()) {
            res = res.filter((g) =>
                g.name.toLowerCase().includes(text.toLowerCase()) ||
                g.address.toLowerCase().includes(text.toLowerCase())
            );
        }
        setFiltered(res);
    };

    const clearServiceFilter = () => {
        setActiveService(null);
        let res = garages;
        if (search.trim()) {
            res = res.filter((g) =>
                g.name.toLowerCase().includes(search.toLowerCase()) ||
                g.address.toLowerCase().includes(search.toLowerCase())
            );
        }
        setFiltered(res);
    };

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={[styles.header, { paddingTop: Math.max(insets.top + Spacing.xs, Spacing.md) }]}>
                <Text style={styles.title}>
                    {activeService ? `${activeService} Garages` : 'Nearby Garages'}
                </Text>
                <Text style={styles.subtitle}>
                    {filtered.length} garage{filtered.length !== 1 ? 's' : ''} found
                </Text>
            </View>

            {/* Active Service Filter Chip */}
            {activeService && (
                <View style={styles.filterChipContainer}>
                    <View style={styles.filterChip}>
                        <Ionicons name="build" size={14} color={Colors.primary} />
                        <Text style={styles.filterChipText}>Service: {activeService}</Text>
                        <TouchableOpacity onPress={clearServiceFilter} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                            <Ionicons name="close-circle" size={16} color={Colors.primary} />
                        </TouchableOpacity>
                    </View>
                </View>
            )}

            {/* Search */}
            <View style={styles.searchWrap}>
                <Ionicons name="search" size={18} color={Colors.textTertiary} />
                <TextInput
                    style={styles.searchInput}
                    placeholder="Search by name or area..."
                    placeholderTextColor={Colors.textTertiary}
                    value={search}
                    onChangeText={handleSearch}
                />
                {search.length > 0 && (
                    <TouchableOpacity onPress={() => handleSearch('')}>
                        <Ionicons name="close-circle" size={18} color={Colors.textTertiary} />
                    </TouchableOpacity>
                )}
            </View>

            {/* List */}
            <FlatList
                data={filtered}
                keyExtractor={(g) => g.id}
                renderItem={({ item }) => (
                    <GarageCard
                        garage={item}
                        onPress={() =>
                            router.push(`/(customer)/garages/garage-detail?id=${item.id}` as any)
                        }
                    />
                )}
                contentContainerStyle={styles.list}
                ListEmptyComponent={
                    loading ? (
                        <ActivityIndicator
                            size="large"
                            color={Colors.primary}
                            style={{ marginTop: 60 }}
                        />
                    ) : (
                        <View style={styles.empty}>
                            <Ionicons name="storefront-outline" size={48} color={Colors.textTertiary} />
                            <Text style={styles.emptyTitle}>No garages found</Text>
                            <Text style={styles.emptyDesc}>
                                {activeService
                                    ? `No garages currently matching "${activeService}". Try clearing the filter.`
                                    : 'Try a different search or check back later.'}
                            </Text>
                            {activeService && (
                                <TouchableOpacity style={styles.clearBtn} onPress={clearServiceFilter}>
                                    <Text style={styles.clearBtnText}>Show All Garages</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    )
                }
                onRefresh={load}
                refreshing={loading}
            />

            <Toast
                visible={toast.visible}
                message={toast.message}
                type={toast.type}
                onHide={hideToast}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.bg },
    header: {
        backgroundColor: Colors.surface,
        paddingHorizontal: Spacing.md,
        paddingBottom: Spacing.md,
        borderBottomWidth: 1, borderBottomColor: Colors.borderLight,
    },
    title: { ...Typography.h1, color: Colors.textPrimary },
    subtitle: { ...Typography.caption, color: Colors.textTertiary, marginTop: 4 },
    filterChipContainer: {
        paddingHorizontal: Spacing.md,
        paddingTop: Spacing.sm,
    },
    filterChip: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        backgroundColor: Colors.primaryLight,
        paddingHorizontal: Spacing.sm,
        paddingVertical: 6,
        borderRadius: Radius.full,
        gap: 6,
        borderWidth: 1,
        borderColor: Colors.primary + '30',
    },
    filterChipText: {
        ...Typography.caption,
        color: Colors.primary,
        fontWeight: '700',
    },
    searchWrap: {
        flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
        backgroundColor: Colors.surface, margin: Spacing.md,
        padding: Spacing.md, borderRadius: Radius.lg,
        borderWidth: 1, borderColor: Colors.border, ...Shadow.sm,
    },
    searchInput: { ...Typography.bodyLg, flex: 1, color: Colors.textPrimary },
    list: { paddingHorizontal: Spacing.md, paddingBottom: Spacing.xl },
    empty: { alignItems: 'center', marginTop: 60, gap: Spacing.sm, paddingHorizontal: Spacing.lg },
    emptyTitle: { ...Typography.h3, color: Colors.textSecondary },
    emptyDesc: { ...Typography.body, color: Colors.textTertiary, textAlign: 'center' },
    clearBtn: {
        marginTop: Spacing.sm,
        backgroundColor: Colors.primary,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
        borderRadius: Radius.md,
    },
    clearBtnText: {
        ...Typography.buttonSm,
        color: '#fff',
    },
});
