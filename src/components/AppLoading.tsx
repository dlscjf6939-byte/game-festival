import React from 'react';
import {StyleSheet, Text, UIManager, View} from 'react-native';
import LottieView from 'lottie-react-native';
import {FONTS} from '../constants/theme';

const loadingLottie = require('../assets/lotties/Loading.json');
const isLottieNativeAvailable = Boolean(UIManager.getViewManagerConfig?.('LottieAnimationView'));

type AppLoadingProps = {
  label?: string;
};

export function AppLoading({label = '불러오는 중...'}: AppLoadingProps): JSX.Element {
  return (
    <View style={styles.wrap}>
      {isLottieNativeAvailable ? (
        <LottieView autoPlay loop source={loadingLottie} style={styles.lottie} />
      ) : (
        <View style={styles.fallbackDot} />
      )}
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    minHeight: 220,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  lottie: {
    width: 92,
    height: 92,
  },
  fallbackDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#E50914',
  },
  label: {
    marginTop: 10,
    color: '#8A8D95',
    textAlign: 'center',
    ...FONTS.font14M,
    lineHeight: 19,
  },
});
