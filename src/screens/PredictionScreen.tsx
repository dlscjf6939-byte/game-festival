import React, {useRef} from 'react';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {
  Animated,
  Image,
  Pressable,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {AppGnb} from '../components/AppGnb';
import {TabSceneTransition} from '../components/TabSceneTransition';
import {image} from '../assets/images';
import type {PredictionStackParamList} from '../navigation/types';
import {FONTS} from '../constants/theme';

const predictionCards = [
  {
    id: 'tekken7',
    title: '철권7',
    description:
      '게임설명이 들어가가 낭 랄랄리릴아러알ㅇ어쩌고 저쩌고입니다. 어리아리아ㅣ라ㅣㅇ리아ㅣㅏ라',
    posterSource: image.tekken,
    wordmarkSource: image.tekkenLetter,
  },
  {
    id: 'starcraft',
    title: '스타크래프트',
    description:
      '게임설명이 들어가가 낭 랄랄리릴아러알ㅇ어쩌고 저쩌고입니다. 어리아리아ㅣ라ㅣㅇ리아ㅣㅏ라',
    posterSource: image.starcraft,
    wordmarkSource: image.starcraftLetter,
  },
  {
    id: 'crazyarcade',
    title: '크레이지 아케이드',
    description:
      '게임설명이 들어가가 낭 랄랄리릴아러알ㅇ어쩌고 저쩌고입니다. 어리아리아ㅣ라ㅣㅇ리아ㅣㅏ라',
    posterSource: image.crazyarcade,
    wordmarkSource: image.crazyarcadeLetter,
  },
];

const tabs = [
  {id: 'prediction', label: '승부예측', active: true},
  {id: 'status', label: '현황', active: false},
];

export function PredictionScreen(): JSX.Element {
  const navigation =
    useNavigation<NativeStackNavigationProp<PredictionStackParamList>>();
  const scrollY = useRef(new Animated.Value(0)).current;

  return (
    <TabSceneTransition>
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="light-content" backgroundColor="#000000" />

        <AppGnb scrollY={scrollY} />

        <Animated.ScrollView
          bounces={false}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          onScroll={Animated.event(
            [{nativeEvent: {contentOffset: {y: scrollY}}}],
            {useNativeDriver: true},
          )}
          scrollEventThrottle={16}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>승부예측</Text>
          </View>

          <View style={styles.tabRow}>
            {tabs.map(tab => (
              <View
                key={tab.id}
                style={[styles.tabChip, tab.active && styles.tabChipActive]}>
                <Text
                  style={[
                    styles.tabChipText,
                    tab.active && styles.tabChipTextActive,
                  ]}>
                  {tab.label}
                </Text>
              </View>
            ))}
          </View>

          <View style={styles.cardStack}>
            {predictionCards.map(card => (
              <View key={card.id} style={styles.card}>
                <Image
                  source={card.posterSource}
                  resizeMode="cover"
                  style={styles.cardImage}
                />

                <View style={styles.cardContent}>
                  <Image
                    source={card.wordmarkSource}
                    resizeMode="contain"
                    style={styles.cardWordmark}
                  />
                  <Text style={styles.cardTitle}>{card.title}</Text>
                  <Text numberOfLines={2} style={styles.cardDescription}>
                    {card.description}
                  </Text>

                  <Pressable
                    onPress={() => navigation.navigate('PredictionDetail')}
                    style={styles.predictButton}>
                    <Text style={styles.predictButtonText}>예측하기</Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
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
  header: {
    height: 56,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  headerTitle: {
    color: '#FFFFFF',
    ...FONTS.font22B,
    lineHeight: 29,
  },
  tabRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    marginBottom: 22,
  },
  tabChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    backgroundColor: 'transparent',
  },
  tabChipActive: {
    backgroundColor: '#5E5252',
    borderColor: '#5E5252',
  },
  tabChipText: {
    color: 'rgba(255,255,255,0.8)',
    ...FONTS.font14M,
    lineHeight: 18,
  },
  tabChipTextActive: {
    color: 'rgba(255,255,255,0.8)',
  },
  cardStack: {
    paddingHorizontal: 20,
    gap: 20,
  },
  card: {
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.3)',
    borderRadius: 12,
    overflow: 'hidden',
    paddingBottom: 16,
    backgroundColor: '#000000',
  },
  cardImage: {
    width: '100%',
    height: 200,
    backgroundColor: '#545454',
  },
  cardContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  cardWordmark: {
    width: 172,
    height: 34,
    marginBottom: 4,
  },
  cardTitle: {
    color: '#FFFFFF',
    ...FONTS.font12B,
    lineHeight: 16,
    marginBottom: 4,
  },
  cardDescription: {
    color: 'rgba(255,255,255,0.7)',
    ...FONTS.font12M,
    lineHeight: 16,
    marginBottom: 20,
  },
  predictButton: {
    width: 119,
    height: 36,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  predictButtonText: {
    color: '#000000',
    ...FONTS.font14M,
    lineHeight: 24,
    letterSpacing: 0.5,
  },
});
