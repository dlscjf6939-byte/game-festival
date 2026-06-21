import React, {useEffect, useRef, useState} from 'react';
import {useIsFocused, useNavigation, type NavigationProp} from '@react-navigation/native';
import {
  Animated,
  Easing,
  Image,
  PermissionsAndroid,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {Camera, CameraType} from 'react-native-camera-kit';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {AnimatedPressable} from '../components/AnimatedPressable';
import {icon} from '../assets/icons';
import {useAuth} from '../auth/AuthProvider';
import type {RootStackParamList} from '../navigation/types';
import {FONTS} from '../constants/theme';
import {formatUnknownError, toCoinNumber} from '../utils/qrPayment';

const SCAN_AREA_SIZE = 295;
const BRAND_RED = '#E50914';

type ScanState =
  | {
      kind: 'idle';
    }
  | {
      kind: 'invalid';
      value: string;
    }
  | {
      kind: 'valid';
      value: string;
    };

function getScannedValue(event: unknown): string {
  if (!event || typeof event !== 'object') {
    return '';
  }

  const nativeEvent = (event as {nativeEvent?: unknown}).nativeEvent;

  if (nativeEvent && typeof nativeEvent === 'object') {
    const nativeValue =
      (nativeEvent as {codeStringValue?: unknown}).codeStringValue ??
      (nativeEvent as {data?: unknown}).data ??
      (nativeEvent as {value?: unknown}).value;

    if (typeof nativeValue === 'string') {
      return nativeValue.trim();
    }
  }

  const directValue =
    (event as {codeStringValue?: unknown}).codeStringValue ??
    (event as {data?: unknown}).data ??
    (event as {value?: unknown}).value;

  return typeof directValue === 'string' ? directValue.trim() : '';
}

function getReadableEventKeys(event: unknown): string {
  if (!event || typeof event !== 'object') {
    return 'none';
  }

  const keys = Object.keys(event);
  const nativeEvent = (event as {nativeEvent?: unknown}).nativeEvent;
  const nativeKeys = nativeEvent && typeof nativeEvent === 'object' ? Object.keys(nativeEvent) : [];

  return `eventKeys=${keys.join(',') || 'none'}, nativeEventKeys=${nativeKeys.join(',') || 'none'}`;
}

export function QrScanScreen(): JSX.Element {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const isFocused = useIsFocused();
  const insets = useSafeAreaInsets();
  const {auth, refreshProfile} = useAuth();
  const [hasCameraPermission, setHasCameraPermission] = useState(Platform.OS === 'ios');
  const [scanState, setScanState] = useState<ScanState>({kind: 'idle'});
  const [isScanEnabled, setIsScanEnabled] = useState(true);
  const [isCameraMounted, setIsCameraMounted] = useState(false);
  const [cameraErrorMessage, setCameraErrorMessage] = useState<string | null>(null);
  const [debugMessage, setDebugMessage] = useState<string | null>(null);
  const [logMessages, setLogMessages] = useState<string[]>([]);
  const [isLogPageVisible, setIsLogPageVisible] = useState(false);
  const scanLockedRef = useRef(false);
  const lastScannedValueRef = useRef<string | null>(null);
  const profileRefreshRequestedRef = useRef(false);
  const cameraMountTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navigateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chromeProgress = useRef(new Animated.Value(0)).current;

  const appendLog = React.useCallback((message: string) => {
    const timestamp = new Date().toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

    setLogMessages(prevMessages => [`[${timestamp}] ${message}`, ...prevMessages].slice(0, 80));
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'android') {
      return;
    }

    let cancelled = false;

    async function requestCameraPermission() {
      const status = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CAMERA, {
        buttonNegative: '취소',
        buttonPositive: '허용',
        message: 'QR 코드를 스캔하려면 카메라 권한이 필요합니다.',
        title: '카메라 권한',
      });

      if (!cancelled) {
        setHasCameraPermission(status === PermissionsAndroid.RESULTS.GRANTED);
        appendLog(`카메라 권한 결과: ${status}`);
      }
    }

    requestCameraPermission().catch(error => {
      const errorMessage = error instanceof Error ? error.message : '카메라 권한 요청에 실패했습니다.';
      setDebugMessage(`카메라 권한 오류: ${errorMessage}`);
      appendLog(`카메라 권한 오류: ${errorMessage}`);
      console.log('[QrScanScreen] camera permission request failed', error);
    });

    return () => {
      cancelled = true;
    };
  }, [appendLog]);

  useEffect(() => {
    if (cameraMountTimerRef.current) {
      clearTimeout(cameraMountTimerRef.current);
      cameraMountTimerRef.current = null;
    }

    if (!isFocused) {
      setIsCameraMounted(false);
      return;
    }

    setIsCameraMounted(false);
    scanLockedRef.current = false;
    setIsScanEnabled(true);
    lastScannedValueRef.current = null;
    setScanState({kind: 'idle'});
    setCameraErrorMessage(null);
    setDebugMessage(null);
    chromeProgress.setValue(0);
    Animated.timing(chromeProgress, {
      toValue: 1,
      duration: Platform.OS === 'ios' ? 260 : 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();

    cameraMountTimerRef.current = setTimeout(() => {
      setIsCameraMounted(true);
      appendLog('카메라 mount 활성화');
    }, Platform.OS === 'android' ? 320 : 120);

    return () => {
      if (cameraMountTimerRef.current) {
        clearTimeout(cameraMountTimerRef.current);
        cameraMountTimerRef.current = null;
      }
    };
  }, [appendLog, chromeProgress, isFocused]);

  useEffect(() => {
    return () => {
      if (cameraMountTimerRef.current) {
        clearTimeout(cameraMountTimerRef.current);
      }

      if (navigateTimerRef.current) {
        clearTimeout(navigateTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!isFocused) {
      profileRefreshRequestedRef.current = false;
      return;
    }

    if (profileRefreshRequestedRef.current) {
      return;
    }

    profileRefreshRequestedRef.current = true;
    refreshProfile().catch(error => {
      const errorMessage = error instanceof Error ? error.message : '프로필 정보를 불러오지 못했습니다.';
      setDebugMessage(`프로필 갱신 오류: ${errorMessage}`);
      appendLog(`프로필 갱신 오류: ${errorMessage}`);
      console.log('[QrScanScreen] refresh profile failed', error);
    });
  }, [appendLog, isFocused, refreshProfile]);

  const handleClose = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }

    navigation.navigate('Main', {screen: 'Home'});
  };

  const handleReadCode = async (event: unknown) => {
    const value = getScannedValue(event);
    const eventKeys = getReadableEventKeys(event);

    appendLog(`QR 이벤트 수신: ${eventKeys}`);

    if (!value) {
      setDebugMessage('QR 이벤트는 들어왔지만 값이 비어 있습니다.');
      appendLog('QR 이벤트 값 비어 있음');
      console.log('[QrScanScreen] QR read event without value', event);
    }

    if (!value || scanLockedRef.current || lastScannedValueRef.current === value) {
      if (value && scanLockedRef.current) {
        appendLog('중복 QR 이벤트 무시: 이미 처리 중');
      }
      return;
    }

    console.log('[QrScanScreen] QR code detected', value);
    setDebugMessage(`QR 인식됨\nvalue=${value}\nlength=${value.length}`);
    appendLog(`QR 인식: length=${value.length}, value=${value}`);
    scanLockedRef.current = true;
    setIsScanEnabled(false);
    setIsCameraMounted(false);
    lastScannedValueRef.current = value;
    setScanState({kind: 'valid', value});
    setDebugMessage(`QR 인식 완료\n결제요청 페이지 이동 시도\nvalue=${value}`);
    appendLog('QR value 확보 완료: 결제요청 페이지로 즉시 이동');
    appendLog(`인증 상태: accessToken ${auth?.accessToken ? '있음' : '없음'}`);
    appendLog('네비게이션 시도: QrPaymentRequest');

    navigateTimerRef.current = setTimeout(() => {
      try {
        navigation.navigate('QrPaymentRequest', {qrValue: value});
        appendLog('네비게이션 호출 완료: QrPaymentRequest');
      } catch (error) {
        const errorLog = formatUnknownError(error);
        setDebugMessage(`결제요청 페이지 이동 실패\n${errorLog}`);
        appendLog(`네비게이션 오류:\n${errorLog}`);
        scanLockedRef.current = false;
        setIsScanEnabled(true);
        setIsCameraMounted(true);
      }
    }, Platform.OS === 'android' ? 180 : 60);
  };

  const handleRetry = () => {
    scanLockedRef.current = false;
    setIsScanEnabled(true);
    lastScannedValueRef.current = null;
    setScanState({kind: 'idle'});
    setCameraErrorMessage(null);
    setDebugMessage(null);
    setIsCameraMounted(true);
    appendLog('다시 스캔');
  };

  const guideText =
    scanState.kind === 'valid'
      ? '결제 QR 코드를 인식했습니다.'
      : scanState.kind === 'invalid'
      ? '결제 QR 코드가 아닙니다. 다시 시도해주세요.'
      : 'QR 코드를 격자 안에 맞추면 자동 인식 됩니다.';
  const chromeTranslateY = chromeProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [Platform.OS === 'ios' ? 8 : 12, 0],
  });
  const coinBalance = toCoinNumber(auth?.profile?.holdingCoin) ?? 0;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />

      <View style={styles.body}>
        {hasCameraPermission && isFocused && isCameraMounted ? (
          <Camera
            cameraType={CameraType.Back}
            focusMode="on"
            onError={event => {
              const errorMessage = event.nativeEvent.errorMessage || '카메라를 초기화하지 못했습니다.';
              console.log('[QrScanScreen] camera error', errorMessage);
              setCameraErrorMessage(errorMessage);
              appendLog(`카메라 오류: ${errorMessage}`);
            }}
            onReadCode={handleReadCode}
            scanBarcode={isFocused && isScanEnabled}
            scanThrottleDelay={1200}
            style={styles.camera}
          />
        ) : null}

        <Animated.View
          style={[
            styles.overlayContent,
            {
              opacity: chromeProgress,
              transform: [{translateY: chromeTranslateY}],
            },
          ]}>
          <View style={styles.scanFrame}>
            <View style={styles.cornerTopLeft} />
            <View style={styles.cornerTopRight} />
            <View style={styles.cornerBottomLeft} />
            <View style={styles.cornerBottomRight} />
          </View>

          <Text style={styles.guideText}>{guideText}</Text>

          {!hasCameraPermission ? (
            <Text style={styles.permissionText}>카메라 권한이 없어 QR 스캔을 시작할 수 없습니다.</Text>
          ) : null}

          {cameraErrorMessage ? <Text style={styles.permissionText}>{cameraErrorMessage}</Text> : null}

          {debugMessage ? (
            <View style={styles.debugCard}>
              <Text style={styles.debugTitle}>상태 / 오류</Text>
              <Text style={styles.debugMessage}>{debugMessage}</Text>
            </View>
          ) : null}

          {scanState.kind === 'valid' ? (
            <View style={styles.resultCard}>
              <Text style={styles.resultLabel}>인식된 결제 QR</Text>
              <Text numberOfLines={2} style={styles.resultValue}>
                {scanState.value}
              </Text>
            </View>
          ) : null}

          {scanState.kind !== 'idle' ? (
            <AnimatedPressable accessibilityRole="button" onPress={handleRetry} style={styles.retryButton}>
              <Text style={styles.retryButtonText}>다시 스캔</Text>
            </AnimatedPressable>
          ) : null}
        </Animated.View>
      </View>

      <Animated.View
        style={[
          styles.header,
          {minHeight: insets.top + 56, paddingTop: insets.top + 16},
          {
            opacity: chromeProgress,
            transform: [{translateY: chromeTranslateY}],
          },
        ]}>
        <View style={styles.headerTitleRow}>
          <Text style={styles.title}>QR 스캔</Text>
          <View style={styles.coinDisplayContainer}>
            <Text style={styles.coinLabel}>보유코인</Text>
            <Text style={styles.coinAmount}>{coinBalance}개</Text>
          </View>
        </View>
        <AnimatedPressable
          accessibilityLabel="QR 스캔 닫기"
          accessibilityRole="button"
          onPress={handleClose}
          style={styles.closeButton}>
          <Image source={icon.closeBtn} style={styles.closeIcon} />
        </AnimatedPressable>
      </Animated.View>

      <AnimatedPressable
        accessibilityRole="button"
        onPress={() => setIsLogPageVisible(true)}
        style={[styles.logFloatingButton, {bottom: insets.bottom + 18}]}>
        <Text style={styles.logFloatingButtonText}>로그 보기</Text>
      </AnimatedPressable>

      {isLogPageVisible ? (
        <View style={styles.logPage}>
          <SafeAreaView style={styles.logPageSafeArea}>
            <View style={styles.logPageHeader}>
              <View>
                <Text style={styles.logPageEyebrow}>RELEASE DEBUG</Text>
                <Text style={styles.logPageTitle}>QR 로그</Text>
              </View>
              <View style={styles.logPageHeaderActions}>
                <AnimatedPressable
                  accessibilityRole="button"
                  onPress={() => setLogMessages([])}
                  style={styles.logPageActionButton}>
                  <Text style={styles.logPageActionText}>비우기</Text>
                </AnimatedPressable>
                <AnimatedPressable
                  accessibilityRole="button"
                  onPress={() => setIsLogPageVisible(false)}
                  style={styles.logPageCloseButton}>
                  <Text style={styles.logPageCloseText}>닫기</Text>
                </AnimatedPressable>
              </View>
            </View>

            <ScrollView contentContainerStyle={styles.logPageContent} showsVerticalScrollIndicator={false}>
              {logMessages.length ? (
                logMessages.map((message, index) => (
                  <Text key={`${message}-${index}`} selectable style={styles.logLine}>
                    {message}
                  </Text>
                ))
              ) : (
                <Text style={styles.logEmptyText}>아직 로그가 없습니다.</Text>
              )}
            </ScrollView>
          </SafeAreaView>
        </View>
      ) : null}

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#000000',
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    minHeight: 56,
    paddingHorizontal: 20,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'transparent',
  },
  headerTitleRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    color: '#FFFFFF',
    ...FONTS.font20B,
  },
  coinDisplayContainer: {
    marginLeft: 12,
    minHeight: 26,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(229, 9, 20, 0.36)',
    backgroundColor: 'rgba(229, 9, 20, 0.16)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  coinLabel: {
    color: '#FFB7BE',
    ...FONTS.font14M,
    lineHeight: 18,
  },
  coinAmount: {
    color: '#FFFFFF',
    ...FONTS.font14B,
    lineHeight: 18,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#171717',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeIcon: {
    width: 24,
    height: 24,
    resizeMode: 'contain',
  },
  logFloatingButton: {
    position: 'absolute',
    right: 18,
    zIndex: 20,
    elevation: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    backgroundColor: 'rgba(17,17,17,0.88)',
  },
  logFloatingButtonText: {
    color: '#FFFFFF',
    ...FONTS.font13B,
    lineHeight: 17,
  },
  logPage: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 60,
    elevation: 60,
    backgroundColor: '#050505',
  },
  logPageSafeArea: {
    flex: 1,
  },
  logPageHeader: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  logPageEyebrow: {
    color: '#E50914',
    letterSpacing: 1.1,
    ...FONTS.font11B,
    lineHeight: 15,
  },
  logPageTitle: {
    marginTop: 4,
    color: '#FFFFFF',
    ...FONTS.font22B,
    lineHeight: 28,
  },
  logPageHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logPageActionButton: {
    minHeight: 36,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#151515',
  },
  logPageActionText: {
    color: '#BFC1C7',
    ...FONTS.font13B,
    lineHeight: 17,
  },
  logPageCloseButton: {
    minHeight: 36,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BRAND_RED,
  },
  logPageCloseText: {
    color: '#FFFFFF',
    ...FONTS.font13B,
    lineHeight: 17,
  },
  logPageContent: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 8,
  },
  logLine: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    color: '#EDEEF2',
    backgroundColor: '#111111',
    ...FONTS.font12M,
    lineHeight: 17,
  },
  logEmptyText: {
    paddingTop: 36,
    color: '#8C8F99',
    textAlign: 'center',
    ...FONTS.font14M,
    lineHeight: 20,
  },
  body: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  camera: {
    ...StyleSheet.absoluteFillObject,
  },
  overlayContent: {
    alignItems: 'center',
    justifyContent: 'center',
    ...StyleSheet.absoluteFillObject,
  },
  scanFrame: {
    width: SCAN_AREA_SIZE,
    height: SCAN_AREA_SIZE,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cornerTopLeft: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 20,
    height: 20,
    borderLeftWidth: 5,
    borderTopWidth: 5,
    borderColor: BRAND_RED,
  },
  cornerTopRight: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 20,
    height: 20,
    borderRightWidth: 5,
    borderTopWidth: 5,
    borderColor: BRAND_RED,
  },
  cornerBottomLeft: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    width: 20,
    height: 20,
    borderLeftWidth: 5,
    borderBottomWidth: 5,
    borderColor: BRAND_RED,
  },
  cornerBottomRight: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 20,
    height: 20,
    borderRightWidth: 5,
    borderBottomWidth: 5,
    borderColor: BRAND_RED,
  },
  guideText: {
    marginTop: 32,
    width: 190,
    color: '#FFFFFF',
    ...FONTS.font14M,
    lineHeight: 18,
    textAlign: 'center',
  },
  permissionText: {
    marginTop: 12,
    color: '#FFB7BE',
    ...FONTS.font13M,
    lineHeight: 18,
    textAlign: 'center',
  },
  debugCard: {
    width: '86%',
    maxWidth: 340,
    marginTop: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 183, 190, 0.38)',
    backgroundColor: 'rgba(17, 17, 17, 0.9)',
  },
  debugTitle: {
    color: '#FFB7BE',
    ...FONTS.font12B,
    lineHeight: 16,
  },
  debugMessage: {
    marginTop: 6,
    color: '#FFFFFF',
    ...FONTS.font12M,
    lineHeight: 17,
  },
  resultCard: {
    width: '86%',
    maxWidth: 340,
    marginTop: 20,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(23, 23, 23, 0.92)',
  },
  resultLabel: {
    color: BRAND_RED,
    ...FONTS.font12B,
  },
  resultValue: {
    marginTop: 6,
    color: '#FFFFFF',
    ...FONTS.font14B,
    lineHeight: 20,
  },
  retryButton: {
    marginTop: 16,
    minWidth: 120,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: BRAND_RED,
    alignItems: 'center',
  },
  retryButtonText: {
    color: '#FFFFFF',
    ...FONTS.font14B,
  },
});
