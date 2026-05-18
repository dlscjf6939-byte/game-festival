import React from 'react';
import {
  ActivityIndicator,
  Animated,
  Image,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import {image} from '../assets/images';

type SplashScreenProps = {
  style?: StyleProp<ViewStyle>;
};

export function SplashScreen({style}: SplashScreenProps): JSX.Element {
  return (
    <Animated.View style={[styles.screen, style]}>
      <Image source={image.logo} resizeMode="contain" style={styles.logo} />
      <ActivityIndicator color="#FFFFFF" style={styles.loader} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000000',
  },
  logo: {
    width: 214,
    height: 64,
  },
  loader: {
    position: 'absolute',
    bottom: 96,
  },
});
