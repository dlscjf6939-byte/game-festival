import React, {useEffect, useRef, useState} from 'react';
import {useNavigation, useRoute} from '@react-navigation/native';
import type {
  NativeStackNavigationProp,
  NativeStackScreenProps,
} from '@react-navigation/native-stack';
import {
  Animated,
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  StyleProp,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import {BlurView} from '@react-native-community/blur';
import {useAuth} from '../auth/AuthProvider';
import {image} from '../assets/images';
import {AppGnb} from '../components/AppGnb';
import {TabSceneTransition} from '../components/TabSceneTransition';
import {
  useCoinBattleRooms,
  type CoinBattleRoom,
} from '../hooks/useCoinBattleRooms';
import {
  normalizeRpsResult,
  useCoinBattleRpsGame,
  type RpsChoice,
  type RpsResult,
  type RpsRoundResult,
} from '../hooks/useCoinBattleRpsGame';
import {
  useCoinBattlePictureMatchGame,
  type PictureMatchPlayer,
  type PictureMatchState,
} from '../hooks/useCoinBattlePictureMatchGame';
import type {CoinBattleStackParamList} from '../navigation/types';

type RouteProps = NativeStackScreenProps<
  CoinBattleStackParamList,
  'CoinBattleRoom'
>['route'];

type BouncyPressableProps = Omit<
  React.ComponentProps<typeof Pressable>,
  'ref' | 'style'
> & {
  style?: StyleProp<ViewStyle>;
};

const roomStatusLabels = {
  EXIT: '종료',
  FULL: '정원마감',
  IN_PROGRESS: '게임중',
  WAITING: '대기중',
} as const;
const rpsChoices: Array<{
  id: RpsChoice;
  image: typeof image.rock;
  label: string;
}> = [
  {id: 'ROCK', image: image.rock, label: '바위'},
  {id: 'SCISSORS', image: image.scissor, label: '가위'},
  {id: 'PAPER', image: image.paper, label: '보'},
];
const rpsChoiceById = Object.fromEntries(
  rpsChoices.map(choice => [choice.id, choice]),
) as Record<RpsChoice, (typeof rpsChoices)[number]>;
const rpsResultMeta = {
  DRAW: {icon: '🤝', label: '무'},
  LOSE: {icon: '💥', label: '패'},
  WIN: {icon: '🏆', label: '승'},
} as const;
const START_COUNTDOWN_SECONDS = 3;

type RoundResultOverlay = {
  result: RpsResult;
  roundNumber: number;
};

function normalizeRoomDetail(payload: unknown): CoinBattleRoom | undefined {
  if (!payload || typeof payload !== 'object') {
    return undefined;
  }

  const room = payload as Partial<CoinBattleRoom>;

  if (
    typeof room.roomId !== 'string' ||
    typeof room.roomName !== 'string' ||
    typeof room.maxMembers !== 'number' ||
    !Array.isArray(room.roomMembers)
  ) {
    return undefined;
  }

  return room as CoinBattleRoom;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

function BouncyPressable({
  children,
  onPressIn,
  onPressOut,
  style,
  ...props
}: BouncyPressableProps): JSX.Element {
  const pressScale = useRef(new Animated.Value(1)).current;

  const animateScale = (toValue: number) => {
    Animated.spring(pressScale, {
      toValue,
      speed: 34,
      bounciness: 5,
      useNativeDriver: true,
    }).start();
  };

  return (
    <AnimatedPressable
      {...props}
      onPressIn={event => {
        animateScale(0.96);
        onPressIn?.(event);
      }}
      onPressOut={event => {
        animateScale(1);
        onPressOut?.(event);
      }}
      style={[style, {transform: [{scale: pressScale}]}]}>
      {children}
    </AnimatedPressable>
  );
}

function BattleSlotCard({
  choice,
  hiddenSubmitted,
  label,
  name,
  role,
}: {
  choice: RpsChoice | null;
  hiddenSubmitted?: boolean;
  label: string;
  name: string;
  role: string;
}): JSX.Element {
  const cardScale = useRef(new Animated.Value(1)).current;
  const pulseOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (choice || hiddenSubmitted) {
      cardScale.setValue(0.92);
      Animated.spring(cardScale, {
        bounciness: 9,
        speed: 18,
        toValue: 1,
        useNativeDriver: true,
      }).start();
    }
  }, [cardScale, choice, hiddenSubmitted]);

  useEffect(() => {
    if (!hiddenSubmitted || choice) {
      pulseOpacity.stopAnimation();
      pulseOpacity.setValue(0);
      return;
    }

    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseOpacity, {
          duration: 700,
          toValue: 1,
          useNativeDriver: true,
        }),
        Animated.timing(pulseOpacity, {
          duration: 700,
          toValue: 0.2,
          useNativeDriver: true,
        }),
      ]),
    );

    animation.start();

    return () => {
      animation.stop();
    };
  }, [choice, hiddenSubmitted, pulseOpacity]);

  return (
    <Animated.View
      style={[
        styles.playerCard,
        (choice || hiddenSubmitted) && styles.playerCardLocked,
        {transform: [{scale: cardScale}]},
      ]}>
      {hiddenSubmitted && !choice ? (
        <Animated.View
          pointerEvents="none"
          style={[styles.playerCardPulse, {opacity: pulseOpacity}]}
        />
      ) : null}
      <Text style={styles.playerRole}>{role}</Text>
      <Text style={styles.playerCardName}>{name}</Text>
      {choice ? (
        <View style={styles.playerChoiceFrame}>
          <Image
            resizeMode="contain"
            source={rpsChoiceById[choice].image}
            style={styles.playerChoiceImage}
          />
        </View>
      ) : hiddenSubmitted ? (
        <View style={styles.hiddenChoiceCard}>
          <Text style={styles.hiddenChoiceGlyph}>✦</Text>
        </View>
      ) : (
        <Text style={styles.playerChoicePlaceholder}>?</Text>
      )}
      <Text
        style={[
          styles.playerChoiceLabel,
          hiddenSubmitted && !choice && styles.playerChoiceLabelReady,
        ]}>
        {label}
      </Text>
    </Animated.View>
  );
}

function RpsChoiceHandCard({
  active,
  choice,
  disabled,
  onPress,
}: {
  active: boolean;
  choice: (typeof rpsChoices)[number];
  disabled: boolean;
  onPress: () => void;
}): JSX.Element {
  const translateY = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;
  const glowOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(translateY, {
        bounciness: 8,
        speed: 18,
        toValue: active ? -12 : 0,
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        bounciness: 7,
        speed: 18,
        toValue: active ? 1.05 : 1,
        useNativeDriver: true,
      }),
      Animated.timing(glowOpacity, {
        duration: 180,
        toValue: active ? 1 : 0,
        useNativeDriver: true,
      }),
    ]).start();
  }, [active, glowOpacity, scale, translateY]);

  return (
    <Animated.View
      style={[
        styles.choiceCardWrap,
        {transform: [{translateY}, {scale}]},
      ]}>
      <Animated.View
        pointerEvents="none"
        style={[styles.choiceGlow, {opacity: glowOpacity}]}
      />
      <BouncyPressable
        accessibilityRole="button"
        disabled={disabled}
        onPress={onPress}
        style={[
          styles.choiceButton,
          active && styles.choiceButtonActive,
          disabled && styles.choiceButtonDisabled,
        ]}>
        <View style={styles.choiceArtFrame}>
          <Image
            resizeMode="contain"
            source={choice.image}
            style={styles.choiceImage}
          />
        </View>
        <Text
          style={[
            styles.choiceLabel,
            active && styles.choiceLabelActive,
          ]}>
          {choice.label}
        </Text>
      </BouncyPressable>
    </Animated.View>
  );
}

function isSamePictureMatchPlayer(
  player: PictureMatchPlayer,
  myUserId?: null | number | string,
  myUserName?: string,
): boolean {
  if (
    myUserId !== null &&
    myUserId !== undefined &&
    player.employeeId !== undefined &&
    String(player.employeeId) === String(myUserId)
  ) {
    return true;
  }

  return Boolean(
    myUserName &&
      player.employeeName &&
      player.employeeName === myUserName,
  );
}

