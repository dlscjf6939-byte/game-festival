import React, {useMemo, useState} from 'react';
import {useNavigation, type NavigationProp} from '@react-navigation/native';
import {
  Image,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import {launchImageLibrary, type Asset as PickerAsset} from 'react-native-image-picker';
import {useAuth} from '../auth/AuthProvider';
import {icon} from '../assets/icons';
import {image} from '../assets/images';
import {AnimatedPressable} from '../components/AnimatedPressable';
import {AppLoading} from '../components/AppLoading';
import {FONTS} from '../constants/theme';
import {withMinimumLoadingTime} from '../utils/loading';
import {getProfileImageUriFromRecord} from '../utils/profileImage';
import type {RootStackParamList} from '../navigation/types';

const API_BASE = 'http://121.254.240.93:8090';
const PROFILE_UPDATE_METHOD = 'PUT';

type ProfileChoice = 'default' | 'album';

type ProfileUpdateResponse = {
  code?: string;
  data?: Record<string, unknown>;
  message?: string;
  success?: boolean;
};

function getImageFileInfo(asset: PickerAsset): {name: string; type: string} {
  const uri = asset.uri ?? '';
  const cleanedUri = uri.split('?')[0];
  const baseFileName = asset.fileName?.trim() || cleanedUri.split('/').pop()?.trim() || `profile-${Date.now()}.jpg`;
  const safeFileName = baseFileName
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9._-]/g, '')
    .replace(/^$/, `profile-${Date.now()}.jpg`);
  const loweredFileName = safeFileName.toLowerCase();

  if (asset.type?.trim()) {
    return {name: safeFileName, type: asset.type.trim()};
  }

  if (loweredFileName.endsWith('.png')) {
    return {name: safeFileName, type: 'image/png'};
  }

  if (loweredFileName.endsWith('.webp')) {
    return {name: safeFileName, type: 'image/webp'};
  }

  if (loweredFileName.endsWith('.heic')) {
    return {name: safeFileName, type: 'image/heic'};
  }

  return {name: safeFileName, type: 'image/jpeg'};
}

function normalizeUploadUri(uri: string): string {
  if (Platform.OS === 'ios' && uri.startsWith('file://')) {
    return uri.replace('file://', '');
  }

  return uri;
}

function getProfileImageUri(profile: Record<string, unknown> | undefined, fallbackUri: string | null): string | null {
  return getProfileImageUriFromRecord(profile) ?? fallbackUri;
}

