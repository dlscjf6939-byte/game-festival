import React, {useEffect, useRef, useState} from 'react';
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
  {id: 'prediction', label: '승부예측'},
  {id: 'participated', label: '참여예측'},
] as const;

type PredictionTabId = (typeof tabs)[number]['id'];

const participatedPredictions = [
  {
    id: 'tekken7',
    title: '철권7 결승전',
    selectedTeam: 'TEAM RED',
    cheerComment: '레드팀 오늘 합이 너무 좋아요. 마지막까지 밀어붙입시다!',
    redPercent: 54,
    blackPercent: 46,
    status: '결과 대기중',
    isParticipated: true,
  },
  {
    id: 'starcraft',
    title: '스타크래프트 라이벌전',
    selectedTeam: null,
    cheerComment: null,
    redPercent: 49,
    blackPercent: 51,
    status: '참여 가능',
    isParticipated: false,
  },
];

type ParticipatedPrediction = (typeof participatedPredictions)[number];

function ParticipatedPredictionCard({
  isActive,
  item,
  onDetailPress,
  onPress,
}: {
  isActive: boolean;
  item: ParticipatedPrediction;
  onDetailPress: () => void;
  onPress: () => void;
}): JSX.Element {
  const liftProgress = useRef(new Animated.Value(isActive ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(liftProgress, {
      toValue: isActive ? 1 : 0,
      speed: 18,
      bounciness: 7,
      useNativeDriver: true,
    }).start();
  }, [isActive, liftProgress]);

  return (
    <Animated.View
      style={[
        styles.participatedCardLift,
        isActive && styles.participatedCardLiftActive,
        {
          transform: [
            {
              translateY: liftProgress.interpolate({
                inputRange: [0, 1],
              outputRange: [0, -4],
              }),
            },
            {
              scale: liftProgress.interpolate({
                inputRange: [0, 1],
              outputRange: [1, 1.012],
              }),
            },
          ],
        },
      ]}>
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        style={[styles.participatedCard, isActive && styles.participatedCardActive]}>
        <View style={styles.participatedHeader}>
          <View>
            <Text style={styles.participatedTitle}>{item.title}</Text>
            <Text
              style={[
                styles.participatedStatus,
                item.isParticipated && styles.participatedStatusDone,
              ]}>
              {item.status}
            </Text>
          </View>
          {item.isParticipated ? (
            <View style={styles.selectedTeamBadge}>
              <Text style={styles.selectedTeamBadgeText}>{item.selectedTeam}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.predictionSummaryRow}>
          <Text style={styles.predictionSummaryLabel}>
            {item.isParticipated ? '내 선택' : '상태'}
          </Text>
          <Text style={styles.predictionSummaryValue}>
            {item.isParticipated ? item.selectedTeam : '아직 참여하지 않음'}
          </Text>
        </View>

        <View style={styles.participatedGraph}>
          <View style={[styles.participatedGraphRed, {flex: item.redPercent}]} />
          <View style={[styles.participatedGraphBlack, {flex: item.blackPercent}]} />
        </View>
        <View style={styles.participatedRatioRow}>
          <Text style={styles.participatedRatioText}>TEAM RED {item.redPercent}%</Text>
          <Text style={styles.participatedRatioText}>TEAM BLACK {item.blackPercent}%</Text>
        </View>

        {isActive ? (
          <Animated.View
            style={[
              styles.cardDetailActionWrap,
              {
                opacity: liftProgress,
                transform: [
                  {
                    translateY: liftProgress.interpolate({
                      inputRange: [0, 1],
                      outputRange: [8, 0],
                    }),
                  },
                ],
              },
            ]}>
            <Pressable
              accessibilityRole="button"
              onPress={onDetailPress}
              style={item.isParticipated ? styles.detailButton : styles.joinPredictionButton}>
              <Text
                style={
                  item.isParticipated
                    ? styles.detailButtonText
                    : styles.joinPredictionButtonText
                }>
                {item.isParticipated ? '상세보기' : '예측 참여하기'}
              </Text>
            </Pressable>
          </Animated.View>
        ) : null}
      </Pressable>
    </Animated.View>
  );
}

export function PredictionScreen(): JSX.Element {
  const navigation =
    useNavigation<NativeStackNavigationProp<PredictionStackParamList>>();
  const scrollY = useRef(new Animated.Value(0)).current;
  const [activeTab, setActiveTab] = useState<PredictionTabId>('prediction');
  const [activePredictionId, setActivePredictionId] = useState<string | null>(null);

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
              <Pressable
                key={tab.id}
                accessibilityRole="button"
                onPress={() => setActiveTab(tab.id)}
                style={[
                  styles.tabChip,
                  activeTab === tab.id && styles.tabChipActive,
                ]}>
                <Text
                  style={[
                    styles.tabChipText,
                    activeTab === tab.id && styles.tabChipTextActive,
                  ]}>
                  {tab.label}
                </Text>
              </Pressable>
            ))}
          </View>

          {activeTab === 'prediction' ? (
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
          ) : (
            <View style={styles.participatedStack}>
              {participatedPredictions.map(item => (
                <ParticipatedPredictionCard
                  key={item.id}
                  item={item}
                  isActive={activePredictionId === item.id}
                  onPress={() => setActivePredictionId(item.id)}
                  onDetailPress={() => navigation.navigate('PredictionDetail')}
                />
              ))}
            </View>
          )}
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
  participatedStack: {
    paddingHorizontal: 20,
    gap: 12,
  },
  participatedCardLift: {
    borderRadius: 22,
  },
  participatedCardLiftActive: {
    zIndex: 3,
    shadowColor: '#F40D21',
    shadowOpacity: 0.14,
    shadowRadius: 12,
    shadowOffset: {width: 0, height: 6},
    elevation: 4,
  },
  participatedCard: {
    borderRadius: 18,
    padding: 16,
    backgroundColor: '#111114',
    borderWidth: 1,
    borderColor: '#242428',
  },
  participatedCardActive: {
    borderWidth: 1,
    borderColor: '#F40D21',
    backgroundColor: '#141012',
  },
  participatedHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  participatedTitle: {
    color: '#FFFFFF',
    ...FONTS.font17B,
    lineHeight: 23,
  },
  participatedStatus: {
    marginTop: 5,
    color: '#8A8D95',
    ...FONTS.font12M,
    lineHeight: 16,
  },
  participatedStatusDone: {
    color: '#FF6A61',
  },
  selectedTeamBadge: {
    minHeight: 26,
    borderRadius: 13,
    paddingHorizontal: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(244,13,33,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(244,13,33,0.42)',
  },
  selectedTeamBadgeText: {
    color: '#FFFFFF',
    ...FONTS.font11B,
    lineHeight: 15,
  },
  predictionSummaryRow: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  predictionSummaryLabel: {
    color: '#8A8D95',
    ...FONTS.font13M,
    lineHeight: 18,
  },
  predictionSummaryValue: {
    color: '#FFFFFF',
    ...FONTS.font14B,
    lineHeight: 19,
  },
  participatedGraph: {
    height: 8,
    marginTop: 14,
    borderRadius: 4,
    flexDirection: 'row',
    overflow: 'hidden',
    backgroundColor: '#242428',
  },
  participatedGraphRed: {
    backgroundColor: '#F40D21',
  },
  participatedGraphBlack: {
    backgroundColor: '#4B5568',
  },
  participatedRatioRow: {
    marginTop: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  participatedRatioText: {
    color: '#A9ABB2',
    ...FONTS.font12M,
    lineHeight: 16,
  },
  joinPredictionButton: {
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  joinPredictionButtonText: {
    color: '#000000',
    ...FONTS.font14B,
    lineHeight: 18,
  },
  cardDetailActionWrap: {
    marginTop: 16,
  },
  detailButton: {
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F40D21',
  },
  detailButtonText: {
    color: '#FFFFFF',
    ...FONTS.font14B,
    lineHeight: 18,
  },
});
