import React from 'react';
import {StyleSheet, View} from 'react-native';

type TabSceneTransitionProps = {
  children: React.ReactNode;
};

export function TabSceneTransition({
  children,
}: TabSceneTransitionProps): JSX.Element {
  return <View style={styles.container}>{children}</View>;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
