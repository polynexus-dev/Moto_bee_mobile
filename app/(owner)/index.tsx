import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    ActivityIndicator, RefreshControl, Image, Modal,
    TextInput, Alert, Dimensions, Pressable
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAuthStore } from '../../store/authStore';
import { getMyGarage, updateGarageInfo } from '../../utils/services/garageService';
import { getGarageBookings } from '../../utils/services/bookingService';
import { getGarageStoredImages, saveGarageStoredImages } from '../../utils/storage';
import {
    pickFromGallerySafe,
    takePhotoSafe,
    GARAGE_SAMPLE_PHOTOS,
    isNativePickerSupported,
} from '../../utils/imagePicker';
import { Garage, Booking, BookingStatus } from '../../types';
import Toast from '../../components/Toast';
import { useToast } from '../../hooks/useToast';
import { Colors, Typography, Spacing, Radius, Shadow } from '../../constants/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function OwnerDashboard() {
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const user = useAuthStore((s) => s.user);
    const { toast, showToast, hideToast } = useToast();

    const [garage, setGarage] = useState<Garage | null>(null);
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [images, setImages] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

    // Image Modal States
    const [showAddImageModal, setShowAddImageModal] = useState(false);
    const [showUrlInput, setShowUrlInput] = useState(false);
    const [showSamplePicker, setShowSamplePicker] = useState(false);
    const [imageUrlInput, setImageUrlInput] = useState('');
    const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);
    const [uploadingImage, setUploadingImage] = useState(false);

    const isMounted = useRef(true);

    useEffect(() => {
        isMounted.current = true;
        return () => {
            isMounted.current = false;
        };
    }, []);

    const loadData = useCallback(async (isSilent = false, isPullRefresh = false) => {
        if (!isSilent && !isPullRefresh) {
            setLoading(true);
        }
        if (isPullRefresh) {
            setRefreshing(true);
        }

        try {
            const [garageData, bookingsData] = await Promise.all([
                getMyGarage().catch((err) => {
                    console.warn('[Dashboard] Failed to fetch garage:', err);
                    return null;
                }),
                getGarageBookings().catch((err) => {
                    console.warn('[Dashboard] Failed to fetch garage bookings:', err);
                    return [] as Booking[];
                }),
            ]);

            if (isMounted.current) {
                if (garageData) {
                    setGarage(garageData);
                    // Load images from storage + garage data
                    const storedImages = await getGarageStoredImages(garageData.id);
                    const combined = Array.from(new Set([
                        ...(garageData.images || []),
                        ...(garageData.image ? [garageData.image] : []),
                        ...storedImages,
                    ])).filter(Boolean);
                    setImages(combined);
                }
                const safeBookings = Array.isArray(bookingsData) ? bookingsData : [];
                setBookings(safeBookings);
                setLastUpdated(new Date());
            }
        } catch (e: any) {
            if (!isSilent && isMounted.current) {
                showToast(e?.response?.data?.detail ?? 'Failed to load dashboard data.', 'error');
            }
        } finally {
            if (isMounted.current) {
                setLoading(false);
                setRefreshing(false);
            }
        }
    }, [showToast]);

    // Live auto-polling every 12 seconds when screen is focused
    useFocusEffect(
        useCallback(() => {
            loadData(false);

            const interval = setInterval(() => {
                loadData(true);
            }, 12000);

            return () => {
                clearInterval(interval);
            };
        }, [loadData])
    );

    // ── Image Actions ──────────────────────────────────────────────────────────
    const persistAndSyncImages = async (newImages: string[]) => {
        setImages(newImages);
        if (garage?.id) {
            await saveGarageStoredImages(garage.id, newImages);
            try {
                await updateGarageInfo(garage.id, {
                    images: newImages,
                    image: newImages[0] || '',
                });
            } catch (err) {
                console.warn('[Dashboard] Backend image sync skipped:', err);
            }
        }
    };

    const handlePickFromGallery = async () => {
        setUploadingImage(true);
        try {
            const result = await pickFromGallerySafe();
            if (!result.canceled && result.assets && result.assets.length > 0) {
                const pickedUris = result.assets.map((a) => a.uri);
                const updated = Array.from(new Set([...images, ...pickedUris]));
                await persistAndSyncImages(updated);
                showToast(`${pickedUris.length} photo(s) added successfully!`, 'success');
                setShowAddImageModal(false);
            } else if (result.canceled && !isNativePickerSupported()) {
                setShowSamplePicker(true);
            }
        } catch {
            showToast('Gallery not available in current APK build. Use sample photos or URL.', 'warning');
            setShowSamplePicker(true);
        } finally {
            setUploadingImage(false);
        }
    };

    const handleTakePhoto = async () => {
        setUploadingImage(true);
        try {
            const result = await takePhotoSafe();
            if (!result.canceled && result.assets && result.assets.length > 0) {
                const newUri = result.assets[0].uri;
                const updated = Array.from(new Set([...images, newUri]));
                await persistAndSyncImages(updated);
                showToast('Photo captured and added!', 'success');
                setShowAddImageModal(false);
            } else if (result.canceled && !isNativePickerSupported()) {
                setShowSamplePicker(true);
            }
        } catch {
            showToast('Camera not available in current APK build. Use sample photos or URL.', 'warning');
            setShowSamplePicker(true);
        } finally {
            setUploadingImage(false);
        }
    };

    const handleAddUrl = async () => {
        const trimmed = imageUrlInput.trim();
        if (!trimmed) {
            showToast('Please enter a valid image URL.', 'error');
            return;
        }
        if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
            showToast('URL must start with http:// or https://', 'error');
            return;
        }

        const updated = Array.from(new Set([...images, trimmed]));
        await persistAndSyncImages(updated);
        setImageUrlInput('');
        setShowUrlInput(false);
        setShowAddImageModal(false);
        showToast('Image URL added successfully!', 'success');
    };

    const handleSelectSample = async (sampleUri: string) => {
        const updated = Array.from(new Set([...images, sampleUri]));
        await persistAndSyncImages(updated);
        setShowSamplePicker(false);
        setShowAddImageModal(false);
        showToast('Workshop photo added!', 'success');
    };

    const handleDeleteImage = async (indexToDelete: number) => {
        Alert.alert(
            'Delete Photo',
            'Are you sure you want to remove this photo from your garage gallery?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        const updated = images.filter((_, i) => i !== indexToDelete);
                        await persistAndSyncImages(updated);
                        setSelectedImageIndex(null);
                        showToast('Photo removed.', 'info');
                    },
                },
            ]
        );
    };

    const handleSetAsCover = async (index: number) => {
        if (index === 0) return;
        const target = images[index];
        const rest = images.filter((_, i) => i !== index);
        const updated = [target, ...rest];
        await persistAndSyncImages(updated);
        setSelectedImageIndex(0);
        showToast('Set as main cover photo!', 'success');
    };

    if (loading && !garage && bookings.length === 0) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={Colors.primary} />
                <Text style={styles.loadingText}>Loading Dashboard & Real-Time Metrics...</Text>
            </View>
        );
    }

    // ── Metric Calculations ───────────────────────────────────────────────────
    const pending = bookings.filter((b) => b.status === 'pending').length;
    const accepted = bookings.filter((b) => b.status === 'accepted').length;
    const inProgress = bookings.filter((b) => b.status === 'in_progress').length;
    const completed = bookings.filter((b) => b.status === 'completed').length;
    const totalBookings = bookings.length;

    const bikeServicesCount = garage?.services?.bike?.length ?? 0;
    const scootyServicesCount = garage?.services?.scooty?.length ?? 0;
    const totalServices = bikeServicesCount + scootyServicesCount;

    const totalCompletedRevenue = bookings
        .filter((b) => b.status === 'completed')
        .reduce((sum, b) => sum + (Number(b.grand_total) || Number(b.services_subtotal) || 0), 0);

    const isProfileComplete = !!garage?.name?.trim() && !!garage?.address?.trim() && !!garage?.phone?.trim();

    // ── Interactive Navigation Helpers ─────────────────────────────────────────
    const navigateToBookings = (statusKey?: string) => {
        if (statusKey && statusKey !== 'all') {
            router.push({
                pathname: '/(owner)/bookings',
                params: { filter: statusKey },
            });
        } else {
            router.push('/(owner)/bookings');
        }
    };

    const navigateToServices = () => {
        router.push('/(owner)/edit-services');
    };

    const navigateToSchedule = () => {
        router.push('/(owner)/schedule');
    };

    const navigateToAccount = () => {
        router.push('/(owner)/account');
    };

    const STATS = [
        {
            key: 'pending',
            label: 'Pending',
            subLabel: 'Needs review',
            value: pending,
            icon: 'time-outline' as const,
            color: '#B45309',
            bg: '#FFFBEB',
            borderColor: '#FDE68A',
            badge: pending > 0 ? `${pending} NEW` : undefined,
            onPress: () => navigateToBookings('pending'),
        },
        {
            key: 'in_progress',
            label: 'In Service',
            subLabel: 'Under repair',
            value: inProgress,
            icon: 'build-outline' as const,
            color: '#1D4ED8',
            bg: '#EFF6FF',
            borderColor: '#BFDBFE',
            onPress: () => navigateToBookings('in_progress'),
        },
        {
            key: 'accepted',
            label: 'Accepted',
            subLabel: 'Scheduled',
            value: accepted,
            icon: 'checkmark-circle-outline' as const,
            color: '#0D9488',
            bg: '#F0FDFA',
            borderColor: '#99F6E4',
            onPress: () => navigateToBookings('accepted'),
        },
        {
            key: 'completed',
            label: 'Completed',
            subLabel: 'Successful',
            value: completed,
            icon: 'checkmark-done-circle-outline' as const,
            color: '#15803D',
            bg: '#F0FDF4',
            borderColor: '#BBF7D0',
            onPress: () => navigateToBookings('completed'),
        },
    ];

    return (
        <View style={{ flex: 1, backgroundColor: Colors.bg }}>
            <ScrollView
                style={styles.container}
                contentContainerStyle={styles.content}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={() => loadData(false, true)}
                        colors={[Colors.primary]}
                        tintColor={Colors.primary}
                    />
                }
            >
                {/* ── Header ──────────────────────────────────────────────── */}
                <View style={[styles.header, { paddingTop: Math.max(insets.top + Spacing.xs, Spacing.md) }]}>
                    <View style={styles.headerLeft}>
                        <View style={styles.liveBadgeRow}>
                            <View style={styles.livePulseDot} />
                            <Text style={styles.liveBadgeText}>LIVE DASHBOARD</Text>
                        </View>
                        <Text style={styles.greetName} numberOfLines={1}>{garage?.name || 'My Garage'}</Text>
                        <Text style={styles.updatedTimeText}>
                            Synced: {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </Text>
                    </View>
                    <TouchableOpacity
                        style={styles.avatarWrap}
                        onPress={navigateToAccount}
                        activeOpacity={0.8}
                    >
                        {images.length > 0 ? (
                            <Image source={{ uri: images[0] }} style={styles.avatarImage} />
                        ) : (
                            <View style={styles.avatar}>
                                <Text style={styles.avatarText}>
                                    {(user?.name?.charAt(0) || garage?.name?.charAt(0) || 'G').toUpperCase()}
                                </Text>
                            </View>
                        )}
                    </TouchableOpacity>
                </View>

                {/* Profile incomplete strip */}
                {!isProfileComplete && (
                    <TouchableOpacity
                        style={styles.statusStrip}
                        onPress={navigateToAccount}
                        activeOpacity={0.8}
                    >
                        <View style={styles.statusLeft}>
                            <View style={[styles.statusDot, { backgroundColor: Colors.warning }]} />
                            <Text style={styles.statusText}>Complete your garage profile in Account</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} />
                    </TouchableOpacity>
                )}

                {/* ── Real-Time Metrics Overview ─────────────────────────────── */}
                <View style={styles.section}>
                    <View style={styles.sectionHeaderRow}>
                        <View>
                            <Text style={styles.sectionTitle}>Real-Time Booking Metrics</Text>
                            <Text style={styles.sectionSubTitle}>Live status of customer service requests</Text>
                        </View>
                        <TouchableOpacity
                            style={styles.refreshBtn}
                            onPress={() => loadData(false, true)}
                            activeOpacity={0.7}
                        >
                            <Ionicons name="sync-outline" size={15} color={Colors.primary} />
                            <Text style={styles.refreshBtnText}>Refresh</Text>
                        </TouchableOpacity>
                    </View>

                    <View style={styles.statsGrid}>
                        {STATS.map((s) => (
                            <TouchableOpacity
                                key={s.key}
                                style={[styles.statCard, { backgroundColor: s.bg, borderColor: s.borderColor }]}
                                onPress={s.onPress}
                                activeOpacity={0.75}
                            >
                                <View style={styles.statCardTop}>
                                    <View style={[styles.statIconBox, { backgroundColor: s.color + '18' }]}>
                                        <Ionicons name={s.icon} size={20} color={s.color} />
                                    </View>
                                    {s.badge ? (
                                        <View style={[styles.statBadge, { backgroundColor: s.color }]}>
                                            <Text style={styles.statBadgeText}>{s.badge}</Text>
                                        </View>
                                    ) : (
                                        <Ionicons name="chevron-forward" size={14} color={s.color + '80'} />
                                    )}
                                </View>
                                <Text style={[styles.statValue, { color: s.color }]}>{s.value}</Text>
                                <View>
                                    <Text style={styles.statLabel}>{s.label}</Text>
                                    <Text style={styles.statSubLabel}>{s.subLabel}</Text>
                                </View>
                            </TouchableOpacity>
                        ))}
                    </View>

                    {/* Secondary Metrics Summary Bar */}
                    <View style={styles.summaryBar}>
                        <TouchableOpacity
                            style={styles.summaryItem}
                            onPress={() => navigateToBookings('all')}
                            activeOpacity={0.7}
                        >
                            <Text style={styles.summaryValue}>{totalBookings}</Text>
                            <Text style={styles.summaryLabel}>Total Bookings</Text>
                        </TouchableOpacity>
                        <View style={styles.summaryDivider} />

                        <TouchableOpacity
                            style={styles.summaryItem}
                            onPress={navigateToServices}
                            activeOpacity={0.7}
                        >
                            <Text style={styles.summaryValue}>{totalServices}</Text>
                            <Text style={styles.summaryLabel}>Active Services</Text>
                        </TouchableOpacity>
                        <View style={styles.summaryDivider} />

                        <View style={styles.summaryItem}>
                            <Text style={[styles.summaryValue, { color: Colors.success }]}>
                                {totalCompletedRevenue > 0 ? `₹${totalCompletedRevenue.toLocaleString('en-IN')}` : '₹0'}
                            </Text>
                            <Text style={styles.summaryLabel}>Earned (Completed)</Text>
                        </View>
                    </View>
                </View>

                {/* ── Garage Gallery & Photos Section ─────────────────────────── */}
                <View style={styles.section}>
                    <View style={styles.sectionHeaderRow}>
                        <View>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <Text style={styles.sectionTitle}>Garage Photos & Showcase</Text>
                                {images.length > 0 && (
                                    <View style={styles.photoCountBadge}>
                                        <Text style={styles.photoCountText}>{images.length}</Text>
                                    </View>
                                )}
                            </View>
                            <Text style={styles.sectionSubTitle}>
                                Visual photos shown to customers when browsing your garage
                            </Text>
                        </View>
                        <TouchableOpacity
                            style={styles.addPhotoBtn}
                            onPress={() => setShowAddImageModal(true)}
                            activeOpacity={0.75}
                        >
                            <Ionicons name="camera-outline" size={15} color={Colors.primary} />
                            <Text style={styles.addPhotoBtnText}>+ Add Photo</Text>
                        </TouchableOpacity>
                    </View>

                    {images.length === 0 ? (
                        <TouchableOpacity
                            style={styles.emptyGalleryCard}
                            onPress={() => setShowAddImageModal(true)}
                            activeOpacity={0.8}
                        >
                            <View style={styles.emptyGalleryIconBox}>
                                <Ionicons name="images-outline" size={32} color={Colors.primary} />
                            </View>
                            <Text style={styles.emptyGalleryTitle}>Add Photos of Your Workshop</Text>
                            <Text style={styles.emptyGalleryDesc}>
                                Garages with high-quality photos of their workspace, tools, and service bays receive up to 3x more bookings!
                            </Text>
                            <View style={styles.uploadPhotoCtaBtn}>
                                <Ionicons name="cloud-upload-outline" size={16} color="#ffffff" />
                                <Text style={styles.uploadPhotoCtaText}>Upload Garage Photos</Text>
                            </View>
                        </TouchableOpacity>
                    ) : (
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={styles.galleryScroll}
                        >
                            {images.map((uri, index) => (
                                <TouchableOpacity
                                    key={`${uri}_${index}`}
                                    style={styles.galleryCard}
                                    onPress={() => setSelectedImageIndex(index)}
                                    activeOpacity={0.85}
                                >
                                    <Image source={{ uri }} style={styles.galleryImage} resizeMode="cover" />
                                    {index === 0 && (
                                        <View style={styles.coverBadge}>
                                            <Ionicons name="star" size={10} color="#92400E" />
                                            <Text style={styles.coverBadgeText}>COVER</Text>
                                        </View>
                                    )}
                                    <View style={styles.galleryOverlayGradient}>
                                        <Text style={styles.galleryIndexText}>#{index + 1}</Text>
                                    </View>
                                </TouchableOpacity>
                            ))}

                            {/* Add More Card at end of scroll */}
                            <TouchableOpacity
                                style={styles.addMoreCard}
                                onPress={() => setShowAddImageModal(true)}
                                activeOpacity={0.75}
                            >
                                <View style={styles.addMoreIconBox}>
                                    <Ionicons name="add" size={24} color={Colors.primary} />
                                </View>
                                <Text style={styles.addMoreText}>Add More</Text>
                            </TouchableOpacity>
                        </ScrollView>
                    )}
                </View>

                {/* ── Garage Services Breakdown ─────────────────────────────── */}
                <View style={styles.section}>
                    <View style={styles.sectionHeaderRow}>
                        <View>
                            <Text style={styles.sectionTitle}>Offered Services</Text>
                            <Text style={styles.sectionSubTitle}>Catalog services available for booking</Text>
                        </View>
                        <TouchableOpacity
                            style={styles.actionLink}
                            onPress={navigateToServices}
                            activeOpacity={0.7}
                        >
                            <Text style={styles.actionLinkText}>Manage Catalog</Text>
                            <Ionicons name="chevron-forward" size={14} color={Colors.primary} />
                        </TouchableOpacity>
                    </View>

                    <View style={styles.servicesCardRow}>
                        <TouchableOpacity
                            style={[styles.serviceTypeCard, { backgroundColor: '#F8FAFC' }]}
                            onPress={navigateToServices}
                            activeOpacity={0.75}
                        >
                            <View style={styles.serviceTypeIconBox}>
                                <Ionicons name="bicycle-outline" size={22} color={Colors.primary} />
                            </View>
                            <View style={styles.serviceTypeInfo}>
                                <Text style={styles.serviceTypeCount}>{bikeServicesCount}</Text>
                                <Text style={styles.serviceTypeTitle}>Bike Services</Text>
                                <Text style={styles.serviceTypeSub}>Configured with pricing</Text>
                            </View>
                            <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} />
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.serviceTypeCard, { backgroundColor: '#F8FAFC' }]}
                            onPress={navigateToServices}
                            activeOpacity={0.75}
                        >
                            <View style={[styles.serviceTypeIconBox, { backgroundColor: '#EEF2FF' }]}>
                                <Ionicons name="speedometer-outline" size={22} color="#4F46E5" />
                            </View>
                            <View style={styles.serviceTypeInfo}>
                                <Text style={styles.serviceTypeCount}>{scootyServicesCount}</Text>
                                <Text style={styles.serviceTypeTitle}>Scooty Services</Text>
                                <Text style={styles.serviceTypeSub}>Configured with pricing</Text>
                            </View>
                            <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* ── Recent Requests ───────────────────────────────────────── */}
                <View style={styles.section}>
                    <View style={styles.sectionHeaderRow}>
                        <View>
                            <Text style={styles.sectionTitle}>Recent Booking Requests</Text>
                            <Text style={styles.sectionSubTitle}>Latest customer appointments</Text>
                        </View>
                        {bookings.length > 0 && (
                            <TouchableOpacity
                                style={styles.actionLink}
                                onPress={() => navigateToBookings('all')}
                                activeOpacity={0.7}
                            >
                                <Text style={styles.actionLinkText}>View All ({bookings.length})</Text>
                                <Ionicons name="chevron-forward" size={14} color={Colors.primary} />
                            </TouchableOpacity>
                        )}
                    </View>

                    {bookings.length === 0 ? (
                        <View style={styles.emptyCard}>
                            <Ionicons name="calendar-outline" size={40} color={Colors.textTertiary} />
                            <Text style={styles.emptyTitle}>No bookings yet</Text>
                            <Text style={styles.emptyDesc}>
                                Real-time customer requests will appear here automatically when received.
                            </Text>
                        </View>
                    ) : (
                        bookings.slice(0, 5).map((b) => (
                            <TouchableOpacity
                                key={b.id}
                                style={styles.bookingRow}
                                onPress={() => navigateToBookings(b.status)}
                                activeOpacity={0.75}
                            >
                                <View style={styles.bookingLeft}>
                                    <View style={styles.bookingAvatarBox}>
                                        <Ionicons
                                            name={b.vehicle_type === 'scooty' ? 'speedometer-outline' : 'bicycle-outline'}
                                            size={18}
                                            color={Colors.primary}
                                        />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <View style={styles.bookingTitleRow}>
                                            <Text style={styles.bookingName} numberOfLines={1}>{b.customer_name || 'Customer'}</Text>
                                            <Text style={styles.vehicleTag}>
                                                {(b.vehicle_type || 'Vehicle').toUpperCase()}
                                            </Text>
                                        </View>
                                        <Text style={styles.bookingServices} numberOfLines={1}>
                                            {b.selected_services || b.bike_details || 'General Service'}
                                        </Text>
                                        <Text style={styles.bookingMeta}>
                                            📅 {b.date} · ⏰ {b.time}
                                            {b.grand_total ? ` · ₹${b.grand_total}` : ''}
                                        </Text>
                                    </View>
                                </View>
                                <View style={[styles.statusPill, getStatusBg(b.status)]}>
                                    <Text style={[styles.statusPillText, getStatusColor(b.status)]}>
                                        {b.status.replace('_', ' ')}
                                    </Text>
                                </View>
                            </TouchableOpacity>
                        ))
                    )}
                </View>

                {/* ── Quick Garage Actions ──────────────────────────────────── */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Quick Actions</Text>
                    <View style={styles.quickGrid}>
                        <TouchableOpacity
                            style={styles.quickActionCard}
                            onPress={() => setShowAddImageModal(true)}
                            activeOpacity={0.75}
                        >
                            <View style={[styles.quickIconBox, { backgroundColor: '#FDF2F8' }]}>
                                <Ionicons name="images-outline" size={20} color="#DB2777" />
                            </View>
                            <Text style={styles.quickActionTitle}>Add Photos</Text>
                            <Text style={styles.quickActionSub}>{images.length} photos</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.quickActionCard}
                            onPress={navigateToServices}
                            activeOpacity={0.75}
                        >
                            <View style={[styles.quickIconBox, { backgroundColor: Colors.primaryLight }]}>
                                <Ionicons name="construct-outline" size={20} color={Colors.primary} />
                            </View>
                            <Text style={styles.quickActionTitle}>Edit Services</Text>
                            <Text style={styles.quickActionSub}>Update prices</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.quickActionCard}
                            onPress={navigateToSchedule}
                            activeOpacity={0.75}
                        >
                            <View style={[styles.quickIconBox, { backgroundColor: '#F0FDFA' }]}>
                                <Ionicons name="time-outline" size={20} color="#0D9488" />
                            </View>
                            <Text style={styles.quickActionTitle}>Working Hours</Text>
                            <Text style={styles.quickActionSub}>Set timings</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* ── Garage Info Card ──────────────────────────────────────── */}
                <View style={styles.section}>
                    <View style={styles.sectionHeaderRow}>
                        <Text style={styles.sectionTitle}>Garage Details</Text>
                        <TouchableOpacity
                            style={styles.actionLink}
                            onPress={navigateToAccount}
                            activeOpacity={0.7}
                        >
                            <Text style={styles.actionLinkText}>Edit</Text>
                            <Ionicons name="chevron-forward" size={14} color={Colors.primary} />
                        </TouchableOpacity>
                    </View>
                    <View style={styles.infoCard}>
                        {[
                            { icon: 'location-outline' as const, label: 'Address', value: garage?.address || 'Not set' },
                            { icon: 'call-outline' as const, label: 'Phone', value: garage?.phone || 'Not set' },
                        ].map((item, i, arr) => (
                            <View key={item.label}>
                                <View style={styles.infoRow}>
                                    <View style={styles.infoIconBox}>
                                        <Ionicons name={item.icon} size={16} color={Colors.textSecondary} />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.infoLabel}>{item.label}</Text>
                                        <Text style={styles.infoValue}>{item.value}</Text>
                                    </View>
                                </View>
                                {i < arr.length - 1 && <View style={styles.divider} />}
                            </View>
                        ))}
                    </View>
                </View>

            </ScrollView>

            {/* ── Add Image Selection Modal ───────────────────────────────── */}
            <Modal
                visible={showAddImageModal}
                transparent
                animationType="slide"
                onRequestClose={() => {
                    setShowAddImageModal(false);
                    setShowUrlInput(false);
                    setShowSamplePicker(false);
                }}
            >
                <Pressable
                    style={styles.modalBackdrop}
                    onPress={() => {
                        setShowAddImageModal(false);
                        setShowUrlInput(false);
                        setShowSamplePicker(false);
                    }}
                >
                    <Pressable style={styles.bottomSheetCard} onPress={(e) => e.stopPropagation()}>
                        <View style={styles.sheetHandle} />
                        <View style={styles.sheetHeader}>
                            <Text style={styles.sheetTitle}>Add Garage Photo</Text>
                            <TouchableOpacity
                                onPress={() => {
                                    setShowAddImageModal(false);
                                    setShowUrlInput(false);
                                    setShowSamplePicker(false);
                                }}
                            >
                                <Ionicons name="close-circle-outline" size={24} color={Colors.textTertiary} />
                            </TouchableOpacity>
                        </View>
                        <Text style={styles.sheetSub}>
                            Showcase your workshop, service bays, and equipment to attract customers.
                        </Text>

                        {uploadingImage ? (
                            <View style={{ paddingVertical: Spacing.xl, alignItems: 'center', gap: 10 }}>
                                <ActivityIndicator size="large" color={Colors.primary} />
                                <Text style={{ ...Typography.body, color: Colors.textSecondary }}>Processing photo...</Text>
                            </View>
                        ) : showSamplePicker ? (
                            <View style={{ gap: Spacing.sm }}>
                                <Text style={{ ...Typography.body, fontWeight: '700', color: Colors.textPrimary }}>
                                    Select a High Quality Workshop Photo:
                                </Text>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
                                    {GARAGE_SAMPLE_PHOTOS.map((sample) => (
                                        <TouchableOpacity
                                            key={sample.title}
                                            style={styles.samplePickCard}
                                            onPress={() => handleSelectSample(sample.uri)}
                                            activeOpacity={0.8}
                                        >
                                            <Image source={{ uri: sample.uri }} style={styles.samplePickImage} />
                                            <Text style={styles.samplePickTitle} numberOfLines={1}>{sample.title}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>
                                <TouchableOpacity
                                    style={styles.urlCancelBtn}
                                    onPress={() => setShowSamplePicker(false)}
                                >
                                    <Text style={styles.urlCancelText}>Back to options</Text>
                                </TouchableOpacity>
                            </View>
                        ) : !showUrlInput ? (
                            <View style={{ gap: Spacing.sm }}>
                                <View style={styles.pickerOptionsGrid}>
                                    <TouchableOpacity
                                        style={styles.pickerOptionCard}
                                        onPress={handleTakePhoto}
                                        activeOpacity={0.8}
                                    >
                                        <View style={[styles.pickerIconBox, { backgroundColor: Colors.primaryLight }]}>
                                            <Ionicons name="camera" size={24} color={Colors.primary} />
                                        </View>
                                        <Text style={styles.pickerOptionTitle}>Take Photo</Text>
                                        <Text style={styles.pickerOptionSub}>Camera</Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        style={styles.pickerOptionCard}
                                        onPress={handlePickFromGallery}
                                        activeOpacity={0.8}
                                    >
                                        <View style={[styles.pickerIconBox, { backgroundColor: '#EFF6FF' }]}>
                                            <Ionicons name="images" size={24} color="#1D4ED8" />
                                        </View>
                                        <Text style={styles.pickerOptionTitle}>Gallery</Text>
                                        <Text style={styles.pickerOptionSub}>Device Photos</Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        style={styles.pickerOptionCard}
                                        onPress={() => setShowSamplePicker(true)}
                                        activeOpacity={0.8}
                                    >
                                        <View style={[styles.pickerIconBox, { backgroundColor: '#FEF3C7' }]}>
                                            <Ionicons name="sparkles" size={24} color="#D97706" />
                                        </View>
                                        <Text style={styles.pickerOptionTitle}>Samples</Text>
                                        <Text style={styles.pickerOptionSub}>Workshop Pics</Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        style={styles.pickerOptionCard}
                                        onPress={() => setShowUrlInput(true)}
                                        activeOpacity={0.8}
                                    >
                                        <View style={[styles.pickerIconBox, { backgroundColor: '#F0FDFA' }]}>
                                            <Ionicons name="link" size={24} color="#0D9488" />
                                        </View>
                                        <Text style={styles.pickerOptionTitle}>Web URL</Text>
                                        <Text style={styles.pickerOptionSub}>Paste Link</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        ) : (
                            <View style={styles.urlInputWrap}>
                                <Text style={styles.urlInputLabel}>Image Web URL (http:// or https://)</Text>
                                <TextInput
                                    style={styles.urlTextInput}
                                    placeholder="https://example.com/garage-photo.jpg"
                                    placeholderTextColor={Colors.textTertiary}
                                    value={imageUrlInput}
                                    onChangeText={setImageUrlInput}
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                    keyboardType="url"
                                />
                                <View style={styles.urlButtonRow}>
                                    <TouchableOpacity
                                        style={styles.urlCancelBtn}
                                        onPress={() => setShowUrlInput(false)}
                                    >
                                        <Text style={styles.urlCancelText}>Back</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={styles.urlSubmitBtn}
                                        onPress={handleAddUrl}
                                    >
                                        <Text style={styles.urlSubmitText}>Add Photo</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        )}
                    </Pressable>
                </Pressable>
            </Modal>

            {/* ── Full Screen Photo Viewer Modal ──────────────────────────── */}
            <Modal
                visible={selectedImageIndex !== null}
                transparent
                animationType="fade"
                onRequestClose={() => setSelectedImageIndex(null)}
            >
                {selectedImageIndex !== null && (
                    <View style={styles.fullViewerBackdrop}>
                        {/* Top Bar */}
                        <View style={styles.fullViewerTopBar}>
                            <TouchableOpacity
                                style={styles.fullViewerCloseBtn}
                                onPress={() => setSelectedImageIndex(null)}
                            >
                                <Ionicons name="close" size={24} color="#ffffff" />
                            </TouchableOpacity>
                            <Text style={styles.fullViewerCounter}>
                                Photo {selectedImageIndex + 1} of {images.length}
                            </Text>
                            <TouchableOpacity
                                style={styles.fullViewerDeleteBtn}
                                onPress={() => handleDeleteImage(selectedImageIndex)}
                            >
                                <Ionicons name="trash-outline" size={20} color="#EF4444" />
                            </TouchableOpacity>
                        </View>

                        {/* Image View */}
                        <View style={styles.fullImageWrap}>
                            <Image
                                source={{ uri: images[selectedImageIndex] }}
                                style={styles.fullImage}
                                resizeMode="contain"
                            />
                        </View>

                        {/* Bottom Actions */}
                        <View style={styles.fullViewerBottomBar}>
                            {selectedImageIndex > 0 ? (
                                <TouchableOpacity
                                    style={styles.setCoverBtn}
                                    onPress={() => handleSetAsCover(selectedImageIndex)}
                                    activeOpacity={0.8}
                                >
                                    <Ionicons name="star" size={16} color="#92400E" />
                                    <Text style={styles.setCoverBtnText}>Set as Main Cover Photo</Text>
                                </TouchableOpacity>
                            ) : (
                                <View style={styles.isCoverPill}>
                                    <Ionicons name="checkmark-circle" size={16} color="#15803D" />
                                    <Text style={styles.isCoverPillText}>Currently Main Cover Photo</Text>
                                </View>
                            )}

                            {/* Prev / Next controls if multiple photos */}
                            {images.length > 1 && (
                                <View style={styles.navRow}>
                                    <TouchableOpacity
                                        style={[styles.navBtn, selectedImageIndex === 0 && styles.navBtnDisabled]}
                                        disabled={selectedImageIndex === 0}
                                        onPress={() => setSelectedImageIndex((prev) => (prev !== null && prev > 0 ? prev - 1 : prev))}
                                    >
                                        <Ionicons name="chevron-back" size={20} color={selectedImageIndex === 0 ? '#6B7280' : '#FFFFFF'} />
                                        <Text style={[styles.navBtnText, selectedImageIndex === 0 && { color: '#6B7280' }]}>Previous</Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        style={[styles.navBtn, selectedImageIndex === images.length - 1 && styles.navBtnDisabled]}
                                        disabled={selectedImageIndex === images.length - 1}
                                        onPress={() => setSelectedImageIndex((prev) => (prev !== null && prev < images.length - 1 ? prev + 1 : prev))}
                                    >
                                        <Text style={[styles.navBtnText, selectedImageIndex === images.length - 1 && { color: '#6B7280' }]}>Next</Text>
                                        <Ionicons name="chevron-forward" size={20} color={selectedImageIndex === images.length - 1 ? '#6B7280' : '#FFFFFF'} />
                                    </TouchableOpacity>
                                </View>
                            )}
                        </View>
                    </View>
                )}
            </Modal>

            <Toast visible={toast.visible} message={toast.message} type={toast.type} onHide={hideToast} />
        </View>
    );
}

function getStatusBg(s: string) {
    const m: Record<string, object> = {
        pending: { backgroundColor: '#FEF3C7' },
        accepted: { backgroundColor: '#CCFBF1' },
        rejected: { backgroundColor: '#FEE2E2' },
        in_progress: { backgroundColor: '#DBEAFE' },
        completed: { backgroundColor: '#DCFCE7' },
        cancelled: { backgroundColor: Colors.surfaceAlt },
    };
    return m[s] ?? m.pending;
}

function getStatusColor(s: string) {
    const m: Record<string, object> = {
        pending: { color: '#92400E' },
        accepted: { color: '#0F766E' },
        rejected: { color: '#991B1B' },
        in_progress: { color: '#1E40AF' },
        completed: { color: '#15803D' },
        cancelled: { color: '#374151' },
    };
    return m[s] ?? m.pending;
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.bg },
    content: { paddingBottom: 36 },
    loadingContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: Colors.bg,
        gap: Spacing.md,
    },
    loadingText: {
        ...Typography.caption,
        color: Colors.textSecondary,
        fontWeight: '500',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: Colors.surface,
        paddingHorizontal: Spacing.md,
        paddingBottom: Spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: Colors.borderLight,
    },
    headerLeft: { flex: 1, paddingRight: Spacing.sm },
    liveBadgeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 2,
    },
    livePulseDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#10B981',
    },
    liveBadgeText: {
        fontSize: 10,
        fontWeight: '700',
        letterSpacing: 0.8,
        color: '#059669',
    },
    greetName: { ...Typography.h1, color: Colors.textPrimary, marginTop: 1 },
    updatedTimeText: {
        ...Typography.caption,
        fontSize: 11,
        color: Colors.textTertiary,
        marginTop: 2,
    },
    avatarWrap: {
        width: 48,
        height: 48,
        borderRadius: 24,
        overflow: 'hidden',
        borderWidth: 2,
        borderColor: Colors.primary,
        ...Shadow.sm,
    },
    avatarImage: {
        width: '100%',
        height: '100%',
    },
    avatar: {
        width: '100%',
        height: '100%',
        backgroundColor: Colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarText: { ...Typography.h3, color: '#fff', fontWeight: '700' },
    statusStrip: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#FFFBEB',
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
        borderBottomWidth: 1,
        borderBottomColor: '#FDE68A',
        marginBottom: Spacing.xs,
    },
    statusLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    statusDot: { width: 8, height: 8, borderRadius: 4 },
    statusText: { ...Typography.caption, color: '#92400E', fontWeight: '600' },
    section: {
        backgroundColor: Colors.surface,
        padding: Spacing.md,
        marginBottom: Spacing.sm,
        borderBottomWidth: 1,
        borderBottomColor: Colors.borderLight,
    },
    sectionHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: Spacing.md,
    },
    sectionTitle: { ...Typography.h2, color: Colors.textPrimary },
    sectionSubTitle: { ...Typography.caption, color: Colors.textTertiary, marginTop: 2 },
    refreshBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: Colors.primaryLight,
        paddingHorizontal: Spacing.sm,
        paddingVertical: 5,
        borderRadius: Radius.full,
    },
    refreshBtnText: {
        fontSize: 12,
        fontWeight: '600',
        color: Colors.primary,
    },
    actionLink: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2,
    },
    actionLinkText: {
        fontSize: 13,
        fontWeight: '600',
        color: Colors.primary,
    },
    statsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: Spacing.sm,
    },
    statCard: {
        width: '48.2%',
        borderRadius: Radius.lg,
        padding: Spacing.md,
        borderWidth: 1,
        gap: 2,
    },
    statCardTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 6,
    },
    statIconBox: {
        width: 36,
        height: 36,
        borderRadius: Radius.md,
        alignItems: 'center',
        justifyContent: 'center',
    },
    statBadge: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: Radius.full,
    },
    statBadgeText: {
        color: '#ffffff',
        fontSize: 10,
        fontWeight: '700',
    },
    statValue: {
        fontSize: 28,
        fontWeight: '800',
        lineHeight: 34,
    },
    statLabel: {
        ...Typography.body,
        fontWeight: '700',
        color: Colors.textPrimary,
        fontSize: 13,
    },
    statSubLabel: {
        ...Typography.caption,
        fontSize: 11,
        color: Colors.textTertiary,
    },
    summaryBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: Colors.surfaceAlt,
        borderRadius: Radius.md,
        paddingVertical: Spacing.sm,
        paddingHorizontal: Spacing.md,
        marginTop: Spacing.md,
    },
    summaryItem: {
        flex: 1,
        alignItems: 'center',
    },
    summaryValue: {
        fontSize: 15,
        fontWeight: '700',
        color: Colors.textPrimary,
    },
    summaryLabel: {
        fontSize: 11,
        color: Colors.textTertiary,
        marginTop: 2,
    },
    summaryDivider: {
        width: 1,
        height: 24,
        backgroundColor: Colors.border,
    },
    // ── Photo Gallery Styles ──────────────────────────────────────────────────
    photoCountBadge: {
        backgroundColor: Colors.primaryLight,
        paddingHorizontal: 7,
        paddingVertical: 2,
        borderRadius: Radius.full,
    },
    photoCountText: {
        fontSize: 11,
        fontWeight: '800',
        color: Colors.primary,
    },
    addPhotoBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: Colors.primaryLight,
        paddingHorizontal: Spacing.sm,
        paddingVertical: 6,
        borderRadius: Radius.full,
    },
    addPhotoBtnText: {
        fontSize: 12,
        fontWeight: '700',
        color: Colors.primary,
    },
    emptyGalleryCard: {
        alignItems: 'center',
        backgroundColor: '#F8FAFC',
        borderWidth: 1.5,
        borderColor: '#E2E8F0',
        borderStyle: 'dashed',
        borderRadius: Radius.lg,
        padding: Spacing.lg,
        gap: Spacing.xs,
    },
    emptyGalleryIconBox: {
        width: 54,
        height: 54,
        borderRadius: 27,
        backgroundColor: Colors.primaryLight,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: Spacing.xs,
    },
    emptyGalleryTitle: {
        ...Typography.h3,
        color: Colors.textPrimary,
        textAlign: 'center',
    },
    emptyGalleryDesc: {
        ...Typography.body,
        fontSize: 12,
        color: Colors.textTertiary,
        textAlign: 'center',
        lineHeight: 18,
        maxWidth: 300,
        marginBottom: Spacing.sm,
    },
    uploadPhotoCtaBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: Colors.primary,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
        borderRadius: Radius.md,
        ...Shadow.sm,
    },
    uploadPhotoCtaText: {
        color: '#ffffff',
        fontSize: 13,
        fontWeight: '700',
    },
    galleryScroll: {
        gap: Spacing.sm,
        paddingRight: Spacing.md,
    },
    galleryCard: {
        width: 140,
        height: 105,
        borderRadius: Radius.md,
        overflow: 'hidden',
        backgroundColor: Colors.surfaceAlt,
        borderWidth: 1,
        borderColor: Colors.borderLight,
        position: 'relative',
    },
    galleryImage: {
        width: '100%',
        height: '100%',
    },
    coverBadge: {
        position: 'absolute',
        top: 6,
        left: 6,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        backgroundColor: '#FEF3C7',
        borderWidth: 1,
        borderColor: '#FDE68A',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: Radius.full,
        ...Shadow.sm,
    },
    coverBadgeText: {
        fontSize: 9,
        fontWeight: '800',
        color: '#92400E',
        letterSpacing: 0.5,
    },
    galleryOverlayGradient: {
        position: 'absolute',
        bottom: 4,
        right: 6,
        backgroundColor: 'rgba(0,0,0,0.55)',
        paddingHorizontal: 5,
        paddingVertical: 2,
        borderRadius: 4,
    },
    galleryIndexText: {
        fontSize: 10,
        fontWeight: '700',
        color: '#ffffff',
    },
    addMoreCard: {
        width: 100,
        height: 105,
        borderRadius: Radius.md,
        borderWidth: 1.5,
        borderColor: Colors.border,
        borderStyle: 'dashed',
        backgroundColor: Colors.surfaceAlt,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
    },
    addMoreIconBox: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: Colors.primaryLight,
        alignItems: 'center',
        justifyContent: 'center',
    },
    addMoreText: {
        fontSize: 11,
        fontWeight: '700',
        color: Colors.primary,
    },
    // ── Sample Picker Card ───────────────────────────────────────────────────
    samplePickCard: {
        width: 130,
        height: 110,
        borderRadius: Radius.md,
        overflow: 'hidden',
        backgroundColor: Colors.surfaceAlt,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    samplePickImage: {
        width: '100%',
        height: 75,
    },
    samplePickTitle: {
        fontSize: 10,
        fontWeight: '700',
        color: Colors.textPrimary,
        padding: 4,
        textAlign: 'center',
    },
    // ── Offered Services Styles ───────────────────────────────────────────────
    servicesCardRow: {
        flexDirection: 'row',
        gap: Spacing.sm,
    },
    serviceTypeCard: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        padding: Spacing.md,
        borderRadius: Radius.lg,
        borderWidth: 1,
        borderColor: Colors.borderLight,
        gap: Spacing.sm,
    },
    serviceTypeIconBox: {
        width: 40,
        height: 40,
        borderRadius: Radius.md,
        backgroundColor: Colors.primaryLight,
        alignItems: 'center',
        justifyContent: 'center',
    },
    serviceTypeInfo: {
        flex: 1,
    },
    serviceTypeCount: {
        fontSize: 18,
        fontWeight: '800',
        color: Colors.textPrimary,
    },
    serviceTypeTitle: {
        fontSize: 12,
        fontWeight: '700',
        color: Colors.textPrimary,
    },
    serviceTypeSub: {
        fontSize: 10,
        color: Colors.textTertiary,
    },
    emptyCard: {
        alignItems: 'center',
        paddingVertical: Spacing.xl,
        gap: Spacing.sm,
        backgroundColor: Colors.surfaceAlt,
        borderRadius: Radius.md,
        paddingHorizontal: Spacing.lg,
    },
    emptyTitle: { ...Typography.h3, color: Colors.textSecondary },
    emptyDesc: { ...Typography.body, color: Colors.textTertiary, textAlign: 'center', fontSize: 13 },
    bookingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: Spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: Colors.borderLight,
    },
    bookingLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
        flex: 1,
        paddingRight: Spacing.sm,
    },
    bookingAvatarBox: {
        width: 38,
        height: 38,
        borderRadius: Radius.md,
        backgroundColor: Colors.primaryLight,
        alignItems: 'center',
        justifyContent: 'center',
    },
    bookingTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    bookingName: {
        ...Typography.body,
        color: Colors.textPrimary,
        fontWeight: '700',
        fontSize: 14,
    },
    vehicleTag: {
        fontSize: 9,
        fontWeight: '800',
        color: Colors.primary,
        backgroundColor: Colors.primaryLight,
        paddingHorizontal: 5,
        paddingVertical: 1,
        borderRadius: 4,
    },
    bookingServices: {
        fontSize: 12,
        color: Colors.textSecondary,
        marginTop: 2,
    },
    bookingMeta: {
        ...Typography.caption,
        color: Colors.textTertiary,
        marginTop: 2,
        fontSize: 11,
    },
    statusPill: {
        paddingHorizontal: Spacing.sm,
        paddingVertical: 5,
        borderRadius: Radius.full,
    },
    statusPillText: {
        ...Typography.overline,
        fontWeight: '700',
        textTransform: 'capitalize',
        fontSize: 10,
    },
    quickGrid: {
        flexDirection: 'row',
        gap: Spacing.sm,
    },
    quickActionCard: {
        flex: 1,
        backgroundColor: Colors.surfaceAlt,
        borderRadius: Radius.md,
        padding: Spacing.sm,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: Colors.borderLight,
        gap: 4,
    },
    quickIconBox: {
        width: 36,
        height: 36,
        borderRadius: Radius.sm,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 2,
    },
    quickActionTitle: {
        fontSize: 12,
        fontWeight: '700',
        color: Colors.textPrimary,
        textAlign: 'center',
    },
    quickActionSub: {
        fontSize: 10,
        color: Colors.textTertiary,
        textAlign: 'center',
    },
    infoCard: {
        borderRadius: Radius.lg,
        borderWidth: 1,
        borderColor: Colors.border,
        overflow: 'hidden',
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.md,
        padding: Spacing.md,
    },
    infoIconBox: {
        width: 32,
        height: 32,
        borderRadius: Radius.sm,
        backgroundColor: Colors.surfaceAlt,
        alignItems: 'center',
        justifyContent: 'center',
    },
    infoLabel: {
        ...Typography.caption,
        color: Colors.textTertiary,
        textTransform: 'uppercase',
        letterSpacing: 0.4,
    },
    infoValue: {
        ...Typography.body,
        color: Colors.textPrimary,
        marginTop: 2,
    },
    divider: {
        height: 1,
        backgroundColor: Colors.borderLight,
        marginHorizontal: Spacing.md,
    },
    // ── Modal Styles ──────────────────────────────────────────────────────────
    modalBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    bottomSheetCard: {
        backgroundColor: Colors.surface,
        borderTopLeftRadius: Radius.xl,
        borderTopRightRadius: Radius.xl,
        padding: Spacing.lg,
        paddingBottom: 40,
        gap: Spacing.md,
        ...Shadow.lg,
    },
    sheetHandle: {
        width: 40,
        height: 4,
        borderRadius: 2,
        backgroundColor: Colors.border,
        alignSelf: 'center',
        marginBottom: Spacing.xs,
    },
    sheetHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    sheetTitle: {
        ...Typography.h2,
        color: Colors.textPrimary,
    },
    sheetSub: {
        ...Typography.caption,
        color: Colors.textSecondary,
        fontSize: 12,
        lineHeight: 16,
    },
    pickerOptionsGrid: {
        flexDirection: 'row',
        gap: Spacing.xs,
        marginTop: Spacing.sm,
    },
    pickerOptionCard: {
        flex: 1,
        backgroundColor: Colors.surfaceAlt,
        borderRadius: Radius.lg,
        padding: Spacing.sm,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: Colors.borderLight,
        gap: 3,
    },
    pickerIconBox: {
        width: 42,
        height: 42,
        borderRadius: Radius.md,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 2,
    },
    pickerOptionTitle: {
        fontSize: 11,
        fontWeight: '700',
        color: Colors.textPrimary,
        textAlign: 'center',
    },
    pickerOptionSub: {
        fontSize: 9,
        color: Colors.textTertiary,
        textAlign: 'center',
    },
    urlInputWrap: {
        gap: Spacing.sm,
        marginTop: Spacing.sm,
    },
    urlInputLabel: {
        ...Typography.caption,
        color: Colors.textSecondary,
        fontWeight: '600',
    },
    urlTextInput: {
        backgroundColor: Colors.surfaceAlt,
        borderWidth: 1,
        borderColor: Colors.border,
        borderRadius: Radius.md,
        paddingHorizontal: Spacing.md,
        paddingVertical: 12,
        fontSize: 14,
        color: Colors.textPrimary,
    },
    urlButtonRow: {
        flexDirection: 'row',
        gap: Spacing.sm,
        marginTop: Spacing.xs,
    },
    urlCancelBtn: {
        flex: 1,
        backgroundColor: Colors.surfaceAlt,
        borderRadius: Radius.md,
        paddingVertical: 12,
        alignItems: 'center',
    },
    urlCancelText: {
        fontWeight: '600',
        color: Colors.textSecondary,
    },
    urlSubmitBtn: {
        flex: 2,
        backgroundColor: Colors.primary,
        borderRadius: Radius.md,
        paddingVertical: 12,
        alignItems: 'center',
    },
    urlSubmitText: {
        fontWeight: '700',
        color: '#ffffff',
    },
    // ── Full Photo Viewer Styles ──────────────────────────────────────────────
    fullViewerBackdrop: {
        flex: 1,
        backgroundColor: '#0F172A',
        justifyContent: 'space-between',
    },
    fullViewerTopBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: Spacing.md,
        paddingTop: Spacing.lg,
        paddingBottom: Spacing.md,
        backgroundColor: 'rgba(0,0,0,0.4)',
    },
    fullViewerCloseBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(255,255,255,0.15)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    fullViewerCounter: {
        fontSize: 14,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    fullViewerDeleteBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(239,68,68,0.2)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    fullImageWrap: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    fullImage: {
        width: SCREEN_WIDTH,
        height: '80%',
    },
    fullViewerBottomBar: {
        paddingHorizontal: Spacing.md,
        paddingBottom: 44,
        paddingTop: Spacing.md,
        backgroundColor: 'rgba(0,0,0,0.6)',
        gap: Spacing.md,
    },
    setCoverBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        backgroundColor: '#FDE68A',
        paddingVertical: 12,
        borderRadius: Radius.md,
    },
    setCoverBtnText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#92400E',
    },
    isCoverPill: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        backgroundColor: '#DCFCE7',
        paddingVertical: 10,
        borderRadius: Radius.md,
    },
    isCoverPillText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#15803D',
    },
    navRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    navBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: Radius.md,
        backgroundColor: 'rgba(255,255,255,0.12)',
    },
    navBtnDisabled: {
        opacity: 0.4,
    },
    navBtnText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#FFFFFF',
    },
});
