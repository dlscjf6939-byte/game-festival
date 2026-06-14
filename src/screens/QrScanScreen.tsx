import React, {useEffect, useRef, useState} from 'react';
import {useIsFocused, useNavigation, type NavigationProp} from '@react-navigation/native';
import {
  Alert,
  Animated,
  Easing,
  Image,
  Modal,
  PermissionsAndroid,
  Platform,
  SafeAreaView,
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

const API_BASE = 'http://121.254.240.93:8090';
const PAYMENT_QR_PATTERN = /(?:https?:\/\/[^/\s]+)?\/api\/products\/(\d+)\/purchase(?:\?([^#\s]+))?/;
const SCAN_AREA_SIZE = 295;
const BRAND_RED = '#E50914';

type PaymentQr = {
  price: number;
  productId: number;
  value: string;
};

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

function normalizeUrl(value: string): URL | null {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return null;
  }

  try {
    return new URL(trimmedValue);
  } catch {
    try {
      return new URL(`http://${trimmedValue}`);
    } catch {
      return null;
    }
  }
}

function getPaymentQr(value: string): PaymentQr | null {
  const matched = value.match(PAYMENT_QR_PATTERN);
  const productId = matched ? Number(matched[1]) : NaN;

  if (!Number.isFinite(productId) || productId < 1) {
    return null;
  }

  const parsedUrl = normalizeUrl(matched?.[0] ?? value);
  const fallbackSearchParams = new URLSearchParams(matched?.[2] ?? '');
  const priceFromQuery =
    toCoinNumber(parsedUrl?.searchParams.get('price')) ??
    toCoinNumber(parsedUrl?.searchParams.get('coin')) ??
    toCoinNumber(parsedUrl?.searchParams.get('amount')) ??
    toCoinNumber(fallbackSearchParams.get('price')) ??
    toCoinNumber(fallbackSearchParams.get('coin')) ??
    toCoinNumber(fallbackSearchParams.get('amount'));

  return {
    price: priceFromQuery ?? productId,
    productId,
    value,
  };
}

function toCoinNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function getScannedValue(event: unknown): string {
  if (!event || typeof event !== 'object') {
    return '';
  }

  const nativeEvent = (event as {nativeEvent?: unknown}).nativeEvent;

  if (!nativeEvent || typeof nativeEvent !== 'object') {
    return '';
  }

  const codeStringValue = (nativeEvent as {codeStringValue?: unknown}).codeStringValue;

  return typeof codeStringValue === 'string' ? codeStringValue.trim() : '';
}

export function QrScanScreen(): JSX.Element {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const isFocused = useIsFocused();
  const insets = useSafeAreaInsets();
  const {auth, refreshProfile} = useAuth();
  const [hasCameraPermission, setHasCameraPermission] = useState(Platform.OS === 'ios');
  const [scanState, setScanState] = useState<ScanState>({kind: 'idle'});
  const [isScanEnabled, setIsScanEnabled] = useState(true);
  const [pendingPayment, setPendingPayment] = useState<PaymentQr | null>(null);
  const [isPaymentProcessing, setIsPaymentProcessing] = useState(false);
  const [paymentErrorMessage, setPaymentErrorMessage] = useState<string | null>(null);
  const scanLockedRef = useRef(false);
  const lastScannedValueRef = useRef<string | null>(null);
  const profileRefreshRequestedRef = useRef(false);
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
      console.log('[QrScanScreen] camera permission request failed', error);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isFocused) {
      return;
    }

    chromeProgress.setValue(0);
    Animated.timing(chromeProgress, {
      toValue: 1,
      duration: Platform.OS === 'ios' ? 260 : 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [chromeProgress, isFocused]);

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
      console.log('[QrScanScreen] refresh profile failed', error);
    });
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

    console.log('[QrScanScreen] QR code detected', value);
    scanLockedRef.current = true;
    setIsScanEnabled(false);
    lastScannedValueRef.current = value;

    const paymentQr = getPaymentQr(value);

    if (!paymentQr) {
      setScanState({kind: 'invalid', value});
      Alert.alert('오류', '유효하지 않은 QR 코드입니다. 올바른 URL 형태가 아닙니다.', [
        {text: '확인', onPress: handleRetry},
      ]);
      return;
    }

    setScanState({kind: 'valid', value});
    setPendingPayment(paymentQr);
    setPaymentErrorMessage(null);
  };

  const closePaymentModal = () => {
    if (isPaymentProcessing) {
      return;
    }

    setPendingPayment(null);
    setPaymentErrorMessage(null);
    handleRetry();
  };

  const confirmPayment = async () => {
    if (!auth?.accessToken || !pendingPayment || isPaymentProcessing) {
      return;
    }

    setIsPaymentProcessing(true);
    setPaymentErrorMessage(null);

    try {
      const response = await fetch(`${API_BASE}/api/products/${pendingPayment.productId}/purchase`, {
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${auth.accessToken}`,
        },
        method: 'POST',
      });
      const responseText = await response.text();
      let responseBody: {message?: string; success?: boolean} | null = null;

      try {
        responseBody = responseText ? (JSON.parse(responseText) as {message?: string; success?: boolean}) : null;
      } catch {
        responseBody = null;
      }

      if (!response.ok || responseBody?.success === false) {
        throw new Error(responseBody?.message || responseText || '결제에 실패했습니다.');
      }

      await refreshProfile();
      setPendingPayment(null);
      Alert.alert('결제 완료', `${pendingPayment.price}코인이 차감되었습니다.`, [
        {text: '확인', onPress: handleClose},
      ]);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '결제 중 오류가 발생했습니다.';
      setPaymentErrorMessage(errorMessage);
      console.log('[QrScanScreen] payment failed', error);
    } finally {
      setIsPaymentProcessing(false);
    }
  };

  const handleRetry = () => {
    scanLockedRef.current = false;
    setIsScanEnabled(true);
    lastScannedValueRef.current = null;
    setScanState({kind: 'idle'});
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
        {hasCameraPermission && isFocused ? (
          <Camera
            cameraType={CameraType.Back}
            onReadCode={handleReadCode}
            scanBarcode={isFocused && isScanEnabled && pendingPayment === null}
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

      <Modal animationType="fade" transparent visible={pendingPayment !== null} onRequestClose={closePaymentModal}>
        <View style={styles.paymentModalOverlay}>
          <View style={styles.paymentModalCard}>
            <Text style={styles.paymentModalEyebrow}>결제 확인</Text>
            <Text style={styles.paymentModalTitle}>코인 {pendingPayment?.price ?? 0}개가 차감돼요</Text>
            <Text style={styles.paymentModalDescription}>결제하시겠어요?</Text>
            {paymentErrorMessage ? <Text style={styles.paymentErrorText}>{paymentErrorMessage}</Text> : null}
            <View style={styles.paymentButtonRow}>
              <AnimatedPressable
                accessibilityRole="button"
                onPress={closePaymentModal}
                style={[styles.paymentButton, styles.paymentCancelButton]}>
                <Text style={styles.paymentCancelText}>취소</Text>
              </AnimatedPressable>
              <AnimatedPressable
                accessibilityRole="button"
                onPress={() => {
                  confirmPayment().catch(error => {
                    console.log('[QrScanScreen] confirm payment handler failed', error);
                  });
                }}
                style={[styles.paymentButton, styles.paymentConfirmButton]}>
                <Text style={styles.paymentConfirmText}>{isPaymentProcessing ? '결제 중...' : '결제하기'}</Text>
              </AnimatedPressable>
            </View>
          </View>
        </View>
      </Modal>
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
    width: '100%',
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
  paymentModalOverlay: {
    flex: 1,
    paddingHorizontal: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.68)',
  },
  paymentModalCard: {
    width: '100%',
    maxWidth: 340,
    paddingHorizontal: 22,
    paddingVertical: 24,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(229, 9, 20, 0.35)',
    backgroundColor: '#111111',
  },
  paymentModalEyebrow: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    overflow: 'hidden',
    color: '#FFB7BE',
    backgroundColor: 'rgba(229, 9, 20, 0.16)',
    ...FONTS.font12B,
  },
  paymentModalTitle: {
    marginTop: 18,
    color: '#FFFFFF',
    ...FONTS.font20B,
    lineHeight: 27,
  },
  paymentModalDescription: {
    marginTop: 6,
    color: '#C8C8C8',
    ...FONTS.font14M,
    lineHeight: 20,
  },
  paymentErrorText: {
    marginTop: 12,
    color: '#FFB7BE',
    ...FONTS.font13M,
    lineHeight: 18,
  },
  paymentButtonRow: {
    marginTop: 22,
    flexDirection: 'row',
    gap: 10,
  },
  paymentButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  paymentCancelButton: {
    borderWidth: 1,
    borderColor: '#2E2E2E',
    backgroundColor: '#181818',
  },
  paymentConfirmButton: {
    backgroundColor: BRAND_RED,
  },
  paymentCancelText: {
    color: '#FFFFFF',
    ...FONTS.font14B,
  },
  paymentConfirmText: {
    color: '#FFFFFF',
    ...FONTS.font14B,
  },
});
