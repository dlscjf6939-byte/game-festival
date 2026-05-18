import React, {useRef} from 'react';
import {
  Animated,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import {AppGnb} from './AppGnb';
import {TabSceneTransition} from './TabSceneTransition';

type MainScaffoldProps = {
  children: React.ReactNode;
  contentContainerStyle?: StyleProp<ViewStyle>;
};

export function MainScaffold({
  children,
  contentContainerStyle,
}: MainScaffoldProps): JSX.Element {
  const scrollY = useRef(new Animated.Value(0)).current;

  return (
    <TabSceneTransition>
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="light-content" backgroundColor="#000000" />

        <AppGnb scrollY={scrollY} />

        <Animated.ScrollView
          bounces={false}
          contentContainerStyle={[styles.content, contentContainerStyle]}
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
