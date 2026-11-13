import React, { useState, useEffect } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    ActivityIndicator, Dimensions, Image
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { getAllGarages } from '../../utils/services/garageService';
import { Garage } from '../../types';
import { Colors, Typography, Spacing, Radius, Shadow } from '../../constants/theme';
import Toast from '../../components/Toast';
import { useToast } from '../../hooks/useToast';

const { width } = Dimensions.get('window');

type VehicleType = 'bike' | 'scooty';

interface WashPackage {
    id: string;
    name: string;
    desc: string;
    duration: string;
    bikePrice: number;
    scootyPrice: number;
    popular?: boolean;
    features: string[];
    icon: keyof typeof Ionicons.glyphMap;
}

const WASH_PACKAGES: WashPackage[] = [
    {
        id: 'p1',
        name: 'Basic Water Wash',
        desc: 'High-pressure water wash with body cleaning & dry wipe.',
        duration: '20 min',
        bikePrice: 149,
        scootyPrice: 129,
        features: ['High Pressure Jet Spray', 'Wheel Rim Cleaning', 'Microfiber Dry Wipe'],
        icon: 'water-outline',
    },
    {
        id: 'p2',
        name: 'Foam Wash & Polish',
        desc: 'Deep snow foam bath, chain lube & high-gloss spray polish.',
        duration: '35 min',
        bikePrice: 299,
        scootyPrice: 249,
        popular: true,
        features: ['Snow Foam Shampoo', 'Chain Lube & Adjustment', 'Tyre & Trim Polish', 'Microfiber Dry'],
        icon: 'sparkles-outline',
    },
    {
        id: 'p3',
        name: 'Full Detailing & Anti-Rust',
        desc: 'Complete engine degrease, anti-rust coat & premium body wax.',
        duration: '60 min',
        bikePrice: 499,
        scootyPrice: 449,
        features: ['Engine Bay Degreasing', 'Premium Carnauba Wax', 'Anti-Rust Protection', 'Scratch Masking'],
        icon: 'shield-checkmark-outline',
    },
    {
        id: 'p4',
        name: 'Doorstep Waterless Wash',
        desc: 'Eco-friendly waterless wash at your preferred location.',
        duration: '30 min',
        bikePrice: 199,
        scootyPrice: 179,
        features: ['Doorstep Service', 'Eco Wash Formula', 'UV Coating Polish', 'No Water Spills'],
        icon: 'home-outline',
    },
];

const DEMO_WASH_SHOPS = [
    {
        id: 'demo-wash-1',
        name: 'Sparkle Auto Wash & Detailing',
        rating: 4.8,
        reviewsCount: 142,
        address: 'MG Road, Near Central Mall, Camp',
        distanceKm: 1.2,
        doorstep: true,
        startsFrom: 129,
        timeSlot: 'Open today • 9 AM - 8 PM',
    },
    {
        id: 'demo-wash-2',
        name: 'MotoClean Express Foam Studio',
        rating: 4.9,
        reviewsCount: 215,
        address: 'FC Road, Opposite Ferguson College',
        distanceKm: 2.4,
        doorstep: true,
        startsFrom: 149,
        timeSlot: 'Open today • 8:30 AM - 9 PM',
    },
    {
        id: 'demo-wash-3',
        name: 'Speedy Shine Bike Wash',
        rating: 4.6,
        reviewsCount: 88,
        address: 'Baner Main Road, Near High Street',
        distanceKm: 3.8,
        doorstep: false,
        startsFrom: 119,
        timeSlot: 'Open today • 9 AM - 7:30 PM',
    },
    {
        id: 'demo-wash-4',
        name: 'ProCare Waterless & Detailing Hub',
        rating: 4.7,
        reviewsCount: 96,
        address: 'Kothrud, Near Karve Statue',
        distanceKm: 4.1,
        doorstep: true,
        startsFrom: 179,
        timeSlot: 'Open today • 9 AM - 8 PM',
    },
];

