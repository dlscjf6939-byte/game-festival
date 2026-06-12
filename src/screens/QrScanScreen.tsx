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
import {AnimatedPressable} from '../components/AnimatedPressable';
import {icon} from '../assets/icons';
import type {RootStackParamList} from '../navigation/types';
import {FONTS} from '../constants/theme';

const PAYMENT_PATH = '/coin/payment';

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

function isPaymentQr(value: string): boolean {
  const parsedUrl = normalizeUrl(value);

  return parsedUrl?.pathname.replace(/\/+$/, '') === PAYMENT_PATH;
}

export function QrScanScreen(): JSX.Element {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const isFocused = useIsFocused();
  const [hasCameraPermission, setHasCameraPermission] = useState(Platform.OS === 'ios');
  const [scanState, setScanState] = useState<ScanState>({kind: 'idle'});
  const scanLockedRef = useRef(false);
  const lastScannedValueRef = useRef<string | null>(null);
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

    void requestCameraPermission();

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

  const handleClose = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }

    navigation.navigate('Main', {screen: 'Home'});
  };

  const handleReadCode = (event: {
    nativeEvent: {
      codeStringValue: string;
    };
  }) => {
    const value = event.nativeEvent.codeStringValue.trim();

    if (!value || scanLockedRef.current || lastScannedValueRef.current === value) {
      return;
    }

    lastScannedValueRef.current = value;

    if (!isPaymentQr(value)) {
      setScanState({kind: 'invalid', value});
      return;
    }

    scanLockedRef.current = true;
    setScanState({kind: 'valid', value});
  };

  const handleRetry = () => {
    scanLockedRef.current = false;
    lastScannedValueRef.current = null;
    setScanState({kind: 'idle'});
  };

  const guideText =
    scanState.kind === 'valid'
      ? '결제용 QR 코드를 인식했습니다.'
      : scanState.kind === 'invalid'
      ? '결제용 QR 코드가 아닙니다. 다시 시도해주세요.'
      : 'QR 코드를 화면 중앙에 맞춰주세요.';
  const chromeTranslateY = chromeProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [Platform.OS === 'ios' ? 8 : 12, 0],
  });

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />

      <Animated.View
        style={[
          styles.header,
          {
            opacity: chromeProgress,
            transform: [{translateY: chromeTranslateY}],
          },
        ]}>
        <Text style={styles.title}>QR 스캔</Text>
        <AnimatedPressable
          accessibilityLabel="QR 스캔 닫기"
          accessibilityRole="button"
          onPress={handleClose}
          style={styles.closeButton}>
          <Image source={icon.closeBtn} style={styles.closeIcon} />
        </AnimatedPressable>
      </Animated.View>

      <View style={styles.body}>
        {hasCameraPermission && isFocused ? (
          <Camera
            cameraType={CameraType.Back}
            onReadCode={handleReadCode}
            scanBarcode={!scanLockedRef.current}
            scanThrottleDelay={1200}
            style={styles.camera}
          />
        ) : null}

        <View pointerEvents="none" style={styles.cameraShade} />

        <Animated.View
          style={[
            styles.overlayContent,
            {
              opacity: chromeProgress,
              transform: [{translateY: chromeTranslateY}],
            },
          ]}>
          <View style={styles.scanFrame}>
            <View style={[styles.corner, styles.cornerTopLeft]} />
            <View style={[styles.corner, styles.cornerTopRight]} />
            <View style={[styles.corner, styles.cornerBottomLeft]} />
            <View style={[styles.corner, styles.cornerBottomRight]} />
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#000000',
  },
  header: {
    height: 56,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    color: '#FFFFFF',
    ...FONTS.font20B,
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
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingBottom: 92,
    overflow: 'hidden',
  },
  camera: {
    ...StyleSheet.absoluteFillObject,
  },
  cameraShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.38)',
  },
  overlayContent: {
    alignItems: 'center',
    width: '100%',
  },
  scanFrame: {
    width: 244,
    height: 244,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  corner: {
    position: 'absolute',
    width: 42,
    height: 42,
    borderColor: '#E50914',
  },
  cornerTopLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: 14,
  },
  cornerTopRight: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: 14,
  },
  cornerBottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: 14,
  },
  cornerBottomRight: {
    right: 0,
    bottom: 0,
    borderRightWidth: 4,
    borderBottomWidth: 4,
    borderBottomRightRadius: 14,
  },
  guideText: {
    marginTop: 24,
    color: '#FFFFFF',
    ...FONTS.font14B,
    lineHeight: 20,
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
    color: '#E50914',
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
    backgroundColor: '#E50914',
    alignItems: 'center',
  },
  retryButtonText: {
    color: '#FFFFFF',
    ...FONTS.font14B,
  },
});
