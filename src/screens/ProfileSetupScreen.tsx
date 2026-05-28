import React, {useMemo, useState} from 'react';
import {
  Image,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import {launchImageLibrary} from 'react-native-image-picker';
import {useAuth} from '../auth/AuthProvider';
import {image} from '../assets/images';
import {AnimatedPressable} from '../components/AnimatedPressable';
import {FONTS} from '../constants/theme';

type ProfileChoice = 'default' | 'album';

export function ProfileSetupScreen(): JSX.Element {
  const {auth, setAuth} = useAuth();
  const [selectedChoice, setSelectedChoice] = useState<ProfileChoice>('default');
  const [selectedImageUri, setSelectedImageUri] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const selectedProfilePreview = useMemo(() => {
    if (selectedChoice === 'album' && selectedImageUri) {
      return {uri: selectedImageUri};
    }

    return image.profile;
  }, [selectedChoice, selectedImageUri]);

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
    setSelectedChoice('album');
  };

  const completeProfileSetup = async () => {
    if (!auth) {
      return;
    }

    await setAuth({
      ...auth,
      firstLoginYn: 'N',
      profile: {
        ...(auth.profile ?? {}),
        profileImageSource: selectedChoice,
        profileImageUri: selectedChoice === 'album' ? selectedImageUri : undefined,
      },
    });
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

        <View style={styles.header}>
          <Text style={styles.title}>프로필을 선택해주세요</Text>
          <Text style={styles.subtitle}>게임대회 앱에서 사용할 프로필이에요.</Text>
        </View>

        <View style={styles.previewCard}>
          <Image source={selectedProfilePreview} style={styles.previewImage} resizeMode="cover" />
          <Text style={styles.previewName}>{auth?.name ?? '내 프로필'}</Text>
          <Text style={styles.previewDescription}>
            {selectedChoice === 'album' && selectedImageUri
              ? '사진앨범에서 선택한 프로필'
              : selectedChoice === 'album'
                ? '사진앨범에서 프로필을 선택해주세요'
                : '기본 프로필로 시작합니다'}
          </Text>
        </View>

        <View style={styles.choiceStack}>
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

        {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
        <Text style={styles.helperText}>사진은 이 기기에서 선택한 이미지로 표시됩니다.</Text>

        <AnimatedPressable accessibilityRole="button" onPress={completeProfileSetup} style={styles.nextButton}>
          <Text style={styles.nextButtonText}>시작하기</Text>
        </AnimatedPressable>
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
    paddingHorizontal: 24,
    paddingTop: 34,
    paddingBottom: 24,
    backgroundColor: '#050505',
  },
  header: {
    marginBottom: 32,
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
  previewImage: {
    width: 112,
    height: 112,
    borderRadius: 56,
    backgroundColor: '#1A1A1A',
  },
  previewName: {
    marginTop: 18,
    color: '#FFFFFF',
    ...FONTS.font22B,
    lineHeight: 28,
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
  helperText: {
    marginTop: 16,
    color: '#777A82',
    ...FONTS.font12R,
    lineHeight: 18,
  },
  errorText: {
    marginTop: 14,
    color: '#E50914',
    ...FONTS.font13M,
    lineHeight: 18,
  },
  nextButton: {
    marginTop: 'auto',
    height: 56,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E50914',
  },
  nextButtonText: {
    color: '#FFFFFF',
    ...FONTS.font17B,
    lineHeight: 22,
  },
});
