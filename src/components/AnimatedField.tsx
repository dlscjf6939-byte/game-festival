import React, {useEffect, useRef, useState} from 'react';
import {
  Animated,
  Easing,
  StyleSheet,
  TextInput,
  type TextInputProps,
  View,
} from 'react-native';
import {FONTS} from '../constants/theme';

type AnimatedFieldProps = TextInputProps & {
  value: string;
};

export function AnimatedField({
  value,
  ...props
}: AnimatedFieldProps): JSX.Element {
  const [isFocused, setIsFocused] = useState(false);
  const focusAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(focusAnim, {
      toValue: isFocused || value.trim().length > 0 ? 1 : 0,
      duration: 420,
      easing: Easing.inOut(Easing.ease),
      useNativeDriver: true,
    }).start();
  }, [focusAnim, isFocused, value]);

  return (
    <View style={styles.inputFrame}>
      <TextInput
        {...props}
        onBlur={event => {
          setIsFocused(false);
          props.onBlur?.(event);
        }}
        onFocus={event => {
          setIsFocused(true);
          props.onFocus?.(event);
        }}
        style={styles.input}
        value={value}
      />
      <Animated.View
        pointerEvents="none"
        style={[
          styles.inputHighlight,
          {
            opacity: focusAnim,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  inputFrame: {
    width: '100%',
    height: 48,
    position: 'relative',
  },
  inputHighlight: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#D90B17',
    backgroundColor: 'transparent',
    zIndex: 2,
  },
  input: {
    width: '100%',
    height: '100%',
    paddingHorizontal: 16,
    paddingVertical: 13,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E9EAEF',
    color: '#111111',
    ...FONTS.font16R,
    lineHeight: 21,
    zIndex: 1,
  },
});
