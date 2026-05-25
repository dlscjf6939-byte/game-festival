import React, {useEffect, useRef, useState} from 'react';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {Animated, Platform, StyleSheet, View} from 'react-native';
import {useAuth} from '../auth/AuthProvider';
import {SplashScreen} from '../components/SplashScreen';
import {LoginScreen} from '../screens/LoginScreen';
import {ProfileSetupScreen} from '../screens/ProfileSetupScreen';
import {QrScanScreen} from '../screens/QrScanScreen';
import {MainNavigator} from './MainNavigator';
import type {RootStackParamList} from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

function isFirstLogin(firstLoginYn: unknown): boolean {
  return (
    firstLoginYn === undefined ||
    firstLoginYn === null ||
    firstLoginYn === true ||
    firstLoginYn === 'Y' ||
    firstLoginYn === 'y' ||
    firstLoginYn === 'true' ||
    firstLoginYn === '1'
  );
}

export function RootNavigator(): JSX.Element {
  const {auth, isRestoring} = useAuth();
  const [splashElapsed, setSplashElapsed] = useState(false);
  const [splashVisible, setSplashVisible] = useState(true);
  const splashOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const timer = setTimeout(() => {
      setSplashElapsed(true);
    }, 1200);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (isRestoring || !splashElapsed) {
      return;
    }

    Animated.timing(splashOpacity, {
      toValue: 0,
      duration: 520,
      useNativeDriver: true,
    }).start(({finished}) => {
      if (finished) {
        setSplashVisible(false);
      }
    });
  }, [isRestoring, splashElapsed, splashOpacity]);

  const splashScale = splashOpacity.interpolate({
    inputRange: [0, 1],
    outputRange: [1.04, 1],
  });

  return (
    <View style={styles.root}>
      {!isRestoring ? (
        <Stack.Navigator
          screenOptions={{headerShown: false, animation: 'fade'}}>
          {auth ? (
            <>
              {isFirstLogin(auth.firstLoginYn) ? (
                <Stack.Screen component={ProfileSetupScreen} name="ProfileSetup" />
              ) : (
                <Stack.Screen component={MainNavigator} name="Main" />
              )}
              <Stack.Screen
                component={QrScanScreen}
                name="QrScan"
                options={{
                  animation:
                    Platform.OS === 'ios'
                      ? 'slide_from_bottom'
                      : 'fade_from_bottom',
                  gestureDirection:
                    Platform.OS === 'ios' ? 'vertical' : undefined,
                  presentation:
                    Platform.OS === 'ios' ? 'fullScreenModal' : 'card',
                }}
              />
            </>
          ) : (
            <Stack.Screen component={LoginScreen} name="Login" />
          )}
        </Stack.Navigator>
      ) : null}

      {splashVisible ? (
        <SplashScreen
          style={[
            StyleSheet.absoluteFill,
            {
              opacity: splashOpacity,
              transform: [{scale: splashScale}],
            },
          ]}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000000',
  },
});
