import React, {useEffect, useRef, useState} from 'react';
import {
  Animated,
  Easing,
  Image,
  Platform,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  UIManager,
  View,
} from 'react-native';
import {BlurView} from '@react-native-community/blur';
import LinearGradient from 'react-native-linear-gradient';
import {AnimatedField} from '../components/AnimatedField';
import {AnimatedPressable} from '../components/AnimatedPressable';
import {image} from '../assets/images';
import {useAuth} from '../auth/AuthProvider';
import {FONTS} from '../constants/theme';

const API_BASE = 'http://121.254.240.93:8090';

type LoginResponse = {
  code: string;
  data?: {
    accessToken: string;
    employeeId?: number | string;
    firstLoginYn?: boolean | 'Y' | 'N' | 'y' | 'n' | 'true' | 'false' | '1' | '0';
    name: string;
  };
  message: string;
  success: boolean;
};

export function LoginScreen(): JSX.Element {
  const {setAuth} = useAuth();
  const [groupwareId, setGroupwareId] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const buttonAnim = useRef(new Animated.Value(0)).current;

  const isEnabled = groupwareId.trim().length > 0 && password.trim().length > 9 && !isSubmitting;
  const hasNativeBlur =
    Platform.OS === 'ios'
      ? Boolean(UIManager.getViewManagerConfig?.('BlurView'))
      : Boolean(UIManager.getViewManagerConfig?.('BlurView') || UIManager.getViewManagerConfig?.('AndroidBlurView'));

  useEffect(() => {
    Animated.timing(buttonAnim, {
      toValue: isEnabled ? 1 : 0,
      duration: 420,
      easing: Easing.inOut(Easing.ease),
      useNativeDriver: true,
    }).start();
  }, [buttonAnim, isEnabled]);

  const handleLogin = async () => {
    if (!isEnabled) {
      return;
    }

    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const response = await fetch(`${API_BASE}/api/employee/login`, {
        body: JSON.stringify({
          id: groupwareId.trim(),
          password,
        }),
        headers: {
          'Content-Type': 'application/json',
        },
        method: 'POST',
      });

      const json = (await response.json()) as LoginResponse;

      if (!response.ok || !json.success || !json.data?.accessToken) {
        throw new Error(json.message || '로그인에 실패했습니다.');
      }

      await setAuth({
        accessToken: json.data.accessToken,
        employeeId: json.data.employeeId,
        firstLoginYn: json.data.firstLoginYn ?? 'Y',
        id: groupwareId.trim(),
        name: json.data.name,
      });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '로그인 처리 중 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#090105" />

      <View style={styles.screen}>
        <View pointerEvents="none" style={styles.posterStage}>
          <LinearGradient
            colors={['#020101', '#070203', '#120305', '#030102', '#010101']}
            end={{x: 0.15, y: 0.05}}
            start={{x: 0.9, y: 1}}
            style={styles.baseGradient}
          />
          <LinearGradient
            colors={['rgba(255, 69, 69, 0.28)', 'rgba(255, 69, 69, 0)']}
            end={{x: 1, y: 1}}
            start={{x: 0, y: 0}}
            style={[styles.blurBlob, styles.blobTopLeft]}
          />
          <LinearGradient
            colors={['rgba(201, 30, 49, 0.24)', 'rgba(201, 30, 49, 0)']}
            end={{x: 1, y: 1}}
            start={{x: 0, y: 0}}
            style={[styles.blurBlob, styles.blobCenter]}
          />
          <LinearGradient
            colors={['rgba(135, 12, 22, 0.22)', 'rgba(135, 12, 22, 0)']}
            end={{x: 1, y: 1}}
            start={{x: 0, y: 0}}
            style={[styles.blurBlob, styles.blobBottomRight]}
          />
          <LinearGradient
            colors={['rgba(255, 255, 255, 0.05)', 'rgba(255, 255, 255, 0)']}
            end={{x: 1, y: 1}}
            start={{x: 0.2, y: 0}}
            style={[styles.blurBlob, styles.blobHaze]}
          />
          {hasNativeBlur ? (
            <BlurView
              blurAmount={22}
              blurType="dark"
              reducedTransparencyFallbackColor="#120406"
              style={styles.realBlur}
            />
          ) : null}
          <View style={styles.posterVeil} />
        </View>

        <View style={styles.centerWrap}>
          <View style={styles.logoBlock}>
            <Image source={image.logo} style={styles.logoImage} resizeMode="contain" />
          </View>

          <View style={styles.formWrap}>
            <View style={styles.fieldStack}>
              <AnimatedField
                autoCapitalize="none"
                autoCorrect={false}
                onChangeText={setGroupwareId}
                placeholder="그룹웨어 ID"
                placeholderTextColor="#B3B4B9"
                selectionColor="#222222"
                value={groupwareId}
              />
              <AnimatedField
                autoCapitalize="none"
                autoCorrect={false}
                onChangeText={setPassword}
                placeholder="비밀번호"
                placeholderTextColor="#B3B4B9"
                secureTextEntry
                selectionColor="#222222"
                value={password}
              />
            </View>

            <AnimatedPressable accessibilityRole="button" onPress={handleLogin} style={styles.buttonFrame}>
              <View style={styles.button}>
                <Animated.View
                  pointerEvents="none"
                  style={[
                    styles.buttonActiveOverlay,
                    {
                      opacity: buttonAnim,
                    },
                  ]}
                />
                <Animated.Text
                  style={[
                    styles.buttonText,
                    {
                      color: buttonAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: ['#B3B4B9', '#FFFFFF'],
                      }),
                    },
                  ]}>
                  {isSubmitting ? '로그인 중...' : '로그인'}
                </Animated.Text>
              </View>
            </AnimatedPressable>
            {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#090105',
  },
  screen: {
    flex: 1,
    backgroundColor: '#090105',
    position: 'relative',
  },
  posterStage: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  baseGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  blurBlob: {
    position: 'absolute',
    width: 640,
    height: 640,
    borderRadius: 360,
  },
  blobTopLeft: {
    top: -240,
    left: -240,
    transform: [{scaleX: 1.75}, {scaleY: 1.3}],
  },
  blobCenter: {
    top: '16%',
    left: '8%',
    width: 600,
    height: 600,
    borderRadius: 320,
    transform: [{scaleX: 1.25}, {scaleY: 1.1}],
  },
  blobBottomRight: {
    right: -260,
    bottom: -260,
    transform: [{scaleX: 1.95}, {scaleY: 1.5}],
  },
  blobHaze: {
    top: '24%',
    right: '-35%',
    width: 560,
    height: 560,
    borderRadius: 300,
    transform: [{scaleX: 1.45}, {scaleY: 1.2}],
  },
  posterVeil: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(2, 1, 1, 0.78)',
  },
  realBlur: {
    ...StyleSheet.absoluteFillObject,
  },
  centerWrap: {
    flex: 1,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoBlock: {
    width: 230,
    height: 69,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 72,
  },
  logoImage: {
    width: '100%',
    height: '100%',
    backgroundColor: 'transparent',
  },
  formWrap: {
    width: '100%',
    alignItems: 'center',
  },
  fieldStack: {
    width: '100%',
    gap: 12,
    marginBottom: 24,
  },
  buttonFrame: {
    width: '100%',
  },
  button: {
    position: 'relative',
    width: '100%',
    height: 52,
    borderRadius: 8,
    backgroundColor: '#E9EAEF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  buttonActiveOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 8,
    backgroundColor: '#D90B17',
  },
  buttonText: {
    ...FONTS.font16M,
    lineHeight: 21,
    textAlign: 'center',
    zIndex: 1,
  },
  errorText: {
    color: '#E50914',
    ...FONTS.font13B,
    lineHeight: 18,
    marginTop: 12,
    textAlign: 'center',
  },
});
