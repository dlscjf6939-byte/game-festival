import React, {useEffect, useRef} from 'react';
import {Animated, Easing, StyleSheet} from 'react-native';
import {useIsFocused} from '@react-navigation/native';

type TabSceneTransitionProps = {
  children: React.ReactNode;
};

export function TabSceneTransition({
  children,
}: TabSceneTransitionProps): JSX.Element {
  const isFocused = useIsFocused();
  const progress = useRef(new Animated.Value(isFocused ? 1 : 0)).current;

  useEffect(() => {
    if (isFocused) {
      progress.setValue(0);
      Animated.timing(progress, {
        toValue: 1,
        duration: 320,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }).start();
    }
  }, [isFocused, progress]);

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [
            {
              translateY: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [3, 0],
              }),
            },
            {
              scale: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [1.002, 1],
              }),
            },
          ],
        },
      ]}>
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
