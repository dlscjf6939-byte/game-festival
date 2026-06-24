import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import LottieView from 'lottie-react-native';
import {
  Alert,
  ActivityIndicator,
  Animated,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  type ImageSourcePropType,
  type LayoutChangeEvent,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  useWindowDimensions,
  View,
  ScrollView,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {icon} from '../assets/icons';
import {image} from '../assets/images';
import {AnimatedPressable} from '../components/AnimatedPressable';
import {AppGnb} from '../components/AppGnb';
import {TabSceneTransition} from '../components/TabSceneTransition';
import {useAuth} from '../auth/AuthProvider';
import {useCoin} from '../coin/CoinProvider';
import {useCoinBattleRooms, type CoinBattleRoom, type CoinBattleRoomStatus} from '../hooks/useCoinBattleRooms';
import type {CoinBattleStackParamList} from '../navigation/types';
import {FONTS} from '../constants/theme';
import {registerScrollToTopHandler} from '../navigation/scrollToTopEvents';

const THUMBNAIL_WIDTH = 143;
const THUMBNAIL_HEIGHT = 99;
const infoLottie = require('../assets/lotties/Info.json');
const coinLottie = require('../assets/lotties/Coin.json');

const coinEarningGuideItems = [
  {badge: '1', description: '+10코인', title: '사전 설문 참여'},
  {badge: '2', description: '일일 1~4코인 랜덤 지급 ( 개근시 +5코인 )', title: '매일 출석체크'},
  {badge: '3', description: '게시글당 +1코인, 일 최대 2회', title: '피드 게시글 작성'},
  {badge: '4', description: '미니게임으로 코인 쟁탈 ( 누적 코인 증감 없음 )', title: '코인대전'},
  {badge: '5', description: '게임별 +2코인', title: '승부예측 적중'},
  {badge: '6', description: '추가 코인 획득 ❤️', title: '다양한 현장 이벤트 참여'},
] as const;

const coinBenefitGuideItems = [
  {badge: '1', description: '누적 코인 차감 없음', title: '상품 응모🍀', reward: false},
  {badge: '2', description: '참가하고 추가 코인 획득', title: '코인대전', reward: false},
  {badge: '3', description: '누적 코인 기준으로 반영', title: '랭킹 반영', reward: false},
  {badge: '4', description: '랭킹 TOP30 특별 상품 증정', title: '랭킹 보상', reward: true},
  {badge: '5', description: '100만원 ~ 30만원 상당 상품', title: 'TOP 3', reward: true},
  {badge: '6', description: '10만원 상당 상품', title: 'TOP 30', reward: true},
] as const;

type DisplayRoom = {
  betAmount: number;
  game: string;
  host: string;
  hostProfileImageUri?: string;
  id: string;
  isRealtime: boolean;
  maxMembers: number;
  memberEmployeeIds: number[];
  memberNames: string[];
  memberCount: number;
  ownerEmployeeId?: number;
  realtimeGameId?: number;
  roomStatus?: CoinBattleRoomStatus;
  status: string;
  statusTone: 'playing' | 'waiting';
  title: string;
};

const filters = [
  {id: 'all', label: '전체'},
  {id: 'waiting', label: '대기중'},
  {id: 'playing', label: '게임중'},
] as const;

type RoomFilterId = (typeof filters)[number]['id'];

const quickActions = [
  {id: 'create', label: '방 만들기', iconSource: icon.plusBtn},
  {id: 'search', label: '방 검색', iconSource: icon.search},
  {id: 'guide', label: '연습', iconSource: icon.howBtn},
];

const gameOptions = [
  {id: 1, label: '가위바위보'},
  {id: 2, label: '같은 카드 맞추기'},
  {id: 21, label: '타자게임'},
];
const maxRoundCountByGameId: Record<number, number> = {
  1: 3,
  2: 1,
  21: 3,
};
const roundOptions = [1, 2, 3];
const MIN_BET_AMOUNT = 1;
const MAX_BET_AMOUNT = 5;
const BASE_TAB_BAR_HEIGHT = 66;
const FAB_BOTTOM = 21;
const QUICK_ACTION_BOTTOM = 93;
const CONTENT_BOTTOM_PADDING = 138;

const roomStatusLabels: Record<CoinBattleRoomStatus, string> = {
  EXIT: '종료',
  FULL: '정원마감',
  IN_PROGRESS: '게임중',
  WAITING: '대기중',
};

const gameTitleById: Record<number, string> = {
  1: '가위바위보',
  2: '같은 카드 맞추기',
  21: '타자게임',
};

function getCoinBattleGameImageSource(realtimeGameId?: number, gameName = ''): ImageSourcePropType {
  const normalizedGameName = gameName.replace(/\s/g, '').toLowerCase();

  if (realtimeGameId === 21 || normalizedGameName.includes('타자') || normalizedGameName.includes('typing')) {
    return image.coinBattle3;
  }

  if (
    realtimeGameId === 2 ||
    normalizedGameName.includes('같은그림') ||
    normalizedGameName.includes('같은카드') ||
    normalizedGameName.includes('그림') ||
    normalizedGameName.includes('카드') ||
    normalizedGameName.includes('match')
  ) {
    return image.coinBattle2;
  }

  return image.coinBattle1;
}

function getRoomStatusLabel(status?: CoinBattleRoomStatus): string {
  if (!status) {
    return '대기중';
  }

  return roomStatusLabels[status] ?? status;
}

function getRoomGameTitle(room: CoinBattleRoom): string {
  if (room.realtimeGameTitle) {
    return room.realtimeGameTitle;
  }

  if (typeof room.realtimeGameId === 'number') {
    return gameTitleById[room.realtimeGameId] ?? `게임 ${room.realtimeGameId}`;
  }

  return '가위바위보';
}

function getRoomHost(room: CoinBattleRoom): string {
  const owner = room.roomMembers.find(member => {
    return member.employeeId === room.ownerEmployeeId;
  });
  const firstMember = room.roomMembers[0];

  return owner?.employeeName ?? firstMember?.employeeName ?? '대기중';
}

function getRoomHostProfileImageUri(room: CoinBattleRoom): string | undefined {
  const owner = room.roomMembers.find(member => {
    return member.employeeId === room.ownerEmployeeId;
  });
  const firstMember = room.roomMembers[0];

  return owner?.profileImageUri ?? firstMember?.profileImageUri;
}

function mapRealtimeRooms(rooms: CoinBattleRoom[]): DisplayRoom[] {
  return rooms.map(room => {
    const memberCount = Math.max(room.currentMemberCount, room.roomMembers.length);
    const isFull = memberCount >= room.maxMembers || room.roomStatus === 'FULL';
    const roomStatus = isFull && room.roomStatus === 'WAITING' ? 'FULL' : room.roomStatus;
    const status = getRoomStatusLabel(roomStatus);
    const statusTone = roomStatus === 'WAITING' ? 'waiting' : 'playing';

    return {
      betAmount: room.betAmount ?? MIN_BET_AMOUNT,
      game: getRoomGameTitle(room),
      host: getRoomHost(room),
      hostProfileImageUri: getRoomHostProfileImageUri(room),
      id: room.roomId,
      isRealtime: true,
      maxMembers: room.maxMembers,
      memberCount,
      memberEmployeeIds: room.roomMembers.map(member => member.employeeId),
      memberNames: room.roomMembers.map(member => member.employeeName),
      ownerEmployeeId: room.ownerEmployeeId,
      realtimeGameId: room.realtimeGameId,
      roomStatus,
      status,
      statusTone,
      title: room.roomName,
    };
  });
}

function isSameEmployeeId(left?: number | string, right?: number | string): boolean {
  if (left === undefined || right === undefined) {
    return false;
  }

  return String(left) === String(right);
}

function getMaxRoundCount(realtimeGameId: number): number {
  return maxRoundCountByGameId[realtimeGameId] ?? 1;
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

function getHoldingCoin(profile?: Record<string, unknown>): number {
  return (
    toCoinNumber(profile?.holdingCoin) ?? toCoinNumber(profile?.coinBalance) ?? toCoinNumber(profile?.balance) ?? 0
  );
}

function isCurrentUserRoomMember(room: DisplayRoom, employeeId?: number | string): boolean {
  return room.memberEmployeeIds.some(memberEmployeeId => isSameEmployeeId(memberEmployeeId, employeeId));
}

function isRoomEntryBlocked(room: DisplayRoom, employeeId?: number | string): boolean {
  if (isCurrentUserRoomMember(room, employeeId)) {
    return false;
  }

  return room.roomStatus === 'FULL' || room.roomStatus === 'IN_PROGRESS' || room.memberCount >= room.maxMembers;
}

function normalizeSearchText(value: string): string {
  return value.trim().toLowerCase();
}

function matchesRoomSearch(room: DisplayRoom, query: string): boolean {
  const normalizedQuery = normalizeSearchText(query);

  if (!normalizedQuery) {
    return true;
  }

  return [room.title, room.host, ...room.memberNames].join(' ').toLowerCase().includes(normalizedQuery);
}

function matchesRoomFilter(room: DisplayRoom, filterId: RoomFilterId): boolean {
  if (filterId === 'waiting') {
    return room.roomStatus === 'WAITING' || room.roomStatus === undefined;
  }

  if (filterId === 'playing') {
    return room.roomStatus === 'IN_PROGRESS';
  }

  return true;
}

function Thumbnail({room}: {room: DisplayRoom}): JSX.Element {
  const thumbnailSource = getCoinBattleGameImageSource(room.realtimeGameId, room.game);

  return (
    <View style={styles.thumbnail}>
      <Image resizeMode="contain" source={thumbnailSource} style={styles.thumbnailImage} />
    </View>
  );
}

export function CoinBattleScreen(): JSX.Element {
  const navigation = useNavigation<NativeStackNavigationProp<CoinBattleStackParamList>>();
  const insets = useSafeAreaInsets();
  const {height: windowHeight} = useWindowDimensions();
  const {auth, refreshProfile} = useAuth();
  const {holdingCoin: latestHoldingCoin, refreshAllCoins, refreshCoinSummary} = useCoin();
  const scrollY = useRef(new Animated.Value(0)).current;
  const scrollRef = useRef<ScrollView | null>(null);
  const quickActionProgress = useRef(new Animated.Value(0)).current;
  const createModalProgress = useRef(new Animated.Value(0)).current;
  const betAmountScale = useRef(new Animated.Value(1)).current;
  const autoNavigatedRoomIdRef = useRef<string | null>(null);
  const createRoomPollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const createRoomTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [quickActionOpen, setQuickActionOpen] = useState(false);
  const [quickActionVisible, setQuickActionVisible] = useState(false);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);
  const [pendingCreatedRoomName, setPendingCreatedRoomName] = useState<string | null>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isCoinInfoVisible, setIsCoinInfoVisible] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [activeFilterId, setActiveFilterId] = useState<RoomFilterId>('all');
  const [roomName, setRoomName] = useState('저랑 코인걸고 게임 한판 하실분!!!');
  const [realtimeGameId, setRealtimeGameId] = useState(1);
  const [totalRoundCount, setTotalRoundCount] = useState(1);
  const [betAmount, setBetAmount] = useState(1);
  const [sceneHeight, setSceneHeight] = useState<number | null>(null);
  const {
    createRoom,
    enterRoom,
    requestRooms,
    rooms: realtimeRooms,
  } = useCoinBattleRooms({
    accessToken: auth?.accessToken,
  });
  const visibleRooms = useMemo(() => mapRealtimeRooms(realtimeRooms), [realtimeRooms]);
  const filteredRooms = useMemo(
    () =>
      visibleRooms.filter(room => matchesRoomFilter(room, activeFilterId) && matchesRoomSearch(room, searchKeyword)),
    [activeFilterId, searchKeyword, visibleRooms],
  );
  const maxRoundCount = getMaxRoundCount(realtimeGameId);
  const visibleTabBarHeight = BASE_TAB_BAR_HEIGHT + insets.bottom;
  const tabBarOverlaysScene = sceneHeight !== null && windowHeight - sceneHeight < visibleTabBarHeight * 0.5;
  const bottomOffset = tabBarOverlaysScene ? visibleTabBarHeight : 0;
  const contentContainerStyle = useMemo(
    () => [styles.content, {paddingBottom: CONTENT_BOTTOM_PADDING + bottomOffset}],
    [bottomOffset],
  );
  const floatingButtonStyle = useMemo(() => ({bottom: FAB_BOTTOM + bottomOffset}), [bottomOffset]);
  const quickActionListStyle = useMemo(
    () => [styles.quickActionList, {bottom: QUICK_ACTION_BOTTOM + bottomOffset}],
    [bottomOffset],
  );
  const visibleRoundOptions = useMemo(() => {
    return roundOptions.filter(option => option <= maxRoundCount);
  }, [maxRoundCount]);
  const ownedRoom = useMemo(() => {
    return visibleRooms.find(room => {
      return room.isRealtime && isSameEmployeeId(room.ownerEmployeeId, auth?.employeeId);
    });
  }, [auth?.employeeId, visibleRooms]);
  const pendingCreatedRoom = useMemo(() => {
    if (!pendingCreatedRoomName) {
      return undefined;
    }

    return visibleRooms.find(room => {
      return room.title === pendingCreatedRoomName || isSameEmployeeId(room.ownerEmployeeId, auth?.employeeId);
    });
  }, [auth?.employeeId, pendingCreatedRoomName, visibleRooms]);
  const displayHoldingCoin = latestHoldingCoin ?? getHoldingCoin(auth?.profile);

  const clearCreateRoomWaiters = useCallback(() => {
    if (createRoomPollIntervalRef.current) {
      clearInterval(createRoomPollIntervalRef.current);
      createRoomPollIntervalRef.current = null;
    }

    if (createRoomTimeoutRef.current) {
      clearTimeout(createRoomTimeoutRef.current);
      createRoomTimeoutRef.current = null;
    }
  }, []);

  const handleSafeAreaLayout = useCallback((event: LayoutChangeEvent) => {
    const nextSceneHeight = Math.round(event.nativeEvent.layout.height);

    setSceneHeight(currentSceneHeight => {
      return currentSceneHeight === nextSceneHeight ? currentSceneHeight : nextSceneHeight;
    });
  }, []);

  useEffect(() => {
    return () => {
      clearCreateRoomWaiters();
    };
  }, [clearCreateRoomWaiters]);

  useEffect(() => {
    return registerScrollToTopHandler('CoinBattle', () => {
      scrollRef.current?.scrollTo({animated: true, y: 0});
    });
  }, []);

  useEffect(() => {
    setTotalRoundCount(previousCount => {
      return Math.min(previousCount, maxRoundCount);
    });
  }, [maxRoundCount]);

  useEffect(() => {
    if (quickActionOpen) {
      setQuickActionVisible(true);
      Animated.spring(quickActionProgress, {
        toValue: 1,
        speed: 18,
        bounciness: 8,
        useNativeDriver: true,
      }).start();
      return;
    }

    Animated.timing(quickActionProgress, {
      toValue: 0,
      duration: 140,
      useNativeDriver: true,
    }).start(({finished}) => {
      if (finished) {
        setQuickActionVisible(false);
      }
    });
  }, [quickActionOpen, quickActionProgress]);

  const createPanelTranslateY = createModalProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [28, 0],
  });
  const createPanelOpacity = createModalProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });
  const modalBackdropOpacity = createModalProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });
  const fabIconRotation = quickActionProgress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '45deg'],
  });

  const openCreateModal = () => {
    setQuickActionOpen(false);
    createModalProgress.setValue(0);
    setCreateModalVisible(true);
    requestAnimationFrame(() => {
      Animated.spring(createModalProgress, {
        toValue: 1,
        speed: 18,
        bounciness: 4,
        useNativeDriver: true,
      }).start();
    });
  };

  const closeCreateModal = () => {
    if (isCreatingRoom) {
      return;
    }

    Animated.timing(createModalProgress, {
      toValue: 0,
      duration: 160,
      useNativeDriver: true,
    }).start(({finished}) => {
      if (finished) {
        setCreateModalVisible(false);
      }
    });
  };

  const animateBetAmount = () => {
    Animated.sequence([
      Animated.timing(betAmountScale, {
        toValue: 1.16,
        duration: 80,
        useNativeDriver: true,
      }),
      Animated.spring(betAmountScale, {
        toValue: 1,
        speed: 28,
        bounciness: 7,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const updateBetAmount = (nextAmount: number) => {
    const clampedAmount = Math.min(MAX_BET_AMOUNT, Math.max(MIN_BET_AMOUNT, nextAmount));

    if (clampedAmount !== betAmount) {
      animateBetAmount();
      setBetAmount(clampedAmount);
    }
  };

  const handleCreateRoom = async () => {
    if (isCreatingRoom) {
      return;
    }

    const clampedRoundCount = Math.min(totalRoundCount, maxRoundCount);
    const clampedBetAmount = Math.min(MAX_BET_AMOUNT, Math.max(MIN_BET_AMOUNT, betAmount));
    const normalizedRoomName = roomName.trim() || '코인대전 대기방';

    setIsCreatingRoom(true);
    setPendingCreatedRoomName(null);
    clearCreateRoomWaiters();

    try {
      const latestCoinSummary = await refreshCoinSummary(false);
      const currentHoldingCoin = latestCoinSummary?.holdingCoin ?? latestHoldingCoin ?? getHoldingCoin(auth?.profile);

      if (currentHoldingCoin < clampedBetAmount) {
        setIsCreatingRoom(false);
        Alert.alert(
          '코인이 부족합니다',
          `보유코인 ${currentHoldingCoin}개로는 베팅 코인 ${clampedBetAmount}개 방을 만들 수 없습니다.`,
        );
        return;
      }

      const created = createRoom({
        betAmount: clampedBetAmount,
        realtimeGameId,
        roomName: normalizedRoomName,
        totalRoundCount: clampedRoundCount,
      });

      if (!created) {
        setIsCreatingRoom(false);
        Alert.alert('방 생성 실패', '소켓 연결 상태를 확인한 뒤 다시 시도해 주세요.');
        return;
      }

      setPendingCreatedRoomName(normalizedRoomName);
      requestRooms();
      createRoomPollIntervalRef.current = setInterval(() => {
        requestRooms();
      }, 1500);
      createRoomTimeoutRef.current = setTimeout(() => {
        clearCreateRoomWaiters();
        setIsCreatingRoom(false);
        setPendingCreatedRoomName(null);
        requestRooms();
        Alert.alert('방 생성 지연', '방 생성 반영이 늦어지고 있습니다. 잠시 후 목록을 다시 확인해 주세요.');
      }, 10000);

      Promise.allSettled([refreshProfile(), refreshAllCoins()]).then(results => {
        results.forEach((result, index) => {
          if (result.status === 'rejected' && __DEV__) {
            console.log('[CoinBattleScreen] refresh after create failed', {index, reason: result.reason});
          }
        });
      });
    } catch (error) {
      clearCreateRoomWaiters();
      setIsCreatingRoom(false);
      setPendingCreatedRoomName(null);
      Alert.alert('방 생성 실패', error instanceof Error ? error.message : '방 생성 중 오류가 발생했습니다.');
    }
  };

  const handleEnterRoom = async (room: DisplayRoom) => {
    const isMyRoomMember = isCurrentUserRoomMember(room, auth?.employeeId);
    const isRoomFull = room.roomStatus === 'FULL' || room.memberCount >= room.maxMembers;
    const isRoomInProgress = room.roomStatus === 'IN_PROGRESS';

    if (!isMyRoomMember && isRoomFull) {
      Alert.alert('정원이 가득 찼습니다', '이미 2명이 입장한 방에는 들어갈 수 없습니다.');
      return;
    }

    if (!isMyRoomMember && isRoomInProgress) {
      Alert.alert('게임이 진행 중입니다', '이미 시작된 방에는 입장할 수 없습니다.');
      return;
    }

    const latestCoinSummary = await refreshCoinSummary(false);
    const currentHoldingCoin = latestCoinSummary?.holdingCoin ?? latestHoldingCoin ?? getHoldingCoin(auth?.profile);

    if (currentHoldingCoin < room.betAmount) {
      Alert.alert(
        '코인이 부족합니다',
        `보유코인 ${currentHoldingCoin}개로는 베팅 코인 ${room.betAmount}개 방에 입장할 수 없습니다.`,
      );
      return;
    }

    if (room.isRealtime) {
      enterRoom(room.id);
    }

    navigation.navigate('CoinBattleRoom', {
      game: room.game,
      host: room.host,
      isRealtime: room.isRealtime,
      roomId: room.id,
      status: room.status,
      title: room.title,
    });
  };

  useEffect(() => {
    const nextRoom = pendingCreatedRoom ?? ownedRoom;

    if (!nextRoom || autoNavigatedRoomIdRef.current === nextRoom.id) {
      return;
    }

    if (__DEV__) {
      console.log('[CoinBattleScreen] auto navigate owned room', {
        ownedRoomId: nextRoom.id,
      });
    }

    clearCreateRoomWaiters();
    setIsCreatingRoom(false);
    setPendingCreatedRoomName(null);
    setCreateModalVisible(false);

    autoNavigatedRoomIdRef.current = nextRoom.id;
    navigation.navigate('CoinBattleRoom', {
      game: nextRoom.game,
      host: nextRoom.host,
      isRealtime: nextRoom.isRealtime,
      roomId: nextRoom.id,
      status: nextRoom.status,
      title: nextRoom.title,
    });
  }, [clearCreateRoomWaiters, navigation, ownedRoom, pendingCreatedRoom]);

  return (
    <TabSceneTransition>
      <SafeAreaView onLayout={handleSafeAreaLayout} style={styles.safeArea}>
        <StatusBar barStyle="light-content" backgroundColor="#000000" />
        <AppGnb scrollY={scrollY} />

        <View style={styles.screen}>
          <Animated.ScrollView
            ref={scrollRef}
            bounces={false}
            contentContainerStyle={contentContainerStyle}
            keyboardDismissMode="interactive"
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            onScroll={Animated.event([{nativeEvent: {contentOffset: {y: scrollY}}}], {useNativeDriver: true})}
            scrollEventThrottle={16}>
            <View style={styles.titleRow}>
              <View style={styles.titleLeft}>
                <Text style={styles.title}>코인대전</Text>
                <AnimatedPressable
                  accessibilityLabel="코인 안내"
                  accessibilityRole="button"
                  onPress={() => setIsCoinInfoVisible(true)}
                  style={styles.headerInfoButton}>
                  <LottieView autoPlay loop source={infoLottie} speed={0.5} style={styles.headerInfoIcon} />
                </AnimatedPressable>
              </View>
              <View style={styles.titleActions}>
                <View style={styles.headerCoinPill}>
                  <LottieView autoPlay loop source={coinLottie} style={styles.headerCoinIcon} />
                  <Text style={styles.headerCoinText}>{displayHoldingCoin}개</Text>
                </View>
                <AnimatedPressable
                  accessibilityRole="button"
                  onPress={() => navigation.navigate('CoinBattleGuide')}
                  style={styles.guideEntryButton}>
                  <Text style={styles.guideEntryButtonText}>연습하기</Text>
                </AnimatedPressable>
              </View>
            </View>

            <View style={styles.filterRow}>
              {filters.map(filter => {
                const active = activeFilterId === filter.id;

                return (
                  <AnimatedPressable
                    key={filter.id}
                    accessibilityRole="button"
                    onPress={() => setActiveFilterId(filter.id)}
                    style={[styles.filterChip, active && styles.filterChipActive]}>
                    <Text style={[styles.filterText, active && styles.filterTextActive]}>{filter.label}</Text>
                  </AnimatedPressable>
                );
              })}
            </View>

            {isSearchOpen ? (
              <View style={styles.searchBar}>
                <Image source={icon.search} style={styles.searchIcon} resizeMode="contain" />
                <TextInput
                  autoFocus
                  onChangeText={setSearchKeyword}
                  placeholder="방 제목, 사용자 이름 검색"
                  placeholderTextColor="#777A82"
                  selectionColor="#E50914"
                  style={styles.searchInput}
                  value={searchKeyword}
                />
                <AnimatedPressable
                  accessibilityLabel="검색 닫기"
                  accessibilityRole="button"
                  onPress={() => {
                    setSearchKeyword('');
                    setIsSearchOpen(false);
                  }}
                  style={styles.searchClearButton}>
                  <Image source={icon.closeBtn} style={styles.searchClearIcon} resizeMode="contain" />
                </AnimatedPressable>
              </View>
            ) : null}

            {visibleRooms.length === 0 ? (
              <View style={styles.emptyRoomState}>
                <Text style={styles.emptyRoomText}>방이 없습니다.</Text>
              </View>
            ) : filteredRooms.length === 0 ? (
              <View style={styles.emptyRoomState}>
                <Text style={styles.emptyRoomText}>
                  {searchKeyword.trim() ? '검색 결과가 없습니다.' : '조건에 맞는 방이 없습니다.'}
                </Text>
              </View>
            ) : (
              <View style={styles.roomList}>
                {filteredRooms.map(room => {
                  const isEntryBlocked = isRoomEntryBlocked(room, auth?.employeeId);

                  return (
                    <AnimatedPressable
                      key={room.id}
                      disabled={isEntryBlocked}
                      onPress={() => handleEnterRoom(room)}
                      style={[styles.roomRow, isEntryBlocked && styles.roomRowDisabled]}>
                      <Thumbnail room={room} />

                      <View style={styles.roomInfo}>
                        <Text numberOfLines={2} style={styles.roomTitle}>
                          {room.title}
                        </Text>

                        <View style={styles.hostRow}>
                          <Image
                            resizeMode="cover"
                            source={room.hostProfileImageUri ? {uri: room.hostProfileImageUri} : image.profile}
                            style={styles.hostDot}
                          />
                          <Text numberOfLines={1} style={styles.hostName}>
                            {room.host}
                          </Text>
                        </View>

                        <View style={styles.gameChip}>
                          <Text numberOfLines={1} style={styles.gameChipText}>
                            {room.game}
                          </Text>
                        </View>

                        <View style={styles.memberStatusRow}>
                          <View
                            style={[
                              styles.statusBadge,
                              room.statusTone === 'waiting' ? styles.statusWaiting : styles.statusPlaying,
                            ]}>
                            <Text style={styles.statusText}>{room.status}</Text>
                          </View>
                          <Text style={styles.memberCountText}>
                            {room.memberCount}/{room.maxMembers}
                          </Text>
                        </View>
                      </View>
                    </AnimatedPressable>
                  );
                })}
              </View>
            )}
          </Animated.ScrollView>

          {quickActionVisible ? (
            <View style={quickActionListStyle}>
              {quickActions.map((action, index) => {
                const translateY = quickActionProgress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [18 + index * 8, 0],
                });
                const scale = quickActionProgress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.72, 1],
                });
                const opacity = quickActionProgress.interpolate({
                  inputRange: [0, 0.7, 1],
                  outputRange: [0, 0.85, 1],
                });

                return (
                  <Animated.View
                    key={action.id}
                    style={{
                      opacity,
                      transform: [{translateY}, {scale}],
                    }}>
                    <AnimatedPressable
                      accessibilityLabel={action.label}
                      accessibilityRole="button"
                      onPress={() => {
                        if (action.id === 'create') {
                          setQuickActionOpen(false);
                          openCreateModal();
                          return;
                        }

                        if (action.id === 'search') {
                          setQuickActionOpen(false);
                          setIsSearchOpen(current => {
                            if (current) {
                              setSearchKeyword('');
                            }

                            return !current;
                          });
                          return;
                        }

                        if (action.id === 'guide') {
                          setQuickActionOpen(false);
                          navigation.navigate('CoinBattleGuide');
                        }
                      }}
                      style={styles.quickActionButton}>
                      <Image resizeMode="contain" source={action.iconSource} style={styles.quickActionIcon} />
                    </AnimatedPressable>
                  </Animated.View>
                );
              })}
            </View>
          ) : null}

          <AnimatedPressable
            accessibilityLabel={quickActionOpen ? '목록 닫기' : '목록 열기'}
            accessibilityRole="button"
            onPress={() => setQuickActionOpen(current => !current)}
            style={[styles.fab, floatingButtonStyle, quickActionOpen ? styles.fabOpen : styles.fabClosed]}>
            <Animated.Image
              resizeMode="contain"
              source={icon.plusBtn}
              style={[
                styles.fabIcon,
                {
                  transform: [{rotate: fabIconRotation}],
                },
              ]}
            />
          </AnimatedPressable>

          <Modal animationType="none" onRequestClose={closeCreateModal} transparent visible={createModalVisible}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
              <Pressable disabled={isCreatingRoom} style={styles.modalBackdropButton} onPress={closeCreateModal}>
                <Animated.View style={[styles.modalBackdrop, {opacity: modalBackdropOpacity}]} />
              </Pressable>
              <TouchableWithoutFeedback accessible={false} onPress={Keyboard.dismiss}>
                <Animated.View
                  style={[
                    styles.createPanel,
                    {
                      opacity: createPanelOpacity,
                      transform: [{translateY: createPanelTranslateY}],
                    },
                  ]}>
                  <Text style={styles.createTitle}>대기방 만들기</Text>

                  <Text style={styles.createLabel}>방 제목</Text>
                  <TextInput
                    editable={!isCreatingRoom}
                    onChangeText={setRoomName}
                    placeholder="방 제목을 입력하세요"
                    placeholderTextColor="#777777"
                    selectionColor="#E50914"
                    style={styles.createInput}
                    value={roomName}
                  />

                  <Text style={styles.createLabel}>게임</Text>
                  <View style={styles.optionRow}>
                    {gameOptions.map(option => {
                      const active = option.id === realtimeGameId;

                      return (
                        <AnimatedPressable
                          key={option.id}
                          disabled={isCreatingRoom}
                          onPress={() => {
                            setRealtimeGameId(option.id);
                            setTotalRoundCount(previousCount => {
                              return Math.min(previousCount, getMaxRoundCount(option.id));
                            });
                          }}
                          style={[styles.optionChip, active && styles.optionChipActive]}>
                          <Text style={[styles.optionText, active && styles.optionTextActive]}>{option.label}</Text>
                        </AnimatedPressable>
                      );
                    })}
                  </View>

                  <Text style={styles.createLabel}>진행 라운드(판수)</Text>
                  <View style={styles.optionRow}>
                    {visibleRoundOptions.map(option => {
                      const active = option === totalRoundCount;

                      return (
                        <AnimatedPressable
                          key={option}
                          disabled={isCreatingRoom}
                          onPress={() => setTotalRoundCount(option)}
                          style={[styles.roundChip, active && styles.optionChipActive]}>
                          <Text style={[styles.optionText, active && styles.optionTextActive]}>{option}</Text>
                        </AnimatedPressable>
                      );
                    })}
                  </View>

                  <Text style={styles.createLabel}>베팅 코인</Text>
                  <View style={styles.stepper}>
                    {betAmount > MIN_BET_AMOUNT ? (
                      <AnimatedPressable
                        disabled={isCreatingRoom}
                        onPress={() => updateBetAmount(betAmount - 1)}
                        style={styles.stepperButton}>
                        <Text style={styles.stepperButtonText}>−</Text>
                      </AnimatedPressable>
                    ) : (
                      <View style={styles.stepperButton} />
                    )}
                    <Animated.Text style={[styles.stepperValue, {transform: [{scale: betAmountScale}]}]}>
                      {betAmount}
                    </Animated.Text>
                    {betAmount < MAX_BET_AMOUNT ? (
                      <AnimatedPressable
                        disabled={isCreatingRoom}
                        onPress={() => updateBetAmount(betAmount + 1)}
                        style={styles.stepperButton}>
                        <Text style={styles.stepperButtonText}>＋</Text>
                      </AnimatedPressable>
                    ) : (
                      <View style={styles.stepperButton} />
                    )}
                  </View>

                  <View style={styles.createActions}>
                    <AnimatedPressable
                      disabled={isCreatingRoom}
                      onPress={closeCreateModal}
                      style={[styles.cancelButton, isCreatingRoom && styles.cancelButtonDisabled]}>
                      <Text style={styles.cancelButtonText}>취소</Text>
                    </AnimatedPressable>
                    <AnimatedPressable
                      disabled={isCreatingRoom}
                      onPress={handleCreateRoom}
                      style={[styles.submitButton, isCreatingRoom && styles.submitButtonDisabled]}>
                      {isCreatingRoom ? (
                        <ActivityIndicator color="#FFFFFF" size="small" style={styles.submitSpinner} />
                      ) : null}
                      <Text style={styles.submitButtonText}>{isCreatingRoom ? '생성 중...' : '등록'}</Text>
                    </AnimatedPressable>
                  </View>
                </Animated.View>
              </TouchableWithoutFeedback>
            </KeyboardAvoidingView>
          </Modal>

          <Modal
            animationType="fade"
            onRequestClose={() => setIsCoinInfoVisible(false)}
            transparent
            visible={isCoinInfoVisible}>
            <View style={styles.coinInfoOverlay}>
              <AnimatedPressable
                accessibilityLabel="코인 안내 닫기"
                accessibilityRole="button"
                onPress={() => setIsCoinInfoVisible(false)}
                style={styles.coinInfoBackdrop}
              />
              <View style={styles.coinInfoCard}>
                <ScrollView showsVerticalScrollIndicator={false}>
                  <View style={styles.coinInfoHeader}>
                    <View>
                      <Text style={styles.coinInfoEyebrow}>COIN GUIDE</Text>
                      <View style={styles.coinInfoTitleRow}>
                        <Text style={styles.coinInfoTitle}>코인 안내</Text>
                        <LottieView autoPlay loop source={coinLottie} style={styles.coinInfoCoinLottie} />
                      </View>
                    </View>
                    <AnimatedPressable
                      accessibilityLabel="코인 안내 닫기"
                      accessibilityRole="button"
                      onPress={() => setIsCoinInfoVisible(false)}
                      style={styles.coinInfoCloseButton}>
                      <Image source={icon.closeBtn} style={styles.coinInfoCloseIcon} resizeMode="contain" />
                    </AnimatedPressable>
                  </View>

                  <View style={styles.coinInfoSection}>
                    <Text style={styles.coinInfoSectionTitle}>코인 획득 방법</Text>
                    <View style={styles.coinInfoList}>
                      {coinEarningGuideItems.map(item => (
                        <View key={item.title} style={styles.coinInfoItem}>
                          <View style={styles.coinInfoItemBadge}>
                            <Text style={styles.coinInfoItemBadgeText}>{item.badge}</Text>
                          </View>
                          <View style={styles.coinInfoItemText}>
                            <Text style={styles.coinInfoItemTitle}>{item.title}</Text>
                            <Text style={styles.coinInfoItemDescription}>{item.description}</Text>
                          </View>
                        </View>
                      ))}
                    </View>
                  </View>

                  <View style={styles.coinInfoSection}>
                    <Text style={styles.coinInfoSectionTitle}>코인을 모으면 좋은 점</Text>
                    <Text style={styles.coinInfoSectionLead}>모은 코인은 다양한 혜택으로 사용할 수 있어요!</Text>
                    <View style={styles.coinInfoList}>
                      {coinBenefitGuideItems.map(item => (
                        <View key={item.title} style={[styles.coinInfoItem, item.reward && styles.coinInfoRewardItem]}>
                          <View
                            style={[
                              styles.coinInfoItemBadge,
                              styles.coinInfoBenefitBadge,
                              item.reward && styles.coinInfoRewardBadge,
                            ]}>
                            <Text style={styles.coinInfoItemBadgeText}>{item.badge}</Text>
                          </View>
                          <View style={styles.coinInfoItemText}>
                            <Text style={styles.coinInfoItemTitle}>{item.title}</Text>
                            <Text style={styles.coinInfoItemDescription}>{item.description}</Text>
                          </View>
                        </View>
                      ))}
                    </View>
                  </View>

                  <AnimatedPressable
                    accessibilityRole="button"
                    onPress={() => setIsCoinInfoVisible(false)}
                    style={styles.coinInfoConfirmButton}>
                    <Text style={styles.coinInfoConfirmText}>확인</Text>
                  </AnimatedPressable>
                </ScrollView>
              </View>
            </View>
          </Modal>
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
  content: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 0,
    paddingBottom: CONTENT_BOTTOM_PADDING,
  },
  title: {
    color: '#FFFFFF',
    ...FONTS.font22B,
    lineHeight: 29,
  },
  titleRow: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  titleLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  titleActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerCoinPill: {
    height: 34,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2D2D2D',
    backgroundColor: '#111114',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingRight: 10,
  },
  headerCoinIcon: {
    width: 34,
    height: 34,
  },
  headerCoinText: {
    color: '#FFFFFF',
    ...FONTS.font13B,
    lineHeight: 17,
  },
  headerInfoButton: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerInfoIcon: {
    width: 20,
    height: 20,
  },
  guideEntryButton: {
    height: 34,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E50914',
    backgroundColor: '#E50914',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  guideEntryButtonText: {
    color: '#FFFFFF',
    ...FONTS.font13B,
    lineHeight: 18,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 0,
  },
  filterChip: {
    minWidth: 71,
    height: 34,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2D2D2D',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#111114',
  },
  filterChipActive: {
    backgroundColor: '#E50914',
    borderColor: '#E50914',
  },
  filterText: {
    color: '#FFFFFF',
    ...FONTS.font14B,
    lineHeight: 18,
  },
  filterTextActive: {
    color: '#FFFFFF',
  },
  searchBar: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2B2B2F',
    backgroundColor: '#0B0B0D',
    paddingHorizontal: 12,
  },
  searchIcon: {
    width: 18,
    height: 18,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: '100%',
    padding: 0,
    color: '#FFFFFF',
    ...FONTS.font14M,
  },
  searchClearButton: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchClearIcon: {
    width: 16,
    height: 16,
    tintColor: '#8A8D95',
  },
  roomList: {
    marginTop: 18,
  },
  emptyRoomState: {
    flex: 1,
    minHeight: 360,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyRoomText: {
    color: '#8A8D95',
    textAlign: 'center',
    ...FONTS.font14M,
    lineHeight: 19,
  },
  roomRow: {
    minHeight: THUMBNAIL_HEIGHT + 20,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    borderRadius: 12,
    padding: 10,
    backgroundColor: '#171717',
    borderWidth: 1,
    borderColor: '#252525',
  },
  roomRowDisabled: {
    opacity: 0.48,
  },
  thumbnail: {
    width: THUMBNAIL_WIDTH,
    height: THUMBNAIL_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: '#171717',
    borderWidth: 1,
    borderColor: '#252525',
    borderRadius: 8,
  },
  thumbnailImage: {
    width: '86%',
    height: '86%',
  },
  statusBadge: {
    minWidth: 44,
    height: 20,
    borderRadius: 4,
    paddingHorizontal: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusPlaying: {
    backgroundColor: '#E50914',
  },
  statusWaiting: {
    backgroundColor: '#272727',
  },
  statusText: {
    color: '#FFFFFF',
    ...FONTS.font10B,
    lineHeight: 13,
  },
  roomInfo: {
    flex: 1,
    paddingLeft: 12,
  },
  roomTitle: {
    color: '#FFFFFF',
    ...FONTS.font15B,
    lineHeight: 21,
  },
  hostRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  hostDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#242428',
    marginRight: 5,
    overflow: 'hidden',
  },
  hostName: {
    flex: 1,
    color: '#D6D8DE',
    ...FONTS.font12M,
    lineHeight: 16,
  },
  gameChip: {
    alignSelf: 'flex-start',
    height: 24,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#2D2D2D',
    backgroundColor: '#171717',
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  gameChipText: {
    color: '#D6D8DE',
    ...FONTS.font11M,
    lineHeight: 15,
  },
  memberStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 5,
  },
  memberCountText: {
    color: '#8A8D95',
    ...FONTS.font11M,
    lineHeight: 15,
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: FAB_BOTTOM,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabClosed: {
    backgroundColor: '#E50914',
  },
  fabOpen: {
    backgroundColor: '#E50914',
  },
  fabIcon: {
    width: 32,
    height: 32,
  },
  quickActionList: {
    position: 'absolute',
    right: 20,
    bottom: QUICK_ACTION_BOTTOM,
    gap: 14,
  },
  quickActionButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#E50914',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickActionIcon: {
    width: 32,
    height: 32,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdropButton: {
    ...StyleSheet.absoluteFillObject,
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.62)',
  },
  createPanel: {
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 24,
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    backgroundColor: '#171717',
    borderWidth: 1,
    borderColor: '#252525',
  },
  createTitle: {
    color: '#FFFFFF',
    ...FONTS.font20B,
    lineHeight: 26,
    marginBottom: 16,
  },
  createLabel: {
    color: '#A9ABB2',
    ...FONTS.font13B,
    lineHeight: 18,
    marginBottom: 8,
    marginTop: 12,
  },
  createInput: {
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2D2D2D',
    backgroundColor: '#0B0B0D',
    color: '#FFFFFF',
    ...FONTS.font14M,
    paddingHorizontal: 12,
  },
  optionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  optionChip: {
    minWidth: 126,
    height: 38,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2D2D2D',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  roundChip: {
    width: 44,
    height: 38,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2D2D2D',
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionChipActive: {
    backgroundColor: '#E50914',
    borderColor: '#E50914',
  },
  optionText: {
    color: '#A9ABB2',
    ...FONTS.font13B,
  },
  optionTextActive: {
    color: '#FFFFFF',
  },
  stepper: {
    width: 150,
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2D2D2D',
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
  },
  stepperButton: {
    width: 44,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperButtonText: {
    color: '#FFFFFF',
    ...FONTS.font22M,
    lineHeight: 26,
  },
  stepperValue: {
    flex: 1,
    color: '#FFFFFF',
    ...FONTS.font16B,
    textAlign: 'center',
  },
  createActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },
  cancelButton: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#2D2D2D',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonDisabled: {
    opacity: 0.5,
  },
  cancelButtonText: {
    color: '#A9ABB2',
    ...FONTS.font14B,
  },
  submitButton: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#E50914',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: '#2A2A2A',
  },
  submitSpinner: {
    marginRight: 8,
  },
  submitButtonText: {
    color: '#FFFFFF',
    ...FONTS.font14B,
  },
  coinInfoOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.68)',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  coinInfoBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  coinInfoCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: '#171717',
    padding: 16,
    maxHeight: '82%',
    shadowColor: '#000000',
    shadowOffset: {width: 0, height: 8},
    shadowOpacity: 0.24,
    shadowRadius: 14,
    elevation: 8,
  },
  coinInfoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  coinInfoTitleRow: {
    marginTop: 5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  coinInfoCoinLottie: {
    width: 34,
    height: 34,
  },
  coinInfoEyebrow: {
    color: '#E50914',
    ...FONTS.font11B,
    lineHeight: 14,
  },
  coinInfoTitle: {
    color: '#FFFFFF',
    ...FONTS.font22B,
    lineHeight: 28,
  },
  coinInfoCloseButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coinInfoCloseIcon: {
    width: 18,
    height: 18,
    tintColor: '#A9ABB2',
  },
  coinInfoSection: {
    marginTop: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
    backgroundColor: '#131315',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  coinInfoSectionTitle: {
    color: '#FFFFFF',
    ...FONTS.font14B,
    lineHeight: 19,
  },
  coinInfoSectionLead: {
    marginTop: 6,
    color: '#D6D7DB',
    ...FONTS.font12M,
    lineHeight: 18,
  },
  coinInfoList: {
    marginTop: 10,
    gap: 2,
  },
  coinInfoItem: {
    minHeight: 38,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingVertical: 6,
  },
  coinInfoItemBadge: {
    width: 24,
    height: 24,
    borderRadius: 7,
    backgroundColor: '#E50914',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 9,
  },
  coinInfoBenefitBadge: {
    backgroundColor: '#2D2D2D',
  },
  coinInfoRewardItem: {
    backgroundColor: 'rgba(229,9,20,0.055)',
  },
  coinInfoRewardBadge: {
    backgroundColor: '#E50914',
  },
  coinInfoItemBadgeText: {
    color: '#FFFFFF',
    ...FONTS.font11B,
    lineHeight: 14,
  },
  coinInfoItemText: {
    flex: 1,
  },
  coinInfoItemTitle: {
    color: '#FFFFFF',
    ...FONTS.font12B,
    lineHeight: 16,
  },
  coinInfoItemDescription: {
    marginTop: 1,
    color: '#C7C8CC',
    ...FONTS.font11M,
    lineHeight: 15,
  },
  coinInfoConfirmButton: {
    height: 44,
    marginTop: 14,
    borderRadius: 10,
    backgroundColor: '#E50914',
    alignItems: 'center',
    justifyContent: 'center',
  },
  coinInfoConfirmText: {
    color: '#FFFFFF',
    ...FONTS.font14B,
    lineHeight: 18,
  },
});
