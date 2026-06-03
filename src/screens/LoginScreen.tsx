import React, {useEffect, useRef, useState} from 'react';
import {
  Animated,
  Easing,
  Image,
  Keyboard,
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
import {AppLoading} from '../components/AppLoading';
import {image} from '../assets/images';
import {useAuth} from '../auth/AuthProvider';
import {FONTS} from '../constants/theme';
import {withMinimumLoadingTime} from '../utils/loading';

const API_BASE = 'http://121.254.240.93:8090';
const PASSWORD_KEY_ROWS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['clear', '0', 'backspace'],
] as const;
const PASSWORD_SUFFIX = '!a';
const LOGIN_PASSWORD_PATTERN = /^\d{8,}!a$/;
const PASSWORD_KEYPAD_HIDDEN_OFFSET = 280;
const LOGIN_CONTENT_RAISED_OFFSET = -150;

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
  const [isPasswordKeypadVisible, setIsPasswordKeypadVisible] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const buttonAnim = useRef(new Animated.Value(0)).current;
  const keypadAnim = useRef(new Animated.Value(0)).current;

  const requestPassword = `${password}${PASSWORD_SUFFIX}`;
  const isEnabled = groupwareId.trim().length > 0 && LOGIN_PASSWORD_PATTERN.test(requestPassword) && !isSubmitting;
  const hasNativeBlur =
    Platform.OS === 'ios'
      ? Boolean(UIManager.getViewManagerConfig?.('BlurView'))
      : Boolean(UIManager.getViewManagerConfig?.('BlurView') || UIManager.getViewManagerConfig?.('AndroidBlurView'));

  const handlePasswordKeyPress = (key: (typeof PASSWORD_KEY_ROWS)[number][number]) => {
    setErrorMessage(null);

    if (key === 'clear') {
      setPassword('');
      return;
    }

    if (key === 'backspace') {
      setPassword(currentPassword => currentPassword.slice(0, -1));
      return;
    }

    setPassword(currentPassword => `${currentPassword}${key}`);
  };

  const openPasswordKeypad = () => {
    Keyboard.dismiss();
    setIsPasswordKeypadVisible(true);
  };

  useEffect(() => {
    Animated.timing(buttonAnim, {
      toValue: isEnabled ? 1 : 0,
      duration: 420,
      easing: Easing.inOut(Easing.ease),
      useNativeDriver: true,
    }).start();
  }, [buttonAnim, isEnabled]);

  useEffect(() => {
    Animated.timing(keypadAnim, {
      toValue: isPasswordKeypadVisible ? 1 : 0,
      duration: 240,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [isPasswordKeypadVisible, keypadAnim]);

  const handleLogin = async () => {
    if (!isEnabled) {
      return;
    }

    setErrorMessage(null);
    setIsPasswordKeypadVisible(false);
    setIsSubmitting(true);

    try {
      const response = await withMinimumLoadingTime(
        fetch(`${API_BASE}/api/employee/login`, {
          body: JSON.stringify({
            id: groupwareId.trim(),
            password: requestPassword,
          }),
          headers: {
            'Content-Type': 'application/json',
          },
          method: 'POST',
        }),
      );

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

        <Animated.View
          style={[
            styles.centerWrap,
            {
              transform: [
                {
                  translateY: keypadAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, LOGIN_CONTENT_RAISED_OFFSET],
                  }),
                },
              ],
            },
          ]}>
          <View style={styles.logoBlock}>
            <Image source={image.logo} style={styles.logoImage} resizeMode="contain" />
          </View>

          <View style={styles.formWrap}>
            <View style={styles.fieldStack}>
              <AnimatedField
                autoCapitalize="none"
                autoCorrect={false}
                onChangeText={setGroupwareId}
                onFocus={() => setIsPasswordKeypadVisible(false)}
                placeholder="그룹웨어 ID"
                placeholderTextColor="#B3B4B9"
                selectionColor="#222222"
                value={groupwareId}
              />
              <AnimatedPressable
                accessibilityLabel="사원번호 입력"
                accessibilityRole="button"
                onPress={openPasswordKeypad}
                style={[styles.passwordDisplay, password ? styles.passwordDisplayActive : null]}>
                <Text style={[styles.passwordDisplayText, password ? styles.passwordDisplayTextActive : null]}>
                  {password ? '*'.repeat(password.length) : '비밀번호'}
                </Text>
              </AnimatedPressable>
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
        </Animated.View>

        <Animated.View
          pointerEvents={isPasswordKeypadVisible ? 'auto' : 'none'}
          style={[
            styles.keypadPanel,
            {
              opacity: keypadAnim,
              transform: [
                {
                  translateY: keypadAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [PASSWORD_KEYPAD_HIDDEN_OFFSET, 0],
                  }),
                },
              ],
            },
          ]}>
          <View style={styles.keypadGrabber} />
          <View style={styles.keypadHeader}>
            <Text style={styles.keypadTitle}>사원번호 입력</Text>
            <AnimatedPressable
              accessibilityRole="button"
              onPress={() => setIsPasswordKeypadVisible(false)}
              style={styles.keypadDoneButton}>
              <Text style={styles.keypadDoneText}>완료</Text>
            </AnimatedPressable>
          </View>
          <View style={styles.keypad}>
            {PASSWORD_KEY_ROWS.flatMap(row =>
              row.map(key => {
                const label = key === 'clear' ? '초기화' : key === 'backspace' ? '삭제' : key;
                const isUtilityKey = key === 'clear' || key === 'backspace';

                return (
                  <AnimatedPressable
                    key={key}
                    accessibilityLabel={`비밀번호 ${label}`}
                    accessibilityRole="button"
                    onPress={() => handlePasswordKeyPress(key)}
                    style={[styles.keypadButton, isUtilityKey ? styles.keypadUtilityButton : null]}>
                    <Text style={[styles.keypadButtonText, isUtilityKey ? styles.keypadUtilityButtonText : null]}>
                      {label}
                    </Text>
                  </AnimatedPressable>
                );
              }),
            )}
          </View>
        </Animated.View>

        {isSubmitting ? (
          <View style={styles.loadingOverlay}>
            <AppLoading label="로그인 중..." />
          </View>
        ) : null}
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
  passwordDisplay: {
    width: '100%',
    height: 52,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  passwordDisplayActive: {
    borderColor: 'rgba(229, 9, 20, 0.58)',
    backgroundColor: 'rgba(229, 9, 20, 0.11)',
  },
  passwordDisplayText: {
    color: '#B3B4B9',
    ...FONTS.font16M,
    lineHeight: 21,
  },
  passwordDisplayTextActive: {
    color: '#FFFFFF',
    letterSpacing: 3,
  },
  keypad: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  keypadPanel: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 10,
    elevation: 10,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    backgroundColor: '#151214',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 26,
    borderTopWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  keypadGrabber: {
    alignSelf: 'center',
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    marginBottom: 12,
  },
  keypadHeader: {
    height: 32,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  keypadTitle: {
    color: '#FFFFFF',
    ...FONTS.font15B,
    lineHeight: 20,
  },
  keypadDoneButton: {
    height: 32,
    minWidth: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keypadDoneText: {
    color: '#E50914',
    ...FONTS.font14B,
    lineHeight: 19,
  },
  keypadButton: {
    width: '31.8%',
    height: 48,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  keypadUtilityButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  keypadButtonText: {
    color: '#FFFFFF',
    ...FONTS.font18B,
    lineHeight: 23,
  },
  keypadUtilityButtonText: {
    color: '#B3B4B9',
    ...FONTS.font13B,
    lineHeight: 18,
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
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
  },
});
