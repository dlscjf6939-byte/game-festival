import React, {useEffect, useRef, useState} from 'react';
import {useIsFocused, useNavigation, type NavigationProp} from '@react-navigation/native';
import {
  Animated,
  Easing,
  Image,
  PermissionsAndroid,
  Platform,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {Camera, CameraType} from 'react-native-camera-kit';
import LottieView from 'lottie-react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {AnimatedPressable} from '../components/AnimatedPressable';
import {icon} from '../assets/icons';
import {useAuth} from '../auth/AuthProvider';
import type {RootStackParamList} from '../navigation/types';
import {FONTS} from '../constants/theme';
import {formatUnknownError, toCoinNumber} from '../utils/qrPayment';

const SCAN_AREA_SIZE = 295;
const BRAND_RED = '#E50914';
const coinLottie = require('../assets/lotties/Coin.json');

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
  const scanLockedRef = useRef(false);
  const lastScannedValueRef = useRef<string | null>(null);
  const profileRefreshRequestedRef = useRef(false);
  const cameraMountTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navigateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chromeProgress = useRef(new Animated.Value(0)).current;

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
      }
    }

    requestCameraPermission().catch(error => {
      setCameraErrorMessage(error instanceof Error ? error.message : '카메라 권한 요청에 실패했습니다.');
    });

    return () => {
      cancelled = true;
    };
  }, []);

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
    chromeProgress.setValue(0);
    Animated.timing(chromeProgress, {
      toValue: 1,
      duration: Platform.OS === 'ios' ? 260 : 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();

    cameraMountTimerRef.current = setTimeout(
      () => {
        setIsCameraMounted(true);
      },
      Platform.OS === 'android' ? 320 : 120,
    );

    return () => {
      if (cameraMountTimerRef.current) {
        clearTimeout(cameraMountTimerRef.current);
        cameraMountTimerRef.current = null;
      }
    };
  }, [chromeProgress, isFocused]);

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
    refreshProfile().catch(() => {});
  }, [isFocused, refreshProfile]);

  const handleClose = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }

    navigation.navigate('Main', {screen: 'Home'});
  };

  const handleReadCode = async (event: unknown) => {
    const value = getScannedValue(event);

    if (!value || scanLockedRef.current || lastScannedValueRef.current === value) {
      return;
    }

    scanLockedRef.current = true;
    setIsScanEnabled(false);
    setIsCameraMounted(false);
    lastScannedValueRef.current = value;
    setScanState({kind: 'valid', value});

    navigateTimerRef.current = setTimeout(
      () => {
        try {
          navigation.navigate('QrPaymentRequest', {qrValue: value});
        } catch (error) {
          setCameraErrorMessage(formatUnknownError(error));
          scanLockedRef.current = false;
          setIsScanEnabled(true);
          setIsCameraMounted(true);
        }
      },
      Platform.OS === 'android' ? 180 : 60,
    );
  };

  const handleRetry = () => {
    scanLockedRef.current = false;
    setIsScanEnabled(true);
    lastScannedValueRef.current = null;
    setScanState({kind: 'idle'});
    setCameraErrorMessage(null);
    setIsCameraMounted(true);
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
              setCameraErrorMessage(errorMessage);
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
          <View style={styles.coinStickyHeader}>
            <Text style={styles.coinStickyLabel}>보유코인</Text>
            <View style={styles.coinStickyPill}>
              <LottieView autoPlay loop source={coinLottie} style={styles.coinStickyIcon} />
              <Text style={styles.coinStickyText}>{coinBalance}개</Text>
            </View>
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
  coinStickyHeader: {
    marginLeft: 12,
    alignSelf: 'center',
    minHeight: 38,
    borderRadius: 8,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(23,23,23,0.96)',
    borderWidth: 1,
    borderColor: '#2D2D2D',
  },
  coinStickyLabel: {
    color: '#8A8D95',
    ...FONTS.font11B,
    lineHeight: 14,
    top: 1,
  },
  coinStickyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  coinStickyIcon: {
    width: 34,
    height: 34,
    paddingRight: 10,
  },
  coinStickyText: {
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
