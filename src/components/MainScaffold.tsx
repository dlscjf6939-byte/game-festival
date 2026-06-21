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
  onRefresh?: () => void;
  refreshing?: boolean;
  scrollToTopRouteName?: keyof MainStackParamList;
};

export function MainScaffold({
  children,
  contentContainerStyle,
  onRefresh,
  refreshing = false,
  scrollToTopRouteName,
}: MainScaffoldProps): JSX.Element {
  const scrollY = useRef(new Animated.Value(0)).current;
  const scrollRef = useRef<ScrollView | null>(null);

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
});
