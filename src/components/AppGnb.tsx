import React, {useEffect, useRef, useState} from 'react';
import {Alert, Image, Linking, StyleSheet, View} from 'react-native';
import {useNavigation, type NavigationProp} from '@react-navigation/native';
import {icon} from '../assets/icons';
import {image} from '../assets/images';
import {useAuth} from '../auth/AuthProvider';
import {AnimatedPressable} from './AnimatedPressable';
import type {MainStackParamList, RootStackParamList} from '../navigation/types';

const SURVEY_FORM_URL = 'https://forms.gle/Lq5j3gAoJhPYzftw6';
const LOGO_LOGOUT_PRESS_COUNT = 5;
const LOGO_LOGOUT_PRESS_WINDOW_MS = 2000;

// 2026년 7월 3일 오후 4시 50분 KST
const SURVEY_VISIBLE_AT = new Date('2026-07-03T16:50:00+09:00').getTime();

function useSurveyVisible(): boolean {
  const [visible, setVisible] = useState(() => Date.now() >= SURVEY_VISIBLE_AT);

  useEffect(() => {
    if (visible) {
      return;
    }

    const remainingTime = SURVEY_VISIBLE_AT - Date.now();

    if (remainingTime <= 0) {
      setVisible(true);
      return;
    }

    const timer = setTimeout(() => {
      setVisible(true);
    }, remainingTime);

    return () => clearTimeout(timer);
  }, [visible]);

  return visible;
}

function HeaderAction({
  onPress,
  variant,
}: {
  onPress?: () => void;
  variant: 'bell' | 'coin' | 'survey';
}): JSX.Element {
  const isQrAction = variant === 'coin';
  const isSurveyAction = variant === 'survey';

  return (
    <AnimatedPressable
      accessibilityLabel={isQrAction ? 'QR 스캔' : isSurveyAction ? '설문조사' : '알림'}
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.headerAction, isSurveyAction && styles.surveyHeaderAction]}>
      <Image
        source={isSurveyAction ? icon.survey : variant === 'bell' ? image.noti : image.qrCode}
        style={[styles.headerActionIcon, isSurveyAction && styles.surveyHeaderActionIcon]}
      />
    </AnimatedPressable>
  );
}

type AppGnbProps = {
  scrollY?: unknown;
};

export function AppGnb(_: AppGnbProps): JSX.Element {
  const navigation = useNavigation<NavigationProp<MainStackParamList>>();
  const {clearAuth} = useAuth();
  const isSurveyVisible = useSurveyVisible();
  const logoPressCountRef = useRef(0);
  const logoPressResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (logoPressResetTimerRef.current) {
        clearTimeout(logoPressResetTimerRef.current);
      }
    };
  }, []);

  const handleLogoPress = () => {
    logoPressCountRef.current += 1;

    if (logoPressResetTimerRef.current) {
      clearTimeout(logoPressResetTimerRef.current);
    }

    logoPressResetTimerRef.current = setTimeout(() => {
      logoPressCountRef.current = 0;
      logoPressResetTimerRef.current = null;
    }, LOGO_LOGOUT_PRESS_WINDOW_MS);

    if (logoPressCountRef.current >= LOGO_LOGOUT_PRESS_COUNT) {
      logoPressCountRef.current = 0;

      if (logoPressResetTimerRef.current) {
        clearTimeout(logoPressResetTimerRef.current);
        logoPressResetTimerRef.current = null;
      }

      clearAuth().catch(() => {
        Alert.alert('로그아웃할 수 없습니다', '잠시 후 다시 시도해주세요.');
      });
      return;
    }

    if (navigation.getState().routeNames.includes('Home')) {
      navigation.navigate('Home');
      return;
    }

    const parentNavigation = navigation.getParent<NavigationProp<RootStackParamList>>();
    parentNavigation?.navigate('Main', {screen: 'Home'});
  };

  const handleQrPress = () => {
    const parentNavigation = navigation.getParent<NavigationProp<RootStackParamList>>();
    parentNavigation?.navigate('QrScan');
  };

  const handleSurveyPress = () => {
    Linking.openURL(SURVEY_FORM_URL).catch(() => {
      Alert.alert('설문조사를 열 수 없습니다', '잠시 후 다시 시도해주세요.');
    });
  };

  return (
    <View style={styles.gnb}>
      <AnimatedPressable
        accessibilityLabel="홈으로 이동"
        accessibilityRole="button"
        onPress={handleLogoPress}
        style={styles.logoButton}>
        <Image source={image.logo} style={styles.logoImage} resizeMode="contain" />
      </AnimatedPressable>

      <View style={styles.gnbActions}>
        {/* <HeaderAction variant="bell" /> */}

        {isSurveyVisible && <HeaderAction onPress={handleSurveyPress} variant="survey" />}

        <HeaderAction onPress={handleQrPress} variant="coin" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  gnb: {
    height: 56,
    paddingHorizontal: 20,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  logoImage: {
    width: 107,
  },
  logoButton: {
    minWidth: 107,
    height: 28,
    justifyContent: 'center',
  },
  gnbActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerAction: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  surveyHeaderAction: {
    width: 36,
    height: 36,
  },
  headerActionIcon: {
    width: 28,
    height: 28,
  },
  surveyHeaderActionIcon: {
    width: 28,
    height: 28,
  },
});
