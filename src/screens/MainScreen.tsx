import React, {useRef, useState} from 'react';
import {
  useFocusEffect,
  useNavigation,
  type CompositeNavigationProp,
  type NavigationProp,
} from '@react-navigation/native';
import {
  Animated,
  Dimensions,
  Easing,
  Image,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import LottieView from 'lottie-react-native';
import {useAttendance} from '../attendance/AttendanceProvider';
import {icon} from '../assets/icons';
import {image} from '../assets/images';
import {useAuth} from '../auth/AuthProvider';
import {useCoin} from '../coin/CoinProvider';
import {AnimatedPressable} from '../components/AnimatedPressable';
import {AppGnb} from '../components/AppGnb';
import {TabSceneTransition} from '../components/TabSceneTransition';
import {FONTS} from '../constants/theme';
import {getProfileImageUriFromRecord} from '../utils/profileImage';
import type {MainStackParamList, RootStackParamList} from '../navigation/types';
import {registerScrollToTopHandler} from '../navigation/scrollToTopEvents';

const {width: SCREEN_WIDTH} = Dimensions.get('window');

const STORY_CARD_WIDTH = 327;
const STORY_CARD_HEIGHT = 474;
const STORY_CARD_GAP = 18;
const STORY_ITEM_WIDTH = STORY_CARD_WIDTH + STORY_CARD_GAP;
const STORY_SNAP_INTERVAL = STORY_ITEM_WIDTH;
const WEEKDAY_LABELS = ['월', '화', '수', '목', '금', '토', '일'] as const;
const checkLottie = require('../assets/lotties/Check.json');
const fanfareLottie = require('../assets/lotties/Fanfare.json');

type MainScreenNavigation = CompositeNavigationProp<
  NavigationProp<MainStackParamList, 'Home'>,
  NavigationProp<RootStackParamList>
>;

const storyCards = [
  {
    id: 'left',
    posterImage: image.poster1,
    title: 'CRAZY ARCADE',
    subtitle: '크레이지 아케이드',
    accent: '#E50914',
    tag: 'LIVE BRACKET',
  },
  {
    id: 'center',
    posterImage: image.poster2,
    title: 'TEKKEN',
    subtitle: '철권',
    accent: '#E50914',
    tag: 'MAIN EVENT',
  },
  {
    id: 'right',
    posterImage: image.poster3,
    title: 'STARCRAFT',
    subtitle: '스타크래프트',
    accent: '#E50914',
    tag: 'RISING PICK',
  },
];

const bracketRoundsByStory = {
  left: [
    {
      id: 'round-8',
      label: '8강',
      matches: [
        {id: 'm1', left: 'TEAM RED', right: 'TEAM COBALT', leftScore: 2, rightScore: 1},
        {id: 'm2', left: 'TEAM NOVA', right: 'TEAM PULSE', leftScore: 0, rightScore: 2},
      ],
    },
    {
      id: 'round-4',
      label: '4강',
      matches: [{id: 'm3', left: 'TEAM RED', right: 'TEAM PULSE', leftScore: 2, rightScore: 0}],
    },
    {
      id: 'round-final',
      label: '결승',
      matches: [{id: 'm4', left: 'TEAM RED', right: 'TEAM ONYX', leftScore: 3, rightScore: 2}],
    },
  ],
  center: [
    {
      id: 'round-8',
      label: '8강',
      matches: [
        {id: 'm1', left: 'DRAGON X', right: 'RAVEN UNIT', leftScore: 2, rightScore: 0},
        {id: 'm2', left: 'KNOCKOUT', right: 'SUDDEN', leftScore: 1, rightScore: 2},
      ],
    },
    {
      id: 'round-4',
      label: '4강',
      matches: [{id: 'm3', left: 'DRAGON X', right: 'SUDDEN', leftScore: 2, rightScore: 1}],
    },
    {
      id: 'round-final',
      label: '결승',
      matches: [{id: 'm4', left: 'DRAGON X', right: 'VOID CORE', leftScore: 3, rightScore: 1}],
    },
  ],
  right: [
    {
      id: 'round-8',
      label: '8강',
      matches: [
        {id: 'm1', left: 'RISING WAVE', right: 'FROST LINE', leftScore: 2, rightScore: 1},
        {id: 'm2', left: 'BLACK MAMBA', right: 'PENTA', leftScore: 2, rightScore: 0},
      ],
    },
    {
      id: 'round-4',
      label: '4강',
      matches: [{id: 'm3', left: 'RISING WAVE', right: 'BLACK MAMBA', leftScore: 2, rightScore: 1}],
    },
    {
      id: 'round-final',
      label: '결승',
      matches: [{id: 'm4', left: 'RISING WAVE', right: 'TEMPEST', leftScore: 3, rightScore: 2}],
    },
  ],
} as const;

function parseDateKey(dateKey: string): Date | null {
  const [yearText, monthText, dayText] = dateKey.split('-');
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);

  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return null;
  }

  return new Date(year, month - 1, day);
}

