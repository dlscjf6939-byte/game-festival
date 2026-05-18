import React, {useEffect, useRef, useState} from 'react';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {Animated, StyleSheet, View} from 'react-native';
import {useAuth} from '../auth/AuthProvider';
import {SplashScreen} from '../components/SplashScreen';
import {LoginScreen} from '../screens/LoginScreen';
import {MainNavigator} from './MainNavigator';
import type {RootStackParamList} from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

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
            <Stack.Screen component={MainNavigator} name="Main" />
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
