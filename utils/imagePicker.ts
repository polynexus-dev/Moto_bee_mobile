import { Alert } from 'react-native';

export type PickImageResult = {
    canceled: boolean;
    assets?: { uri: string }[];
};

// Preset high quality workshop sample photos for instant selection
export const GARAGE_SAMPLE_PHOTOS = [
    {
        title: 'Modern Workshop & Bay',
        uri: 'https://images.unsplash.com/photo-1613214149922-f1809c99b414?auto=format&fit=crop&w=800&q=80',
    },
    {
        title: 'Bike Service Ramp',
        uri: 'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?auto=format&fit=crop&w=800&q=80',
    },
    {
        title: 'Engine Repair & Tools',
        uri: 'https://images.unsplash.com/photo-1486006920555-c77dce18193b?auto=format&fit=crop&w=800&q=80',
    },
    {
        title: 'Mechanic Work Area',
        uri: 'https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?auto=format&fit=crop&w=800&q=80',
    },
    {
        title: 'Diagnostic Station',
        uri: 'https://images.unsplash.com/photo-1580273916550-e323be2ae537?auto=format&fit=crop&w=800&q=80',
    },
    {
        title: 'Premium Garage Front',
        uri: 'https://images.unsplash.com/photo-1517524008697-84bbe3c3fd98?auto=format&fit=crop&w=800&q=80',
    },
];

function getImagePicker() {
    try {
        const mod = require('expo-image-picker');
        return mod;
    } catch {
        return null;
    }
}

export function isNativePickerSupported(): boolean {
    const mod = getImagePicker();
    return !!(mod && typeof mod.launchCameraAsync === 'function');
}

export async function pickFromGallerySafe(): Promise<PickImageResult> {
    try {
        const ImagePicker = getImagePicker();
        if (!ImagePicker) {
            showRebuildNotice('Gallery');
            return { canceled: true };
        }

        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permission Required', 'Gallery permission is required to select photos.');
            return { canceled: true };
        }

        const res = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsMultipleSelection: true,
            quality: 0.8,
        });
        return res;
    } catch (e: any) {
        showRebuildNotice('Gallery');
        return { canceled: true };
    }
}

export async function takePhotoSafe(): Promise<PickImageResult> {
    try {
        const ImagePicker = getImagePicker();
        if (!ImagePicker) {
            showRebuildNotice('Camera');
            return { canceled: true };
        }

        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permission Required', 'Camera permission is required to capture photos.');
            return { canceled: true };
        }

        const res = await ImagePicker.launchCameraAsync({
            mediaTypes: ['images'],
            quality: 0.8,
        });
        return res;
    } catch (e: any) {
        showRebuildNotice('Camera');
        return { canceled: true };
    }
}

function showRebuildNotice(feature: string) {
    Alert.alert(
        `${feature} Needs Android App Rebuild`,
        `Because 'expo-image-picker' was newly installed, the running Android app must be rebuilt to link the native camera module.\n\nPlease restart your terminal and run:\nnpx expo run:android\n\nIn the meantime, you can use the Sample Workshop Photos or Web URL options!`,
        [{ text: 'OK' }]
    );
}