function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function toCoinNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function MainScreen(): JSX.Element {
  const navigation = useNavigation<MainScreenNavigation>();
  const {auth, refreshProfile} = useAuth();
  const {
    accumulatedCoin: latestAccumulatedCoin,
    holdingCoin: latestHoldingCoin,
    rankingItems,
    isRankingLoading,
    refreshAllCoins,
  } = useCoin();
  const {attendance, checkInNotice, dismissCheckInNotice, isChecking, refreshAttendance} = useAttendance();
  const scrollX = useRef(new Animated.Value(STORY_SNAP_INTERVAL)).current;
  const scrollY = useRef(new Animated.Value(0)).current;
  const mainScrollRef = useRef<Animated.ScrollView | null>(null);
  const refreshProfileRef = useRef(refreshProfile);
  const refreshAllCoinsRef = useRef(refreshAllCoins);
  const refreshAttendanceRef = useRef(refreshAttendance);
  const attendanceModalProgress = useRef(new Animated.Value(0)).current;
  const attendanceModalShake = useRef(new Animated.Value(0)).current;
  const bracketFlipValues = useRef(
    storyCards.reduce((acc, card) => {
      acc[card.id] = new Animated.Value(0);
      return acc;
    }, {} as Record<(typeof storyCards)[number]['id'], Animated.Value>),
  ).current;
  const [flippedCardId, setFlippedCardId] = useState<(typeof storyCards)[number]['id'] | null>(null);
  const activeCheckInNotice = checkInNotice;
  const profile = auth?.profile;
  const coinBalance = latestHoldingCoin ?? toCoinNumber(profile?.holdingCoin) ?? 0;
  const department = typeof profile?.department === 'string' ? profile.department.trim() : '';
  const profileImageUri = getProfileImageUriFromRecord(profile);
  const profileImageSource = profileImageUri ? {uri: profileImageUri} : image.profile;
  const name = auth?.name ?? '이인철';
  const greetingPrefix = department || '서비스개발팀';
  const myRankingItem = rankingItems.find(item => item.isMe);
  const accumulatedCoin = latestAccumulatedCoin ?? toCoinNumber(profile?.accumulatedCoin) ?? 0;
  const rankingText = isRankingLoading ? '집계 중' : myRankingItem ? `${myRankingItem.rank}위` : '미집계';
  const checkedDateSet = new Set(attendance?.checkedDates ?? []);
  const todayKey = toDateKey(new Date());
  const weekStartDate = attendance?.weekStartDate ? parseDateKey(attendance.weekStartDate) : null;
  const attendanceBoard = WEEKDAY_LABELS.map((label, index) => {
    const targetDate = weekStartDate ? new Date(weekStartDate) : null;

    if (targetDate) {
      targetDate.setDate(targetDate.getDate() + index);
    }

    const dateKey = targetDate ? toDateKey(targetDate) : null;
    const isChecked = Boolean(dateKey && checkedDateSet.has(dateKey));
    const isUpcoming = Boolean(dateKey && dateKey > todayKey);

    return {
      isChecked,
      isMissed: Boolean(dateKey && !isChecked && !isUpcoming),
      isUpcoming,
      label,
    };
  });
  const attendanceCountText = attendance ? `${attendance.checkedThisWeekCount}/7` : '-/7';
  const modalWeeklyCount = activeCheckInNotice?.checkedThisWeekCount ?? attendance?.checkedThisWeekCount ?? 0;
  const weeklyRewardCoins = activeCheckInNotice?.weeklyRewardCoins ?? 0;
  const hasWeeklyReward = weeklyRewardCoins > 0;
  const attendanceModalBoard = activeCheckInNotice
    ? attendanceBoard.map((day, index) => ({
        ...day,
        isChecked: day.isChecked || index < modalWeeklyCount,
        isMissed: false,
      }))
    : attendanceBoard;
  const handleDismissAttendanceModal = () => {
    dismissCheckInNotice();
  };
  const attendanceModalOverlayStyle = {
    opacity: attendanceModalProgress.interpolate({
      inputRange: [0, 1],
      outputRange: [0, 1],
    }),
  };
  const attendanceModalCardStyle = {
    opacity: attendanceModalProgress,
    transform: [
      {
        translateX: hasWeeklyReward
          ? attendanceModalShake.interpolate({
              inputRange: [-1, 0, 1],
              outputRange: [-8, 0, 8],
            })
          : 0,
      },
      {
        translateY: attendanceModalProgress.interpolate({
          inputRange: [0, 1],
          outputRange: [26, 0],
        }),
      },
      {
        scale: attendanceModalProgress.interpolate({
          inputRange: [0, 1],
          outputRange: [0.94, 1],
        }),
      },
      {
        rotate: hasWeeklyReward
          ? attendanceModalShake.interpolate({
              inputRange: [-1, 0, 1],
              outputRange: ['-1.1deg', '0deg', '1.1deg'],
            })
          : '0deg',
      },
    ],
  };
  const attendanceModalFanfareStyle = {
    opacity: hasWeeklyReward
      ? attendanceModalProgress.interpolate({
          inputRange: [0, 0.22, 1],
          outputRange: [0, 1, 1],
        })
      : 0,
    transform: [
      {
        scale: attendanceModalProgress.interpolate({
          inputRange: [0, 0.62, 1],
          outputRange: [0.78, 1.08, 1],
        }),
      },
    ],
  };

  React.useEffect(() => {
    refreshProfileRef.current = refreshProfile;
    refreshAllCoinsRef.current = refreshAllCoins;
    refreshAttendanceRef.current = refreshAttendance;
  }, [refreshAllCoins, refreshAttendance, refreshProfile]);

  React.useEffect(() => {
    return registerScrollToTopHandler('Home', () => {
      mainScrollRef.current?.scrollTo({animated: true, y: 0});
    });
  }, []);

  React.useEffect(() => {
    if (!activeCheckInNotice) {
      attendanceModalProgress.setValue(0);
      attendanceModalShake.setValue(0);
      return;
    }

    attendanceModalProgress.setValue(0);
    attendanceModalShake.setValue(0);
    const entranceAnimation = Animated.spring(attendanceModalProgress, {
      toValue: 1,
      friction: 8,
      tension: 72,
      useNativeDriver: true,
    });

    if (!hasWeeklyReward) {
      entranceAnimation.start();
      return;
    }

    const jingleStep = (toValue: number) =>
      Animated.spring(attendanceModalShake, {
        toValue,
        friction: 8,
        tension: 95,
        useNativeDriver: true,
      });

    Animated.parallel([
      entranceAnimation,
      Animated.sequence([
        Animated.delay(230),
        jingleStep(1),
        jingleStep(-1),
        jingleStep(0.62),
        jingleStep(-0.32),
        Animated.spring(attendanceModalShake, {
          toValue: 0,
          friction: 7,
          tension: 80,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, [activeCheckInNotice, attendanceModalProgress, attendanceModalShake, hasWeeklyReward]);

  useFocusEffect(
    React.useCallback(() => {
      Promise.allSettled([
        refreshProfileRef.current(),
        refreshAllCoinsRef.current(),
        refreshAttendanceRef.current(),
      ]).then(results => {
        results.forEach((result, index) => {
          if (result.status === 'rejected') {
            console.log('[MainScreen] focus refresh failed', {
              index,
              reason: result.reason,
            });
          }
        });
      });
    }, []),
  );

  const animateFlip = React.useCallback(
    (cardId: (typeof storyCards)[number]['id'], toValue: 0 | 1, onComplete?: () => void) => {
      Animated.timing(bracketFlipValues[cardId], {
        toValue,
        duration: 420,
        easing: Easing.bezier(0.2, 0.75, 0.2, 1),
        useNativeDriver: true,
      }).start(({finished}) => {
        if (!finished || !onComplete) {
          return;
        }
        onComplete();
      });
    },
    [bracketFlipValues],
  );

  const handleStoryCardPress = React.useCallback(
    (cardId: (typeof storyCards)[number]['id']) => {
      if (flippedCardId === cardId) {
        animateFlip(cardId, 0, () => setFlippedCardId(null));
        return;
      }

      if (flippedCardId) {
        const prevCardId = flippedCardId;
        animateFlip(prevCardId, 0, () => {
          setFlippedCardId(cardId);
          animateFlip(cardId, 1);
        });
        return;
      }

      setFlippedCardId(cardId);
      animateFlip(cardId, 1);
    },
    [animateFlip, flippedCardId],
  );

  const handleStoryListMomentumEnd = React.useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (!flippedCardId) {
        return;
      }

      const offsetX = event.nativeEvent.contentOffset.x;
      const nextIndex = Math.round(offsetX / STORY_SNAP_INTERVAL);
      const nextCard = storyCards[nextIndex];

      if (!nextCard || nextCard.id === flippedCardId) {
        return;
      }

      animateFlip(flippedCardId, 0, () => setFlippedCardId(null));
    },
    [animateFlip, flippedCardId],
  );
  const handleCoinCardPress = React.useCallback(() => {
    navigation.navigate('Coins');
  }, [navigation]);
  const handleProfilePress = React.useCallback(() => {
    navigation.navigate('ProfileSetup');
  }, [navigation]);

  const renderStoryCard = React.useCallback(
    ({item, index}: {item: (typeof storyCards)[number]; index: number}): JSX.Element => {
      const inputRange = [
        (index - 1) * STORY_SNAP_INTERVAL,
        index * STORY_SNAP_INTERVAL,
        (index + 1) * STORY_SNAP_INTERVAL,
      ];

      const scale = scrollX.interpolate({
        inputRange,
        outputRange: [0.92, 1, 0.92],
        extrapolate: 'clamp',
      });

      const opacity = scrollX.interpolate({
        inputRange,
        outputRange: [0.72, 1, 0.72],
        extrapolate: 'clamp',
      });

      const translateY = scrollX.interpolate({
        inputRange,
        outputRange: [14, 0, 14],
        extrapolate: 'clamp',
      });

      const rotate = scrollX.interpolate({
        inputRange,
        outputRange: ['5deg', '0deg', '-5deg'],
        extrapolate: 'clamp',
      });
      const flipValue = bracketFlipValues[item.id];
      const frontRotateY = flipValue.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '180deg'],
      });
      const backRotateY = flipValue.interpolate({
        inputRange: [0, 1],
        outputRange: ['180deg', '360deg'],
      });
      const frontOpacity = flipValue.interpolate({
        inputRange: [0, 0.49, 0.5, 1],
        outputRange: [1, 1, 0, 0],
      });
      const backOpacity = flipValue.interpolate({
        inputRange: [0, 0.49, 0.5, 1],
        outputRange: [0, 0, 1, 1],
      });
      const cardRounds = bracketRoundsByStory[item.id as keyof typeof bracketRoundsByStory];

      return (
        <View style={styles.storyItem}>
          <AnimatedPressable
            accessibilityRole="button"
            disabled={flippedCardId === item.id}
            onPress={() => handleStoryCardPress(item.id)}
            style={styles.storyPressable}>
            <Animated.View
              style={[
                styles.storyCard,
                {borderColor: `${item.accent}55`},
                {
                  opacity,
                  transform: [{translateY}, {scale}, {rotate}],
                },
              ]}>
              <Animated.View
                pointerEvents={flippedCardId === item.id ? 'none' : 'auto'}
                style={[
                  styles.storyFace,
                  {
                    opacity: frontOpacity,
                    transform: [{perspective: 1200}, {rotateY: frontRotateY}],
                  },
                ]}>
                <Image source={item.posterImage} resizeMode="cover" style={styles.storyPosterImage} />
                <View style={styles.storyNoise} />
              </Animated.View>

              <Animated.View
                pointerEvents={flippedCardId === item.id ? 'auto' : 'none'}
                style={[
                  styles.storyFace,
                  styles.storyBackFace,
                  {
                    opacity: backOpacity,
                    transform: [{perspective: 1200}, {rotateY: backRotateY}],
                  },
                ]}>
                <View style={styles.storyBackHeader}>
                  <View>
                    <Text style={styles.storyBackEyebrow}>{item.tag}</Text>
                    <Text style={styles.storyBackTitle}>{item.subtitle} 대진표</Text>
                  </View>
                  <AnimatedPressable onPress={() => handleStoryCardPress(item.id)} style={styles.storyBackCloseButton}>
                    <Text style={styles.storyBackCloseButtonText}>닫기</Text>
                  </AnimatedPressable>
                </View>

                <ScrollView
                  bounces={false}
                  contentContainerStyle={styles.storyBackRoundsContent}
                  nestedScrollEnabled
                  style={styles.storyBackScroll}
                  showsVerticalScrollIndicator={false}>
                  {cardRounds.map((round, roundIndex) => (
                    <View
                      key={round.id}
                      style={[
                        styles.storyBackRound,
                        roundIndex === cardRounds.length - 1 && styles.storyBackRoundFinal,
                      ]}>
                      <View style={styles.storyBackRoundHeader}>
                        <View style={styles.storyBackRoundTitleWrap}>
                          <View
                            style={[
                              styles.storyBackRoundIndex,
                              roundIndex === cardRounds.length - 1 && styles.storyBackRoundIndexFinal,
                            ]}>
                            <Text style={styles.storyBackRoundIndexText}>{roundIndex + 1}</Text>
                          </View>
                          <Text style={styles.storyBackRoundLabel}>{round.label}</Text>
                        </View>
                        <View
                          style={[
                            styles.storyBackRoundMetaBadge,
                            roundIndex === cardRounds.length - 1 && styles.storyBackRoundMetaBadgeFinal,
                          ]}>
                          <Text
                            style={[
                              styles.storyBackRoundMeta,
                              roundIndex === cardRounds.length - 1 && styles.storyBackRoundMetaFinal,
                            ]}>
                            {roundIndex === cardRounds.length - 1 ? 'FINAL' : `${round.matches.length} MATCH`}
                          </Text>
                        </View>
                      </View>
                      {round.matches.map(match => {
                        const leftWon = match.leftScore >= match.rightScore;
                        const winnerName = leftWon ? match.left : match.right;

                        return (
                          <View
                            key={match.id}
                            style={[
                              styles.storyBackMatch,
                              roundIndex === cardRounds.length - 1 && styles.storyBackMatchFinal,
                            ]}>
                            {roundIndex === cardRounds.length - 1 ? (
                              <View style={styles.storyBackChampionPill}>
                                <Text numberOfLines={1} style={styles.storyBackChampionText}>
                                  WINNER · {winnerName}
                                </Text>
                              </View>
                            ) : null}
                            <View style={[styles.storyBackTeamRow, leftWon && styles.storyBackTeamRowWinner]}>
                              <View style={styles.storyBackTeamNameWrap}>
                                <View style={[styles.storyBackSeedDot, leftWon && styles.storyBackSeedDotWinner]} />
                                <Text
                                  numberOfLines={1}
                                  style={[styles.storyBackTeamName, !leftWon && styles.storyBackTeamNameMuted]}>
                                  {match.left}
                                </Text>
                              </View>
                              <Text style={[styles.storyBackTeamScore, leftWon && styles.storyBackTeamScoreWinner]}>
                                {match.leftScore}
                              </Text>
                            </View>
                            <View style={styles.storyBackVsRow}>
                              <View style={styles.storyBackLine} />
                              <Text style={styles.storyBackVsText}>VS</Text>
                              <View style={styles.storyBackLine} />
                            </View>
                            <View style={[styles.storyBackTeamRow, !leftWon && styles.storyBackTeamRowWinner]}>
                              <View style={styles.storyBackTeamNameWrap}>
                                <View style={[styles.storyBackSeedDot, !leftWon && styles.storyBackSeedDotWinner]} />
                                <Text
                                  numberOfLines={1}
                                  style={[styles.storyBackTeamName, leftWon && styles.storyBackTeamNameMuted]}>
                                  {match.right}
                                </Text>
                              </View>
                              <Text style={[styles.storyBackTeamScore, !leftWon && styles.storyBackTeamScoreWinner]}>
                                {match.rightScore}
                              </Text>
                            </View>
                          </View>
                        );
                      })}
                      {roundIndex < cardRounds.length - 1 ? <View style={styles.storyBackRoundConnector} /> : null}
                    </View>
                  ))}
                </ScrollView>
              </Animated.View>
            </Animated.View>
          </AnimatedPressable>
        </View>
      );
    },
    [bracketFlipValues, flippedCardId, handleStoryCardPress, scrollX],
  );

  return (
    <TabSceneTransition>
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="light-content" backgroundColor="#000000" />

        <View style={styles.screen}>
          <View pointerEvents="none" style={styles.screenBackgroundLayer}>
            {storyCards.map((card, index) => {
              const inputRange = [
                (index - 1) * STORY_SNAP_INTERVAL,
                index * STORY_SNAP_INTERVAL,
                (index + 1) * STORY_SNAP_INTERVAL,
              ];

              const posterOpacity = scrollX.interpolate({
                inputRange,
                outputRange: [0, 0.34, 0],
                extrapolate: 'clamp',
              });
              const posterScale = scrollX.interpolate({
                inputRange,
                outputRange: [1.08, 1, 1.08],
                extrapolate: 'clamp',
              });

              return (
                <Animated.Image
                  key={card.id}
                  blurRadius={32}
                  resizeMode="cover"
                  source={card.posterImage}
                  style={[
                    styles.screenPosterBackground,
                    {
                      opacity: posterOpacity,
                      transform: [{scale: posterScale}],
                    },
                  ]}
                />
              );
            })}
            <View style={styles.screenPosterScrim} />
            <View style={styles.screenVignette} />
          </View>

          <View style={styles.mainArea}>
            <AppGnb scrollY={scrollY} />

            <Animated.ScrollView
              ref={mainScrollRef}
              bounces={false}
              contentContainerStyle={styles.content}
              showsVerticalScrollIndicator={false}
              onScroll={Animated.event([{nativeEvent: {contentOffset: {y: scrollY}}}], {useNativeDriver: true})}
              scrollEventThrottle={16}>
              <Animated.FlatList
                data={storyCards}
                decelerationRate="fast"
                disableIntervalMomentum
                getItemLayout={(_, index) => ({
                  index,
                  length: STORY_SNAP_INTERVAL,
                  offset: STORY_SNAP_INTERVAL * index,
                })}
                horizontal
                initialNumToRender={storyCards.length}
                initialScrollIndex={1}
                keyExtractor={item => item.id}
                onScroll={Animated.event([{nativeEvent: {contentOffset: {x: scrollX}}}], {useNativeDriver: true})}
                onMomentumScrollEnd={handleStoryListMomentumEnd}
                renderItem={renderStoryCard}
                scrollEventThrottle={16}
                showsHorizontalScrollIndicator={false}
                snapToAlignment="start"
                snapToInterval={STORY_SNAP_INTERVAL}
                bounces={false}
                contentContainerStyle={styles.storyListContent}
              />
              <View style={styles.storyPagination}>
                {storyCards.map((card, index) => {
                  const inputRange = [
                    (index - 1) * STORY_SNAP_INTERVAL,
                    index * STORY_SNAP_INTERVAL,
                    (index + 1) * STORY_SNAP_INTERVAL,
                  ];

                  const opacity = scrollX.interpolate({
                    inputRange,
                    outputRange: [0.3, 1, 0.3],
                    extrapolate: 'clamp',
                  });

                  return (
                    <Animated.View
                      key={card.id}
                      style={[
                        styles.paginationDot,
                        {
                          opacity,
                          backgroundColor: card.accent,
                        },
                      ]}
                    />
                  );
                })}
              </View>

              <View style={styles.coinSection}>
                <AnimatedPressable
                  accessibilityLabel="프로필 수정"
                  accessibilityRole="button"
                  onPress={handleProfilePress}
                  style={styles.profileSummary}>
                  <Image source={profileImageSource} style={styles.profileImage} />
                  <Text style={styles.greeting}>{`${greetingPrefix} ${name}님`}</Text>
                  <Image source={icon.pencil} style={styles.profileEditIcon} resizeMode="contain" />
                </AnimatedPressable>
                <AnimatedPressable
                  accessibilityLabel="나의 코인현황 상세 보기"
                  accessibilityRole="button"
                  onPress={handleCoinCardPress}
                  style={styles.coinCard}>
                  <View style={styles.coinHeader}>
                    <Text style={styles.coinHeaderTitle}>나의 코인 현황</Text>
                    <Image source={icon.backBtn} style={styles.coinShortcutIcon} resizeMode="contain" />
                  </View>

                  <View style={styles.coinSummaryRow}>
                    <View style={styles.coinSummaryItem}>
                      <Text style={styles.coinSummaryLabel}>보유코인</Text>
                      <Text style={styles.coinValue}>{coinBalance}개</Text>
                    </View>
                    <View style={styles.coinSummaryItem}>
                      <Text style={styles.coinSummaryLabel}>누적코인</Text>
                      <Text style={styles.coinValue}>{accumulatedCoin}개</Text>
                    </View>
                  </View>

                  <View style={styles.coinDivider} />

                  <View style={styles.coinRows}>
                    <View style={styles.coinRow}>
                      <Text style={styles.coinRowLabel}>현재 랭킹</Text>
                      <Text style={styles.coinRowValue}>{rankingText}</Text>
                    </View>
                    <View style={styles.coinRow}>
                      <Text style={styles.coinRowLabel}>사업본부</Text>
                      <Text style={styles.coinRowValue}>
                        {typeof profile?.division === 'string' && profile.division.trim()
                          ? profile.division.trim()
                          : '-'}
                      </Text>
                    </View>
                    <View style={styles.coinRow}>
                      <Text style={styles.coinRowLabel}>소속</Text>
                      <Text style={styles.coinRowValue}>{department || '-'}</Text>
                    </View>
                  </View>
                </AnimatedPressable>

                <View style={styles.attendanceCard}>
                  <View style={styles.attendanceHeader}>
                    <Text style={styles.attendanceTitle}>출석체크 현황판</Text>
                    <Text style={styles.attendanceMeta}>
                      {isChecking ? '확인 중...' : `이번 주 ${attendanceCountText}`}
                    </Text>
                  </View>
                  <View style={styles.attendanceGrid}>
                    {attendanceBoard.map(day => (
                      <View key={day.label} style={styles.attendanceCell}>
                        <View style={[styles.attendanceDot, day.isChecked && styles.attendanceDotChecked]}>
                          {day.isChecked ? (
                            <LottieView autoPlay loop={false} source={checkLottie} style={styles.attendanceDotLottie} />
                          ) : day.isMissed ? (
                            <Text style={[styles.attendanceDotText, day.isChecked && styles.attendanceDotTextChecked]}>
                              ✕
                            </Text>
                          ) : null}
                        </View>
                        <Text style={[styles.attendanceDayLabel, day.isChecked && styles.attendanceDayLabelChecked]}>
                          {day.label}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              </View>
            </Animated.ScrollView>
          </View>
        </View>
      </SafeAreaView>

      <Modal
        animationType="fade"
        onRequestClose={handleDismissAttendanceModal}
        transparent
        visible={Boolean(activeCheckInNotice)}>
        <Animated.View style={[styles.attendanceModalOverlay, attendanceModalOverlayStyle]}>
          <Animated.View style={[styles.attendanceModalCard, attendanceModalCardStyle]}>
            {hasWeeklyReward ? (
              <Animated.View
                pointerEvents="none"
                style={[styles.attendanceModalFanfareLayer, attendanceModalFanfareStyle]}>
                <LottieView autoPlay loop={true} source={fanfareLottie} style={styles.attendanceModalFanfare} />
              </Animated.View>
            ) : null}
            <View style={styles.attendanceModalBadge}>
              <Text style={styles.attendanceModalBadgeText}>출석체크</Text>
            </View>
            <Text style={styles.attendanceModalCountText}>
              {hasWeeklyReward
                ? '7일 개근 완료'
                : modalWeeklyCount > 0
                ? `이번 주 ${modalWeeklyCount}일 출석`
                : '출석 완료'}
            </Text>
            <Text style={styles.attendanceModalSuccessText}>오늘 출석 완료</Text>

            {hasWeeklyReward ? (
              <View style={styles.attendanceModalPerfectBadge}>
                <Text style={styles.attendanceModalPerfectText}>개근상 +{weeklyRewardCoins}코인</Text>
              </View>
            ) : null}

            <View style={styles.attendanceModalWeekWrap}>
              {attendanceModalBoard.map((day, index) => {
                const dayProgressStart = 0.18 + index * 0.055;
                const dayAnimatedStyle = {
                  opacity: attendanceModalProgress.interpolate({
                    inputRange: [0, dayProgressStart, 1],
                    outputRange: [0, 0, 1],
                  }),
                  transform: [
                    {
                      translateY: attendanceModalProgress.interpolate({
                        inputRange: [0, dayProgressStart, 1],
                        outputRange: [12, 12, 0],
                      }),
                    },
                  ],
                };

                return (
                  <Animated.View key={`modal-${day.label}`} style={[styles.attendanceModalDayItem, dayAnimatedStyle]}>
                    <Text style={styles.attendanceModalDayLabel}>{day.label}</Text>
                    <View style={[styles.attendanceModalDayDot, day.isChecked && styles.attendanceModalDayDotChecked]}>
                      {day.isChecked ? (
                        <LottieView
                          autoPlay
                          loop={false}
                          source={checkLottie}
                          style={styles.attendanceModalDayDotLottie}
                        />
                      ) : day.isMissed ? (
                        <Text
                          style={[
                            styles.attendanceModalDayDotText,
                            day.isChecked && styles.attendanceModalDayDotTextChecked,
                          ]}>
                          ✕
                        </Text>
                      ) : null}
                    </View>
                  </Animated.View>
                );
              })}
            </View>

            <View style={styles.attendanceModalHintCard}>
              <Text style={styles.attendanceModalHintText}>
                {hasWeeklyReward
                  ? `총 ${activeCheckInNotice?.rewardCoins ?? weeklyRewardCoins}코인 지급`
                  : activeCheckInNotice && activeCheckInNotice.rewardCoins > 0
                  ? `+${activeCheckInNotice.rewardCoins}코인 지급`
                  : '내일도 출석해요'}
              </Text>
            </View>

            <AnimatedPressable onPress={handleDismissAttendanceModal} style={styles.attendanceModalConfirmButton}>
              <Text style={styles.attendanceModalConfirmText}>확인했어요</Text>
            </AnimatedPressable>
          </Animated.View>
        </Animated.View>
      </Modal>
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
  screenBackgroundLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  screenPosterBackground: {
    position: 'absolute',
    top: -70,
    bottom: -70,
    left: -70,
    right: -70,
  },
  screenPosterScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.58)',
  },
  screenVignette: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.18)',
  },
  mainArea: {
    flex: 1,
  },
  bellBody: {
    width: 18,
    height: 14,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    borderTopLeftRadius: 9,
    borderTopRightRadius: 9,
    borderBottomLeftRadius: 6,
    borderBottomRightRadius: 6,
  },
  bellBase: {
    width: 4,
    height: 2,
    borderRadius: 2,
    backgroundColor: '#FFFFFF',
    marginTop: 2,
  },
  notificationDot: {
    position: 'absolute',
    top: 2,
    right: 3,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E50914',
  },
  coinRing: {
    width: 18,
    height: 18,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    borderRadius: 9,
  },
  coinStripe: {
    position: 'absolute',
    width: 24,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E50914',
  },
  content: {
    paddingBottom: 36,
  },
  storyListContent: {
    paddingTop: 8,
    paddingHorizontal: (SCREEN_WIDTH - STORY_ITEM_WIDTH) / 2,
  },
  storyItem: {
    width: STORY_ITEM_WIDTH,
    alignItems: 'center',
  },
  storyPressable: {
    width: STORY_CARD_WIDTH,
    height: STORY_CARD_HEIGHT,
  },
  storyCard: {
    width: STORY_CARD_WIDTH,
    height: STORY_CARD_HEIGHT,
    borderRadius: 12,
    backgroundColor: '#171717',
    borderWidth: 1,
    overflow: 'hidden',
  },
  storyFace: {
    ...StyleSheet.absoluteFillObject,
    backfaceVisibility: 'hidden',
  },
  storyBackFace: {
    backgroundColor: 'rgba(10,12,16,0.97)',
    padding: 14,
  },
  storyPosterImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  storyGlow: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    top: 56,
    alignSelf: 'center',
    opacity: 0.55,
  },
  storyAccentOrb: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    right: -24,
    top: -20,
    opacity: 0.3,
  },
  storyNoise: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  storyBackHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  storyBackEyebrow: {
    color: '#CDD2DA',
    ...FONTS.font10B,
  },
  storyBackTitle: {
    color: '#FFFFFF',
    ...FONTS.font18B,
    marginTop: 3,
  },
  storyBackHint: {
    color: '#8F96A3',
    ...FONTS.font10B,
    marginTop: 3,
  },
  storyBackCloseButton: {
    height: 28,
    borderRadius: 8,
    paddingHorizontal: 10,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  storyBackCloseButtonText: {
    color: '#FFFFFF',
    ...FONTS.font12B,
  },
  storyBackScroll: {
    flex: 1,
  },
  storyBackRoundsContent: {
    gap: 10,
    paddingBottom: 12,
  },
  storyBackRound: {
    position: 'relative',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.055)',
    padding: 9,
  },
  storyBackRoundFinal: {
    borderColor: 'rgba(229,9,20,0.42)',
    backgroundColor: 'rgba(229,9,20,0.075)',
  },
  storyBackRoundHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 7,
  },
  storyBackRoundTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 0,
    flex: 1,
  },
  storyBackRoundIndex: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 7,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  storyBackRoundIndexFinal: {
    backgroundColor: '#E50914',
    borderColor: '#E50914',
  },
  storyBackRoundIndexText: {
    color: '#FFFFFF',
    ...FONTS.font10B,
    lineHeight: 13,
  },
  storyBackRoundLabel: {
    flexShrink: 1,
    color: '#FFFFFF',
    ...FONTS.font14B,
  },
  storyBackRoundMetaBadge: {
    minHeight: 20,
    borderRadius: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  storyBackRoundMetaBadgeFinal: {
    backgroundColor: 'rgba(229,9,20,0.18)',
  },
  storyBackRoundMeta: {
    color: '#8F96A3',
    ...FONTS.font10B,
    letterSpacing: 0.6,
  },
  storyBackRoundMetaFinal: {
    color: '#FFFFFF',
  },
  storyBackMatch: {
    borderRadius: 12,
    backgroundColor: 'rgba(5,7,10,0.82)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    padding: 6,
    marginTop: 6,
  },
  storyBackMatchFinal: {
    borderColor: 'rgba(229,9,20,0.28)',
    backgroundColor: 'rgba(8,4,6,0.90)',
  },
  storyBackChampionPill: {
    minHeight: 24,
    borderRadius: 10,
    paddingHorizontal: 9,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
    backgroundColor: 'rgba(229,9,20,0.22)',
    borderWidth: 1,
    borderColor: 'rgba(229,9,20,0.38)',
  },
  storyBackChampionText: {
    color: '#FFFFFF',
    ...FONTS.font10B,
    letterSpacing: 0.5,
  },
  storyBackTeamRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 28,
    borderRadius: 9,
    paddingHorizontal: 8,
  },
  storyBackTeamRowWinner: {
    backgroundColor: 'rgba(229,9,20,0.16)',
  },
  storyBackTeamNameWrap: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 8,
  },
  storyBackSeedDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 7,
    backgroundColor: '#4A4D56',
  },
  storyBackSeedDotWinner: {
    backgroundColor: '#E50914',
  },
  storyBackTeamName: {
    color: '#E8EAF0',
    ...FONTS.font12B,
  },
  storyBackTeamNameMuted: {
    color: '#858A96',
  },
  storyBackTeamScore: {
    minWidth: 24,
    height: 22,
    borderRadius: 7,
    overflow: 'hidden',
    color: '#AEB4C1',
    backgroundColor: 'rgba(255,255,255,0.08)',
    textAlign: 'center',
    ...FONTS.font14B,
    lineHeight: 22,
  },
  storyBackTeamScoreWinner: {
    color: '#FFFFFF',
    backgroundColor: '#E50914',
  },
  storyBackLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  storyBackVsRow: {
    minHeight: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  storyBackVsText: {
    color: '#6F7581',
    ...FONTS.font10B,
  },
  storyBackRoundConnector: {
    alignSelf: 'center',
    width: 2,
    height: 10,
    marginBottom: -19,
    backgroundColor: 'rgba(229,9,20,0.45)',
  },
  storyGradient: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: 20,
    backgroundColor: 'rgba(0,0,0,0.42)',
  },
  storyBadge: {
    position: 'absolute',
    top: 20,
    left: 20,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  storyBadgeText: {
    ...FONTS.font10B,
    letterSpacing: 1.1,
  },
  storyEyebrow: {
    color: '#F2F3F5',
    ...FONTS.font13M,
    letterSpacing: 0.4,
  },
  storyTitle: {
    marginTop: 8,
    color: '#FFFFFF',
    ...FONTS.font30B,
  },
  storyMeta: {
    marginTop: 14,
    color: 'rgba(255,255,255,0.58)',
    ...FONTS.font11B,
    letterSpacing: 1.2,
  },
  storyPagination: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 16,
  },
  paginationDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
  },
  coinSection: {
    width: 335,
    alignSelf: 'center',
    marginTop: 32,
    gap: 14,
  },
  profileSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  greeting: {
    color: '#FFFFFF',
    ...FONTS.font22M,
  },
  profileEditIcon: {
    width: 28,
    height: 28,
    // tintColor: '#A9ABB2',
  },
  profileImage: {
    width: 40,
    height: 40,
    marginRight: 12,
    borderRadius: 20,
  },
  coinCard: {
    borderRadius: 12,
    backgroundColor: '#171717',
    borderWidth: 1,
    borderColor: '#252525',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  coinHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  coinHeaderTitle: {
    color: '#D2D4D8',
    ...FONTS.font14M,
  },
  coinShortcutIcon: {
    width: 18,
    height: 18,
    tintColor: '#FFFFFF',
    transform: [{rotate: '180deg'}],
  },
  coinValue: {
    marginTop: 5,
    color: '#FFFFFF',
    textAlign: 'center',
    ...FONTS.font22B,
  },
  coinSummaryRow: {
    marginTop: 12,
    flexDirection: 'row',
    gap: 8,
  },
  coinSummaryItem: {
    flex: 1,
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: '#1C1C1C',
    borderWidth: 1,
    borderColor: '#2D2D2D',
  },
  coinSummaryLabel: {
    color: '#A9ABB2',
    textAlign: 'center',
    ...FONTS.font13M,
    lineHeight: 17,
  },
  coinDivider: {
    height: 1,
    backgroundColor: '#252525',
    marginTop: 12,
    marginBottom: 12,
  },
  coinRows: {
    gap: 7,
  },
  coinRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  coinRowLabel: {
    color: '#FFFFFF',
    ...FONTS.font14M,
  },
  coinRowValue: {
    color: '#FFFFFF',
    ...FONTS.font14M,
  },
  attendanceCard: {
    borderRadius: 12,
    backgroundColor: '#171717',
    borderWidth: 1,
    borderColor: '#252525',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  attendanceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  attendanceTitle: {
    color: '#FFFFFF',
    ...FONTS.font16B,
  },
  attendanceMeta: {
    color: '#A9ABB2',
    ...FONTS.font12M,
  },
  attendanceGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  attendanceCell: {
    alignItems: 'center',
    width: 38,
  },
  attendanceDot: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2B2B2B',
    borderWidth: 1,
    borderColor: '#3A3A3A',
  },
  attendanceDotChecked: {
    backgroundColor: '#E50914',
    borderColor: '#E50914',
  },
  attendanceDotText: {
    color: '#E6E8EE',
    ...FONTS.font14B,
  },
  attendanceDotTextChecked: {
    color: '#FFFFFF',
  },
  attendanceDotLottie: {
    width: 44,
    height: 44,
    transform: [{scale: 1.5}],
  },
  attendanceDayLabel: {
    marginTop: 6,
    color: '#8A8D95',
    ...FONTS.font11M,
  },
  attendanceDayLabelChecked: {
    color: '#FFFFFF',
  },
  attendanceModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.76)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 22,
  },
  attendanceModalFanfareLayer: {
    position: 'absolute',
    // top: -186,
    top: '-50%',
    width: 620,
    height: 620,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    elevation: 20,
  },
  attendanceModalFanfare: {
    width: 450,
    height: 450,
  },
  attendanceModalCard: {
    width: '100%',
    maxWidth: 390,
    borderRadius: 12,
    backgroundColor: '#121216',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 18,
    paddingTop: 22,
    paddingBottom: 18,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: {width: 0, height: 18},
    shadowOpacity: 0.36,
    shadowRadius: 28,
    elevation: 18,
  },
  attendanceModalBadge: {
    zIndex: 3,
    minHeight: 26,
    borderRadius: 8,
    backgroundColor: 'rgba(229,9,20,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(229,9,20,0.28)',
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attendanceModalBadgeText: {
    color: '#FF7A82',
    ...FONTS.font11B,
    lineHeight: 14,
  },
  attendanceModalCountText: {
    zIndex: 3,
    marginTop: 14,
    color: '#FFFFFF',
    ...FONTS.font22B,
    lineHeight: 28,
  },
  attendanceModalSuccessText: {
    zIndex: 3,
    marginTop: 4,
    color: '#BFC3CF',
    ...FONTS.font15M,
    lineHeight: 20,
  },
  attendanceModalPerfectBadge: {
    zIndex: 3,
    marginTop: 12,
    borderRadius: 999,
    backgroundColor: 'rgba(240,24,37,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(240,24,37,0.5)',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  attendanceModalPerfectText: {
    color: '#FFFFFF',
    ...FONTS.font14B,
    lineHeight: 18,
    textAlign: 'center',
  },
  attendanceModalWeekWrap: {
    zIndex: 3,
    width: '100%',
    marginTop: 18,
    borderRadius: 12,
    backgroundColor: '#0B0B0E',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 8,
    paddingVertical: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  attendanceModalDayItem: {
    alignItems: 'center',
    width: 36,
  },
  attendanceModalDayLabel: {
    color: '#8B909D',
    ...FONTS.font11B,
    lineHeight: 14,
    marginBottom: 7,
  },
  attendanceModalDayDot: {
    width: 30,
    height: 30,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#343743',
    backgroundColor: '#20232C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  attendanceModalDayDotChecked: {
    backgroundColor: '#F01825',
    borderColor: '#F01825',
  },
  attendanceModalDayDotText: {
    color: '#8E93A2',
    ...FONTS.font13B,
    lineHeight: 15,
  },
  attendanceModalDayDotTextChecked: {
    color: '#FFFFFF',
  },
  attendanceModalDayDotLottie: {
    width: 42,
    height: 42,
    transform: [{scale: 1.48}],
  },
  attendanceModalHintCard: {
    zIndex: 3,
    width: '100%',
    marginTop: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  attendanceModalHintText: {
    color: '#D9DCE5',
    ...FONTS.font14M,
    lineHeight: 20,
    textAlign: 'center',
  },
  attendanceModalHintAccent: {
    color: '#FF5962',
    ...FONTS.font14B,
  },
  attendanceModalConfirmButton: {
    zIndex: 3,
    marginTop: 16,
    width: '100%',
    height: 48,
    borderRadius: 12,
    backgroundColor: '#F01825',
    alignItems: 'center',
    justifyContent: 'center',
  },
  attendanceModalConfirmText: {
    color: '#FFFFFF',
    ...FONTS.font15B,
    lineHeight: 20,
  },
});

export default MainScreen;