export function ProfileSetupScreen(): JSX.Element {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const {auth, setAuth} = useAuth();
  const {height} = useWindowDimensions();
  const [selectedChoice, setSelectedChoice] = useState<ProfileChoice>('default');
  const [selectedImageAsset, setSelectedImageAsset] = useState<PickerAsset | null>(null);
  const [selectedImageUri, setSelectedImageUri] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const currentProfileImageUri = getProfileImageUriFromRecord(auth?.profile);
  const selectedProfilePreview = useMemo(() => {
    if (selectedChoice === 'album' && selectedImageUri) {
      return {uri: selectedImageUri};
    }

    if (currentProfileImageUri) {
      return {uri: currentProfileImageUri};
    }

    return image.profile;
  }, [currentProfileImageUri, selectedChoice, selectedImageUri]);
  const isCompactHeight = height < 720;
  const canGoBack = navigation.canGoBack();

  const openImageLibrary = async () => {
    setErrorMessage(null);

    const result = await launchImageLibrary({
      mediaType: 'photo',
      quality: 0.8,
      selectionLimit: 1,
    });

    if (result.didCancel) {
      return;
    }

    if (result.errorCode) {
      setErrorMessage(result.errorMessage || '사진을 불러오지 못했습니다.');
      return;
    }

    const asset = result.assets?.[0];

    if (!asset?.uri) {
      setErrorMessage('선택한 사진을 확인할 수 없습니다.');
      return;
    }

    setSelectedImageUri(asset.uri);
    setSelectedImageAsset(asset);
    setSelectedChoice('album');
  };

  const updateProfileImage = async (asset: PickerAsset): Promise<Record<string, unknown> | null> => {
    if (!auth?.accessToken || !asset.uri) {
      throw new Error('프로필을 업데이트할 수 없습니다.');
    }

    const {name, type} = getImageFileInfo(asset);
    const formData = new FormData();
    formData.append('profileFile', {
      name,
      type,
      uri: normalizeUploadUri(asset.uri),
    } as any);

    const response = await withMinimumLoadingTime(
      fetch(`${API_BASE}/api/employee/profile`, {
        body: formData,
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${auth.accessToken}`,
        },
        method: PROFILE_UPDATE_METHOD,
      }),
    );

    const responseText = await response.text();
    let responseBody: ProfileUpdateResponse | null = null;

    try {
      responseBody = JSON.parse(responseText) as ProfileUpdateResponse;
    } catch {
      responseBody = null;
    }

    if (!response.ok || responseBody?.success === false) {
      throw new Error(responseBody?.message || responseText || '프로필 업데이트에 실패했습니다.');
    }

    return responseBody?.data ?? null;
  };

  const completeProfileSetup = async () => {
    if (!auth) {
      return;
    }

    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      if (selectedChoice === 'album' && !selectedImageAsset?.uri) {
        throw new Error('프로필 사진을 선택해주세요.');
      }

      const updatedProfile = selectedChoice === 'album' && selectedImageAsset
        ? await updateProfileImage(selectedImageAsset)
        : null;
      const nextProfileImageUri = getProfileImageUri(
        updatedProfile ?? undefined,
        selectedChoice === 'album' ? selectedImageUri : currentProfileImageUri,
      );

      await setAuth({
        ...auth,
        firstLoginYn: 'N',
        profile: {
          ...(auth.profile ?? {}),
          ...(updatedProfile ?? {}),
          profileImageSource: selectedChoice,
          profileImageUri: nextProfileImageUri ?? undefined,
        },
      });
      navigation.navigate('Main');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '프로필 업데이트 중 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };
  const handleBackPress = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }

    navigation.navigate('Main');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#050505" />

      <View style={styles.screen}>
        <LinearGradient
          colors={['#160307', '#050505', '#050505']}
          start={{x: 0.1, y: 0}}
          end={{x: 0.9, y: 1}}
          style={StyleSheet.absoluteFill}
        />

        <ScrollView
          bounces={false}
          contentContainerStyle={[styles.content, isCompactHeight ? styles.contentCompact : null]}
          showsVerticalScrollIndicator={false}>
          <View style={[styles.header, isCompactHeight ? styles.headerCompact : null]}>
            {canGoBack ? (
              <AnimatedPressable
                accessibilityLabel="뒤로가기"
                accessibilityRole="button"
                onPress={handleBackPress}
                style={styles.backButton}>
                <Image source={icon.backBtn} style={styles.backIcon} resizeMode="contain" />
              </AnimatedPressable>
            ) : null}
            <Text style={styles.title}>프로필을 선택해주세요</Text>
            <Text style={styles.subtitle}>게임대회 앱에서 사용할 프로필이에요.</Text>
          </View>

          <View style={[styles.previewCard, isCompactHeight ? styles.previewCardCompact : null]}>
            <Image
              source={selectedProfilePreview}
              style={[styles.previewImage, isCompactHeight ? styles.previewImageCompact : null]}
              resizeMode="cover"
            />
            <Text style={[styles.previewName, isCompactHeight ? styles.previewNameCompact : null]}>
              {auth?.name ?? '내 프로필'}
            </Text>
            <Text style={styles.previewDescription}>
              {selectedChoice === 'album' && selectedImageUri
                ? '사진앨범에서 선택한 프로필'
                : selectedChoice === 'album'
                  ? '사진앨범에서 프로필을 선택해주세요'
                  : '기본 프로필로 시작합니다'}
            </Text>
          </View>

          <View style={[styles.choiceStack, isCompactHeight ? styles.choiceStackCompact : null]}>
            <AnimatedPressable
              accessibilityRole="button"
              onPress={() => setSelectedChoice('default')}
              style={[styles.choiceCard, selectedChoice === 'default' && styles.choiceCardSelected]}>
              <Image source={image.profile} style={styles.choiceAvatar} resizeMode="cover" />
              <View style={styles.choiceTextBlock}>
                <Text style={styles.choiceTitle}>기본 프로필</Text>
                <Text style={styles.choiceSubtitle}>앱에서 제공하는 기본 이미지로 시작</Text>
              </View>
              <View style={[styles.radio, selectedChoice === 'default' && styles.radioSelected]}>
                {selectedChoice === 'default' ? <View style={styles.radioDot} /> : null}
              </View>
            </AnimatedPressable>

            <AnimatedPressable
              accessibilityRole="button"
              onPress={openImageLibrary}
              style={[styles.choiceCard, selectedChoice === 'album' && styles.choiceCardSelected]}>
              {selectedImageUri ? (
                <Image source={{uri: selectedImageUri}} style={styles.choiceAvatar} resizeMode="cover" />
              ) : (
                <View style={styles.albumIcon}>
                  <Text style={styles.albumIconText}>＋</Text>
                </View>
              )}
              <View style={styles.choiceTextBlock}>
                <Text style={styles.choiceTitle}>사진앨범에서 선택</Text>
                <Text style={styles.choiceSubtitle}>
                  {selectedImageUri ? '선택한 사진을 프로필로 설정' : '내 사진으로 프로필을 설정'}
                </Text>
              </View>
              <View style={[styles.radio, selectedChoice === 'album' && styles.radioSelected]}>
                {selectedChoice === 'album' ? <View style={styles.radioDot} /> : null}
              </View>
            </AnimatedPressable>
          </View>

          <View style={[styles.actionArea, isCompactHeight ? styles.actionAreaCompact : null]}>
            {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
            <Text style={styles.helperText}>사진은 이 기기에서 선택한 이미지로 표시됩니다.</Text>

            <AnimatedPressable
              accessibilityRole="button"
              disabled={isSubmitting}
              onPress={completeProfileSetup}
              style={[styles.nextButton, isSubmitting ? styles.nextButtonDisabled : null]}>
              <Text style={styles.nextButtonText}>{isSubmitting ? '저장 중...' : '시작하기'}</Text>
            </AnimatedPressable>
          </View>
        </ScrollView>

        {isSubmitting ? (
          <View style={styles.loadingOverlay}>
            <AppLoading label="프로필을 저장하는 중..." />
          </View>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#050505',
  },
  screen: {
    flex: 1,
    backgroundColor: '#050505',
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 34,
    paddingBottom: 24,
  },
  contentCompact: {
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 18,
  },
  header: {
    marginBottom: 32,
  },
  headerCompact: {
    marginBottom: 22,
  },
  backButton: {
    width: 42,
    height: 42,
    marginBottom: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: {
    width: 24,
    height: 24,
    tintColor: '#FFFFFF',
  },
  title: {
    color: '#FFFFFF',
    ...FONTS.font28B,
    lineHeight: 35,
  },
  subtitle: {
    marginTop: 10,
    color: '#A9ABB2',
    ...FONTS.font15R,
    lineHeight: 22,
  },
  previewCard: {
    alignItems: 'center',
    paddingVertical: 30,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
  },
  previewCardCompact: {
    paddingVertical: 22,
    borderRadius: 22,
  },
  previewImage: {
    width: 112,
    height: 112,
    borderRadius: 56,
    backgroundColor: '#1A1A1A',
  },
  previewImageCompact: {
    width: 88,
    height: 88,
    borderRadius: 44,
  },
  previewName: {
    marginTop: 18,
    color: '#FFFFFF',
    ...FONTS.font22B,
    lineHeight: 28,
  },
  previewNameCompact: {
    marginTop: 14,
  },
  previewDescription: {
    marginTop: 7,
    color: '#A9ABB2',
    ...FONTS.font14R,
    lineHeight: 20,
  },
  choiceStack: {
    marginTop: 28,
    gap: 12,
  },
  choiceStackCompact: {
    marginTop: 20,
    gap: 10,
  },
  choiceCard: {
    minHeight: 76,
    borderRadius: 20,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#121214',
    borderWidth: 1,
    borderColor: '#242428',
  },
  choiceCardSelected: {
    borderColor: '#E50914',
    backgroundColor: 'rgba(229,9,20,0.12)',
  },
  choiceAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#222222',
  },
  albumIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#25262B',
  },
  albumIconText: {
    color: '#FFFFFF',
    ...FONTS.font28R,
    lineHeight: 30,
  },
  choiceTextBlock: {
    flex: 1,
    marginLeft: 14,
  },
  choiceTitle: {
    color: '#FFFFFF',
    ...FONTS.font16B,
    lineHeight: 21,
  },
  choiceSubtitle: {
    marginTop: 5,
    color: '#8A8D95',
    ...FONTS.font13R,
    lineHeight: 18,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#5A5D65',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: {
    borderColor: '#E50914',
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#E50914',
  },
  actionArea: {
    marginTop: 'auto',
    paddingTop: 30,
  },
  actionAreaCompact: {
    paddingTop: 24,
  },
  helperText: {
    color: '#777A82',
    ...FONTS.font12R,
    lineHeight: 18,
  },
  errorText: {
    marginBottom: 10,
    color: '#E50914',
    ...FONTS.font13M,
    lineHeight: 18,
  },
  nextButton: {
    marginTop: 18,
    height: 56,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E50914',
  },
  nextButtonDisabled: {
    opacity: 0.65,
  },
  nextButtonText: {
    color: '#FFFFFF',
    ...FONTS.font17B,
    lineHeight: 22,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
});