export default function WashingServiceScreen() {
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const [vehicleType, setVehicleType] = useState<VehicleType>('bike');
    const [garages, setGarages] = useState<Garage[]>([]);
    const [loading, setLoading] = useState(true);
    const { toast, showToast, hideToast } = useToast();

    useEffect(() => {
        loadGarages();
    }, []);

    const loadGarages = async () => {
        setLoading(true);
        try {
            const apiGarages = await getAllGarages();
            setGarages(apiGarages);
        } catch {
            // Keep default demo shops if backend is offline
        } finally {
            setLoading(false);
        }
    };

    const displayShops = garages.length > 0
        ? garages.map(g => ({
            id: g.id,
            name: g.name,
            rating: 4.8,
            reviewsCount: 50,
            address: g.address,
            distanceKm: g.distanceKm ?? 1.5,
            doorstep: true,
            startsFrom: 129,
            timeSlot: 'Open today • 9 AM - 8 PM',
        }))
        : DEMO_WASH_SHOPS;

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={[styles.header, { paddingTop: Math.max(insets.top + Spacing.xs, Spacing.md) }]}>
                <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
                    <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
                </TouchableOpacity>
                <View style={styles.headerTextWrap}>
                    <Text style={styles.headerTitle}>Vehicle Washing</Text>
                    <Text style={styles.headerSubtitle}>Sparkling clean for bike & scooty</Text>
                </View>
                <TouchableOpacity
                    style={styles.cartBtn}
                    onPress={() => router.push('/(customer)/cart' as any)}
                >
                    <Ionicons name="cart-outline" size={22} color={Colors.textPrimary} />
                </TouchableOpacity>
            </View>

            <ScrollView
                style={styles.content}
                contentContainerStyle={styles.contentInner}
                showsVerticalScrollIndicator={false}
            >
                {/* Hero Banner */}
                <View style={styles.heroCard}>
                    <View style={styles.heroBadge}>
                        <Ionicons name="water" size={12} color="#1D4ED8" />
                        <Text style={styles.heroBadgeText}>PREMIUM CLEANING</Text>
                    </View>
                    <Text style={styles.heroTitle}>Professional Foam & Pressure Wash</Text>
                    <Text style={styles.heroSub}>
                        Get your vehicle shining with high-pressure jets, eco foam, & deep polishing.
                    </Text>
                </View>

                {/* Vehicle Type Switcher */}
                <View style={styles.vehicleSwitchContainer}>
                    <TouchableOpacity
                        style={[styles.vehicleTab, vehicleType === 'bike' && styles.vehicleTabActive]}
                        onPress={() => setVehicleType('bike')}
                        activeOpacity={0.8}
                    >
                        <Ionicons
                            name="bicycle-outline"
                            size={18}
                            color={vehicleType === 'bike' ? '#fff' : Colors.textSecondary}
                        />
                        <Text style={[styles.vehicleTabText, vehicleType === 'bike' && styles.vehicleTabTextActive]}>
                            Motorbike Wash
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.vehicleTab, vehicleType === 'scooty' && styles.vehicleTabActive]}
                        onPress={() => setVehicleType('scooty')}
                        activeOpacity={0.8}
                    >
                        <Ionicons
                            name="speedometer-outline"
                            size={18}
                            color={vehicleType === 'scooty' ? '#fff' : Colors.textSecondary}
                        />
                        <Text style={[styles.vehicleTabText, vehicleType === 'scooty' && styles.vehicleTabTextActive]}>
                            Scooty Wash
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* Packages Section */}
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Wash Packages & Pricing</Text>
                    <Text style={styles.sectionSub}>Prices tailored for {vehicleType === 'bike' ? 'Motorbikes' : 'Scooties'}</Text>
                </View>

                {WASH_PACKAGES.map((pkg) => {
                    const price = vehicleType === 'bike' ? pkg.bikePrice : pkg.scootyPrice;
                    return (
                        <View key={pkg.id} style={[styles.pkgCard, pkg.popular && styles.pkgCardPopular]}>
                            {pkg.popular && (
                                <View style={styles.popularBadge}>
                                    <Ionicons name="star" size={10} color="#fff" />
                                    <Text style={styles.popularText}>MOST POPULAR</Text>
                                </View>
                            )}
                            <View style={styles.pkgTop}>
                                <View style={styles.pkgIconBox}>
                                    <Ionicons name={pkg.icon} size={22} color={Colors.primary} />
                                </View>
                                <View style={styles.pkgInfo}>
                                    <Text style={styles.pkgName}>{pkg.name}</Text>
                                    <Text style={styles.pkgDuration}>
                                        <Ionicons name="time-outline" size={12} color={Colors.textTertiary} /> {pkg.duration}
                                    </Text>
                                </View>
                                <View style={styles.pkgPriceWrap}>
                                    <Text style={styles.pkgPrice}>₹{price}</Text>
                                </View>
                            </View>

                            <Text style={styles.pkgDesc}>{pkg.desc}</Text>

                            <View style={styles.featuresList}>
                                {pkg.features.map((feat, idx) => (
                                    <View key={idx} style={styles.featRow}>
                                        <Ionicons name="checkmark-circle" size={15} color={Colors.success} />
                                        <Text style={styles.featText}>{feat}</Text>
                                    </View>
                                ))}
                            </View>

                            <TouchableOpacity
                                style={styles.bookPkgBtn}
                                onPress={() => router.push('/(customer)/garages' as any)}
                                activeOpacity={0.85}
                            >
                                <Text style={styles.bookPkgBtnText}>Book Package at Garage</Text>
                                <Ionicons name="arrow-forward" size={14} color="#fff" />
                            </TouchableOpacity>
                        </View>
                    );
                })}

                {/* Available Demo Shops */}
                <View style={[styles.sectionHeader, { marginTop: Spacing.lg }]}>
                    <Text style={styles.sectionTitle}>Shops Offering Wash</Text>
                    <Text style={styles.sectionSub}>Available demo garages near your location</Text>
                </View>

                {loading ? (
                    <ActivityIndicator size="large" color={Colors.primary} style={{ marginVertical: 20 }} />
                ) : (
                    displayShops.map((shop) => (
                        <View key={shop.id} style={styles.shopCard}>
                            <View style={styles.shopTop}>
                                <View style={styles.shopIconBox}>
                                    <Ionicons name="water" size={24} color="#1D4ED8" />
                                </View>
                                <View style={styles.shopInfo}>
                                    <View style={styles.shopNameRow}>
                                        <Text style={styles.shopName} numberOfLines={1}>{shop.name}</Text>
                                    </View>
                                    <View style={styles.shopRatingRow}>
                                        <Ionicons name="star" size={13} color="#F59E0B" />
                                        <Text style={styles.shopRating}>{shop.rating}</Text>
                                        <Text style={styles.shopReviews}>({shop.reviewsCount})</Text>
                                        <Text style={styles.dotSeparator}>•</Text>
                                        <Text style={styles.shopDistance}>{shop.distanceKm} km away</Text>
                                    </View>
                                </View>
                            </View>

                            <View style={styles.shopAddressRow}>
                                <Ionicons name="location-outline" size={14} color={Colors.textTertiary} />
                                <Text style={styles.shopAddress} numberOfLines={1}>{shop.address}</Text>
                            </View>

                            <View style={styles.shopBadgesRow}>
                                {shop.doorstep && (
                                    <View style={styles.badgeChip}>
                                        <Ionicons name="home-outline" size={12} color={Colors.primary} />
                                        <Text style={styles.badgeChipText}>Doorstep Wash Available</Text>
                                    </View>
                                )}
                                <View style={[styles.badgeChip, { backgroundColor: Colors.infoLight }]}>
                                    <Ionicons name="flash-outline" size={12} color={Colors.info} />
                                    <Text style={[styles.badgeChipText, { color: Colors.info }]}>Express Clean</Text>
                                </View>
                            </View>

                            <View style={styles.shopFooter}>
                                <View>
                                    <Text style={styles.startsLabel}>Wash starting from</Text>
                                    <Text style={styles.startsPrice}>₹{shop.startsFrom}</Text>
                                </View>

                                <TouchableOpacity
                                    style={styles.selectShopBtn}
                                    onPress={() => {
                                        if (shop.id.startsWith('demo')) {
                                            router.push('/(customer)/garages' as any);
                                        } else {
                                            router.push(`/(customer)/garages/garage-detail?id=${shop.id}` as any);
                                        }
                                    }}
                                    activeOpacity={0.85}
                                >
                                    <Text style={styles.selectShopText}>Book at Garage</Text>
                                    <Ionicons name="chevron-forward" size={14} color="#fff" />
                                </TouchableOpacity>
                            </View>
                        </View>
                    ))
                )}
            </ScrollView>

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
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        backgroundColor: Colors.surface, paddingHorizontal: Spacing.md,
        paddingBottom: Spacing.md,
        borderBottomWidth: 1, borderBottomColor: Colors.borderLight,
    },
    backBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.bg },
    headerTextWrap: { flex: 1, marginLeft: Spacing.sm },
    headerTitle: { ...Typography.h2, color: Colors.textPrimary },
    headerSubtitle: { ...Typography.caption, color: Colors.textTertiary, marginTop: 1 },
    cartBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.bg },

    content: { flex: 1 },
    contentInner: { padding: Spacing.md, paddingBottom: Spacing.xl * 2 },

    // Hero
    heroCard: {
        backgroundColor: '#EFF6FF',
        borderRadius: Radius.lg,
        padding: Spacing.lg,
        borderWidth: 1,
        borderColor: '#BFDBFE',
        marginBottom: Spacing.md,
    },
    heroBadge: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        backgroundColor: '#DBEAFE', paddingHorizontal: 8, paddingVertical: 3,
        borderRadius: Radius.full, alignSelf: 'flex-start', marginBottom: Spacing.xs,
    },
    heroBadgeText: { fontSize: 10, fontWeight: '800', color: '#1D4ED8', letterSpacing: 0.5 },
    heroTitle: { ...Typography.h2, color: '#1E3A8A', marginBottom: 4 },
    heroSub: { ...Typography.body, color: '#3B82F6', fontSize: 13, lineHeight: 18 },

    // Switcher
    vehicleSwitchContainer: {
        flexDirection: 'row', backgroundColor: Colors.surface,
        borderRadius: Radius.lg, padding: 4, marginBottom: Spacing.lg,
        borderWidth: 1, borderColor: Colors.border,
    },
    vehicleTab: {
        flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        paddingVertical: 10, borderRadius: Radius.md, gap: 6,
    },
    vehicleTabActive: { backgroundColor: Colors.primary },
    vehicleTabText: { ...Typography.buttonSm, color: Colors.textSecondary },
    vehicleTabTextActive: { color: '#fff', fontWeight: '700' },

    // Sections
    sectionHeader: { marginBottom: Spacing.md },
    sectionTitle: { ...Typography.h2, color: Colors.textPrimary },
    sectionSub: { ...Typography.caption, color: Colors.textTertiary, marginTop: 2 },

    // Packages
    pkgCard: {
        backgroundColor: Colors.surface, borderRadius: Radius.lg,
        padding: Spacing.md, marginBottom: Spacing.md,
        borderWidth: 1, borderColor: Colors.border, ...Shadow.sm, position: 'relative',
    },
    pkgCardPopular: { borderColor: Colors.primary, borderWidth: 1.5 },
    popularBadge: {
        position: 'absolute', top: -11, right: Spacing.md,
        backgroundColor: Colors.primary, flexDirection: 'row', alignItems: 'center', gap: 3,
        paddingHorizontal: 8, paddingVertical: 2, borderRadius: Radius.full,
    },
    popularText: { fontSize: 9, fontWeight: '800', color: '#fff', letterSpacing: 0.5 },
    pkgTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.xs },
    pkgIconBox: {
        width: 40, height: 40, borderRadius: Radius.md,
        backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center',
    },
    pkgInfo: { flex: 1 },
    pkgName: { ...Typography.h3, color: Colors.textPrimary },
    pkgDuration: { ...Typography.caption, color: Colors.textTertiary, marginTop: 2 },
    pkgPriceWrap: { alignItems: 'flex-end' },
    pkgPrice: { ...Typography.h2, color: Colors.primary, fontWeight: '800' },
    pkgDesc: { ...Typography.body, color: Colors.textSecondary, fontSize: 13, marginBottom: Spacing.sm },
    featuresList: { gap: 6, marginBottom: Spacing.md },
    featRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    featText: { ...Typography.caption, color: Colors.textPrimary, fontSize: 12 },

    bookPkgBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
        backgroundColor: Colors.primary, borderRadius: Radius.md, paddingVertical: 10,
    },
    bookPkgBtnText: { ...Typography.buttonSm, color: '#fff', fontWeight: '700' },

    // Shops
    shopCard: {
        backgroundColor: Colors.surface, borderRadius: Radius.lg,
        padding: Spacing.md, marginBottom: Spacing.md,
        borderWidth: 1, borderColor: Colors.border, ...Shadow.sm,
    },
    shopTop: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'center' },
    shopIconBox: {
        width: 44, height: 44, borderRadius: Radius.md,
        backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center',
    },
    shopInfo: { flex: 1 },
    shopNameRow: { flexDirection: 'row', alignItems: 'center' },
    shopName: { ...Typography.h3, color: Colors.textPrimary, flex: 1 },
    shopRatingRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
    shopRating: { ...Typography.caption, color: Colors.textPrimary, fontWeight: '700' },
    shopReviews: { ...Typography.caption, color: Colors.textTertiary },
    dotSeparator: { ...Typography.caption, color: Colors.textTertiary },
    shopDistance: { ...Typography.caption, color: Colors.primary, fontWeight: '600' },

    shopAddressRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: Spacing.xs },
    shopAddress: { ...Typography.caption, color: Colors.textTertiary, flex: 1 },

    shopBadgesRow: { flexDirection: 'row', gap: Spacing.xs, marginTop: Spacing.sm, flexWrap: 'wrap' },
    badgeChip: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        backgroundColor: Colors.primaryLight, paddingHorizontal: Spacing.sm, paddingVertical: 4,
        borderRadius: Radius.full,
    },
    badgeChipText: { ...Typography.caption, color: Colors.primary, fontWeight: '600', fontSize: 11 },

    shopFooter: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        marginTop: Spacing.md, paddingTop: Spacing.sm,
        borderTopWidth: 1, borderTopColor: Colors.borderLight,
    },
    startsLabel: { ...Typography.caption, color: Colors.textTertiary },
    startsPrice: { ...Typography.h3, color: Colors.textPrimary, fontWeight: '800' },
    selectShopBtn: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        backgroundColor: Colors.primary, paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.xs + 2, borderRadius: Radius.md,
    },
    selectShopText: { ...Typography.buttonSm, color: '#fff', fontWeight: '700' },
});
