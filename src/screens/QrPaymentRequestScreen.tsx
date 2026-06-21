import React, {useCallback, useMemo, useState} from 'react';
import {useNavigation, useRoute, type NavigationProp, type RouteProp} from '@react-navigation/native';
import {
  ActivityIndicator,
  Alert,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import LottieView from 'lottie-react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {AnimatedPressable} from '../components/AnimatedPressable';
import {useAuth} from '../auth/AuthProvider';
import {FONTS} from '../constants/theme';
import type {RootStackParamList} from '../navigation/types';
import {showCoinPaymentNotification} from '../utils/localCoinNotification';
import {
  formatPaymentQrDebugInfo,
  formatUnknownError,
  getPaymentQr,
  getPaymentQrDebugInfo,
  getPurchaseUrl,
  getStoredAccessToken,
} from '../utils/qrPayment';

type PaymentResponse = {
  code?: string;
  data?: unknown;
  message?: string;
  success?: boolean;
};

const BRAND_RED = '#E50914';
const paymentLottie = require('../assets/lotties/Payment.json');

export function QrPaymentRequestScreen(): JSX.Element {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'QrPaymentRequest'>>();
  const insets = useSafeAreaInsets();
  const {auth, refreshProfile} = useAuth();
  const paymentQr = useMemo(() => getPaymentQr(route.params.qrValue), [route.params.qrValue]);
  const paymentQrDebugInfo = useMemo(() => getPaymentQrDebugInfo(route.params.qrValue), [route.params.qrValue]);
  const formattedPaymentQrDebugInfo = useMemo(
    () => formatPaymentQrDebugInfo(paymentQrDebugInfo),
    [paymentQrDebugInfo],
  );
  const [isRequesting, setIsRequesting] = useState(false);
  const [isComplete, setIsComplete] = useState(false);

  const appendLog = useCallback((message: string) => {
    console.log('[QrPaymentRequestScreen]', message);
  }, []);

  const handleClose = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }

    navigation.navigate('Main', {screen: 'Home'});
  }, [navigation]);

  const requestPayment = useCallback(async () => {
    if (!paymentQr || isRequesting || isComplete) {
      return;
    }

    const storedAccessToken = auth?.accessToken ? null : await getStoredAccessToken();
    const accessToken = auth?.accessToken ?? storedAccessToken;
    const tokenSource = auth?.accessToken ? 'context' : storedAccessToken ? 'storage' : 'none';

    appendLog(
      `결제 토큰 확인: source=${tokenSource}, exists=${accessToken ? 'yes' : 'no'}, length=${
        accessToken?.length ?? 0
      }`,
    );
    appendLog(`결제 요청 QR 상세:\n${formattedPaymentQrDebugInfo}`);

    if (!accessToken) {
      const message = '로그인 정보가 없어 결제를 진행할 수 없습니다. 다시 로그인해주세요.';
      appendLog(`결제 중단: ${message}`);
      Alert.alert('결제 실패', message);
      return;
    }

    setIsRequesting(true);

    try {
      const purchaseUrl = getPurchaseUrl(paymentQr);
      const requestedAt = Date.now();
      appendLog(`결제 요청: POST ${purchaseUrl}`);
      const response = await fetch(purchaseUrl, {
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        method: 'POST',
      });
      const responseText = await response.text();
      appendLog(
        `결제 응답: HTTP ${response.status}, ok=${response.ok ? 'yes' : 'no'}, duration=${
          Date.now() - requestedAt
        }ms`,
      );
      appendLog(`결제 응답 본문: ${responseText || '(empty)'}`);
      let responseBody: PaymentResponse | null = null;

      try {
        responseBody = responseText ? (JSON.parse(responseText) as PaymentResponse) : null;
        appendLog(`결제 응답 JSON 파싱: ${responseBody ? 'success' : 'empty'}`);
      } catch (parseError) {
        responseBody = null;
        appendLog(`결제 응답 JSON 파싱 실패:\n${formatUnknownError(parseError)}`);
      }

      if (!response.ok || responseBody?.success === false) {
        const serverMessage = responseBody?.message || responseText || `결제에 실패했습니다. HTTP ${response.status}`;

        if (response.status === 401 || responseBody?.code === 'E401') {
          throw new Error(`인증 오류: ${serverMessage}`);
        }

        throw new Error(serverMessage);
      }

      appendLog('프로필 갱신 요청 시작');
      await refreshProfile();
      appendLog('프로필 갱신 요청 완료');
      setIsComplete(true);
      appendLog(`결제 완료: productId=${paymentQr.productId}, price=${paymentQr.price}`);
      await showCoinPaymentNotification(paymentQr.price);
      navigation.navigate('Main', {screen: 'Home'});
    } catch (error) {
      const message = error instanceof Error ? error.message : '결제 중 오류가 발생했습니다.';
      const errorLog = formatUnknownError(error);
      appendLog(`결제 오류 상세:\n${errorLog}`);
      Alert.alert('결제 실패', message);
      console.log('[QrPaymentRequestScreen] payment failed', error);
    } finally {
      setIsRequesting(false);
    }
  }, [
    appendLog,
    auth?.accessToken,
    formattedPaymentQrDebugInfo,
    isComplete,
    isRequesting,
    navigation,
    paymentQr,
    refreshProfile,
  ]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.confirmCard}>
          <LottieView autoPlay loop source={paymentLottie} style={styles.paymentLottie} />

          <Text style={styles.confirmTitle}>결제하시겠습니까?</Text>
          <Text style={styles.confirmDescription}>
            {paymentQr ? `${paymentQr.price} 코인이 차감됩니다.` : '결제 QR 형식이 올바르지 않습니다.'}
          </Text>
        </View>
      </ScrollView>

      <View style={[styles.bottomButtonArea, {paddingBottom: insets.bottom + 16}]}>
        <View style={styles.buttonRow}>
          <AnimatedPressable
            accessibilityRole="button"
            disabled={isRequesting}
            onPress={handleClose}
            style={[styles.actionButton, styles.cancelButton, isRequesting && styles.requestButtonDisabled]}>
            <Text style={styles.cancelButtonText}>취소</Text>
          </AnimatedPressable>
          <AnimatedPressable
            accessibilityRole="button"
            disabled={!paymentQr || isRequesting || isComplete}
            onPress={requestPayment}
            style={[
              styles.actionButton,
              styles.payButton,
              (!paymentQr || isRequesting || isComplete) && styles.requestButtonDisabled,
            ]}>
            {isRequesting ? <ActivityIndicator color="#FFFFFF" size="small" /> : null}
            <Text style={styles.payButtonText}>{isComplete ? '결제 완료' : isRequesting ? '결제 중...' : '결제'}</Text>
          </AnimatedPressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#000000',
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 24,
    gap: 14,
    justifyContent: 'center',
  },
  confirmCard: {
    paddingHorizontal: 20,
    paddingBottom: 6,
    alignItems: 'center',
  },
  paymentLottie: {
    width: 178,
    height: 178,
  },
  confirmTitle: {
    marginTop: 10,
    color: '#FFFFFF',
    textAlign: 'center',
    ...FONTS.font24B,
    lineHeight: 31,
  },
  confirmDescription: {
    marginTop: 8,
    color: '#BFC1C7',
    textAlign: 'center',
    ...FONTS.font16M,
    lineHeight: 22,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
  },
  bottomButtonArea: {
    paddingHorizontal: 20,
    paddingTop: 12,
    backgroundColor: '#000000',
  },
  actionButton: {
    flex: 1,
    minHeight: 54,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  cancelButton: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: '#181818',
  },
  payButton: {
    backgroundColor: BRAND_RED,
  },
  requestButtonDisabled: {
    opacity: 0.48,
  },
  cancelButtonText: {
    color: '#FFFFFF',
    ...FONTS.font16B,
    lineHeight: 22,
  },
  payButtonText: {
    color: '#FFFFFF',
    ...FONTS.font16B,
    lineHeight: 22,
  },
});