function FlippablePictureCard({
  disabled,
  isFaceUp,
  isMatched,
  isMine,
  onPress,
  picture,
}: {
  disabled: boolean;
  isFaceUp: boolean;
  isMatched: boolean;
  isMine: boolean;
  onPress: () => void;
  picture: {
    employeeName?: string;
    imgUrl?: string;
  };
}): JSX.Element {
  const flipProgress = useRef(new Animated.Value(isFaceUp ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(flipProgress, {
      bounciness: 0,
      speed: 18,
      toValue: isFaceUp ? 1 : 0,
      useNativeDriver: true,
    }).start();
  }, [flipProgress, isFaceUp]);

  const frontRotateY = flipProgress.interpolate({
    inputRange: [0, 1],
    outputRange: ['180deg', '360deg'],
  });
  const backRotateY = flipProgress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={styles.pictureMatchCardShell}>
      <Animated.View
        style={[
          styles.pictureMatchCard,
          styles.pictureMatchCardFace,
          styles.pictureMatchCardBackFace,
          {transform: [{perspective: 800}, {rotateY: backRotateY}]},
        ]}>
        <Text style={styles.pictureMatchBackText}>?</Text>
      </Animated.View>

      <Animated.View
        style={[
          styles.pictureMatchCard,
          styles.pictureMatchCardFace,
          styles.pictureMatchCardFaceUp,
          isMatched && styles.pictureMatchCardMatched,
          {transform: [{perspective: 800}, {rotateY: frontRotateY}]},
        ]}>
        {isMine ? (
          <View style={styles.pictureMatchMineBadge}>
            <Text style={styles.pictureMatchMineBadgeText}>✓</Text>
          </View>
        ) : null}
        {picture.imgUrl ? (
          <Image
            resizeMode="cover"
            source={{uri: picture.imgUrl}}
            style={styles.pictureMatchImage}
          />
        ) : (
          <Text style={styles.pictureMatchFallbackName}>
            {picture.employeeName ?? '카드'}
          </Text>
        )}
      </Animated.View>
    </Pressable>
  );
}

