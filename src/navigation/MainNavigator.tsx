import React, {useRef} from 'react';
import {
  Animated,
  Image,
  StyleSheet,
  type PressableProps,
} from 'react-native';
import {
  createBottomTabNavigator,
  type BottomTabBarButtonProps,
} from '@react-navigation/bottom-tabs';
import {getFocusedRouteNameFromRoute} from '@react-navigation/native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {icon} from '../assets/icons';
import {CoinProvider} from '../coin/CoinProvider';
import {FeedProvider} from '../feed/FeedProvider';
import {CoinsScreen} from '../screens/CoinsScreen';
import {FeedScreen} from '../screens/FeedScreen';
import MainScreen from '../screens/MainScreen';
import {CoinBattleNavigator} from './CoinBattleNavigator';
import {PredictionNavigator} from './PredictionNavigator';
import type {MainStackParamList} from './types';
import {AnimatedPressable} from '../components/AnimatedPressable';
import {FONTS} from '../constants/theme';
import {emitScrollToTop} from './scrollToTopEvents';

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
  homeTabVisual: {
    minWidth: 62,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{translateY: -14}],
  },
  homeTabCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E50914',
    borderWidth: 4,
    borderColor: '#000000',
    shadowColor: '#000000',
    shadowOpacity: 0.28,
    shadowRadius: 14,
    shadowOffset: {width: 0, height: 8},
    elevation: 10,
  },
  homeTabCircleDimmed: {
    backgroundColor: '#2A2A2D',
    shadowOpacity: 0.12,
  },
  homeTabIcon: {
    width: 25,
    height: 25,
  },
  homeTabIconWhite: {
    tintColor: '#FFFFFF',
  },
  homeTabLabel: {
    marginTop: 3,
    color: '#FFFFFF',
    ...FONTS.font11B,
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
  if (routeName === 'Home') {
    return (
      <Animated.View style={styles.homeTabVisual}>
        <Animated.View style={[styles.homeTabCircle, !focused && styles.homeTabCircleDimmed]}>
          <Image resizeMode="contain" source={TAB_ICONS.Home} style={[styles.homeTabIcon, styles.homeTabIconWhite]} />
        </Animated.View>
        <Animated.Text style={[styles.homeTabLabel, !focused && {color}]}>홈</Animated.Text>
      </Animated.View>
    );
  }

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

function FeedTabScreen(): JSX.Element {
  return (
    <FeedProvider>
      <FeedScreen />
    </FeedProvider>
  );
}

function TabButton({
  children,
  onPress,
  onLongPress,
  routeName,
  accessibilityState,
}: BottomTabBarButtonProps & {routeName: VisibleTabRoute}): JSX.Element {
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
    emitScrollToTop(routeName);
  };

  return (
    <AnimatedPressable
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
    </AnimatedPressable>
  );
}

function renderHomeTabButton(props: BottomTabBarButtonProps): JSX.Element {
  return <TabButton {...props} routeName="Home" />;
}

function renderCoinsTabButton(props: BottomTabBarButtonProps): JSX.Element {
  return <TabButton {...props} routeName="Coins" />;
}

function renderFeedTabButton(props: BottomTabBarButtonProps): JSX.Element {
  return <TabButton {...props} routeName="Feed" />;
}

function renderCoinBattleTabButton(props: BottomTabBarButtonProps): JSX.Element {
  return <TabButton {...props} routeName="CoinBattle" />;
}

function renderPredictionTabButton(props: BottomTabBarButtonProps): JSX.Element {
  return <TabButton {...props} routeName="Prediction" />;
}

export function MainNavigator(): JSX.Element {
  const insets = useSafeAreaInsets();
  const tabBarStyle = {
    backgroundColor: '#0B0B0B',
    borderTopColor: '#161616',
    borderTopWidth: 1,
    height: 56 + insets.bottom + 10,
    overflow: 'visible' as const,
    paddingTop: 10,
    paddingBottom: Math.max(insets.bottom, 12),
  };

  return (
    <CoinProvider>
      <Tab.Navigator
        initialRouteName="Home"
        sceneContainerStyle={styles.sceneContainer}
        screenOptions={{
          headerShown: false,
          tabBarStyle,
          tabBarActiveTintColor: '#FFFFFF',
          tabBarInactiveTintColor: '#6F7279',
          tabBarShowLabel: false,
          tabBarItemStyle: {
            justifyContent: 'center',
          },
        }}>
        <Tab.Screen
          component={CoinsScreen}
          name="Coins"
          options={{tabBarButton: renderCoinsTabButton, tabBarIcon: CoinsTabIcon}}
        />
        <Tab.Screen
          component={FeedTabScreen}
          name="Feed"
          options={{tabBarButton: renderFeedTabButton, tabBarIcon: FeedTabIcon}}
        />
        <Tab.Screen
          component={MainScreen}
          name="Home"
          options={{tabBarButton: renderHomeTabButton, tabBarIcon: HomeTabIcon}}
        />
        <Tab.Screen
          component={CoinBattleNavigator}
          name="CoinBattle"
          options={({route}) => {
            const focusedRouteName = getFocusedRouteNameFromRoute(route) ?? 'CoinBattleHome';
            const shouldHideTabBar = focusedRouteName === 'CoinBattleRoom';

            return {
              tabBarButton: renderCoinBattleTabButton,
              tabBarIcon: CoinBattleTabIcon,
              tabBarStyle: shouldHideTabBar
                ? {...tabBarStyle, display: 'none'}
                : tabBarStyle,
            };
          }}
        />
        <Tab.Screen
          component={PredictionNavigator}
          name="Prediction"
          options={{tabBarButton: renderPredictionTabButton, tabBarIcon: PredictionTabIcon}}
        />
      </Tab.Navigator>
    </CoinProvider>
  );
}
