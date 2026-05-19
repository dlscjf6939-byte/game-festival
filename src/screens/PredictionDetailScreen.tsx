import React, {useEffect, useRef, useState} from 'react';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {
  Animated,
  Pressable,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {AppGnb} from '../components/AppGnb';
import {TabSceneTransition} from '../components/TabSceneTransition';
import type {PredictionStackParamList} from '../navigation/types';
import {FONTS} from '../constants/theme';

const teams = [
  {id: 'team-red', name: 'TEAM RED'},
  {id: 'team-black', name: 'TEAM BLACK'},
];

function ChoiceCard({
  isSelected,
  onPress,
}: {
  isSelected: boolean;
  onPress: () => void;
}): JSX.Element {
  const selectAnim = useRef(new Animated.Value(isSelected ? 1 : 0)).current;
  const pressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(selectAnim, {
      toValue: isSelected ? 1 : 0,
      speed: 16,
      bounciness: 7,
      useNativeDriver: true,
    }).start();
  }, [isSelected, selectAnim]);

  const handlePressIn = () => {
    Animated.spring(pressAnim, {
      toValue: 1,
      speed: 26,
      bounciness: 4,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(pressAnim, {
      toValue: 0,
      speed: 18,
      bounciness: 8,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Animated.View
      style={[
        styles.choiceCardShell,
        {
          transform: [
            {
              scale: pressAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [1, 0.986],
              }),
            },
            {
              scale: selectAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [1, 1.01],
              }),
            },
          ],
        },
      ]}>
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}>
        <Animated.View
          style={[styles.choiceCard, isSelected && styles.choiceCardSelected]}>
          <View style={styles.placeholderArt} />

          <Animated.View
            style={[
              styles.selectChip,
              isSelected && styles.selectChipSelected,
              {
                transform: [
                  {
                    scale: selectAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [1, 1.08],
                    }),
                  },
                ],
              },
            ]}>
            <Text style={styles.selectChipText}>
              {isSelected ? '선택됨' : '선택'}
            </Text>
          </Animated.View>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

function BackIcon(): JSX.Element {
  return (
    <View style={styles.backIconWrap}>
      <View style={[styles.backStroke, styles.backStrokeTop]} />
      <View style={[styles.backStroke, styles.backStrokeBottom]} />
    </View>
  );
}

export function PredictionDetailScreen(): JSX.Element {
  const navigation =
    useNavigation<NativeStackNavigationProp<PredictionStackParamList>>();
  const [selectedTeam, setSelectedTeam] = useState<string>('team-red');

  return (
    <TabSceneTransition>
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="light-content" backgroundColor="#000000" />

        <View style={styles.screen}>
          <AppGnb />

          <View style={styles.backRow}>
            <Pressable
              accessibilityLabel="뒤로가기"
              accessibilityRole="button"
              onPress={() => navigation.goBack()}
              style={styles.backButton}>
              <BackIcon />
            </Pressable>
          </View>

          <View style={styles.heroBlock}>
            <Text style={styles.heroTitle}>
              어느 팀이{'\n'}우승을 할지 맞춰보세요.
            </Text>
            <Text style={styles.heroSubtitle}>
              경기 종료 후 결과가 발표돼요.
            </Text>
          </View>

          <View style={styles.cardList}>
            {teams.map(team => {
              const isSelected = selectedTeam === team.id;

              return (
                <ChoiceCard
                  key={team.id}
                  onPress={() => setSelectedTeam(team.id)}
                  isSelected={isSelected}
                />
              );
            })}
          </View>
        </View>
      </SafeAreaView>
    </TabSceneTransition>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#000000',
  },
  screen: {
    flex: 1,
    backgroundColor: '#000000',
  },
  backRow: {
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  backButton: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIconWrap: {
    width: 24,
    height: 24,
    justifyContent: 'center',
  },
  backStroke: {
    position: 'absolute',
    left: 4,
    width: 11,
    height: 2.5,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
  },
  backStrokeTop: {
    transform: [{rotate: '-45deg'}],
    top: 8,
  },
  backStrokeBottom: {
    transform: [{rotate: '45deg'}],
    top: 14,
  },
  heroBlock: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 48,
  },
  heroTitle: {
    color: '#FFFFFF',
    ...FONTS.font22B,
    lineHeight: 30,
  },
  heroSubtitle: {
    marginTop: 8,
    color: 'rgba(255,255,255,0.7)',
    ...FONTS.font16M,
    lineHeight: 21,
  },
  cardList: {
    paddingHorizontal: 20,
    gap: 20,
  },
  choiceCardShell: {},
  choiceCard: {
    height: 140,
    backgroundColor: '#D9D9D9',
    position: 'relative',
    overflow: 'hidden',
  },
  choiceCardSelected: {
    borderWidth: 1,
    borderColor: '#E50914',
  },
  placeholderArt: {
    flex: 1,
    backgroundColor: '#D9D9D9',
  },
  selectChip: {
    position: 'absolute',
    right: 12,
    bottom: 12,
    borderRadius: 30,
    paddingHorizontal: 12,
    paddingVertical: 8,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#E50914',
  },
  selectChipSelected: {
    backgroundColor: '#E50914',
  },
  selectChipText: {
    color: '#FFFFFF',
    ...FONTS.font14B,
    lineHeight: 18,
  },
});