function PictureMatchGamePanel({
  isFinished,
  myUserId,
  myUserName,
  onFlip,
  state,
}: {
  isFinished: boolean;
  myUserId?: null | number | string;
  myUserName?: string;
  onFlip: (pictureIndex: number) => void;
  state: PictureMatchState | null;
}): JSX.Element {
  const width = typeof state?.width === 'number' ? state.width : 0;
  const players = state && Array.isArray(state.players)
    ? state.players
    : state && Array.isArray(state.player)
      ? state.player
      : [];
  const pictures = state && Array.isArray(state.pictures) ? state.pictures : [];
  const matchPictureCount =
    typeof state?.matchPictureCount === 'number' &&
    state.matchPictureCount > 0
      ? state.matchPictureCount
      : 2;
  const currentTurnPlayer = players.find(player => player.isMyTurn);
  const isMyTurn = currentTurnPlayer
    ? isSamePictureMatchPlayer(currentTurnPlayer, myUserId, myUserName)
    : false;
  const myMatchedCardCount = pictures.reduce((count, picture) => {
    if (!picture.isMatched || picture.matchedEmployeeId === undefined) {
      return count;
    }

    return myUserId !== null &&
      myUserId !== undefined &&
      String(picture.matchedEmployeeId) === String(myUserId)
      ? count + 1
      : count;
  }, 0);
  const opponentMatchedCardCount = pictures.reduce((count, picture) => {
    if (!picture.isMatched || picture.matchedEmployeeId === undefined) {
      return count;
    }

    return myUserId !== null &&
      myUserId !== undefined &&
      String(picture.matchedEmployeeId) !== String(myUserId)
      ? count + 1
      : count;
  }, 0);
  const myMatchedSetCount = Math.floor(myMatchedCardCount / matchPictureCount);
  const opponentMatchedSetCount = Math.floor(
    opponentMatchedCardCount / matchPictureCount,
  );
  const totalMatchedSetCount = Math.floor(
    (myMatchedCardCount + opponentMatchedCardCount) / matchPictureCount,
  );
  const totalSetCount = Math.floor(pictures.length / matchPictureCount);
  const remainingSetCount = Math.max(totalSetCount - totalMatchedSetCount, 0);
  const allVisibleAtStart =
    pictures.length > 0 &&
    pictures.every(picture => picture.isFlipped) &&
    pictures.every(picture => !picture.isMatched);
  const rows = Array.from(
    {length: width > 0 ? Math.ceil(pictures.length / width) : 0},
    (_, rowIndex) => {
      const start = rowIndex * width;
      return pictures.slice(start, start + width);
    },
  );
  const turnLabel = isFinished
    ? '게임 종료'
    : allVisibleAtStart
      ? '기억하세요'
      : isMyTurn
        ? '내 턴'
        : '상대 턴';

  return (
    <View style={styles.pictureMatchPanel}>
      <View style={styles.pictureMatchHeader}>
        <Text style={styles.pictureMatchTitle}>같은 그림 맞추기</Text>
        <View
          style={[
            styles.pictureMatchTurnPill,
            isMyTurn && styles.pictureMatchTurnPillActive,
          ]}>
          <Text style={styles.pictureMatchTurnText}>{turnLabel}</Text>
        </View>
      </View>

      <View style={styles.pictureMatchScoreRow}>
        <View style={styles.pictureMatchScoreCard}>
          <Text style={styles.pictureMatchScoreLabel}>내 점수</Text>
          <Text style={styles.pictureMatchScoreValue}>
            {myMatchedSetCount}
          </Text>
        </View>
        <View style={styles.pictureMatchMetaCard}>
          <Text style={styles.pictureMatchMetaLabel}>남은 매치</Text>
          <Text style={styles.pictureMatchMetaValue}>{remainingSetCount}</Text>
        </View>
        <View style={styles.pictureMatchScoreCard}>
          <Text style={styles.pictureMatchScoreLabel}>상대 점수</Text>
          <Text style={styles.pictureMatchScoreValue}>
            {opponentMatchedSetCount}
          </Text>
        </View>
      </View>

      <View style={styles.pictureMatchBoard}>
        {rows.map((row, rowIndex) => (
          <View key={`row-${rowIndex}`} style={styles.pictureMatchRow}>
            {row.map((picture, columnIndex) => {
              const pictureIndex = rowIndex * width + columnIndex;
              const isFaceUp = Boolean(
                picture.isFlipped || picture.isMatched,
              );
              const isMine =
                picture.isMatched &&
                myUserId !== null &&
                myUserId !== undefined &&
                picture.matchedEmployeeId !== undefined &&
                String(picture.matchedEmployeeId) === String(myUserId);

              return (
                <FlippablePictureCard
                  key={`${picture.employeeId ?? 'picture'}-${pictureIndex}`}
                  disabled={
                    isFinished ||
                    allVisibleAtStart ||
                    !isMyTurn ||
                    Boolean(picture.isMatched) ||
                    Boolean(picture.isFlipped)
                  }
                  isFaceUp={isFaceUp}
                  isMatched={Boolean(picture.isMatched)}
                  isMine={Boolean(isMine)}
                  onPress={() => onFlip(pictureIndex)}
                  picture={picture}
                />
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
}

export function CoinBattleRoomScreen(): JSX.Element {
  const navigation =
    useNavigation<NativeStackNavigationProp<CoinBattleStackParamList>>();
  const route = useRoute<RouteProps>();
  const {auth} = useAuth();
  const {
    checkPictureMatch,
    chooseRps,
    connectionStatus,
    flipPictureMatch,
    leaveRoom,
    readyRoom,
    requestPictureMatchState,
    requestRoomState,
    requestRpsState,
    rooms: realtimeRooms,
    startRoom,
    subscribePictureMatch,
    subscribeRoom,
    subscribeRps,
  } = useCoinBattleRooms({accessToken: auth?.accessToken});
  const [ready, setReady] = useState(false);
  const [roomDetail, setRoomDetail] = useState<CoinBattleRoom | undefined>(
    undefined,
  );
  const [gameRoomSnapshot, setGameRoomSnapshot] =
    useState<CoinBattleRoom | undefined>(undefined);
  const [hasGameStarted, setHasGameStarted] = useState(false);
  const [finishedRoomSnapshot, setFinishedRoomSnapshot] =
    useState<CoinBattleRoom | undefined>(undefined);
  const [startCountdownSeconds, setStartCountdownSeconds] = useState<
    number | null
  >(null);
  const [roundResultOverlay, setRoundResultOverlay] =
    useState<RoundResultOverlay | null>(null);
  const [pendingRpsChoice, setPendingRpsChoice] =
    useState<RpsChoice | null>(null);
  const [isReturningToWaitingRoom, setIsReturningToWaitingRoom] =
    useState(false);
  const scrollViewRef = useRef<ScrollView>(null);
  const leaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const roundResultTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const startRequestedRef = useRef(false);
  const latestPresentedRoundRef = useRef(0);
  const countdownBackdropOpacity = useRef(new Animated.Value(0)).current;
  const countdownScale = useRef(new Animated.Value(0.72)).current;
  const countdownOpacity = useRef(new Animated.Value(0)).current;
  const resultBackdropOpacity = useRef(new Animated.Value(0)).current;
  const resultScale = useRef(new Animated.Value(0.68)).current;
  const resultOpacity = useRef(new Animated.Value(0)).current;
  const roomContentOpacity = useRef(new Animated.Value(1)).current;
  const roomContentTranslateY = useRef(new Animated.Value(0)).current;
  const {game, host, isRealtime, roomId, status, title} = route.params;
  const myUserId = auth?.employeeId ?? auth?.id;
  const liveRoom =
    roomDetail ?? realtimeRooms.find(room => room.roomId === roomId);
  const currentRoom =
    finishedRoomSnapshot ??
    (hasGameStarted ? gameRoomSnapshot ?? liveRoom : liveRoom);
  const myMember = currentRoom?.roomMembers.find(member => {
    return String(member.employeeId) === String(myUserId);
  });
  const myReady = myMember?.isReady ?? ready;
  const roomMembers = currentRoom?.roomMembers ?? [];
  const currentMemberCount =
    currentRoom?.currentMemberCount ?? Math.max(roomMembers.length, 1);
  const maxMembers = currentRoom?.maxMembers ?? 2;
  const roomStatus = currentRoom?.roomStatus;
  const roomStatusLabel = roomStatus
    ? roomStatusLabels[roomStatus]
    : status;
  const totalRoundCount = currentRoom?.totalRoundCount ?? 1;
  const emptySlotCount = Math.max(maxMembers - roomMembers.length, 0);
  const isOwner =
    currentRoom?.ownerEmployeeId !== undefined &&
    String(currentRoom.ownerEmployeeId) === String(myUserId);
  const isGameInProgress = roomStatus === 'IN_PROGRESS';
  const isRpsGame = currentRoom?.realtimeGameId === 1;
  const isPictureMatchGame = currentRoom?.realtimeGameId === 2;
  const opponentMember = roomMembers.find(member => {
    return String(member.employeeId) !== String(myUserId);
  });
  const {
    handleRpsChoice,
    hasOpponentSubmitted,
    opponentRpsChoice,
    resetRpsGame,
    rpsRoundResults,
    selectedRpsChoice,
  } = useCoinBattleRpsGame({
    chooseRps,
    isActive: hasGameStarted && isRpsGame,
    myUserId,
    myUserName: auth?.name,
    requestRpsState,
    roomId,
    subscribeRps,
  });
  const {
    handleFlipPicture,
    pictureMatchState,
    resetPictureMatchGame,
  } = useCoinBattlePictureMatchGame({
    checkPictureMatch,
    flipPictureMatch,
    isActive: hasGameStarted && isPictureMatchGame,
    myUserId,
    myUserName: auth?.name,
    requestPictureMatchState,
    roomId,
    subscribePictureMatch,
  });
  const completedRoundCount = rpsRoundResults.reduce((count, round) => {
    return typeof round.judgedAt === 'string' && round.judgedAt.length > 0
      ? count + 1
      : count;
  }, 0);
  const latestRoundNumber = rpsRoundResults.reduce((maxRound, round) => {
    return typeof round.roundNumber === 'number' &&
      round.roundNumber > maxRound
      ? round.roundNumber
      : maxRound;
  }, 0);
  const currentRoundNumber = Math.min(
    Math.max(
      latestRoundNumber > completedRoundCount
        ? latestRoundNumber
        : completedRoundCount + 1,
      1,
    ),
    totalRoundCount,
  );
  const isRpsMatchFinished =
    totalRoundCount > 0 && completedRoundCount >= totalRoundCount;
  const pictureMatchPictures =
    pictureMatchState && Array.isArray(pictureMatchState.pictures)
    ? pictureMatchState.pictures
    : [];
  const isPictureMatchFinished =
    pictureMatchPictures.length > 0 &&
    pictureMatchPictures.every(picture => picture.isMatched);
  const isMatchFinished = isRpsGame
    ? isRpsMatchFinished
    : isPictureMatchGame
      ? isPictureMatchFinished
      : false;
  const canStartCountdown =
    isRealtime &&
    Boolean(currentRoom) &&
    roomMembers.length === maxMembers &&
    roomMembers.every(member => member.isReady) &&
    !hasGameStarted &&
    !isMatchFinished &&
    currentRoom?.roomStatus !== 'IN_PROGRESS';
  const canAutoStart = canStartCountdown && isOwner;
  const shouldShowGame = hasGameStarted || isMatchFinished;
  const latestJudgedRound = rpsRoundResults
    .filter(round => {
      return (
        typeof round.judgedAt === 'string' &&
        round.judgedAt.trim().length > 0
      );
    })
    .slice()
    .sort((left, right) => {
      return (left.roundNumber ?? 0) - (right.roundNumber ?? 0);
    })
    .at(-1);
  const latestMyRoundPlayer = latestJudgedRound?.rpsPlayers?.find(player => {
    if (
      myUserId !== null &&
      myUserId !== undefined &&
      player.employeeId !== undefined &&
      String(player.employeeId) === String(myUserId)
    ) {
      return true;
    }

    return Boolean(
      auth?.name &&
        player.employeeName &&
        player.employeeName === auth.name,
    );
  });
  const latestMyRoundResult = normalizeRpsResult(
    latestMyRoundPlayer?.result,
  );
  const displayedMyChoice = selectedRpsChoice;
  const displayedOpponentChoice = opponentRpsChoice;
  const shouldShowChoiceOverlay =
    shouldShowGame &&
    isRpsGame &&
    !isMatchFinished &&
    !selectedRpsChoice &&
    !roundResultOverlay;

  useEffect(() => {
    if (__DEV__) {
      console.log('[CoinBattleRoomScreen] mounted', {roomId});
    }

    return () => {
      if (__DEV__) {
        console.log('[CoinBattleRoomScreen] unmounted', {roomId});
      }

      if (leaveTimerRef.current) {
        clearTimeout(leaveTimerRef.current);
      }

      if (roundResultTimerRef.current) {
        clearTimeout(roundResultTimerRef.current);
      }
    };
  }, [roomId]);

  useEffect(() => {
    if (connectionStatus !== 'connected') {
      return;
    }

    const unsubscribe = subscribeRoom(roomId, messageBody => {
      try {
        const parsed = JSON.parse(messageBody) as unknown;
        const nextRoom = normalizeRoomDetail(parsed);

        if (!nextRoom) {
          if (__DEV__) {
            console.log('[CoinBattleRoomScreen] Failed to parse room detail', {
              messageBody,
              roomId,
            });
          }
          return;
        }

        if (__DEV__) {
          console.log('[CoinBattleRoomScreen] Received room detail', {
            roomId: nextRoom.roomId,
            roomMembers: nextRoom.roomMembers,
            roomStatus: nextRoom.roomStatus,
          });
        }

        setRoomDetail(nextRoom);
      } catch (error) {
        if (__DEV__) {
          console.log('[CoinBattleRoomScreen] Failed to parse room detail', {
            error,
            messageBody,
            roomId,
          });
        }
      }
    });

    if (!unsubscribe) {
      return;
    }

    requestRoomState(roomId);

    return unsubscribe;
  }, [connectionStatus, requestRoomState, roomId, subscribeRoom]);

  useEffect(() => {
    if (!__DEV__) {
      return;
    }

    console.log('[CoinBattleRoomScreen] state', {
      completedRoundCount,
      hasFinishedRoomSnapshot: Boolean(finishedRoomSnapshot),
      hasGameStarted,
      hasGameRoomSnapshot: Boolean(gameRoomSnapshot),
      hasLiveRoom: Boolean(liveRoom),
      isGameInProgress,
      isMatchFinished,
      latestMyRoundResult,
      roomStatus,
      shouldShowGame,
      totalRoundCount,
    });
  }, [
    completedRoundCount,
    finishedRoomSnapshot,
    gameRoomSnapshot,
    hasGameStarted,
    isGameInProgress,
    isMatchFinished,
    latestMyRoundResult,
    liveRoom,
    roomStatus,
    shouldShowGame,
    totalRoundCount,
  ]);

  useEffect(() => {
    if (liveRoom?.roomStatus === 'IN_PROGRESS') {
      setHasGameStarted(true);
      setGameRoomSnapshot(liveRoom);
    }
  }, [liveRoom]);

  useEffect(() => {
    if (liveRoom && isMatchFinished && !finishedRoomSnapshot) {
      setFinishedRoomSnapshot(gameRoomSnapshot ?? liveRoom);
    }
  }, [finishedRoomSnapshot, gameRoomSnapshot, isMatchFinished, liveRoom]);

  useEffect(() => {
    if (!canStartCountdown) {
      setStartCountdownSeconds(null);
      return;
    }

    setStartCountdownSeconds(previous => {
      return previous ?? START_COUNTDOWN_SECONDS;
    });
  }, [canStartCountdown]);

  useEffect(() => {
    if (startCountdownSeconds === null || !canStartCountdown) {
      return;
    }

    if (startCountdownSeconds === 0) {
      if (canAutoStart && !startRequestedRef.current && currentRoom) {
        startRequestedRef.current = startRoom({
          realtimeGameId: currentRoom.realtimeGameId,
          roomId,
          userId: myUserId,
        });
      }
      return;
    }

    const timer = setTimeout(() => {
      setStartCountdownSeconds(previous => {
        return previous === null ? null : Math.max(previous - 1, 0);
      });
    }, 1000);

    return () => clearTimeout(timer);
  }, [
    canAutoStart,
    canStartCountdown,
    currentRoom,
    myUserId,
    roomId,
    startCountdownSeconds,
    startRoom,
  ]);

  useEffect(() => {
    if (startCountdownSeconds === null) {
      Animated.parallel([
        Animated.timing(countdownBackdropOpacity, {
          duration: 180,
          toValue: 0,
          useNativeDriver: true,
        }),
        Animated.timing(countdownOpacity, {
          duration: 120,
          toValue: 0,
          useNativeDriver: true,
        }),
      ]).start();
      return;
    }

    countdownScale.setValue(0.72);
    countdownOpacity.setValue(0);

    Animated.parallel([
      Animated.timing(countdownBackdropOpacity, {
        duration: 180,
        toValue: 1,
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.parallel([
          Animated.spring(countdownScale, {
            bounciness: 10,
            speed: 18,
            toValue: 1,
            useNativeDriver: true,
          }),
          Animated.timing(countdownOpacity, {
            duration: 140,
            toValue: 1,
            useNativeDriver: true,
          }),
        ]),
        Animated.timing(countdownOpacity, {
          delay: startCountdownSeconds === 0 ? 260 : 380,
          duration: 240,
          toValue: startCountdownSeconds === 0 ? 1 : 0.76,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, [
    countdownBackdropOpacity,
    countdownOpacity,
    countdownScale,
    startCountdownSeconds,
  ]);

  useEffect(() => {
    if (!latestJudgedRound || !latestMyRoundResult) {
      return;
    }

    const nextRoundNumber = latestJudgedRound.roundNumber ?? 0;

    if (
      nextRoundNumber <= 0 ||
      nextRoundNumber <= latestPresentedRoundRef.current
    ) {
      return;
    }

    latestPresentedRoundRef.current = nextRoundNumber;
    setRoundResultOverlay({
      result: latestMyRoundResult,
      roundNumber: nextRoundNumber,
    });
  }, [latestJudgedRound, latestMyRoundResult]);

  useEffect(() => {
    if (!selectedRpsChoice) {
      setPendingRpsChoice(null);
    }
  }, [currentRoundNumber, selectedRpsChoice]);

  useEffect(() => {
    if (!roundResultOverlay) {
      Animated.parallel([
        Animated.timing(resultBackdropOpacity, {
          duration: 180,
          toValue: 0,
          useNativeDriver: true,
        }),
        Animated.timing(resultOpacity, {
          duration: 160,
          toValue: 0,
          useNativeDriver: true,
        }),
      ]).start();
      return;
    }

    if (roundResultTimerRef.current) {
      clearTimeout(roundResultTimerRef.current);
    }

    resultBackdropOpacity.setValue(0);
    resultScale.setValue(0.68);
    resultOpacity.setValue(0);

    Animated.parallel([
      Animated.timing(resultBackdropOpacity, {
        duration: 180,
        toValue: 1,
        useNativeDriver: true,
      }),
      Animated.parallel([
        Animated.spring(resultScale, {
          bounciness: 12,
          speed: 16,
          toValue: 1,
          useNativeDriver: true,
        }),
        Animated.timing(resultOpacity, {
          duration: 160,
          toValue: 1,
          useNativeDriver: true,
        }),
      ]),
    ]).start();

    roundResultTimerRef.current = setTimeout(() => {
      Animated.parallel([
        Animated.timing(resultBackdropOpacity, {
          duration: 220,
          toValue: 0,
          useNativeDriver: true,
        }),
        Animated.timing(resultOpacity, {
          duration: 180,
          toValue: 0,
          useNativeDriver: true,
        }),
      ]).start(({finished}) => {
        if (finished) {
          setRoundResultOverlay(null);
        }
      });
    }, isMatchFinished ? 1800 : 1400);

    return () => {
      if (roundResultTimerRef.current) {
        clearTimeout(roundResultTimerRef.current);
      }
    };
  }, [
    isMatchFinished,
    resultBackdropOpacity,
    resultOpacity,
    resultScale,
    roundResultOverlay,
  ]);

  const handleLeaveRoom = () => {
    if (__DEV__) {
      console.log('[CoinBattleRoomScreen] handleLeaveRoom', {roomId});
    }

    if (!isRealtime) {
      navigation.goBack();
      return;
    }

    leaveRoom(roomId, myUserId);

    if (leaveTimerRef.current) {
      clearTimeout(leaveTimerRef.current);
    }

    leaveTimerRef.current = setTimeout(() => {
      navigation.replace('CoinBattleHome');
    }, 120);
  };

  const handleReady = () => {
    const nextReady = !myReady;
    setReady(nextReady);

    if (isRealtime) {
      readyRoom(roomId, myUserId, nextReady);
    }
  };

  const handleReturnToWaitingRoom = () => {
    if (isReturningToWaitingRoom) {
      return;
    }

    if (__DEV__) {
      console.log('[CoinBattleRoomScreen] returnToWaitingRoom', {roomId});
    }

    setRoundResultOverlay(null);
    setIsReturningToWaitingRoom(true);

    Animated.parallel([
      Animated.timing(roomContentOpacity, {
        duration: 180,
        toValue: 0,
        useNativeDriver: true,
      }),
      Animated.timing(roomContentTranslateY, {
        duration: 180,
        toValue: 10,
        useNativeDriver: true,
      }),
    ]).start(({finished}) => {
      if (!finished) {
        setIsReturningToWaitingRoom(false);
        return;
      }

      setHasGameStarted(false);
      setGameRoomSnapshot(undefined);
      setFinishedRoomSnapshot(undefined);
      setStartCountdownSeconds(null);
    setReady(false);
    setPendingRpsChoice(null);
    startRequestedRef.current = false;
      latestPresentedRoundRef.current = 0;
      resetRpsGame();
      resetPictureMatchGame();
      requestRoomState(roomId);
      scrollViewRef.current?.scrollTo({animated: false, y: 0});

      roomContentOpacity.setValue(0);
      roomContentTranslateY.setValue(-8);

      Animated.parallel([
        Animated.timing(roomContentOpacity, {
          duration: 220,
          toValue: 1,
          useNativeDriver: true,
        }),
        Animated.spring(roomContentTranslateY, {
          bounciness: 5,
          speed: 18,
          toValue: 0,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setIsReturningToWaitingRoom(false);
      });
    });
  };

  const handleConfirmRpsChoice = () => {
    if (!pendingRpsChoice) {
      return;
    }

    handleRpsChoice(pendingRpsChoice);
  };

  return (
    <TabSceneTransition>
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="light-content" backgroundColor="#000000" />
        <AppGnb />

        <ScrollView
          ref={scrollViewRef}
          bounces={false}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}>
          <Animated.View
            style={{
              opacity: roomContentOpacity,
              transform: [{translateY: roomContentTranslateY}],
            }}>
          {shouldShowGame ? (
            <>
              <View style={styles.liveCompactHeader}>
                <Text numberOfLines={1} style={styles.liveCompactTitle}>
                  {title}
                </Text>
                <View style={styles.liveCompactMetaRow}>
                  <Text style={styles.liveCompactMeta}>
                    {isPictureMatchGame
                      ? '같은그림 맞추기'
                      : `라운드 ${
                          isMatchFinished ? '종료' : currentRoundNumber
                        } / ${totalRoundCount}`}
                  </Text>
                  <View style={styles.liveCompactDot} />
                  <Text style={styles.liveCompactMeta}>
                    코인 {currentRoom?.betAmount ?? 1}
                  </Text>
                </View>
                <View style={styles.liveCompactPlayersRow}>
                  <Text numberOfLines={1} style={styles.liveCompactPlayer}>
                    {myMember?.employeeName ?? auth?.name ?? '나'}
                  </Text>
                  <Text style={styles.liveCompactVs}>VS</Text>
                  <Text numberOfLines={1} style={styles.liveCompactPlayer}>
                    {opponentMember?.employeeName ?? '상대'}
                  </Text>
                </View>
              </View>

              <View style={styles.gameSection}>
                {isPictureMatchGame ? (
                  <PictureMatchGamePanel
                    isFinished={isMatchFinished}
                    myUserId={myUserId}
                    myUserName={auth?.name}
                    onFlip={handleFlipPicture}
                    state={pictureMatchState}
                  />
                ) : (
                  <>
                    {!isMatchFinished ? (
                      <View style={styles.gameHeader}>
                        <View>
                          <Text style={styles.gameEyebrow}>LIVE MATCH</Text>
                          <Text style={styles.gameTitle}>가위바위보</Text>
                        </View>
                        <View style={styles.roundBadge}>
                          <Text style={styles.roundBadgeText}>
                            {`ROUND ${currentRoundNumber} / ${totalRoundCount}`}
                          </Text>
                        </View>
                      </View>
                    ) : null}

                    {!isMatchFinished &&
                    latestJudgedRound &&
                    latestMyRoundResult ? (
                      <View
                        style={[
                          styles.latestResultBanner,
                          latestMyRoundResult === 'WIN' &&
                            styles.latestResultBannerWin,
                          latestMyRoundResult === 'LOSE' &&
                            styles.latestResultBannerLose,
                          latestMyRoundResult === 'DRAW' &&
                            styles.latestResultBannerDraw,
                        ]}>
                        <Text style={styles.latestResultEyebrow}>
                          {latestJudgedRound.roundNumber ?? '-'}라운드 결과
                        </Text>
                        <Text style={styles.latestResultTitle}>
                          {latestMyRoundResult === 'WIN'
                            ? '승리'
                            : latestMyRoundResult === 'LOSE'
                              ? '패배'
                              : '무승부'}
                        </Text>
                      </View>
                    ) : null}

                    {!isMatchFinished ? (
                      <View style={styles.matchupRow}>
                        <BattleSlotCard
                          choice={displayedMyChoice}
                          label={
                            displayedMyChoice
                              ? rpsChoiceById[displayedMyChoice].label
                              : '선택 대기'
                          }
                          name={myMember?.employeeName ?? auth?.name ?? '나'}
                          role="나"
                        />

                        <Text style={styles.vsText}>VS</Text>

                        <BattleSlotCard
                          choice={displayedOpponentChoice}
                          hiddenSubmitted={
                            !displayedOpponentChoice && hasOpponentSubmitted
                          }
                          label={
                            displayedOpponentChoice
                              ? rpsChoiceById[displayedOpponentChoice].label
                              : hasOpponentSubmitted
                                ? '선택 완료'
                                : '선택 대기'
                          }
                          name={opponentMember?.employeeName ?? '상대'}
                          role="상대"
                        />
                      </View>
                    ) : null}

                    {!isMatchFinished ? (
                      <View style={styles.choiceLockCard}>
                        <Text style={styles.choiceLockTitle}>
                          {selectedRpsChoice
                            ? '카드 선택 완료'
                            : '카드 선택 대기'}
                        </Text>
                        <Text style={styles.choiceLockDescription}>
                          {selectedRpsChoice
                            ? '이번 라운드의 카드는 확정되었습니다.'
                            : '라운드 시작 시 카드 선택창이 열립니다.'}
                        </Text>
                      </View>
                    ) : null}

                    <View
                      style={[
                        styles.roundHistory,
                        isMatchFinished && styles.roundHistoryFinished,
                      ]}>
                      <Text style={styles.roundHistoryTitle}>라운드 기록</Text>
                      {rpsRoundResults.length > 0 ? (
                        rpsRoundResults
                          .slice()
                          .sort((left, right) => {
                            return (
                              (left.roundNumber ?? 0) -
                              (right.roundNumber ?? 0)
                            );
                          })
                          .map((round, index) => {
                            return (
                              <RpsRoundRow
                                key={`${round.roundNumber ?? 'round'}-${index}`}
                                myUserId={myUserId}
                                myUserName={auth?.name}
                                roomMembers={roomMembers}
                                round={round}
                              />
                            );
                          })
                      ) : (
                        <Text style={styles.roundHistoryEmpty}>
                          아직 진행된 라운드가 없습니다.
                        </Text>
                      )}
                    </View>
                  </>
                )}
              </View>
            </>
          ) : (
            <>
              <View style={styles.hero}>
                <View style={styles.statusChip}>
                  <Text style={styles.statusText}>{roomStatusLabel}</Text>
                </View>
                <Text style={styles.title}>{title}</Text>
                <Text style={styles.subtitle}>방 ID {roomId}</Text>
              </View>

              <View style={styles.infoGrid}>
                <View style={styles.infoCard}>
                  <Text style={styles.infoLabel}>게임</Text>
                  <Text style={styles.infoValue}>{game}</Text>
                </View>
                <View style={styles.infoCard}>
                  <Text style={styles.infoLabel}>베팅 코인</Text>
                  <Text style={styles.infoValue}>
                    {currentRoom?.betAmount ?? 1}개
                  </Text>
                </View>
                <View style={styles.infoCard}>
                  <Text style={styles.infoLabel}>라운드</Text>
                  <Text style={styles.infoValue}>{totalRoundCount}라운드</Text>
                </View>
                <View style={styles.infoCard}>
                  <Text style={styles.infoLabel}>인원</Text>
                  <Text style={styles.infoValue}>
                    {currentMemberCount} / {maxMembers}
                  </Text>
                </View>
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>참가자</Text>
                {roomMembers.length > 0 ? (
                  roomMembers.map(member => {
                    const memberIsOwner =
                      currentRoom?.ownerEmployeeId === member.employeeId;
                    const isMe =
                      String(member.employeeId) === String(myUserId);
                    const memberReady = isMe ? myReady : member.isReady;

                    return (
                      <View key={member.employeeId} style={styles.memberRow}>
                        <View style={styles.avatar} />
                        <View style={styles.memberText}>
                          <Text style={styles.memberName}>
                            {member.employeeName}
                          </Text>
                          <Text style={styles.memberRole}>
                            {memberIsOwner ? '방장' : '참가자'}
                          </Text>
                        </View>
                        <View
                          style={[
                            styles.readyBadge,
                            memberReady && styles.readyBadgeActive,
                          ]}>
                          <Text style={styles.readyBadgeText}>
                            {memberReady ? '준비완료' : '준비중'}
                          </Text>
                        </View>
                      </View>
                    );
                  })
                ) : (
                  <View style={styles.memberRow}>
                    <View style={styles.avatar} />
                    <View style={styles.memberText}>
                      <Text style={styles.memberName}>{host}</Text>
                      <Text style={styles.memberRole}>방장</Text>
                    </View>
                    <View
                      style={[
                        styles.readyBadge,
                        myReady && styles.readyBadgeActive,
                      ]}>
                      <Text style={styles.readyBadgeText}>
                        {myReady ? '준비완료' : '준비중'}
                      </Text>
                    </View>
                  </View>
                )}

                {Array.from({length: emptySlotCount}).map((_, index) => (
                  <View key={`empty-${index}`} style={styles.emptySlot}>
                    <Text style={styles.emptySlotText}>상대 입장 대기중</Text>
                  </View>
                ))}
              </View>

              <View style={styles.actionRow}>
                <BouncyPressable
                  accessibilityRole="button"
                  onPress={handleReady}
                  style={[
                    styles.readyButton,
                    myReady && styles.readyButtonActive,
                  ]}>
                  <Text
                    style={[
                      styles.readyButtonText,
                      myReady && styles.readyButtonTextActive,
                    ]}>
                    {myReady ? '준비 완료' : '준비하기'}
                  </Text>
                </BouncyPressable>
                <BouncyPressable
                  accessibilityRole="button"
                  onPress={handleLeaveRoom}
                  style={styles.leaveButton}>
                  <Text style={styles.leaveButtonText}>나가기</Text>
                </BouncyPressable>
              </View>
            </>
          )}
          </Animated.View>
        </ScrollView>

        {shouldShowGame && isMatchFinished && !isReturningToWaitingRoom ? (
          <View style={styles.finishDock}>
            <BouncyPressable
              accessibilityRole="button"
              onPress={handleReturnToWaitingRoom}
              style={styles.finishButton}>
              <Text style={styles.finishButtonText}>대기방으로 돌아가기</Text>
            </BouncyPressable>
          </View>
        ) : null}

        {startCountdownSeconds !== null ? (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.countdownOverlay,
              {opacity: countdownBackdropOpacity},
            ]}>
            <BlurView
              blurAmount={12}
              blurType="dark"
              style={styles.countdownBlur}
            />
            <View style={styles.countdownTint} />
            <Animated.View
              style={[
                styles.countdownCenter,
                {
                  opacity: countdownOpacity,
                  transform: [{scale: countdownScale}],
                },
              ]}>
              <Text style={styles.countdownEyebrow}>READY</Text>
              <Text style={styles.countdownValue}>
                {startCountdownSeconds === 0
                  ? 'START'
                  : startCountdownSeconds}
              </Text>
              <Text style={styles.countdownHint}>
                {startCountdownSeconds === 0
                  ? '게임 시작'
                  : '곧 시작합니다'}
              </Text>
            </Animated.View>
          </Animated.View>
        ) : null}

        {shouldShowChoiceOverlay ? (
          <View style={styles.choiceOverlay}>
            <BlurView
              blurAmount={12}
              blurType="dark"
              style={styles.choiceOverlayBlur}
            />
            <View style={styles.choiceOverlayTint} />
            <View style={styles.choiceOverlayContent}>
              <Text style={styles.choiceOverlayEyebrow}>
                ROUND {currentRoundNumber}
              </Text>
              <Text style={styles.choiceOverlayTitle}>카드를 선택하세요</Text>
              <Text style={styles.choiceOverlayHint}>
                한 번 고르면 이번 라운드에는 바꿀 수 없습니다.
              </Text>
              <View style={styles.choiceOverlayRow}>
                {rpsChoices.map(choice => (
                  <RpsChoiceHandCard
                    key={choice.id}
                    active={pendingRpsChoice === choice.id}
                    choice={choice}
                    disabled={false}
                    onPress={() => setPendingRpsChoice(choice.id)}
                  />
                ))}
              </View>
              <BouncyPressable
                accessibilityRole="button"
                disabled={!pendingRpsChoice}
                onPress={handleConfirmRpsChoice}
                style={[
                  styles.choiceConfirmButton,
                  !pendingRpsChoice && styles.choiceConfirmButtonDisabled,
                ]}>
                <Text
                  style={[
                    styles.choiceConfirmButtonText,
                    !pendingRpsChoice &&
                      styles.choiceConfirmButtonTextDisabled,
                  ]}>
                  {pendingRpsChoice
                    ? '이 카드로 확정'
                    : '카드를 먼저 선택하세요'}
                </Text>
              </BouncyPressable>
            </View>
          </View>
        ) : null}

        {roundResultOverlay ? (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.resultOverlay,
              roundResultOverlay.result === 'WIN' && styles.resultOverlayWin,
              roundResultOverlay.result === 'LOSE' && styles.resultOverlayLose,
              roundResultOverlay.result === 'DRAW' && styles.resultOverlayDraw,
              {opacity: resultBackdropOpacity},
            ]}>
            <Animated.View
              style={[
                styles.resultCenter,
                {
                  opacity: resultOpacity,
                  transform: [{scale: resultScale}],
                },
              ]}>
              <Text style={styles.resultEyebrow}>
                {isMatchFinished
                  ? 'FINAL ROUND'
                  : `ROUND ${roundResultOverlay.roundNumber}`}
              </Text>
              <Text style={styles.resultValue}>
                {roundResultOverlay.result === 'WIN'
                  ? '승리'
                  : roundResultOverlay.result === 'LOSE'
                    ? '패배'
                    : '무승부'}
              </Text>
              <Text style={styles.resultHint}>
                {roundResultOverlay.result === 'WIN'
                  ? '완벽한 한 수'
                  : roundResultOverlay.result === 'LOSE'
                    ? '다음 라운드를 노려보세요'
                    : '승부는 다음 라운드로'}
              </Text>
            </Animated.View>
          </Animated.View>
        ) : null}
      </SafeAreaView>
    </TabSceneTransition>
  );
}

function RpsRoundRow({
  myUserId,
  myUserName,
  roomMembers,
  round,
}: {
  myUserId?: null | number | string;
  myUserName?: string;
  roomMembers: Array<{
    employeeId: number;
    employeeName: string;
  }>;
  round: RpsRoundResult;
}): JSX.Element {
  const players = Array.isArray(round.rpsPlayers) ? round.rpsPlayers : [];
  const [leftMember, rightMember] = roomMembers;
  const leftChoice =
    players.find(player => player.employeeId === leftMember?.employeeId) ??
    players[0];
  const rightChoice =
    players.find(player => player.employeeId === rightMember?.employeeId) ??
    players.find(player => player !== leftChoice);

  const renderPlayerLine = (
    member:
      | {
          employeeId: number;
          employeeName: string;
        }
      | undefined,
    player:
      | {
          choice?: unknown;
          employeeId?: number;
          employeeName?: string;
          result?: unknown;
        }
      | undefined,
    fallbackName: string,
  ) => {
    const normalizedChoice =
      player?.choice === 'ROCK' ||
      player?.choice === 'PAPER' ||
      player?.choice === 'SCISSORS'
        ? player.choice
        : null;
    const choiceMeta = normalizedChoice
      ? rpsChoices.find(choice => choice.id === normalizedChoice)
      : null;
    const result = normalizeRpsResult(player?.result);
    const resultMeta = result ? rpsResultMeta[result] : null;
    const isMe =
      (member &&
        myUserId !== null &&
        myUserId !== undefined &&
        String(member.employeeId) === String(myUserId)) ||
      Boolean(
        myUserName &&
          (member?.employeeName === myUserName ||
            player?.employeeName === myUserName),
      );

    return (
      <View
        style={[
          styles.roundPlayerLine,
          isMe && styles.roundPlayerLineMine,
        ]}>
        <Text
          style={[
            styles.roundPlayerName,
            isMe && styles.roundPlayerNameMine,
          ]}>
          {resultMeta ? `${resultMeta.icon} ${resultMeta.label} · ` : ''}
          {member?.employeeName ?? player?.employeeName ?? fallbackName}
          {isMe ? ' (나)' : ''}
        </Text>
        <Text style={styles.roundPlayerChoice}>
          {choiceMeta ? choiceMeta.label : '대기'}
        </Text>
      </View>
    );
  };
  const myRoundPlayer =
    players.find(player => {
      if (
        myUserId !== null &&
        myUserId !== undefined &&
        player.employeeId !== undefined &&
        String(player.employeeId) === String(myUserId)
      ) {
        return true;
      }

      return Boolean(
        myUserName &&
          player.employeeName &&
          player.employeeName === myUserName,
      );
    }) ?? null;
  const myRoundResult = normalizeRpsResult(myRoundPlayer?.result);

  return (
    <View style={styles.roundHistoryItem}>
      <View style={styles.roundHistoryHeader}>
        <Text style={styles.roundHistoryItemTitle}>
          라운드 {round.roundNumber ?? '-'}
        </Text>
        {myRoundResult ? (
          <View
            style={[
              styles.roundResultChip,
              myRoundResult === 'WIN' && styles.roundResultChipWin,
              myRoundResult === 'LOSE' && styles.roundResultChipLose,
              myRoundResult === 'DRAW' && styles.roundResultChipDraw,
            ]}>
            <Text style={styles.roundResultChipText}>
              내 결과{' '}
              {myRoundResult === 'WIN'
                ? '승'
                : myRoundResult === 'LOSE'
                  ? '패'
                  : '무'}
            </Text>
          </View>
        ) : null}
      </View>
      {renderPlayerLine(leftMember, leftChoice, '플레이어1')}
      {renderPlayerLine(rightMember, rightChoice, '플레이어2')}
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#000000',
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 132,
  },
  hero: {
    borderRadius: 18,
    padding: 18,
    backgroundColor: '#121212',
    borderWidth: 1,
    borderColor: '#272727',
  },
  statusChip: {
    alignSelf: 'flex-start',
    borderRadius: 4,
    backgroundColor: '#F40D21',
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginBottom: 12,
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
    lineHeight: 30,
  },
  subtitle: {
    marginTop: 10,
    color: '#898989',
    fontSize: 12,
    fontWeight: '600',
  },
  countdownOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countdownBlur: {
    ...StyleSheet.absoluteFillObject,
  },
  countdownTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.58)',
  },
  countdownCenter: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  countdownEyebrow: {
    color: '#FF9AA3',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 2,
  },
  countdownValue: {
    marginTop: 4,
    color: '#FFFFFF',
    fontSize: 68,
    fontWeight: '900',
    lineHeight: 76,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: {width: 0, height: 3},
    textShadowRadius: 12,
  },
  countdownHint: {
    marginTop: -2,
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  resultOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultOverlayWin: {
    backgroundColor: 'rgba(6, 22, 13, 0.86)',
  },
  resultOverlayLose: {
    backgroundColor: 'rgba(28, 5, 8, 0.88)',
  },
  resultOverlayDraw: {
    backgroundColor: 'rgba(28, 23, 7, 0.86)',
  },
  resultCenter: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultEyebrow: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 2,
    opacity: 0.78,
  },
  resultValue: {
    marginTop: 8,
    color: '#FFFFFF',
    fontSize: 44,
    fontWeight: '900',
    lineHeight: 52,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: {width: 0, height: 3},
    textShadowRadius: 12,
  },
  resultHint: {
    marginTop: 6,
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    opacity: 0.9,
  },
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 16,
  },
  infoCard: {
    width: '48.5%',
    borderRadius: 12,
    padding: 14,
    backgroundColor: '#101010',
    borderWidth: 1,
    borderColor: '#242424',
  },
  infoLabel: {
    color: '#8B8E96',
    fontSize: 12,
    fontWeight: '700',
  },
  infoValue: {
    marginTop: 8,
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    lineHeight: 20,
  },
  liveCompactHeader: {
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#121212',
    borderWidth: 1,
    borderColor: '#272727',
  },
  liveCompactTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '900',
    lineHeight: 23,
  },
  liveCompactMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  liveCompactMeta: {
    color: '#A5A7AD',
    fontSize: 12,
    fontWeight: '800',
  },
  liveCompactDot: {
    width: 3,
    height: 3,
    borderRadius: 999,
    marginHorizontal: 8,
    backgroundColor: '#5A5D66',
  },
  liveCompactPlayersRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  liveCompactPlayer: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'center',
  },
  liveCompactVs: {
    color: '#F40D21',
    fontSize: 12,
    fontWeight: '900',
    paddingHorizontal: 10,
  },
  section: {
    marginTop: 24,
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 12,
  },
  memberRow: {
    minHeight: 72,
    borderRadius: 14,
    backgroundColor: '#111111',
    borderWidth: 1,
    borderColor: '#242424',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    marginRight: 12,
  },
  memberText: {
    flex: 1,
  },
  memberName: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 19,
  },
  memberRole: {
    marginTop: 3,
    color: '#8B8E96',
    fontSize: 12,
    fontWeight: '600',
  },
  readyBadge: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  readyBadgeActive: {
    backgroundColor: '#F40D21',
    borderColor: '#F40D21',
  },
  readyBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  emptySlot: {
    height: 58,
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#343434',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  emptySlotText: {
    color: '#777777',
    fontSize: 13,
    fontWeight: '700',
  },
  gameSection: {
    marginTop: 24,
    borderRadius: 18,
    padding: 18,
    backgroundColor: '#101010',
    borderWidth: 1,
    borderColor: '#272727',
  },
  gameHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  gameEyebrow: {
    color: '#F40D21',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  gameTitle: {
    marginTop: 6,
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
  },
  roundBadge: {
    borderRadius: 999,
    backgroundColor: 'rgba(244,13,33,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(244,13,33,0.45)',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  roundBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  matchupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 22,
  },
  latestResultBanner: {
    marginTop: 18,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
  },
  latestResultBannerWin: {
    backgroundColor: 'rgba(62, 183, 105, 0.14)',
    borderColor: 'rgba(62, 183, 105, 0.55)',
  },
  latestResultBannerLose: {
    backgroundColor: 'rgba(244, 13, 33, 0.14)',
    borderColor: 'rgba(244, 13, 33, 0.55)',
  },
  latestResultBannerDraw: {
    backgroundColor: 'rgba(247, 206, 69, 0.14)',
    borderColor: 'rgba(247, 206, 69, 0.55)',
  },
  latestResultEyebrow: {
    color: '#C7C8CC',
    fontSize: 12,
    fontWeight: '700',
  },
  latestResultTitle: {
    marginTop: 4,
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '900',
  },
  playerCard: {
    flex: 1,
    minHeight: 178,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: '#161616',
    borderWidth: 1,
    borderColor: '#292929',
    padding: 12,
  },
  playerCardLocked: {
    borderColor: '#F40D21',
    backgroundColor: '#201012',
  },
  playerCardPulse: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(244, 13, 33, 0.18)',
  },
  playerRole: {
    color: '#FF8A94',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  playerCardName: {
    marginTop: 5,
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  playerChoiceFrame: {
    marginTop: 12,
    width: 72,
    height: 88,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#211113',
    borderWidth: 1,
    borderColor: '#F40D21',
  },
  playerChoiceImage: {
    width: 48,
    height: 48,
  },
  playerChoicePlaceholder: {
    marginTop: 12,
    color: '#FFFFFF',
    fontSize: 38,
    fontWeight: '900',
  },
  hiddenChoiceCard: {
    marginTop: 12,
    width: 72,
    height: 88,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#261114',
    borderWidth: 1,
    borderColor: '#F40D21',
  },
  hiddenChoiceGlyph: {
    color: '#F40D21',
    fontSize: 30,
    fontWeight: '900',
  },
  playerChoiceLabel: {
    marginTop: 8,
    color: '#C7C8CC',
    fontSize: 12,
    fontWeight: '700',
  },
  playerChoiceLabelReady: {
    color: '#F40D21',
    fontWeight: '900',
  },
  vsText: {
    color: '#F40D21',
    fontSize: 15,
    fontWeight: '900',
  },
  choiceLockCard: {
    marginTop: 22,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#3A1A1E',
    backgroundColor: '#161616',
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  choiceLockTitle: {
    color: '#F40D21',
    fontSize: 14,
    fontWeight: '900',
  },
  choiceLockDescription: {
    marginTop: 4,
    color: '#C7C8CC',
    fontSize: 12,
    fontWeight: '700',
  },
  choiceRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-end',
    marginTop: 18,
    paddingTop: 12,
  },
  choiceCardWrap: {
    flex: 1,
  },
  choiceGlow: {
    position: 'absolute',
    left: 8,
    right: 8,
    bottom: -4,
    height: 18,
    borderRadius: 999,
    backgroundColor: 'rgba(244, 13, 33, 0.62)',
  },
  choiceButton: {
    minHeight: 126,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#161616',
    borderWidth: 1,
    borderColor: '#292929',
  },
  choiceButtonActive: {
    backgroundColor: '#201012',
    borderColor: '#F40D21',
  },
  choiceButtonDisabled: {
    opacity: 0.45,
  },
  choiceArtFrame: {
    width: 58,
    height: 68,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1E1113',
    borderWidth: 1,
    borderColor: '#3A1A1E',
  },
  choiceImage: {
    width: 38,
    height: 38,
  },
  choiceLabel: {
    marginTop: 10,
    color: '#C7C8CC',
    fontSize: 12,
    fontWeight: '800',
  },
  choiceLabelActive: {
    color: '#F40D21',
  },
  choiceOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
  },
  choiceOverlayBlur: {
    ...StyleSheet.absoluteFillObject,
  },
  choiceOverlayTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  choiceOverlayContent: {
    paddingHorizontal: 20,
  },
  choiceOverlayEyebrow: {
    color: '#F40D21',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1.5,
    textAlign: 'center',
  },
  choiceOverlayTitle: {
    marginTop: 10,
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '900',
    textAlign: 'center',
  },
  choiceOverlayHint: {
    marginTop: 8,
    color: '#D4D4D4',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  choiceOverlayRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-end',
    marginTop: 28,
    paddingTop: 12,
  },
  choiceConfirmButton: {
    marginTop: 22,
    height: 54,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F40D21',
  },
  choiceConfirmButtonDisabled: {
    backgroundColor: '#323232',
  },
  choiceConfirmButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
  },
  choiceConfirmButtonTextDisabled: {
    color: '#A5A7AD',
  },
  roundHistory: {
    marginTop: 18,
    borderRadius: 14,
    backgroundColor: '#161616',
    borderWidth: 1,
    borderColor: '#292929',
    padding: 14,
  },
  roundHistoryFinished: {
    marginTop: 0,
  },
  roundHistoryTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  roundHistoryEmpty: {
    marginTop: 8,
    color: '#8B8E96',
    fontSize: 13,
    fontWeight: '600',
  },
  roundHistoryItem: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#292929',
    paddingTop: 12,
  },
  roundHistoryItemTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  roundHistoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 8,
  },
  roundResultChip: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  roundResultChipWin: {
    backgroundColor: 'rgba(62, 183, 105, 0.14)',
    borderColor: 'rgba(62, 183, 105, 0.55)',
  },
  roundResultChipLose: {
    backgroundColor: 'rgba(244, 13, 33, 0.14)',
    borderColor: 'rgba(244, 13, 33, 0.55)',
  },
  roundResultChipDraw: {
    backgroundColor: 'rgba(247, 206, 69, 0.14)',
    borderColor: 'rgba(247, 206, 69, 0.55)',
  },
  roundResultChipText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  roundPlayerLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    marginTop: 6,
  },
  roundPlayerLineMine: {
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  roundPlayerName: {
    flex: 1,
    color: '#C7C8CC',
    fontSize: 12,
    fontWeight: '700',
  },
  roundPlayerNameMine: {
    color: '#FFFFFF',
  },
  roundPlayerChoice: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  placeholderGameCard: {
    marginTop: 18,
    minHeight: 96,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#161616',
    borderWidth: 1,
    borderColor: '#292929',
  },
  placeholderGameText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  pictureMatchPanel: {},
  pictureMatchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pictureMatchTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
  },
  pictureMatchTurnPill: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#343434',
    backgroundColor: '#171717',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  pictureMatchTurnPillActive: {
    borderColor: 'rgba(244, 13, 33, 0.48)',
    backgroundColor: 'rgba(244, 13, 33, 0.16)',
  },
  pictureMatchTurnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
  },
  pictureMatchScoreRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },
  pictureMatchScoreCard: {
    flex: 1,
    minHeight: 72,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#161616',
    borderWidth: 1,
    borderColor: '#292929',
  },
  pictureMatchMetaCard: {
    flex: 1,
    minHeight: 72,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(244, 13, 33, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(244, 13, 33, 0.4)',
  },
  pictureMatchScoreLabel: {
    color: '#8B8E96',
    fontSize: 11,
    fontWeight: '700',
  },
  pictureMatchScoreValue: {
    marginTop: 5,
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
  },
  pictureMatchMetaLabel: {
    color: '#FF8A94',
    fontSize: 11,
    fontWeight: '800',
  },
  pictureMatchMetaValue: {
    marginTop: 5,
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
  },
  pictureMatchBoard: {
    gap: 8,
    marginTop: 18,
  },
  pictureMatchRow: {
    flexDirection: 'row',
    gap: 8,
  },
  pictureMatchCardShell: {
    flex: 1,
    aspectRatio: 0.78,
  },
  pictureMatchCard: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 12,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  pictureMatchCardFace: {
    backfaceVisibility: 'hidden',
  },
  pictureMatchCardBackFace: {
    backgroundColor: '#1A1A1A',
    borderColor: '#303030',
  },
  pictureMatchCardFaceUp: {
    borderColor: '#F40D21',
    backgroundColor: '#211113',
  },
  pictureMatchCardMatched: {
    borderColor: 'rgba(244, 13, 33, 0.7)',
  },
  pictureMatchImage: {
    width: '100%',
    height: '100%',
  },
  pictureMatchBackText: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '900',
  },
  pictureMatchFallbackName: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    textAlign: 'center',
    paddingHorizontal: 6,
  },
  pictureMatchMineBadge: {
    position: 'absolute',
    zIndex: 1,
    top: 6,
    right: 6,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F40D21',
  },
  pictureMatchMineBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
  },
  finishDock: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 20,
    borderRadius: 14,
  },
  finishButton: {
    height: 54,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  finishButtonText: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '900',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 26,
  },
  readyButton: {
    flex: 1,
    height: 48,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  readyButtonActive: {
    backgroundColor: '#F40D21',
  },
  readyButtonText: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '800',
  },
  readyButtonTextActive: {
    color: '#FFFFFF',
  },
  leaveButton: {
    width: 92,
    height: 48,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#383838',
    alignItems: 'center',
    justifyContent: 'center',
  },
  leaveButtonText: {
    color: '#D7D7D7',
    fontSize: 14,
    fontWeight: '800',
  },
});
