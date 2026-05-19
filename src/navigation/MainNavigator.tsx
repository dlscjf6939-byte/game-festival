import React, {useRef} from 'react';
import {
  Animated,
  Image,
  Pressable,
  StyleSheet,
  type PressableProps,
} from 'react-native';
import {
  createBottomTabNavigator,
  type BottomTabBarButtonProps,
} from '@react-navigation/bottom-tabs';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {icon} from '../assets/icons';
import {CoinsScreen} from '../screens/CoinsScreen';
import {FeedScreen} from '../screens/FeedScreen';
import MainScreen from '../screens/MainScreen';
import {CoinBattleNavigator} from './CoinBattleNavigator';
import {PredictionNavigator} from './PredictionNavigator';
import type {MainStackParamList} from './types';
import {FONTS} from '../constants/theme';

const Tab = createBottomTabNavigator<MainStackParamList>();
type VisibleTabRoute = keyof MainStackParamList;

const TAB_ICONS = {
  CoinBattle: icon.battle,
  Coins: icon.coin,
  Feed: icon.feed,
  Home: icon.home,
  Prediction: icon.vs,
} as const;

const TAB_LABELS: Record<VisibleTabRoute, string> = {
  CoinBattle: '코인대전',
  Coins: '코인',
  Feed: '피드',
  Home: '홈',
  Prediction: '승부예측',
};

const styles = StyleSheet.create({
  sceneContainer: {
    backgroundColor: '#000000',
  },
  tabVisual: {
    minWidth: 62,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabIcon: {
    width: 22,
    height: 22,
    marginBottom: 2,
  },
  tabLabel: {
    ...FONTS.font12B,
  },
  tabLabelFocused: {
    opacity: 1,
  },
  tabLabelDimmed: {
    opacity: 0.82,
  },
  tabIconFocused: {
    opacity: 1,
  },
  tabIconDimmed: {
    opacity: 0.76,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

function TabVisual({
  color,
  focused,
  routeName,
}: {
  color: string;
  focused: boolean;
  routeName: VisibleTabRoute;
}): JSX.Element {
  return (
    <Animated.View style={styles.tabVisual}>
      <Image
        resizeMode="contain"
        source={TAB_ICONS[routeName]}
        style={[
          styles.tabIcon,
          focused ? styles.tabIconFocused : styles.tabIconDimmed,
          {tintColor: color},
        ]}
      />
      <Animated.Text
        style={[
          styles.tabLabel,
          focused ? styles.tabLabelFocused : styles.tabLabelDimmed,
          {color},
        ]}>
        {TAB_LABELS[routeName]}
      </Animated.Text>
    </Animated.View>
  );
}

type TabIconProps = {
  color: string;
  focused: boolean;
};

function HomeTabIcon(props: TabIconProps): JSX.Element {
  return <TabVisual {...props} routeName="Home" />;
}

function CoinsTabIcon(props: TabIconProps): JSX.Element {
  return <TabVisual {...props} routeName="Coins" />;
}

function FeedTabIcon(props: TabIconProps): JSX.Element {
  return <TabVisual {...props} routeName="Feed" />;
}

function CoinBattleTabIcon(props: TabIconProps): JSX.Element {
  return <TabVisual {...props} routeName="CoinBattle" />;
}

function PredictionTabIcon(props: TabIconProps): JSX.Element {
  return <TabVisual {...props} routeName="Prediction" />;
}

function renderTabButton(props: BottomTabBarButtonProps): JSX.Element {
  return <TabButton {...props} />;
}

function TabButton({
  children,
  onPress,
  onLongPress,
  accessibilityState,
}: BottomTabBarButtonProps): JSX.Element {
  const pulse = useRef(new Animated.Value(0)).current;
  const isSelected = accessibilityState?.selected;

  const handlePress: PressableProps['onPress'] = event => {
    pulse.setValue(0);
    Animated.sequence([
      Animated.timing(pulse, {
        toValue: 1,
        duration: 120,
        useNativeDriver: true,
      }),
      Animated.spring(pulse, {
        toValue: 0,
        speed: 18,
        bounciness: 10,
        useNativeDriver: true,
      }),
    ]).start();
    onPress?.(event);
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={accessibilityState}
      onLongPress={onLongPress}
      onPress={handlePress}
      style={styles.tabButton}>
      <Animated.View
        style={{
          transform: [
            {
              translateY: pulse.interpolate({
                inputRange: [0, 1],
                outputRange: [0, -3],
              }),
            },
            {
              scale: pulse.interpolate({
                inputRange: [0, 1],
                outputRange: [1, isSelected ? 1.08 : 1.06],
              }),
            },
          ],
        }}>
        {children}
      </Animated.View>
    </Pressable>
  );
}

export function MainNavigator(): JSX.Element {
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      initialRouteName="Home"
      sceneContainerStyle={styles.sceneContainer}
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#0B0B0B',
          borderTopColor: '#161616',
          borderTopWidth: 1,
          height: 56 + insets.bottom + 10,
          paddingTop: 10,
          paddingBottom: Math.max(insets.bottom, 12),
        },
        tabBarActiveTintColor: '#FFFFFF',
        tabBarInactiveTintColor: '#6F7279',
        tabBarShowLabel: false,
        tabBarItemStyle: {
          justifyContent: 'center',
        },
        tabBarButton: renderTabButton,
      }}>
      <Tab.Screen
        component={MainScreen}
        name="Home"
        options={{tabBarIcon: HomeTabIcon}}
      />
      <Tab.Screen
        component={CoinsScreen}
        name="Coins"
        options={{tabBarIcon: CoinsTabIcon}}
      />
      <Tab.Screen
        component={FeedScreen}
        name="Feed"
        options={{tabBarIcon: FeedTabIcon}}
      />
      <Tab.Screen
        component={CoinBattleNavigator}
        name="CoinBattle"
        options={{tabBarIcon: CoinBattleTabIcon}}
      />
      <Tab.Screen
        component={PredictionNavigator}
        name="Prediction"
        options={{tabBarIcon: PredictionTabIcon}}
      />
    </Tab.Navigator>
  );
}
