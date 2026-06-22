import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  Animated,
  PanResponder,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import {FONTS} from '../constants/theme';
import {AnimatedPressable} from './AnimatedPressable';

const SEGMENTED_TAB_PADDING = 5;

export type SlidingSegmentedTabOption<T extends string | number> = {
  id: T;
  label: string;
};

type SlidingSegmentedTabsProps<T extends string | number> = {
  activeTab: T;
  onTabPress: (tabId: T) => void;
  style?: StyleProp<ViewStyle>;
  tabs: readonly SlidingSegmentedTabOption<T>[];
};

type SwipeableTabViewProps<T extends string | number> = {
  activeTab: T;
  children: React.ReactNode;
  onTabPress: (tabId: T) => void;
  style?: StyleProp<ViewStyle>;
  tabs: readonly SlidingSegmentedTabOption<T>[];
};

function getTabIndex<T extends string | number>(tabs: readonly SlidingSegmentedTabOption<T>[], activeTab: T): number {
  return Math.max(0, tabs.findIndex(tab => tab.id === activeTab));
}

export function SlidingSegmentedTabs<T extends string | number>({
  activeTab,
  onTabPress,
  style,
  tabs,
}: SlidingSegmentedTabsProps<T>): JSX.Element {
  const slideProgress = useRef(new Animated.Value(getTabIndex(tabs, activeTab))).current;
  const [rowWidth, setRowWidth] = useState(0);
  const tabCount = Math.max(tabs.length, 1);
  const indicatorWidth = rowWidth > 0 ? (rowWidth - SEGMENTED_TAB_PADDING * 2) / tabCount : 0;
  const activeIndex = getTabIndex(tabs, activeTab);
  const indicatorTranslateX = slideProgress.interpolate({
    inputRange: tabs.map((_, index) => index),
    outputRange: tabs.map((_, index) => index * indicatorWidth),
    extrapolate: 'clamp',
  });

  useEffect(() => {
    Animated.spring(slideProgress, {
      toValue: activeIndex,
      speed: 22,
      bounciness: 0,
      useNativeDriver: true,
    }).start();
  }, [activeIndex, slideProgress]);

  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    setRowWidth(event.nativeEvent.layout.width);
  }, []);

  return (
    <View onLayout={handleLayout} style={[styles.row, style]}>
      {indicatorWidth > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.indicator,
            {
              width: indicatorWidth,
              transform: [{translateX: indicatorTranslateX}],
            },
          ]}
        />
      ) : null}

      {tabs.map(tab => {
        const isActive = activeTab === tab.id;

        return (
          <AnimatedPressable
            key={tab.id}
            accessibilityRole="button"
            onPress={() => onTabPress(tab.id)}
            style={styles.chip}>
            <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.text, isActive && styles.textActive]}>
              {tab.label}
            </Text>
          </AnimatedPressable>
        );
      })}
    </View>
  );
}

export function SwipeableTabView<T extends string | number>({
  activeTab,
  children,
  onTabPress,
  style,
  tabs,
}: SwipeableTabViewProps<T>): JSX.Element {
  const activeIndex = getTabIndex(tabs, activeTab);
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gestureState) => {
          if (tabs.length < 2) {
            return false;
          }

          const absDx = Math.abs(gestureState.dx);
          const absDy = Math.abs(gestureState.dy);

          return absDx > 36 && absDx > absDy * 1.35;
        },
        onPanResponderRelease: (_, gestureState) => {
          const absDx = Math.abs(gestureState.dx);
          const absDy = Math.abs(gestureState.dy);

          if (absDx < 52 || absDx < absDy * 1.2) {
            return;
          }

          const nextIndex = gestureState.dx < 0 ? activeIndex + 1 : activeIndex - 1;
          const nextTab = tabs[nextIndex];

          if (nextTab) {
            onTabPress(nextTab.id);
          }
        },
      }),
    [activeIndex, onTabPress, tabs],
  );

  return (
    <View style={style} {...panResponder.panHandlers}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    height: 52,
    padding: SEGMENTED_TAB_PADDING,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: '#070708',
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: {width: 0, height: 10},
    shadowOpacity: 0.22,
    shadowRadius: 16,
    elevation: 4,
  },
  indicator: {
    position: 'absolute',
    top: SEGMENTED_TAB_PADDING,
    bottom: SEGMENTED_TAB_PADDING,
    left: SEGMENTED_TAB_PADDING,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    backgroundColor: '#E50914',
    shadowColor: '#E50914',
    shadowOffset: {width: 0, height: 8},
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
  },
  chip: {
    flex: 1,
    height: '100%',
    paddingHorizontal: 10,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  text: {
    color: '#8F8F95',
    ...FONTS.font14B,
    lineHeight: 18,
  },
  textActive: {
    color: '#FFFFFF',
  },
});
