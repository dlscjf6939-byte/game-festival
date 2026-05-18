import React from 'react';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {CoinBattleRoomScreen} from '../screens/CoinBattleRoomScreen';
import {CoinBattleScreen} from '../screens/CoinBattleScreen';
import type {CoinBattleStackParamList} from './types';

const Stack = createNativeStackNavigator<CoinBattleStackParamList>();

export function CoinBattleNavigator(): JSX.Element {
  return (
    <Stack.Navigator screenOptions={{headerShown: false, animation: 'fade'}}>
      <Stack.Screen component={CoinBattleScreen} name="CoinBattleHome" />
      <Stack.Screen component={CoinBattleRoomScreen} name="CoinBattleRoom" />
    </Stack.Navigator>
  );
}
