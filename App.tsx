import React from 'react';
import {DefaultTheme, NavigationContainer} from '@react-navigation/native';
import {StyleSheet, Text, TextInput} from 'react-native';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {AuthProvider} from './src/auth/AuthProvider';
import {FONT_FAMILY} from './src/constants/theme';
import {RootNavigator} from './src/navigation/RootNavigator';

const navigationTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: '#000000',
  },
};

type ComponentWithDefaultProps = {
  defaultProps?: {
    style?: unknown;
  };
};

function applyDefaultFont(Component: typeof Text | typeof TextInput) {
  const target = Component as ComponentWithDefaultProps;

  target.defaultProps = target.defaultProps ?? {};
  target.defaultProps.style = [
    {fontFamily: FONT_FAMILY.regular},
    target.defaultProps.style,
  ];
}

applyDefaultFont(Text);
applyDefaultFont(TextInput);

function App(): JSX.Element {
  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <AuthProvider>
          <NavigationContainer theme={navigationTheme}>
            <RootNavigator />
          </NavigationContainer>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});

export default App;
