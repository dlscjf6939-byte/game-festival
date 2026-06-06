import React, {useEffect, useMemo, useRef, useState} from 'react';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {
  Animated,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {icon} from '../assets/icons';
import {image} from '../assets/images';
import {AnimatedPressable} from '../components/AnimatedPressable';
import {AppGnb} from '../components/AppGnb';
import {TabSceneTransition} from '../components/TabSceneTransition';
import {useAuth} from '../auth/AuthProvider';
import {
  useCoinBattleRooms,
  type CoinBattleRoom,
  type CoinBattleRoomStatus,
} from '../hooks/useCoinBattleRooms';
import type {CoinBattleStackParamList} from '../navigation/types';
import {FONTS} from '../constants/theme';

const SCREENSHOT_WIDTH = 375;
const SCREENSHOT_HEIGHT = 812;
const THUMBNAIL_WIDTH = 143;
const THUMBNAIL_HEIGHT = 99;

type DisplayRoom = {
  cropY: number;
  game: string;
  host: string;
  hostProfileImageUri?: string;
  id: string;
  isRealtime: boolean;
  ownerEmployeeId?: number;
  status: string;
  statusTone: 'playing' | 'waiting';
  title: string;
};

const filters = ['전체', '대기중', '게임중'];
const quickActions = [
  {id: 'create', label: '방 만들기', iconSource: icon.plusBtn},
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

const cropOffsets = [169, 270, 371, 472, 573, 674];

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
  return rooms.map((room, index) => {
    const status = getRoomStatusLabel(room.roomStatus);
    const statusTone = room.roomStatus === 'WAITING' ? 'waiting' : 'playing';

    return {
      cropY: cropOffsets[index % cropOffsets.length],
      game: getRoomGameTitle(room),
      host: getRoomHost(room),
      hostProfileImageUri: getRoomHostProfileImageUri(room),
      id: room.roomId,
      isRealtime: true,
      ownerEmployeeId: room.ownerEmployeeId,
      status,
      statusTone,
      title: room.roomName,
    };
  });
}

function isSameEmployeeId(
  left?: number | string,
  right?: number | string,
): boolean {
  if (left === undefined || right === undefined) {
    return false;
  }

  return String(left) === String(right);
}

function getMaxRoundCount(realtimeGameId: number): number {
  return maxRoundCountByGameId[realtimeGameId] ?? 1;
}

function Thumbnail({room}: {room: DisplayRoom}): JSX.Element {
  const isWaiting = room.statusTone === 'waiting';

  return (
    <View style={styles.thumbnail}>
      {/* <Image
        source={image.coinBattle}
        style={[
          styles.thumbnailImage,
          {
            left: -20,
            top: -room.cropY,
          },
        ]}
      /> */}
      <View
        style={[
          styles.statusBadge,
          isWaiting ? styles.statusWaiting : styles.statusPlaying,
        ]}>
        <Text style={styles.statusText}>{room.status}</Text>
      </View>
    </View>
  );
}

export function CoinBattleScreen(): JSX.Element {
  const navigation =
    useNavigation<NativeStackNavigationProp<CoinBattleStackParamList>>();
  const {auth, refreshProfile} = useAuth();
  const scrollY = useRef(new Animated.Value(0)).current;
  const quickActionProgress = useRef(new Animated.Value(0)).current;
  const createModalProgress = useRef(new Animated.Value(0)).current;
  const betAmountScale = useRef(new Animated.Value(1)).current;
  const autoNavigatedRoomIdRef = useRef<string | null>(null);
  const [quickActionOpen, setQuickActionOpen] = useState(false);
  const [quickActionVisible, setQuickActionVisible] = useState(false);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [roomName, setRoomName] = useState('저랑 코인걸고 게임 한판 하실분!!!');
  const [realtimeGameId, setRealtimeGameId] = useState(1);
  const [totalRoundCount, setTotalRoundCount] = useState(1);
  const [betAmount, setBetAmount] = useState(1);
  const {
    createRoom,
    enterRoom,
    rooms: realtimeRooms,
  } = useCoinBattleRooms({
    accessToken: auth?.accessToken,
  });
  const visibleRooms = useMemo(
    () => mapRealtimeRooms(realtimeRooms),
    [realtimeRooms],
  );
  const maxRoundCount = getMaxRoundCount(realtimeGameId);
  const visibleRoundOptions = useMemo(() => {
    return roundOptions.filter(option => option <= maxRoundCount);
  }, [maxRoundCount]);
  const ownedRoom = useMemo(() => {
    return visibleRooms.find(room => {
      return (
        room.isRealtime &&
        isSameEmployeeId(room.ownerEmployeeId, auth?.employeeId)
      );
    });
  }, [auth?.employeeId, visibleRooms]);

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
    const clampedAmount = Math.min(
      MAX_BET_AMOUNT,
      Math.max(MIN_BET_AMOUNT, nextAmount),
    );

    if (clampedAmount !== betAmount) {
      animateBetAmount();
      setBetAmount(clampedAmount);
    }
  };

  const handleCreateRoom = () => {
    const clampedRoundCount = Math.min(totalRoundCount, maxRoundCount);
    const created = createRoom({
      betAmount: Math.min(MAX_BET_AMOUNT, Math.max(MIN_BET_AMOUNT, betAmount)),
      realtimeGameId,
      roomName: roomName.trim() || '코인대전 대기방',
      totalRoundCount: clampedRoundCount,
    });

    if (created) {
      refreshProfile().catch(error => {
        if (__DEV__) {
          console.log('[CoinBattleScreen] profile refresh after create failed', error);
        }
      });
      closeCreateModal();
    }
  };

  const handleEnterRoom = (room: DisplayRoom) => {
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
    if (!ownedRoom || autoNavigatedRoomIdRef.current === ownedRoom.id) {
      return;
    }

    if (__DEV__) {
      console.log('[CoinBattleScreen] auto navigate owned room', {
        ownedRoomId: ownedRoom.id,
      });
    }

    autoNavigatedRoomIdRef.current = ownedRoom.id;
    navigation.replace('CoinBattleRoom', {
      game: ownedRoom.game,
      host: ownedRoom.host,
      isRealtime: ownedRoom.isRealtime,
      roomId: ownedRoom.id,
      status: ownedRoom.status,
      title: ownedRoom.title,
    });
  }, [navigation, ownedRoom]);

  return (
    <TabSceneTransition>
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="light-content" backgroundColor="#000000" />
        <AppGnb scrollY={scrollY} />

        <View style={styles.screen}>
          <Animated.ScrollView
            bounces={false}
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
            onScroll={Animated.event(
              [{nativeEvent: {contentOffset: {y: scrollY}}}],
              {useNativeDriver: true},
            )}
            scrollEventThrottle={16}>
            <View style={styles.titleRow}>
              <Text style={styles.title}>코인대전</Text>
              <AnimatedPressable
                accessibilityRole="button"
                onPress={() => navigation.navigate('CoinBattleGuide')}
                style={styles.guideEntryButton}>
                <Text style={styles.guideEntryButtonText}>연습하기</Text>
              </AnimatedPressable>
            </View>

            <View style={styles.filterRow}>
              {filters.map((filter, index) => {
                const active = index === 0;

                return (
                  <View
                    key={filter}
                    style={[
                      styles.filterChip,
                      active && styles.filterChipActive,
                    ]}>
                    <Text
                      style={[
                        styles.filterText,
                        active && styles.filterTextActive,
                      ]}>
                      {filter}
                    </Text>
                  </View>
                );
              })}
            </View>

            {visibleRooms.length === 0 ? (
              <View style={styles.emptyRoomState}>
                <Text style={styles.emptyRoomText}>방이 없습니다.</Text>
              </View>
            ) : (
              <View style={styles.roomList}>
                {visibleRooms.map(room => (
                  <AnimatedPressable
                    key={room.id}
                    onPress={() => handleEnterRoom(room)}
                    style={styles.roomRow}>
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
                    </View>
                  </AnimatedPressable>
                ))}
              </View>
            )}
          </Animated.ScrollView>

          {quickActionVisible ? (
            <View style={styles.quickActionList}>
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
                          openCreateModal();
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
            style={[
              styles.fab,
              quickActionOpen ? styles.fabOpen : styles.fabClosed,
            ]}>
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

          <Modal
            animationType="none"
            onRequestClose={closeCreateModal}
            transparent
            visible={createModalVisible}>
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
              style={styles.modalOverlay}>
              <Pressable
                style={styles.modalBackdropButton}
                onPress={closeCreateModal}>
                <Animated.View
                  style={[
                    styles.modalBackdrop,
                    {opacity: modalBackdropOpacity},
                  ]}
                />
              </Pressable>
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
                        onPress={() => {
                          setRealtimeGameId(option.id);
                          setTotalRoundCount(previousCount => {
                            return Math.min(previousCount, getMaxRoundCount(option.id));
                          });
                        }}
                        style={[
                          styles.optionChip,
                          active && styles.optionChipActive,
                        ]}>
                        <Text
                          style={[
                            styles.optionText,
                            active && styles.optionTextActive,
                          ]}>
                          {option.label}
                        </Text>
                      </AnimatedPressable>
                    );
                  })}
                </View>

                <Text style={styles.createLabel}>진행 라운드</Text>
                <View style={styles.optionRow}>
                  {visibleRoundOptions.map(option => {
                    const active = option === totalRoundCount;

                    return (
                      <AnimatedPressable
                        key={option}
                        onPress={() => setTotalRoundCount(option)}
                        style={[
                          styles.roundChip,
                          active && styles.optionChipActive,
                        ]}>
                        <Text
                          style={[
                            styles.optionText,
                            active && styles.optionTextActive,
                          ]}>
                          {option}
                        </Text>
                      </AnimatedPressable>
                    );
                  })}
                </View>

                <Text style={styles.createLabel}>베팅 코인</Text>
                <View style={styles.stepper}>
                  {betAmount > MIN_BET_AMOUNT ? (
                    <AnimatedPressable
                      onPress={() => updateBetAmount(betAmount - 1)}
                      style={styles.stepperButton}>
                      <Text style={styles.stepperButtonText}>−</Text>
                    </AnimatedPressable>
                  ) : (
                    <View style={styles.stepperButton} />
                  )}
                  <Animated.Text
                    style={[
                      styles.stepperValue,
                      {transform: [{scale: betAmountScale}]},
                    ]}>
                    {betAmount}
                  </Animated.Text>
                  {betAmount < MAX_BET_AMOUNT ? (
                    <AnimatedPressable
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
                    onPress={closeCreateModal}
                    style={styles.cancelButton}>
                    <Text style={styles.cancelButtonText}>취소</Text>
                  </AnimatedPressable>
                  <AnimatedPressable
                    onPress={handleCreateRoom}
                    style={styles.submitButton}>
                    <Text style={styles.submitButtonText}>등록</Text>
                  </AnimatedPressable>
                </View>
              </Animated.View>
            </KeyboardAvoidingView>
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
    paddingTop: 8,
    paddingBottom: 138,
  },
  title: {
    color: '#FFFFFF',
    ...FONTS.font22B,
    lineHeight: 29,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  guideEntryButton: {
    height: 34,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#333333',
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
    marginTop: 28,
  },
  filterChip: {
    minWidth: 71,
    height: 34,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000000',
  },
  filterChipActive: {
    backgroundColor: '#5E5252',
    borderColor: '#5E5252',
  },
  filterText: {
    color: '#FFFFFF',
    ...FONTS.font14B,
    lineHeight: 18,
  },
  filterTextActive: {
    color: '#FFFFFF',
  },
  roomList: {
    marginTop: 20,
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
    minHeight: THUMBNAIL_HEIGHT,
    flexDirection: 'row',
    marginBottom: 16,
  },
  thumbnail: {
    width: THUMBNAIL_WIDTH,
    height: THUMBNAIL_HEIGHT,
    overflow: 'hidden',
    backgroundColor: '#AFC0FF',
  },
  thumbnailImage: {
    position: 'absolute',
    width: SCREENSHOT_WIDTH,
    height: SCREENSHOT_HEIGHT,
  },
  statusBadge: {
    position: 'absolute',
    top: 5,
    left: 5,
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
    backgroundColor: '#7A844F',
  },
  statusText: {
    color: '#FFFFFF',
    ...FONTS.font10B,
    lineHeight: 13,
  },
  roomInfo: {
    flex: 1,
    paddingLeft: 14,
    paddingTop: 1,
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
    backgroundColor: '#FFFFFF',
    marginRight: 5,
    overflow: 'hidden',
  },
  hostName: {
    flex: 1,
    color: '#E0E0E0',
    ...FONTS.font12M,
    lineHeight: 16,
  },
  gameChip: {
    alignSelf: 'flex-start',
    height: 24,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.7)',
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  gameChipText: {
    color: '#FFFFFF',
    ...FONTS.font11M,
    lineHeight: 15,
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 21,
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
    bottom: 93,
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
    paddingBottom: 34,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: '#151515',
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  createTitle: {
    color: '#FFFFFF',
    ...FONTS.font20B,
    lineHeight: 26,
    marginBottom: 18,
  },
  createLabel: {
    color: '#B7B9C0',
    ...FONTS.font13B,
    lineHeight: 18,
    marginBottom: 8,
    marginTop: 12,
  },
  createInput: {
    height: 46,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#333333',
    backgroundColor: '#0A0A0A',
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
    borderColor: '#373737',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  roundChip: {
    width: 44,
    height: 38,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#373737',
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionChipActive: {
    backgroundColor: '#E50914',
    borderColor: '#E50914',
  },
  optionText: {
    color: '#D9D9D9',
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
    borderColor: '#373737',
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
    marginTop: 22,
  },
  cancelButton: {
    flex: 1,
    height: 46,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#383838',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    color: '#D7D7D7',
    ...FONTS.font14B,
  },
  submitButton: {
    flex: 1,
    height: 46,
    borderRadius: 8,
    backgroundColor: '#E50914',
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonText: {
    color: '#FFFFFF',
    ...FONTS.font14B,
  },
});
