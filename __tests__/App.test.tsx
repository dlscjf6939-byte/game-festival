/**
 * @format
 */

import 'react-native';
import React from 'react';
import App from '../App';

// Note: import explicitly to use the types shiped with jest.
import {it, jest} from '@jest/globals';

// Note: test renderer must be required after react-native.
import renderer from 'react-test-renderer';

jest.mock('@react-navigation/native', () => ({
  DefaultTheme: {
    dark: false,
    colors: {
      primary: '#000000',
      background: '#000000',
      card: '#000000',
      text: '#FFFFFF',
      border: '#000000',
      notification: '#000000',
    },
  },
  NavigationContainer: ({children}: {children: React.ReactNode}) => children,
  useNavigation: () => ({
    navigate: jest.fn(),
  }),
}));

jest.mock('@react-navigation/native-stack', () => ({
  createNativeStackNavigator: () => ({
    Navigator: ({children}: {children: React.ReactNode}) => children,
    Screen: () => null,
  }),
}));

it('renders correctly', () => {
  renderer.create(<App />);
});
