import React, {useRef, useState} from 'react';
import {useFocusEffect} from '@react-navigation/native';
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
import {image} from '../assets/images';
import {useAuth} from '../auth/AuthProvider';
import {useCoin} from '../coin/CoinProvider';
import {AnimatedPressable} from '../components/AnimatedPressable';
import {AppGnb} from '../components/AppGnb';
import {TabSceneTransition} from '../components/TabSceneTransition';
import {FONTS} from '../constants/theme';

const {width: SCREEN_WIDTH} = Dimensions.get('window');

const STORY_CARD_WIDTH = 327;
const STORY_CARD_HEIGHT = 474;
const STORY_CARD_GAP = 18;
const STORY_ITEM_WIDTH = STORY_CARD_WIDTH + STORY_CARD_GAP;
const STORY_SNAP_INTERVAL = STORY_ITEM_WIDTH;
const WEEKDAY_LABELS = ['월', '화', '수', '목', '금', '토', '일'] as const;
const checkLottie = require('../assets/lotties/Check.json');

const storyCards = [
  {
    id: 'left',
    posterImage: image.poster1,
    title: 'CRAZY ARCADE',
    subtitle: '크레이지 아케이드',
    accent: '#0e5ac5',
    tag: 'LIVE BRACKET',
  },
  {
    id: 'center',
    posterImage: image.poster2,
    title: 'TEKKEN',
    subtitle: '철권',
    accent: '#E11319',
    tag: 'MAIN EVENT',
  },
  {
    id: 'right',
    posterImage: image.poster3,
    title: 'STARCRAFT',
    subtitle: '스타크래프트',
    accent: '#F7CE45',
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

function MainScreen(): JSX.Element {
  const {auth} = useAuth();
  const {rankingItems, isRankingLoading} = useCoin();
  const {attendance, checkInNotice, dismissCheckInNotice, isChecking, refreshAttendance} = useAttendance();
  const scrollX = useRef(new Animated.Value(STORY_SNAP_INTERVAL)).current;
  const scrollY = useRef(new Animated.Value(0)).current;
  const bracketFlipValues = useRef(
    storyCards.reduce(
      (acc, card) => {
        acc[card.id] = new Animated.Value(0);
        return acc;
      },
      {} as Record<(typeof storyCards)[number]['id'], Animated.Value>,
    ),
  ).current;
  const [flippedCardId, setFlippedCardId] = useState<(typeof storyCards)[number]['id'] | null>(null);
  const profile = auth?.profile;
  const coinBalanceRaw =
    typeof profile?.coinBalance === 'number'
      ? profile.coinBalance
      : typeof profile?.coinBalance === 'string'
      ? Number(profile.coinBalance)
      : 0;
  const coinBalance = Number.isFinite(coinBalanceRaw) ? coinBalanceRaw : 0;
  const department = typeof profile?.department === 'string' ? profile.department.trim() : '';
  const profileImageUri = typeof profile?.profileImageUri === 'string' && profile.profileImageUri.trim()
    ? profile.profileImageUri.trim()
    : null;
  const profileImageSource = profileImageUri ? {uri: profileImageUri} : image.profile;
  const name = auth?.name ?? '이인철';
  const greetingPrefix = department || '서비스개발팀';
  const myRankingItem = rankingItems.find(item => item.isMe);
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
  const modalWeeklyCount = attendance?.checkedThisWeekCount ?? checkInNotice?.checkedThisWeekCount ?? 0;

  useFocusEffect(
    React.useCallback(() => {
      void refreshAttendance();
    }, [refreshAttendance]),
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

              const topOpacity = scrollX.interpolate({
                inputRange,
                outputRange: [0, 0.18, 0],
                extrapolate: 'clamp',
              });
              const bottomOpacity = scrollX.interpolate({
                inputRange,
                outputRange: [0, 0.1, 0],
                extrapolate: 'clamp',
              });

              return (
                <React.Fragment key={card.id}>
                  <Animated.View
                    style={[
                      styles.screenAccentTop,
                      {
                        backgroundColor: card.accent,
                        opacity: Animated.multiply(topOpacity, 1),
                      },
                    ]}
                  />
                  <Animated.View
                    style={[
                      styles.screenAccentBottom,
                      {
                        backgroundColor: card.accent,
                        opacity: bottomOpacity,
                      },
                    ]}
                  />
                </React.Fragment>
              );
            })}
            <View style={styles.screenVignette} />
          </View>

          <View style={styles.mainArea}>
            <AppGnb scrollY={scrollY} />

            <Animated.ScrollView
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
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    marginBottom: 16,
                  }}>
                  <Image source={profileImageSource} style={styles.profileImage} />
                  <Text style={styles.greeting}>{`${greetingPrefix} ${name}님`}</Text>
                </View>
                <View style={styles.coinCard}>
                  <View style={styles.coinHeader}>
                    <Text style={styles.coinHeaderTitle}>나의 보유코인</Text>
                    <View style={styles.coinValueWrap}>
                      <Text style={styles.coinValue}>{coinBalance}개</Text>
                      <View style={styles.coinChevron} />
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
                </View>

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

      <Modal animationType="fade" onRequestClose={dismissCheckInNotice} transparent visible={Boolean(checkInNotice)}>
        <View style={styles.attendanceModalOverlay}>
          <View style={styles.attendanceModalCard}>
            <Text style={styles.attendanceModalCountText}>
              {modalWeeklyCount > 0 ? `이번 주 ${modalWeeklyCount}일 출석` : '출석체크'}
            </Text>
            <Text style={styles.attendanceModalSuccessText}>오늘 출석체크 완료!</Text>

            <View style={styles.attendanceModalWeekWrap}>
              {attendanceBoard.map(day => (
                <View key={`modal-${day.label}`} style={styles.attendanceModalDayItem}>
                  <Text style={styles.attendanceModalDayLabel}>{day.label}</Text>
                  <View style={[styles.attendanceModalDayDot, day.isChecked && styles.attendanceModalDayDotChecked]}>
                    {day.isChecked ? (
                      <LottieView autoPlay loop={false} source={checkLottie} style={styles.attendanceModalDayDotLottie} />
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
                </View>
              ))}
            </View>

            <View style={styles.attendanceModalHintCard}>
              <Text style={styles.attendanceModalHintText}>
                <Text style={styles.attendanceModalHintAccent}>이번 주 {modalWeeklyCount}/7 출석 완료</Text>
                {'\n'}
                {checkInNotice && checkInNotice.rewardCoins > 0
                  ? `오늘 보상 코인 +${checkInNotice.rewardCoins} 지급!`
                  : '남은 날도 잊지 말고 체크해요.'}
              </Text>
            </View>

            <AnimatedPressable onPress={dismissCheckInNotice} style={styles.attendanceModalConfirmButton}>
              <Text style={styles.attendanceModalConfirmText}>확인했어요</Text>
            </AnimatedPressable>
          </View>
        </View>
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
  screenAccentTop: {
    position: 'absolute',
    top: -180,
    left: -120,
    right: -120,
    height: 460,
    borderRadius: 260,
  },
  screenAccentBottom: {
    position: 'absolute',
    bottom: -240,
    left: -160,
    right: -160,
    height: 520,
    borderRadius: 320,
  },
  screenVignette: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.24)',
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
    backgroundColor: '#E11319',
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
    backgroundColor: '#E11319',
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
    borderRadius: 23,
    backgroundColor: '#101010',
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
  greeting: {
    color: '#FFFFFF',
    ...FONTS.font22M,
  },
  profileImage: {
    width: 40,
    height: 40,
    marginRight: 12,
    borderRadius: 20,
  },
  coinCard: {
    borderRadius: 20,
    backgroundColor: '#222323',
    paddingHorizontal: 20,
    paddingVertical: 28,
  },
  coinHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  coinHeaderTitle: {
    color: '#FFFFFF',
    ...FONTS.font18B,
  },
  coinValueWrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  coinValue: {
    color: '#FFFFFF',
    ...FONTS.font18B,
  },
  coinChevron: {
    width: 8,
    height: 8,
    marginLeft: 8,
    borderRightWidth: 1.6,
    borderBottomWidth: 1.6,
    borderColor: '#B3B4B9',
    transform: [{rotate: '-45deg'}],
  },
  coinDivider: {
    height: 1,
    backgroundColor: 'rgba(242,243,245,0.3)',
    marginTop: 20,
    marginBottom: 20,
  },
  coinRows: {
    gap: 12,
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
    borderRadius: 20,
    backgroundColor: '#161616',
    borderWidth: 1,
    borderColor: '#2A2A2A',
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
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 22,
  },
  attendanceModalCard: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 24,
    backgroundColor: '#1C1D24',
    borderWidth: 1,
    borderColor: '#2C2D36',
    paddingHorizontal: 22,
    paddingTop: 34,
    paddingBottom: 20,
    alignItems: 'center',
  },
  attendanceModalCountText: {
    color: '#FFFFFF',
    ...FONTS.font40B,
    lineHeight: 52,
  },
  attendanceModalSuccessText: {
    marginTop: 8,
    color: '#E9EAF0',
    ...FONTS.font24M,
    lineHeight: 32,
  },
  attendanceModalWeekWrap: {
    width: '100%',
    marginTop: 22,
    borderRadius: 16,
    backgroundColor: '#121319',
    borderWidth: 1,
    borderColor: '#25262E',
    paddingHorizontal: 10,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  attendanceModalDayItem: {
    alignItems: 'center',
    width: 38,
  },
  attendanceModalDayLabel: {
    color: '#8F939E',
    ...FONTS.font13B,
    marginBottom: 8,
  },
  attendanceModalDayDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#40424D',
    backgroundColor: '#2E303A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  attendanceModalDayDotChecked: {
    backgroundColor: '#E50914',
    borderColor: '#E50914',
  },
  attendanceModalDayDotText: {
    color: '#D8DCE7',
    ...FONTS.font16B,
    lineHeight: 18,
  },
  attendanceModalDayDotTextChecked: {
    color: '#FFFFFF',
  },
  attendanceModalDayDotLottie: {
    width: 48,
    height: 48,
    transform: [{scale: 1.52}],
  },
  attendanceModalHintCard: {
    width: '100%',
    marginTop: 18,
    borderRadius: 16,
    backgroundColor: '#252731',
    borderWidth: 1,
    borderColor: '#343746',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  attendanceModalHintText: {
    color: '#E1E3EA',
    ...FONTS.font18M,
    lineHeight: 26,
  },
  attendanceModalHintAccent: {
    color: '#E50914',
    ...FONTS.font18B,
  },
  attendanceModalConfirmButton: {
    marginTop: 20,
    width: '100%',
    height: 54,
    borderRadius: 16,
    backgroundColor: '#E50914',
    alignItems: 'center',
    justifyContent: 'center',
  },
  attendanceModalConfirmText: {
    color: '#FFFFFF',
    ...FONTS.font16B,
    lineHeight: 21,
  },
});

export default MainScreen;
