import React, {useRef, useState} from 'react';
import {
  useFocusEffect,
  useNavigation,
  type CompositeNavigationProp,
  type NavigationProp,
} from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Animated,
  Dimensions,
  FlatList,
  Image,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  RefreshControl,
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
const PROFILE_TIP_STORAGE_PREFIX = 'game_app_profile_tip_dismissed_v1';
const checkLottie = require('../assets/lotties/Check.json');
const fanfareLottie = require('../assets/lotties/Fanfare.json');

type MainScreenNavigation = CompositeNavigationProp<
  NavigationProp<MainStackParamList, 'Home'>,
  NavigationProp<RootStackParamList>
>;

const storyCards = [
  {
    id: 'maskSinger',
    posterImage: image.poster4,
  },
  {
    id: 'executiveLineup',
    posterImage: image.poster5,
  },
  {
    id: 'center',
    posterImage: image.poster2,
  },
  {
    id: 'left',
    posterImage: image.poster1,
  },
  {
    id: 'right',
    posterImage: image.poster3,
  },
];
type StoryCard = (typeof storyCards)[number];
const LOOPED_STORY_CARDS: StoryCard[] = [...storyCards, ...storyCards, ...storyCards, ...storyCards, ...storyCards];
const STORY_LOOP_MIDDLE_START_INDEX = storyCards.length * 2;
const STORY_LOOP_SAFE_START_INDEX = storyCards.length;
const STORY_LOOP_SAFE_END_INDEX = storyCards.length * 4;
const INITIAL_STORY_INDEX = STORY_LOOP_MIDDLE_START_INDEX + 1;
const STORY_BACKGROUND_OPACITY_RANGES = storyCards.reduce((ranges, card) => {
  const inputRange: number[] = [];
  const outputRange: number[] = [];

  LOOPED_STORY_CARDS.forEach((loopedCard, loopIndex) => {
    if (loopedCard.id !== card.id) {
      return;
    }

    inputRange.push(
      (loopIndex - 1) * STORY_SNAP_INTERVAL,
      loopIndex * STORY_SNAP_INTERVAL,
      (loopIndex + 1) * STORY_SNAP_INTERVAL,
    );
    outputRange.push(0, 0.5, 0);
  });

  return {
    ...ranges,
    [card.id]: {inputRange, outputRange},
  };
}, {} as Record<StoryCard['id'], {inputRange: number[]; outputRange: number[]}>);

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
  const scrollX = useRef(new Animated.Value(INITIAL_STORY_INDEX * STORY_SNAP_INTERVAL)).current;
  const scrollY = useRef(new Animated.Value(0)).current;
  const mainScrollRef = useRef<ScrollView | null>(null);
  const storyListRef = useRef<FlatList<StoryCard> | null>(null);
  const currentStoryIndexRef = useRef(INITIAL_STORY_INDEX);
  const refreshProfileRef = useRef(refreshProfile);
  const refreshAllCoinsRef = useRef(refreshAllCoins);
  const refreshAttendanceRef = useRef(refreshAttendance);
  const attendanceModalProgress = useRef(new Animated.Value(0)).current;
  const attendanceModalShake = useRef(new Animated.Value(0)).current;
  const [activeStoryIndex, setActiveStoryIndex] = useState(INITIAL_STORY_INDEX % storyCards.length);
  const [isStoryUserScrolling, setIsStoryUserScrolling] = useState(false);
  const [isAttendanceSummaryModalVisible, setIsAttendanceSummaryModalVisible] = useState(false);
  const [isRefreshingHome, setIsRefreshingHome] = useState(false);
  const [isProfileTipVisible, setIsProfileTipVisible] = useState(false);
  const activeCheckInNotice = checkInNotice;
  const isAttendanceModalVisible = Boolean(activeCheckInNotice || isAttendanceSummaryModalVisible);
  const profile = auth?.profile;
  const profileTipStorageKey = `${PROFILE_TIP_STORAGE_PREFIX}:${
    auth?.employeeId ?? profile?.employeeId ?? auth?.id ?? 'guest'
  }`;
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
  const didAttendToday = checkedDateSet.has(todayKey);
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
    setIsAttendanceSummaryModalVisible(false);
    dismissCheckInNotice();
  };
  const handleAttendanceCardPress = () => {
    setIsAttendanceSummaryModalVisible(true);
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
    let isMounted = true;

    AsyncStorage.getItem(profileTipStorageKey)
      .then(storedValue => {
        if (isMounted) {
          setIsProfileTipVisible(storedValue !== 'true');
        }
      })
      .catch(error => {
        console.log('[MainScreen] profile tip storage read failed', error);

        if (isMounted) {
          setIsProfileTipVisible(true);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [profileTipStorageKey]);

  React.useEffect(() => {
    return registerScrollToTopHandler('Home', () => {
      mainScrollRef.current?.scrollTo({animated: true, y: 0});
    });
  }, []);

  const refreshHomeData = React.useCallback(async () => {
    return Promise.allSettled([
      refreshProfileRef.current(),
      refreshAllCoinsRef.current(),
      refreshAttendanceRef.current(),
    ]);
  }, []);

  const handleHomeRefresh = React.useCallback(async () => {
    if (isRefreshingHome) {
      return;
    }

    setIsRefreshingHome(true);

    try {
      await refreshHomeData();
    } finally {
      setIsRefreshingHome(false);
    }
  }, [isRefreshingHome, refreshHomeData]);

  React.useEffect(() => {
    if (!isAttendanceModalVisible) {
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
  }, [attendanceModalProgress, attendanceModalShake, hasWeeklyReward, isAttendanceModalVisible]);

  useFocusEffect(
    React.useCallback(() => {
      refreshHomeData().then(results => {
        results.forEach((result, index) => {
          if (result.status === 'rejected') {
            console.log('[MainScreen] focus refresh failed', {
              index,
              reason: result.reason,
            });
          }
        });
      });
    }, [refreshHomeData]),
  );

  const handleStoryListMomentumEnd = React.useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    setIsStoryUserScrolling(false);

    const offsetX = event.nativeEvent.contentOffset.x;
    const nextIndex = Math.round(offsetX / STORY_SNAP_INTERVAL);
    const nextCard = LOOPED_STORY_CARDS[nextIndex];

    if (nextCard) {
      currentStoryIndexRef.current = nextIndex;
      setActiveStoryIndex(nextIndex % storyCards.length);
    }

    if (nextCard && (nextIndex < STORY_LOOP_SAFE_START_INDEX || nextIndex >= STORY_LOOP_SAFE_END_INDEX)) {
      const normalizedIndex = STORY_LOOP_MIDDLE_START_INDEX + (nextIndex % storyCards.length);
      currentStoryIndexRef.current = normalizedIndex;
      requestAnimationFrame(() => {
        storyListRef.current?.scrollToIndex({animated: false, index: normalizedIndex});
      });
    }
  }, []);
  const moveStoryListWithoutAnimation = React.useCallback(
    (index: number) => {
      const offset = index * STORY_SNAP_INTERVAL;

      scrollX.stopAnimation();
      scrollX.setValue(offset);
      storyListRef.current?.scrollToOffset({animated: false, offset});
    },
    [scrollX],
  );
  const handleCoinCardPress = React.useCallback(() => {
    navigation.navigate('Coins');
  }, [navigation]);
  const dismissProfileTip = React.useCallback(() => {
    setIsProfileTipVisible(false);
    AsyncStorage.setItem(profileTipStorageKey, 'true').catch(error => {
      console.log('[MainScreen] profile tip storage write failed', error);
    });
  }, [profileTipStorageKey]);
  const handleProfilePress = React.useCallback(() => {
    dismissProfileTip();
    navigation.navigate('ProfileSetup');
  }, [dismissProfileTip, navigation]);

  React.useEffect(() => {
    if (isStoryUserScrolling || storyCards.length < 2) {
      return undefined;
    }

    const autoScrollTimer = setInterval(() => {
      let currentIndex = currentStoryIndexRef.current;

      if (currentIndex >= STORY_LOOP_SAFE_END_INDEX - 1) {
        currentIndex = STORY_LOOP_MIDDLE_START_INDEX + (currentIndex % storyCards.length);
        currentStoryIndexRef.current = currentIndex;
        moveStoryListWithoutAnimation(currentIndex);
      }

      let nextIndex = currentIndex + 1;

      if (nextIndex >= LOOPED_STORY_CARDS.length) {
        const normalizedIndex = STORY_LOOP_MIDDLE_START_INDEX + (currentIndex % storyCards.length);
        currentStoryIndexRef.current = normalizedIndex;
        moveStoryListWithoutAnimation(normalizedIndex);
        nextIndex = normalizedIndex + 1;
      }

      currentStoryIndexRef.current = nextIndex;
      setActiveStoryIndex(nextIndex % storyCards.length);
      storyListRef.current?.scrollToIndex({animated: true, index: nextIndex});
    }, 4000);

    return () => clearInterval(autoScrollTimer);
  }, [isStoryUserScrolling, moveStoryListWithoutAnimation]);

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

      return (
        <View style={styles.storyItem}>
          <Animated.View
            style={[
              styles.storyCard,
              {
                opacity,
                transform: [{translateY}, {scale}, {rotate}],
              },
            ]}>
            <View style={styles.storyFace}>
              <Image source={item.posterImage} resizeMode="cover" style={styles.storyPosterImage} />
              <View style={styles.storyNoise} />
            </View>
          </Animated.View>
        </View>
      );
    },
    [scrollX],
  );

  return (
    <TabSceneTransition>
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="light-content" backgroundColor="#000000" />

        <View pointerEvents="none" style={styles.screenBackgroundLayer}>
          {storyCards.map(card => {
            const opacityRange = STORY_BACKGROUND_OPACITY_RANGES[card.id];

            return (
              <Animated.Image
                key={`background-${card.id}`}
                blurRadius={Platform.OS === 'android' ? 12 : 28}
                resizeMode="cover"
                source={card.posterImage}
                style={[
                  styles.screenPosterBackground,
                  {
                    opacity: scrollX.interpolate({
                      inputRange: opacityRange.inputRange,
                      outputRange: opacityRange.outputRange,
                      extrapolate: 'clamp',
                    }),
                  },
                ]}
              />
            );
          })}
          <View style={styles.screenPosterScrim} />
          <View style={styles.screenVignette} />
        </View>

        <View style={styles.screen}>
          <View style={styles.mainArea}>
            <AppGnb scrollY={scrollY} />

            <Animated.ScrollView
              ref={mainScrollRef}
              bounces
              contentContainerStyle={styles.content}
              refreshControl={
                <RefreshControl
                  colors={['#E50914']}
                  progressBackgroundColor="#151519"
                  refreshing={isRefreshingHome}
                  tintColor="#FFFFFF"
                  onRefresh={handleHomeRefresh}
                />
              }
              showsVerticalScrollIndicator={false}
              onScroll={Animated.event([{nativeEvent: {contentOffset: {y: scrollY}}}], {useNativeDriver: true})}
              scrollEventThrottle={16}>
              <View style={styles.storySectionHeader}>
                <Text style={styles.storySectionEyebrow}>GAME FESTIVAL</Text>
                <Text style={styles.storySectionTitle}>게임대회 주요 이벤트</Text>
                <Text style={styles.storySectionDescription}>메인 종목과 스페셜 매치를 포스터로 만나보세요</Text>
              </View>
              <Animated.FlatList
                ref={storyListRef}
                data={LOOPED_STORY_CARDS}
                decelerationRate="fast"
                disableIntervalMomentum
                getItemLayout={(_, index) => ({
                  index,
                  length: STORY_SNAP_INTERVAL,
                  offset: STORY_SNAP_INTERVAL * index,
                })}
                horizontal
                initialNumToRender={5}
                initialScrollIndex={INITIAL_STORY_INDEX}
                keyExtractor={(item, index) => `${item.id}-${index}`}
                maxToRenderPerBatch={5}
                onScroll={Animated.event([{nativeEvent: {contentOffset: {x: scrollX}}}], {useNativeDriver: true})}
                onScrollBeginDrag={() => setIsStoryUserScrolling(true)}
                onScrollEndDrag={() => setIsStoryUserScrolling(false)}
                onMomentumScrollBegin={() => setIsStoryUserScrolling(true)}
                onMomentumScrollEnd={handleStoryListMomentumEnd}
                renderItem={renderStoryCard}
                removeClippedSubviews={Platform.OS === 'android'}
                onScrollToIndexFailed={info => {
                  storyListRef.current?.scrollToOffset({
                    animated: true,
                    offset: info.averageItemLength * info.index,
                  });
                }}
                scrollEventThrottle={16}
                showsHorizontalScrollIndicator={false}
                snapToAlignment="start"
                snapToInterval={STORY_SNAP_INTERVAL}
                bounces={false}
                contentContainerStyle={styles.storyListContent}
                updateCellsBatchingPeriod={80}
                windowSize={5}
              />
              <View style={styles.storyPagination}>
                {storyCards.map((card, index) => {
                  return (
                    <View
                      key={card.id}
                      style={[
                        styles.paginationDot,
                        activeStoryIndex === index ? styles.paginationDotActive : styles.paginationDotInactive,
                      ]}
                    />
                  );
                })}
              </View>

              <View style={styles.coinSection}>
                {isProfileTipVisible ? (
                  <AnimatedPressable
                    accessibilityLabel="프로필 수정 안내 닫기"
                    accessibilityRole="button"
                    onPress={dismissProfileTip}
                    style={styles.profileTipBubble}>
                    <Text style={styles.profileTipText}>프로필을 눌러 수정할 수 있어요</Text>
                    <View style={styles.profileTipTail} />
                  </AnimatedPressable>
                ) : null}
                <AnimatedPressable
                  accessibilityLabel="프로필 수정"
                  accessibilityRole="button"
                  onPress={handleProfilePress}
                  style={styles.profileSummary}>
                  <Image source={profileImageSource} style={styles.profileImage} />
                  <View style={styles.profileTextBlock}>
                    <Text numberOfLines={1} style={styles.greeting}>
                      {`${greetingPrefix} ${name}님`}
                    </Text>
                  </View>
                  {/* <Image source={icon.pencil} style={styles.profileEditIcon} resizeMode="contain" /> */}
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

                <AnimatedPressable
                  accessibilityLabel="출석체크 현황 자세히 보기"
                  accessibilityRole="button"
                  onPress={handleAttendanceCardPress}
                  style={styles.attendanceCard}>
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
                </AnimatedPressable>
              </View>
            </Animated.ScrollView>
          </View>
        </View>
      </SafeAreaView>

      <Modal
        animationType="fade"
        onRequestClose={handleDismissAttendanceModal}
        transparent
        visible={isAttendanceModalVisible}>
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
                ? '연속 출석 완료'
                : modalWeeklyCount > 0
                ? `이번 주 ${modalWeeklyCount}일 출석`
                : '출석 완료'}
            </Text>
            <Text style={styles.attendanceModalSuccessText}>
              {didAttendToday ? '오늘 출석 완료' : '오늘은 아직 출석 전'}
            </Text>

            {hasWeeklyReward ? (
              <View style={styles.attendanceModalPerfectBadge}>
                <Text style={styles.attendanceModalPerfectText}>연속 출석 +{weeklyRewardCoins}코인</Text>
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
                  : '내일도 출석해요🍀'}
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
    backgroundColor: 'rgba(0,0,0,0.64)',
  },
  screenVignette: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.2)',
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
  storySectionHeader: {
    paddingHorizontal: 24,
    paddingTop: 14,
    paddingBottom: 12,
  },
  storySectionEyebrow: {
    color: '#E50914',
    letterSpacing: 1.4,
    ...FONTS.font11B,
    lineHeight: 15,
  },
  storySectionTitle: {
    marginTop: 6,
    color: '#FFFFFF',
    ...FONTS.font24B,
    lineHeight: 30,
  },
  storySectionDescription: {
    marginTop: 7,
    color: '#A9ABB2',
    ...FONTS.font13M,
    lineHeight: 19,
  },
  storyListContent: {
    paddingTop: 4,
    paddingHorizontal: (SCREEN_WIDTH - STORY_ITEM_WIDTH) / 2,
  },
  storyItem: {
    width: STORY_ITEM_WIDTH,
    alignItems: 'center',
  },
  storyCard: {
    width: STORY_CARD_WIDTH,
    height: STORY_CARD_HEIGHT,
    borderRadius: 12,
    backgroundColor: '#050505',
    borderWidth: 2,
    borderColor: '#252525',
    overflow: 'hidden',
  },
  storyFace: {
    ...StyleSheet.absoluteFillObject,
  },
  storyPosterImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  storyNoise: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.04)',
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
    backgroundColor: '#E50914',
  },
  paginationDotActive: {
    opacity: 1,
  },
  paginationDotInactive: {
    opacity: 0.3,
  },
  coinSection: {
    width: '90%',
    alignSelf: 'center',
    marginTop: 32,
    gap: 14,
    marginHorizontal: 20,
  },
  profileTipBubble: {
    alignSelf: 'flex-start',
    maxWidth: 250,
    minHeight: 36,
    borderRadius: 10,
    backgroundColor: '#20232C',
    borderWidth: 1,
    borderColor: '#343743',
    paddingHorizontal: 12,
    paddingVertical: 9,
    justifyContent: 'center',
  },
  profileTipText: {
    color: '#FFFFFF',
    ...FONTS.font13B,
    lineHeight: 17,
  },
  profileTipTail: {
    position: 'absolute',
    left: 14,
    bottom: -7,
    width: 13,
    height: 13,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#343743',
    backgroundColor: '#20232C',
    transform: [{rotate: '45deg'}],
  },
  profileSummary: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileTextBlock: {
    flex: 1,
    minWidth: 0,
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
    width: 36,
  },
  attendanceDot: {
    width: 30,
    height: 30,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#343743',
    backgroundColor: '#20232C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  attendanceDotChecked: {
    backgroundColor: '#F01825',
    borderColor: '#F01825',
  },
  attendanceDotText: {
    color: '#8E93A2',
    ...FONTS.font13B,
    lineHeight: 15,
  },
  attendanceDotTextChecked: {
    color: '#FFFFFF',
  },
  attendanceDotLottie: {
    width: 42,
    height: 42,
    transform: [{scale: 1.48}],
  },
  attendanceDayLabel: {
    marginTop: 6,
    color: '#8B909D',
    ...FONTS.font11B,
    lineHeight: 14,
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
