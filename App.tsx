import React from 'react';
import {HotUpdater, type HotUpdaterFallbackComponentProps} from '@hot-updater/react-native';
import {DefaultTheme, NavigationContainer} from '@react-navigation/native';
import {StyleSheet, Text, TextInput, View} from 'react-native';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {AttendanceProvider} from './src/attendance/AttendanceProvider';
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

const HOT_UPDATER_BASE_URL = 'https://gkoofsjvyukiznogrmde.supabase.co/functions/v1/update-server';

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

function HotUpdaterFallback({progress, status}: HotUpdaterFallbackComponentProps): JSX.Element {
  const progressPercent = Math.round(progress * 100);

  return (
    <View style={styles.updateFallback}>
      <Text style={styles.updateFallbackTitle}>
        {status === 'UPDATING' ? '업데이트 적용 중...' : '업데이트 확인 중...'}
      </Text>
      {progress > 0 ? <Text style={styles.updateFallbackProgress}>{progressPercent}%</Text> : null}
    </View>
  );
}

function App(): JSX.Element {
  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <AuthProvider>
          <AttendanceProvider>
            <NavigationContainer theme={navigationTheme}>
              <RootNavigator />
            </NavigationContainer>
          </AttendanceProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  updateFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000000',
    paddingHorizontal: 24,
  },
  updateFallbackTitle: {
    color: '#FFFFFF',
    fontFamily: FONT_FAMILY.bold,
    fontSize: 18,
    includeFontPadding: false,
    lineHeight: 24,
  },
  updateFallbackProgress: {
    marginTop: 12,
    color: '#E50914',
    fontFamily: FONT_FAMILY.bold,
    fontSize: 28,
    includeFontPadding: false,
    lineHeight: 36,
  },
});

export default HotUpdater.wrap({
  baseURL: HOT_UPDATER_BASE_URL,
  updateStrategy: 'appVersion',
  fallbackComponent: HotUpdaterFallback,
  onError: error => {
    console.warn('[HotUpdater]', error);
  },
})(App);
