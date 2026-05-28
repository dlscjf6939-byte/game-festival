import React, {useRef} from 'react';
import {
  Animated,
  Pressable,
  type GestureResponderEvent,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

type AnimatedPressableProps = Omit<PressableProps, 'style'> & {
  activeScale?: number;
  style?: StyleProp<ViewStyle>;
};

const AnimatedPressableBase = Animated.createAnimatedComponent(Pressable);

export function AnimatedPressable({
  activeScale = 0.97,
  children,
  disabled,
  onPressIn,
  onPressOut,
  style,
  ...props
}: AnimatedPressableProps): JSX.Element {
  const pressScale = useRef(new Animated.Value(1)).current;

  const animateScale = (toValue: number) => {
    Animated.spring(pressScale, {
      toValue,
      speed: 38,
      bounciness: 5,
      useNativeDriver: true,
    }).start();
  };

  const handlePressIn = (event: GestureResponderEvent) => {
    if (!disabled) {
      animateScale(activeScale);
    }

    onPressIn?.(event);
  };

  const handlePressOut = (event: GestureResponderEvent) => {
    if (!disabled) {
      animateScale(1);
    }

    onPressOut?.(event);
  };

  return (
    <AnimatedPressableBase
      {...props}
      disabled={disabled}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[style, {transform: [{scale: pressScale}]}]}>
      {children}
    </AnimatedPressableBase>
  );
}
