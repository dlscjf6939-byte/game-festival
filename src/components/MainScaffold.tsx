import React, {useRef} from 'react';
import {
  Animated,
  RefreshControl,
  SafeAreaView,
  type ScrollView,
  StatusBar,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import {AppGnb} from './AppGnb';
import {TabSceneTransition} from './TabSceneTransition';
import {registerScrollToTopHandler} from '../navigation/scrollToTopEvents';
import type {MainStackParamList} from '../navigation/types';

type MainScaffoldProps = {
  children: React.ReactNode;
  contentContainerStyle?: StyleProp<ViewStyle>;
  fixedFooter?: React.ReactNode;
  onRefresh?: () => void;
  refreshing?: boolean;
  stickyHeader?: React.ReactNode;
  stickyHeaderThreshold?: number;
  scrollToTopRouteName?: keyof MainStackParamList;
};

export function MainScaffold({
  children,
  contentContainerStyle,
  fixedFooter,
  onRefresh,
  refreshing = false,
  stickyHeader,
  stickyHeaderThreshold = 120,
  scrollToTopRouteName,
}: MainScaffoldProps): JSX.Element {
  const scrollY = useRef(new Animated.Value(0)).current;
  const scrollRef = useRef<ScrollView | null>(null);
  const stickyHeaderOpacity = scrollY.interpolate({
    inputRange: [stickyHeaderThreshold - 42, stickyHeaderThreshold],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });
  const stickyHeaderTranslateY = scrollY.interpolate({
    inputRange: [stickyHeaderThreshold - 42, stickyHeaderThreshold],
    outputRange: [-4, 0],
    extrapolate: 'clamp',
  });

  React.useEffect(() => {
    if (!scrollToTopRouteName) {
      return undefined;
    }

    return registerScrollToTopHandler(scrollToTopRouteName, () => {
      scrollRef.current?.scrollTo({animated: true, y: 0});
    });
  }, [scrollToTopRouteName]);

  return (
    <TabSceneTransition>
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="light-content" backgroundColor="#000000" />

        <AppGnb scrollY={scrollY} />

        <Animated.ScrollView
          ref={scrollRef}
          bounces={Boolean(onRefresh)}
          contentContainerStyle={[styles.content, contentContainerStyle]}
          refreshControl={
            onRefresh ? (
              <RefreshControl
                colors={['#E50914']}
                progressBackgroundColor="#151519"
                refreshing={refreshing}
                tintColor="#FFFFFF"
                onRefresh={onRefresh}
              />
            ) : undefined
          }
          showsVerticalScrollIndicator={false}
          onScroll={Animated.event(
            [{nativeEvent: {contentOffset: {y: scrollY}}}],
            {useNativeDriver: true},
          )}
          scrollEventThrottle={16}>
          <View style={styles.body}>{children}</View>
        </Animated.ScrollView>
        {stickyHeader ? (
          <Animated.View
            pointerEvents="box-none"
            style={[
              styles.stickyHeader,
              {
                opacity: stickyHeaderOpacity,
                transform: [{translateY: stickyHeaderTranslateY}],
              },
            ]}>
            {stickyHeader}
          </Animated.View>
        ) : null}
        {fixedFooter ? <View style={styles.fixedFooter}>{fixedFooter}</View> : null}
      </SafeAreaView>
    </TabSceneTransition>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#000000',
  },
  content: {
    paddingBottom: 36,
  },
  body: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  stickyHeader: {
    position: 'absolute',
    top: 102,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 8,
    // backgroundColor: '#000000',
  },
  fixedFooter: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
});
