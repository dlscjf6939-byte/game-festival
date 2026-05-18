import React from 'react';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {PredictionDetailScreen} from '../screens/PredictionDetailScreen';
import {PredictionScreen} from '../screens/PredictionScreen';
import type {PredictionStackParamList} from './types';

const Stack = createNativeStackNavigator<PredictionStackParamList>();

export function PredictionNavigator(): JSX.Element {
  return (
    <Stack.Navigator
      initialRouteName="PredictionHome"
      screenOptions={{headerShown: false, animation: 'slide_from_right'}}>
      <Stack.Screen component={PredictionScreen} name="PredictionHome" />
      <Stack.Screen
        component={PredictionDetailScreen}
        name="PredictionDetail"
      />
    </Stack.Navigator>
  );
}
