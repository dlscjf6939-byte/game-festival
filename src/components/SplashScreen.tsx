import React, {useEffect, useRef} from 'react';
import {Animated, Easing, Image, StyleSheet, type StyleProp, type ViewStyle} from 'react-native';
import {image} from '../assets/images';

type SplashScreenProps = {
  style?: StyleProp<ViewStyle>;
};

export function SplashScreen({style}: SplashScreenProps): JSX.Element {
  const logoProgress = useRef(new Animated.Value(0)).current;
  const pulseProgress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseProgress, {
          toValue: 1,
          duration: 1100,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulseProgress, {
          toValue: 0,
          duration: 1100,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );

    Animated.timing(logoProgress, {
      toValue: 1,
      duration: 3000,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
    pulseLoop.start();

    return () => {
      logoProgress.stopAnimation();
      pulseLoop.stop();
    };
  }, [logoProgress, pulseProgress]);

  const logoOpacity = logoProgress.interpolate({
    inputRange: [0, 0.22, 1],
    outputRange: [0, 0.4, 1],
  });
  const logoScale = logoProgress.interpolate({
    inputRange: [0, 0.72, 1],
    outputRange: [0.84, 1.035, 1],
  });
  const logoTranslateY = logoProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [18, 0],
  });
  const pulseOpacity = pulseProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0.32, 1],
  });
  const pulseScaleX = pulseProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0.7, 1],
  });

  return (
    <Animated.View style={[styles.screen, style]}>
      <Animated.View
        style={[
          styles.logoWrap,
          {
            opacity: logoOpacity,
            transform: [{translateY: logoTranslateY}, {scale: logoScale}],
          },
        ]}>
        <Image source={image.logo} resizeMode="contain" style={styles.logo} />
      </Animated.View>
      <Animated.View
        style={[
          styles.loader,
          {
            opacity: pulseOpacity,
            transform: [{scaleX: pulseScaleX}],
          },
        ]}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000000',
    overflow: 'hidden',
  },
  logoWrap: {
    width: 246,
    height: 86,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 214,
    height: 64,
  },
  loader: {
    position: 'absolute',
    width: 86,
    height: 3,
    borderRadius: 2,
    bottom: 96,
    backgroundColor: '#E50914',
  },
});
