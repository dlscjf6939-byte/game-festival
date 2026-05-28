import React from 'react';
import {Image, StyleSheet, View} from 'react-native';
import {useNavigation, type NavigationProp} from '@react-navigation/native';
import {image} from '../assets/images';
import {AnimatedPressable} from './AnimatedPressable';
import type {
  MainStackParamList,
  RootStackParamList,
} from '../navigation/types';

function HeaderAction({
  onPress,
  variant,
}: {
  onPress?: () => void;
  variant: 'bell' | 'coin';
}): JSX.Element {
  return (
    <AnimatedPressable
      accessibilityLabel={variant === 'coin' ? 'QR 스캔' : '알림'}
      accessibilityRole="button"
      onPress={onPress}
      style={styles.headerAction}>
      <Image
        source={variant === 'bell' ? image.noti : image.qrCode}
        style={styles.headerActionIcon}
      />
    </AnimatedPressable>
  );
}

type AppGnbProps = {
  scrollY?: unknown;
};

export function AppGnb(_: AppGnbProps): JSX.Element {
  const navigation = useNavigation<NavigationProp<MainStackParamList>>();

  const handleQrPress = () => {
    const parentNavigation =
      navigation.getParent<NavigationProp<RootStackParamList>>();

    parentNavigation?.navigate('QrScan');
  };

  return (
    <View style={styles.gnb}>
      <Image
        source={image.logo}
        style={styles.logoImage}
        resizeMode="contain"
      />
      <View style={styles.gnbActions}>
        <HeaderAction variant="bell" />
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
  headerActionIcon: {
    width: 28,
    height: 28,
  },
});
