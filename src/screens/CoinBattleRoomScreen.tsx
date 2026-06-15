import React, {useEffect, useRef, useState} from 'react';
import {useNavigation, useRoute} from '@react-navigation/native';
import type {NativeStackNavigationProp, NativeStackScreenProps} from '@react-navigation/native-stack';
import {
  Alert,
  Animated,
  BackHandler,
  Image,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {BlurView} from '@react-native-community/blur';
import {useAuth} from '../auth/AuthProvider';
import {image} from '../assets/images';
import {icon} from '../assets/icons';
import {useCoin} from '../coin/CoinProvider';
import {AnimatedPressable} from '../components/AnimatedPressable';
import {AppGnb} from '../components/AppGnb';
import {TabSceneTransition} from '../components/TabSceneTransition';
import {normalizeCoinBattleRoom, useCoinBattleRooms, type CoinBattleRoom} from '../hooks/useCoinBattleRooms';
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
import {
  useCoinBattleTypingGame,
  type TypingFinalResult,
  type TypingGameState,
  type TypingPlayer,
  type TypingRound,
} from '../hooks/useCoinBattleTypingGame';
import type {CoinBattleStackParamList} from '../navigation/types';
import {FONTS} from '../constants/theme';

type RouteProps = NativeStackScreenProps<CoinBattleStackParamList, 'CoinBattleRoom'>['route'];

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
const rpsChoiceById = Object.fromEntries(rpsChoices.map(choice => [choice.id, choice])) as Record<
  RpsChoice,
  (typeof rpsChoices)[number]
>;
const rpsResultMeta = {
  DRAW: {label: '무'},
  LOSE: {label: '패'},
  WIN: {label: '승'},
} as const;
const maxRoundCountByGameId: Record<number, number> = {
  1: 3,
  2: 1,
  21: 3,
};
const START_COUNTDOWN_SECONDS = 3;
const PICTURE_MATCH_LOCAL_REVEAL_MS = 2000;
const PICTURE_MATCH_REVEAL_STAGGER_MS = 90;

type RoundResultOverlay = {
  result: RpsResult;
  roundNumber: number;
  source?: 'picture' | 'rps' | 'typing';
  winnerName?: string;
};

type TypingRankingItem = {
  elapsedSeconds?: number;
  employeeId?: number;
  employeeName?: string;
  submittedAt?: string;
  winCount: number;
};

function formatRoomMemberRecord(member: CoinBattleRoom['roomMembers'][number]): string | null {
  const record = member.record;

  if (!record) {
    return null;
  }

  return `${record.winCount ?? 0}승 ${record.drawCount ?? 0}무 ${record.loseCount ?? 0}패`;
}

function resetRoomForWaiting(room: CoinBattleRoom | undefined): CoinBattleRoom | undefined {
  if (!room) {
    return undefined;
  }

  return {
    ...room,
    roomMembers: room.roomMembers.map(member => {
      return {
        ...member,
        isReady: false,
      };
    }),
    roomStatus: 'WAITING',
  };
}

function getMaxRoundCount(realtimeGameId?: number): number {
  if (typeof realtimeGameId !== 'number') {
    return 1;
  }

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

function getProfileImageUriFromRecord(profile?: Record<string, unknown>): string | null {
  if (typeof profile?.profileImageUri === 'string' && profile.profileImageUri.trim().length > 0) {
    return profile.profileImageUri.trim();
  }

  if (typeof profile?.profileImageUrl === 'string' && profile.profileImageUrl.trim().length > 0) {
    return profile.profileImageUrl.trim();
  }

  return null;
}

function getMemberProfileImageUri(
  member: CoinBattleRoom['roomMembers'][number],
  fallbackProfile?: Record<string, unknown>,
): string | null {
  if (typeof member.profileImageUri === 'string' && member.profileImageUri.trim().length > 0) {
    return member.profileImageUri.trim();
  }

  if (typeof member.profileImageUrl === 'string' && member.profileImageUrl.trim().length > 0) {
    return member.profileImageUrl.trim();
  }

  return getProfileImageUriFromRecord(fallbackProfile);
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
        <Animated.View pointerEvents="none" style={[styles.playerCardPulse, {opacity: pulseOpacity}]} />
      ) : null}
      <Text style={styles.playerRole}>{role}</Text>
      <Text style={styles.playerCardName}>{name}</Text>
      {choice ? (
        <View style={styles.playerChoiceFrame}>
          <Image resizeMode="contain" source={rpsChoiceById[choice].image} style={styles.playerChoiceImage} />
        </View>
      ) : hiddenSubmitted ? (
        <View style={styles.hiddenChoiceCard}>
          <Text style={styles.hiddenChoiceGlyph}>✦</Text>
        </View>
      ) : (
        <Text style={styles.playerChoicePlaceholder}>?</Text>
      )}
      <Text style={[styles.playerChoiceLabel, hiddenSubmitted && !choice && styles.playerChoiceLabelReady]}>
        {label}
      </Text>
    </Animated.View>
  );
}

function GamePanelHeader({badgeLabel, title}: {badgeLabel: string; title: string}): JSX.Element {
  return (
    <View style={styles.gameHeader}>
      <View>
        <Text style={styles.gameEyebrow}>실시간 대전</Text>
        <Text style={styles.gameTitle}>{title}</Text>
      </View>
      <View style={styles.roundBadge}>
        <Text style={styles.roundBadgeText}>{badgeLabel}</Text>
      </View>
    </View>
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
    <Animated.View style={[styles.choiceCardWrap, {transform: [{translateY}, {scale}]}]}>
      <Animated.View pointerEvents="none" style={[styles.choiceGlow, {opacity: glowOpacity}]} />
      <AnimatedPressable
        accessibilityRole="button"
        disabled={disabled}
        onPress={onPress}
        style={[styles.choiceButton, active && styles.choiceButtonActive, disabled && styles.choiceButtonDisabled]}>
        <View style={styles.choiceArtFrame}>
          <Image resizeMode="contain" source={choice.image} style={styles.choiceImage} />
        </View>
        <Text style={[styles.choiceLabel, active && styles.choiceLabelActive]}>{choice.label}</Text>
      </AnimatedPressable>
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

  return Boolean(myUserName && player.employeeName && player.employeeName === myUserName);
}

function getPictureMatchBoardKey(pictures: PictureMatchState['pictures']): string {
  if (!Array.isArray(pictures) || pictures.length === 0) {
    return '';
  }

  return pictures
    .map((picture, index) => {
      return picture.imgUrl ?? picture.employeeName ?? String(index);
    })
    .join('|');
}

function getPictureMatchResultForMe({
  finalResults,
  myUserId,
  myUserName,
  pictures,
}: {
  finalResults: PictureMatchPlayer[];
  myUserId?: null | number | string;
  myUserName?: string;
  pictures: PictureMatchState['pictures'];
}): RpsResult | null {
  const myFinalResult = finalResults.find(player => {
    return isSamePictureMatchPlayer(player, myUserId, myUserName);
  });
  const normalizedFinalResult = normalizeRpsResult(myFinalResult?.result);

  if (normalizedFinalResult) {
    return normalizedFinalResult;
  }

  if (!Array.isArray(pictures) || pictures.length === 0 || pictures.some(picture => !picture.isMatched)) {
    return null;
  }

  const myMatchedCount = pictures.reduce((count, picture) => {
    if (
      myUserId === null ||
      myUserId === undefined ||
      picture.matchedEmployeeId === undefined ||
      String(picture.matchedEmployeeId) !== String(myUserId)
    ) {
      return count;
    }

    return count + 1;
  }, 0);
  const opponentMatchedCount = pictures.length - myMatchedCount;

  if (myMatchedCount > opponentMatchedCount) {
    return 'WIN';
  }

  if (myMatchedCount < opponentMatchedCount) {
    return 'LOSE';
  }

  return 'DRAW';
}

function FlippablePictureCard({
  disabled,
  isFaceUp,
  isMatched,
  isMine,
  onPress,
  picture,
  revealDelayMs = 0,
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
  revealDelayMs?: number;
}): JSX.Element {
  const flipProgress = useRef(new Animated.Value(isFaceUp ? 1 : 0)).current;

  useEffect(() => {
    const startFlip = () => {
      Animated.spring(flipProgress, {
        bounciness: 0,
        speed: 18,
        toValue: isFaceUp ? 1 : 0,
        useNativeDriver: true,
      }).start();
    };

    if (isFaceUp && revealDelayMs > 0) {
      const timer = setTimeout(startFlip, revealDelayMs);
      return () => clearTimeout(timer);
    }

    startFlip();
  }, [flipProgress, isFaceUp, revealDelayMs]);

  const frontRotateY = flipProgress.interpolate({
    inputRange: [0, 1],
    outputRange: ['180deg', '360deg'],
  });
  const backRotateY = flipProgress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  return (
    <AnimatedPressable disabled={disabled} onPress={onPress} style={styles.pictureMatchCardShell}>
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
            <Image source={icon.check} style={styles.pictureMatchMineBadgeIcon} />
          </View>
        ) : null}
        {picture.imgUrl ? (
          <Image resizeMode="cover" source={{uri: picture.imgUrl}} style={styles.pictureMatchImage} />
        ) : (
          <Text style={styles.pictureMatchFallbackName}>{picture.employeeName ?? '카드'}</Text>
        )}
      </Animated.View>
    </AnimatedPressable>
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
  const players =
    state && Array.isArray(state.players) ? state.players : state && Array.isArray(state.player) ? state.player : [];
  const pictures = state && Array.isArray(state.pictures) ? state.pictures : [];
  const matchPictureCount =
    typeof state?.matchPictureCount === 'number' && state.matchPictureCount > 0 ? state.matchPictureCount : 2;
  const boardKey = getPictureMatchBoardKey(pictures);
  const pictureImageUrlsKey = pictures
    .map(picture => picture.imgUrl)
    .filter((imgUrl): imgUrl is string => typeof imgUrl === 'string' && imgUrl.trim().length > 0)
    .join('\n');
  const [preparingRevealBoardKey, setPreparingRevealBoardKey] = useState<string | null>(null);
  const [localRevealBoardKey, setLocalRevealBoardKey] = useState<string | null>(null);
  const [handledRevealBoardKey, setHandledRevealBoardKey] = useState<string | null>(null);
  const currentTurnPlayer = players.find(player => player.isMyTurn);
  const isMyTurn = currentTurnPlayer ? isSamePictureMatchPlayer(currentTurnPlayer, myUserId, myUserName) : false;
  const myMatchedCardCount = pictures.reduce((count, picture) => {
    if (!picture.isMatched || picture.matchedEmployeeId === undefined) {
      return count;
    }

    return myUserId !== null && myUserId !== undefined && String(picture.matchedEmployeeId) === String(myUserId)
      ? count + 1
      : count;
  }, 0);
  const opponentMatchedCardCount = pictures.reduce((count, picture) => {
    if (!picture.isMatched || picture.matchedEmployeeId === undefined) {
      return count;
    }

    return myUserId !== null && myUserId !== undefined && String(picture.matchedEmployeeId) !== String(myUserId)
      ? count + 1
      : count;
  }, 0);
  const myMatchedSetCount = Math.floor(myMatchedCardCount / matchPictureCount);
  const opponentMatchedSetCount = Math.floor(opponentMatchedCardCount / matchPictureCount);
  const totalMatchedSetCount = Math.floor((myMatchedCardCount + opponentMatchedCardCount) / matchPictureCount);
  const totalSetCount = Math.floor(pictures.length / matchPictureCount);
  const remainingSetCount = Math.max(totalSetCount - totalMatchedSetCount, 0);
  const serverInitialReveal =
    pictures.length > 0 &&
    pictures.every(picture => picture.isFlipped) &&
    pictures.every(picture => !picture.isMatched);
  const shouldIgnoreServerInitialReveal = handledRevealBoardKey === boardKey && serverInitialReveal;
  const allVisibleAtStart = serverInitialReveal && !shouldIgnoreServerInitialReveal;
  const isInitialUnmatchedBoard = pictures.length > 0 && pictures.every(picture => !picture.isMatched);
  const isLocalRevealActive = localRevealBoardKey === boardKey;
  const shouldRunLocalReveal = Boolean(
    boardKey && isInitialUnmatchedBoard && !isFinished && handledRevealBoardKey !== boardKey,
  );
  const shouldConcealForLocalReveal = shouldRunLocalReveal && !isLocalRevealActive;
  const isPreparingLocalReveal = shouldConcealForLocalReveal || preparingRevealBoardKey === boardKey;
  const rows = Array.from({length: width > 0 ? Math.ceil(pictures.length / width) : 0}, (_, rowIndex) => {
    const start = rowIndex * width;
    return pictures.slice(start, start + width);
  });
  const turnLabel = isFinished
    ? '게임 종료'
    : isPreparingLocalReveal
    ? '준비중'
    : allVisibleAtStart || isLocalRevealActive
    ? '기억하세요'
    : isMyTurn
    ? '내 턴'
    : '상대 턴';

  useEffect(() => {
    if (!boardKey || !isInitialUnmatchedBoard || isFinished || handledRevealBoardKey === boardKey) {
      setPreparingRevealBoardKey(null);
      setLocalRevealBoardKey(null);
      return;
    }

    let cancelled = false;
    let revealTimer: ReturnType<typeof setTimeout> | null = null;
    setPreparingRevealBoardKey(boardKey);
    setLocalRevealBoardKey(null);

    const imageUrls = pictureImageUrlsKey.length > 0 ? pictureImageUrlsKey.split('\n') : [];

    Promise.allSettled(imageUrls.map(imgUrl => Image.prefetch(imgUrl))).then(() => {
      if (cancelled) {
        return;
      }

      setPreparingRevealBoardKey(null);
      setLocalRevealBoardKey(boardKey);
      revealTimer = setTimeout(() => {
        if (!cancelled) {
          setLocalRevealBoardKey(null);
          setHandledRevealBoardKey(boardKey);
        }
      }, PICTURE_MATCH_LOCAL_REVEAL_MS);
    });

    return () => {
      cancelled = true;

      if (revealTimer) {
        clearTimeout(revealTimer);
      }
    };
  }, [boardKey, handledRevealBoardKey, isFinished, isInitialUnmatchedBoard, pictureImageUrlsKey]);

  return (
    <View style={styles.pictureMatchPanel}>
      <GamePanelHeader badgeLabel={isFinished ? 'FINISH' : turnLabel} title="같은그림 맞추기" />

      <View style={styles.pictureMatchScoreRow}>
        <View style={styles.pictureMatchScoreCard}>
          <Text style={styles.pictureMatchScoreLabel}>내 점수</Text>
          <Text style={styles.pictureMatchScoreValue}>{myMatchedSetCount}</Text>
        </View>
        <View style={styles.pictureMatchMetaCard}>
          <Text style={styles.pictureMatchMetaLabel}>남은 매치</Text>
          <Text style={styles.pictureMatchMetaValue}>{remainingSetCount}</Text>
        </View>
        <View style={styles.pictureMatchScoreCard}>
          <Text style={styles.pictureMatchScoreLabel}>상대 점수</Text>
          <Text style={styles.pictureMatchScoreValue}>{opponentMatchedSetCount}</Text>
        </View>
      </View>

      <View style={styles.pictureMatchBoard}>
        {rows.map((row, rowIndex) => (
          <View key={`row-${rowIndex}`} style={styles.pictureMatchRow}>
            {row.map((picture, columnIndex) => {
              const pictureIndex = rowIndex * width + columnIndex;
              const isFaceUp =
                shouldConcealForLocalReveal || shouldIgnoreServerInitialReveal
                  ? Boolean(picture.isMatched)
                  : Boolean(picture.isFlipped || picture.isMatched);
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
                    shouldConcealForLocalReveal ||
                    isLocalRevealActive ||
                    !isMyTurn ||
                    Boolean(picture.isMatched) ||
                    (Boolean(picture.isFlipped) && !shouldIgnoreServerInitialReveal)
                  }
                  isFaceUp={isFaceUp || isLocalRevealActive}
                  isMatched={Boolean(picture.isMatched)}
                  isMine={Boolean(isMine)}
                  onPress={() => onFlip(pictureIndex)}
                  picture={picture}
                  revealDelayMs={isLocalRevealActive ? pictureIndex * PICTURE_MATCH_REVEAL_STAGGER_MS : 0}
                />
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
}

function isSameTypingPlayer(
  player: TypingPlayer | TypingFinalResult,
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

  return Boolean(myUserName && player.employeeName && player.employeeName === myUserName);
}

function getCorrectPrefixLength(answerSentence: string, inputValue: string): number {
  let correctLength = 0;

  while (
    correctLength < inputValue.length &&
    correctLength < answerSentence.length &&
    inputValue[correctLength] === answerSentence[correctLength]
  ) {
    correctLength += 1;
  }

  return correctLength;
}

function formatTypingElapsed(seconds?: number): string {
  if (typeof seconds !== 'number' || Number.isNaN(seconds)) {
    return '-';
  }

  return `${seconds.toFixed(seconds % 1 === 0 ? 0 : 1)}초`;
}

function isTypingPlayerCompleted(player: TypingPlayer): boolean {
  return (
    (typeof player.submittedAt === 'string' && player.submittedAt.trim().length > 0) ||
    typeof player.elapsedSeconds === 'number' ||
    typeof player.result === 'string'
  );
}

function getTypingRoundWinner(players: TypingPlayer[]): TypingPlayer | undefined {
  const resultWinner = players.find(player => normalizeRpsResult(player.result) === 'WIN');

  if (resultWinner) {
    return resultWinner;
  }

  return players
    .filter(isTypingPlayerCompleted)
    .slice()
    .sort((left, right) => {
      const leftElapsed = typeof left.elapsedSeconds === 'number' ? left.elapsedSeconds : Number.POSITIVE_INFINITY;
      const rightElapsed = typeof right.elapsedSeconds === 'number' ? right.elapsedSeconds : Number.POSITIVE_INFINITY;

      if (leftElapsed !== rightElapsed) {
        return leftElapsed - rightElapsed;
      }

      return String(left.submittedAt).localeCompare(String(right.submittedAt));
    })[0];
}

function getTypingRoundResultForMe(
  round: TypingRound | undefined,
  myUserId?: null | number | string,
  myUserName?: string,
): RpsResult | null {
  const players = round?.typingPlayers ?? [];
  const myPlayer = players.find(player => isSameTypingPlayer(player, myUserId, myUserName));
  const serverResult = normalizeRpsResult(myPlayer?.result);

  if (serverResult) {
    return serverResult;
  }

  const winner = getTypingRoundWinner(players);

  if (winner) {
    return isSameTypingPlayer(winner, myUserId, myUserName) ? 'WIN' : 'LOSE';
  }

  const completedPlayers = players.filter(isTypingPlayerCompleted);

  if (players.length > 1 && completedPlayers.length === players.length) {
    return 'DRAW';
  }

  return null;
}

function isTypingRoundCompleted(round?: {judgedAt?: string; typingPlayers?: TypingPlayer[]}): boolean {
  if (!round) {
    return false;
  }

  if (typeof round.judgedAt === 'string' && round.judgedAt.trim().length > 0) {
    return true;
  }

  return Boolean(getTypingRoundWinner(round.typingPlayers ?? []) || round.typingPlayers?.some(isTypingPlayerCompleted));
}

function getTypingPlayerKey(player: TypingPlayer | TypingFinalResult): string {
  if (player.employeeId !== undefined) {
    return `id:${player.employeeId}`;
  }

  return `name:${player.employeeName ?? 'unknown'}`;
}

function buildTypingRanking(rounds: TypingRound[], finalResults: TypingFinalResult[]): TypingRankingItem[] {
  if (finalResults.length > 0) {
    return finalResults.map(result => ({
      elapsedSeconds: result.elapsedSeconds,
      employeeId: result.employeeId,
      employeeName: result.employeeName,
      submittedAt: result.submittedAt,
      winCount: 0,
    }));
  }

  const rankingMap = new Map<string, TypingRankingItem>();

  rounds.forEach(round => {
    const players = round.typingPlayers ?? [];
    const winner = getTypingRoundWinner(players);

    players.forEach(player => {
      const key = getTypingPlayerKey(player);
      const previous = rankingMap.get(key);
      const elapsedSeconds =
        typeof player.elapsedSeconds === 'number'
          ? (previous?.elapsedSeconds ?? 0) + player.elapsedSeconds
          : previous?.elapsedSeconds;

      rankingMap.set(key, {
        elapsedSeconds,
        employeeId: player.employeeId,
        employeeName: player.employeeName,
        submittedAt: player.submittedAt ?? previous?.submittedAt,
        winCount: (previous?.winCount ?? 0) + (winner && getTypingPlayerKey(winner) === key ? 1 : 0),
      });
    });
  });

  return Array.from(rankingMap.values()).sort((left, right) => {
    if (right.winCount !== left.winCount) {
      return right.winCount - left.winCount;
    }

    const leftElapsed = typeof left.elapsedSeconds === 'number' ? left.elapsedSeconds : Number.POSITIVE_INFINITY;
    const rightElapsed = typeof right.elapsedSeconds === 'number' ? right.elapsedSeconds : Number.POSITIVE_INFINITY;

    return leftElapsed - rightElapsed;
  });
}

function TypingGamePanel({
  disabled,
  myUserId,
  myUserName,
  onStickySentenceChange,
  onSubmit,
  state,
}: {
  disabled?: boolean;
  myUserId?: null | number | string;
  myUserName?: string;
  onStickySentenceChange?: (sentence: string | null) => void;
  onSubmit: (sentence: string) => boolean;
  state: TypingGameState | null;
}): JSX.Element {
  const [inputValue, setInputValue] = useState('');
  const [isInputFocused, setIsInputFocused] = useState(false);
  const submittedRoundKeyRef = useRef<string | null>(null);
  const rounds = state?.rounds ?? [];
  const currentRound = rounds.at(-1);
  const answerSentence = currentRound?.answerSentence ?? '';
  const currentRoundKey = `${state?.roomId ?? ''}:${currentRound?.roundNumber ?? rounds.length}:${answerSentence}`;
  const players = currentRound?.typingPlayers ?? [];
  const finalResults = state?.finalResults ?? [];
  const rankingItems = buildTypingRanking(rounds, finalResults);
  const myPlayer = players.find(player => isSameTypingPlayer(player, myUserId, myUserName));
  const roundWinner = getTypingRoundWinner(players);
  const hasSubmitted = Boolean(myPlayer?.submittedAt);
  const isJudged = Boolean(currentRound?.judgedAt);
  const isMatchFinished = finalResults.length > 0;
  const correctPrefixLength = getCorrectPrefixLength(answerSentence, inputValue);
  const hasMistake = inputValue.length > correctPrefixLength;
  const isComplete = answerSentence.length > 0 && inputValue === answerSentence;
  const progressPercent =
    answerSentence.length > 0 ? Math.min((correctPrefixLength / answerSentence.length) * 100, 100) : 0;
  const isSubmitPending = submittedRoundKeyRef.current === currentRoundKey;
  const editable =
    Boolean(answerSentence) && !disabled && !isSubmitPending && !hasSubmitted && !isJudged && !isMatchFinished;
  const statusMessage = hasSubmitted
    ? roundWinner && isSameTypingPlayer(roundWinner, myUserId, myUserName)
      ? '가장 먼저 입력했어요. 라운드 승리!'
      : '제출 완료! 판정을 기다리는 중입니다.'
    : isMatchFinished
    ? '타자게임이 종료되었습니다.'
    : isJudged
    ? '이번 라운드 판정이 완료되었습니다.'
    : isSubmitPending
    ? '제출 중입니다. 잠시만 기다려 주세요.'
    : hasMistake
    ? '오타가 있어요. 정확히 입력하면 제출할 수 있습니다.'
    : isComplete
    ? '완벽합니다. 바로 제출하세요!'
    : answerSentence
    ? '문장을 그대로 입력해 주세요.'
    : '출제 문장을 기다리는 중입니다.';

  useEffect(() => {
    setInputValue('');
    submittedRoundKeyRef.current = null;
  }, [currentRoundKey]);

  useEffect(() => {
    if (!onStickySentenceChange) {
      return;
    }

    if (isInputFocused && answerSentence) {
      onStickySentenceChange(answerSentence);
      return;
    }

    onStickySentenceChange(null);

    return () => {
      onStickySentenceChange(null);
    };
  }, [answerSentence, isInputFocused, onStickySentenceChange]);

  const handleSubmit = () => {
    if (!isComplete || hasSubmitted || isSubmitPending) {
      return;
    }

    const submitted = onSubmit(inputValue);

    if (submitted) {
      submittedRoundKeyRef.current = currentRoundKey;
      setInputValue('');
    }
  };

  return (
    <View style={styles.typingPanel}>
      <GamePanelHeader
        badgeLabel={isMatchFinished ? 'FINISH' : `ROUND ${currentRound?.roundNumber ?? '-'}`}
        title="타자게임"
      />

      <View style={styles.typingSentenceCard}>
        <Text style={styles.typingSentenceLabel}>출제 문장</Text>
        <Text style={styles.typingSentence}>{answerSentence || '잠시 후 문장이 표시됩니다.'}</Text>
      </View>

      <View style={styles.typingProgressTrack}>
        <View style={[styles.typingProgressFill, {width: `${progressPercent}%`}]} />
      </View>

      <View style={styles.typingStatusRow}>
        <Text style={[styles.typingStatusText, hasMistake && styles.typingStatusError]}>{statusMessage}</Text>
        <Text style={styles.typingCountText}>
          {correctPrefixLength}/{answerSentence.length || 0}
        </Text>
      </View>

      <TextInput
        autoCapitalize="none"
        autoCorrect={false}
        editable={editable}
        blurOnSubmit
        multiline
        onChangeText={setInputValue}
        onBlur={() => setIsInputFocused(false)}
        onFocus={() => setIsInputFocused(true)}
        onSubmitEditing={handleSubmit}
        placeholder="문장을 입력하세요"
        placeholderTextColor="#777777"
        returnKeyType="done"
        style={[
          styles.typingInput,
          hasMistake && styles.typingInputError,
          isComplete && styles.typingInputComplete,
          !editable && styles.typingInputDisabled,
        ]}
        value={inputValue}
      />

      <View style={styles.typingButtonRow}>
        <AnimatedPressable
          disabled={!editable || inputValue.length === 0}
          onPress={() => setInputValue('')}
          style={[styles.typingSubButton, (!editable || inputValue.length === 0) && styles.typingButtonDisabled]}>
          <Text style={styles.typingSubButtonText}>다시 입력</Text>
        </AnimatedPressable>
        <AnimatedPressable
          disabled={!isComplete || hasSubmitted || isSubmitPending}
          onPress={handleSubmit}
          style={[
            styles.typingPrimaryButton,
            (!isComplete || hasSubmitted || isSubmitPending) && styles.typingButtonDisabled,
          ]}>
          <Text style={styles.typingPrimaryButtonText}>{isSubmitPending ? '제출 중' : '제출'}</Text>
        </AnimatedPressable>
      </View>

      <View style={styles.typingPlayersCard}>
        <Text style={styles.roundHistoryTitle}>참가 현황</Text>
        {players.length > 0 ? (
          players.map((player, index) => {
            const isMine = isSameTypingPlayer(player, myUserId, myUserName);

            return (
              <View
                key={`${player.employeeId ?? player.employeeName ?? 'player'}-${index}`}
                style={[styles.typingPlayerRow, isMine && styles.typingPlayerRowMine]}>
                <Text numberOfLines={1} style={[styles.typingPlayerName, isMine && styles.typingPlayerNameMine]}>
                  {isMine ? '나' : player.employeeName ?? '참가자'}
                </Text>
                <Text style={styles.typingPlayerMeta}>
                  {isTypingPlayerCompleted(player) ? `완료 · ${formatTypingElapsed(player.elapsedSeconds)}` : '입력중'}
                </Text>
              </View>
            );
          })
        ) : (
          <Text style={styles.roundHistoryEmpty}>아직 제출한 참가자가 없습니다.</Text>
        )}
      </View>

      {rankingItems.length > 0 ? (
        <View style={styles.typingPlayersCard}>
          <Text style={styles.roundHistoryTitle}>최종 순위</Text>
          {rankingItems.map((result, index) => {
            const isMine = isSameTypingPlayer(result, myUserId, myUserName);

            return (
              <View
                key={`${result.employeeId ?? result.employeeName ?? 'result'}-${index}`}
                style={[styles.typingPlayerRow, isMine && styles.typingPlayerRowMine]}>
                <Text style={styles.typingRankText}>{index + 1}</Text>
                <Text numberOfLines={1} style={[styles.typingPlayerName, isMine && styles.typingPlayerNameMine]}>
                  {isMine ? `${result.employeeName ?? '나'} · 내 기록` : result.employeeName ?? '참가자'}
                </Text>
                <Text style={styles.typingPlayerMeta}>
                  {result.winCount > 0
                    ? `${result.winCount}승 · ${formatTypingElapsed(result.elapsedSeconds)}`
                    : formatTypingElapsed(result.elapsedSeconds)}
                </Text>
              </View>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

export function CoinBattleRoomScreen(): JSX.Element {
  const navigation = useNavigation<NativeStackNavigationProp<CoinBattleStackParamList>>();
  const route = useRoute<RouteProps>();
  const {auth, refreshProfile} = useAuth();
  const {holdingCoin: latestHoldingCoin, refreshAllCoins} = useCoin();
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
    requestTypingState,
    rooms: realtimeRooms,
    startRoom,
    subscribePictureMatch,
    subscribeRoom,
    subscribeRps,
    subscribeTyping,
    submitTypingSentence,
  } = useCoinBattleRooms({accessToken: auth?.accessToken});
  const [ready, setReady] = useState(false);
  const [optimisticReady, setOptimisticReady] = useState<boolean | null>(null);
  const [roomDetail, setRoomDetail] = useState<CoinBattleRoom | undefined>(undefined);
  const [gameRoomSnapshot, setGameRoomSnapshot] = useState<CoinBattleRoom | undefined>(undefined);
  const [hasGameStarted, setHasGameStarted] = useState(false);
  const [finishedRoomSnapshot, setFinishedRoomSnapshot] = useState<CoinBattleRoom | undefined>(undefined);
  const [startCountdownSeconds, setStartCountdownSeconds] = useState<number | null>(null);
  const [roundResultOverlay, setRoundResultOverlay] = useState<RoundResultOverlay | null>(null);
  const [pendingRpsChoice, setPendingRpsChoice] = useState<RpsChoice | null>(null);
  const [isReturningToWaitingRoom, setIsReturningToWaitingRoom] = useState(false);
  const [stickyTypingSentence, setStickyTypingSentence] = useState<string | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const leaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const roundResultTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startRequestedRef = useRef(false);
  const latestPresentedRoundRef = useRef(0);
  const latestTypingSyncRequestedRoundRef = useRef(0);
  const coinRefreshRoomIdRef = useRef<string | null>(null);
  const balanceExitRoomRef = useRef<string | null>(null);
  const confirmedLeaveRef = useRef(false);
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
  const liveRoom = roomDetail ?? realtimeRooms.find(room => room.roomId === roomId);
  const currentRoom = hasGameStarted ? finishedRoomSnapshot ?? gameRoomSnapshot ?? liveRoom : liveRoom;
  const roomBetAmount = currentRoom?.betAmount ?? 1;
  const myMember = currentRoom?.roomMembers.find(member => {
    return String(member.employeeId) === String(myUserId);
  });
  const holdingCoin = toCoinNumber(myMember?.coinBalance) ?? latestHoldingCoin ?? getHoldingCoin(auth?.profile);
  const serverMyReady = myMember?.isReady;
  const myReady = optimisticReady ?? serverMyReady ?? ready;
  const roomMembers = currentRoom?.roomMembers ?? [];
  const isMyMember = roomMembers.some(member => {
    return String(member.employeeId) === String(myUserId);
  });
  const currentMemberCount = currentRoom?.currentMemberCount ?? Math.max(roomMembers.length, 1);
  const maxMembers = currentRoom?.maxMembers ?? 2;
  const roomStatus = currentRoom?.roomStatus;
  const roomStatusLabel = roomStatus ? roomStatusLabels[roomStatus] : status;
  const totalRoundCount = Math.min(currentRoom?.totalRoundCount ?? 1, getMaxRoundCount(currentRoom?.realtimeGameId));
  const emptySlotCount = Math.max(maxMembers - roomMembers.length, 0);
  const isOwner =
    currentRoom?.ownerEmployeeId !== undefined && String(currentRoom.ownerEmployeeId) === String(myUserId);
  const isGameInProgress = roomStatus === 'IN_PROGRESS';
  const isRpsGame = currentRoom?.realtimeGameId === 1;
  const isPictureMatchGame = currentRoom?.realtimeGameId === 2;
  const isTypingGame = currentRoom?.realtimeGameId === 21;
  const opponentMember = roomMembers.find(member => {
    return String(member.employeeId) !== String(myUserId);
  });
  const {handleRpsChoice, hasOpponentSubmitted, opponentRpsChoice, resetRpsGame, rpsRoundResults, selectedRpsChoice} =
    useCoinBattleRpsGame({
      chooseRps,
      isActive: hasGameStarted && isRpsGame,
      myUserId,
      myUserName: auth?.name,
      requestRpsState,
      roomId,
      subscribeRps,
    });
  const {handleFlipPicture, pictureMatchState, resetPictureMatchGame} = useCoinBattlePictureMatchGame({
    checkPictureMatch,
    flipPictureMatch,
    isActive: hasGameStarted && isPictureMatchGame,
    myUserId,
    myUserName: auth?.name,
    requestPictureMatchState,
    roomId,
    subscribePictureMatch,
  });
  const {
    completedTypingRoundCount: trackedCompletedTypingRoundCount,
    handleSubmitTyping,
    resetTypingGame,
    typingGameState,
  } = useCoinBattleTypingGame({
    isActive: hasGameStarted && isTypingGame,
    requestTypingState,
    roomId,
    submitTypingSentence,
    subscribeTyping,
  });
  const completedRoundCount = rpsRoundResults.reduce((count, round) => {
    return typeof round.judgedAt === 'string' && round.judgedAt.length > 0 ? count + 1 : count;
  }, 0);
  const latestRoundNumber = rpsRoundResults.reduce((maxRound, round) => {
    return typeof round.roundNumber === 'number' && round.roundNumber > maxRound ? round.roundNumber : maxRound;
  }, 0);
  const currentRoundNumber = Math.min(
    Math.max(latestRoundNumber > completedRoundCount ? latestRoundNumber : completedRoundCount + 1, 1),
    totalRoundCount,
  );
  const isRpsMatchFinished = totalRoundCount > 0 && completedRoundCount >= totalRoundCount;
  const pictureMatchPictures =
    pictureMatchState && Array.isArray(pictureMatchState.pictures) ? pictureMatchState.pictures : [];
  const pictureMatchFinalResults =
    pictureMatchState && Array.isArray(pictureMatchState.finalResults) ? pictureMatchState.finalResults : [];
  const isPictureMatchFinished =
    pictureMatchFinalResults.length > 0 ||
    (pictureMatchPictures.length > 0 && pictureMatchPictures.every(picture => picture.isMatched));
  const latestMyPictureMatchResult = getPictureMatchResultForMe({
    finalResults: pictureMatchFinalResults,
    myUserId,
    myUserName: auth?.name,
    pictures: pictureMatchPictures,
  });
  const typingFinalResults =
    typingGameState && Array.isArray(typingGameState.finalResults) ? typingGameState.finalResults : [];
  const typingRounds = typingGameState && Array.isArray(typingGameState.rounds) ? typingGameState.rounds : [];
  const typingTotalRoundCount =
    typingGameState && Array.isArray(typingGameState.roundSentences) && typingGameState.roundSentences.length > 0
      ? typingGameState.roundSentences.length
      : totalRoundCount;
  const visibleCompletedTypingRoundCount = typingRounds.reduce((count, round) => {
    return isTypingRoundCompleted(round) ? count + 1 : count;
  }, 0);
  const completedTypingRoundCount = Math.max(visibleCompletedTypingRoundCount, trackedCompletedTypingRoundCount);
  const latestCompletedTypingRoundNumber = typingRounds.reduce((latestTypingRoundNumber, round, index) => {
    if (!isTypingRoundCompleted(round)) {
      return latestTypingRoundNumber;
    }

    const roundNumber = typeof round.roundNumber === 'number' ? round.roundNumber : index + 1;

    return Math.max(latestTypingRoundNumber, roundNumber);
  }, 0);
  const isTypingMatchFinished =
    typingFinalResults.length > 0 ||
    (isTypingGame &&
      typingTotalRoundCount > 0 &&
      (completedTypingRoundCount >= typingTotalRoundCount ||
        latestCompletedTypingRoundNumber >= typingTotalRoundCount));
  const isMatchFinished = isRpsGame
    ? isRpsMatchFinished
    : isPictureMatchGame
    ? isPictureMatchFinished
    : isTypingGame
    ? isTypingMatchFinished
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
      return typeof round.judgedAt === 'string' && round.judgedAt.trim().length > 0;
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

    return Boolean(auth?.name && player.employeeName && player.employeeName === auth.name);
  });
  const latestMyRoundResult = normalizeRpsResult(latestMyRoundPlayer?.result);
  const latestTypingCompletedRound = typingRounds
    .filter(round => {
      return isTypingRoundCompleted(round);
    })
    .slice()
    .sort((left, right) => {
      return (left.roundNumber ?? 0) - (right.roundNumber ?? 0);
    })
    .at(-1);
  const latestTypingWinner = latestTypingCompletedRound
    ? getTypingRoundWinner(latestTypingCompletedRound.typingPlayers ?? [])
    : undefined;
  const latestMyTypingResult = getTypingRoundResultForMe(latestTypingCompletedRound, myUserId, auth?.name);
  const displayedMyChoice = selectedRpsChoice;
  const displayedOpponentChoice = opponentRpsChoice;
  const myProfileImageUri = getProfileImageUriFromRecord(auth?.profile);
  const shouldShowChoiceOverlay =
    shouldShowGame && isRpsGame && !isMatchFinished && !selectedRpsChoice && !roundResultOverlay;

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
    setOptimisticReady(null);
    setReady(false);
    balanceExitRoomRef.current = null;
    confirmedLeaveRef.current = false;
  }, [roomId]);

  useEffect(() => {
    if (serverMyReady === undefined) {
      return;
    }

    setReady(serverMyReady);

    if (optimisticReady === serverMyReady) {
      setOptimisticReady(null);
    }
  }, [optimisticReady, serverMyReady]);

  useEffect(() => {
    if (
      !isRealtime ||
      !currentRoom ||
      !isMyMember ||
      shouldShowGame ||
      currentRoom.roomStatus === 'IN_PROGRESS' ||
      holdingCoin >= roomBetAmount ||
      balanceExitRoomRef.current === roomId
    ) {
      return;
    }

    balanceExitRoomRef.current = roomId;
    leaveRoom(roomId, myUserId);

    Alert.alert(
      '코인이 부족합니다',
      `보유코인 ${holdingCoin}개가 베팅 코인 ${roomBetAmount}개보다 부족해 대기방에서 퇴장됩니다.`,
    );

    if (leaveTimerRef.current) {
      clearTimeout(leaveTimerRef.current);
    }

    leaveTimerRef.current = setTimeout(() => {
      confirmedLeaveRef.current = true;

      if (navigation.canGoBack()) {
        navigation.goBack();
        return;
      }

      navigation.replace('CoinBattleHome');
    }, 120);
  }, [
    currentRoom,
    holdingCoin,
    isMyMember,
    isRealtime,
    leaveRoom,
    myUserId,
    navigation,
    roomBetAmount,
    roomId,
    shouldShowGame,
  ]);

  useEffect(() => {
    if (connectionStatus !== 'connected') {
      return;
    }

    const unsubscribe = subscribeRoom(roomId, messageBody => {
      try {
        const parsed = JSON.parse(messageBody) as unknown;
        const nextRoom = normalizeCoinBattleRoom(parsed);

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
    if (liveRoom && isMatchFinished) {
      setFinishedRoomSnapshot(previousSnapshot => {
        const baseSnapshot = previousSnapshot ?? gameRoomSnapshot ?? liveRoom;

        return {
          ...baseSnapshot,
          ...liveRoom,
          roomMembers: liveRoom.roomMembers.length > 0 ? liveRoom.roomMembers : baseSnapshot.roomMembers,
        };
      });

      if (coinRefreshRoomIdRef.current !== roomId) {
        coinRefreshRoomIdRef.current = roomId;
        Promise.allSettled([refreshProfile(), refreshAllCoins()]).then(results => {
          results.forEach((result, index) => {
            if (result.status === 'rejected' && __DEV__) {
              console.log('[CoinBattleRoomScreen] coin refresh after match failed', {
                index,
                reason: result.reason,
              });
            }
          });
        });
      }
    }
  }, [gameRoomSnapshot, isMatchFinished, liveRoom, refreshAllCoins, refreshProfile, roomId]);

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
  }, [canAutoStart, canStartCountdown, currentRoom, myUserId, roomId, startCountdownSeconds, startRoom]);

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
  }, [countdownBackdropOpacity, countdownOpacity, countdownScale, startCountdownSeconds]);

  useEffect(() => {
    if (!latestJudgedRound || !latestMyRoundResult) {
      return;
    }

    const nextRoundNumber = latestJudgedRound.roundNumber ?? 0;

    if (nextRoundNumber <= 0 || nextRoundNumber <= latestPresentedRoundRef.current) {
      return;
    }

    latestPresentedRoundRef.current = nextRoundNumber;
    setRoundResultOverlay({
      result: latestMyRoundResult,
      roundNumber: nextRoundNumber,
    });
  }, [latestJudgedRound, latestMyRoundResult]);

  useEffect(() => {
    if (!isTypingGame || !latestTypingCompletedRound || !latestMyTypingResult) {
      return;
    }

    const nextRoundNumber = latestTypingCompletedRound.roundNumber ?? 0;

    if (nextRoundNumber <= 0 || nextRoundNumber <= latestPresentedRoundRef.current) {
      return;
    }

    latestPresentedRoundRef.current = nextRoundNumber;
    setRoundResultOverlay({
      result: latestMyTypingResult,
      roundNumber: nextRoundNumber,
      source: 'typing',
      winnerName: latestTypingWinner?.employeeName,
    });
  }, [isTypingGame, latestMyTypingResult, latestTypingCompletedRound, latestTypingWinner]);

  useEffect(() => {
    if (!isPictureMatchGame || !isPictureMatchFinished || !latestMyPictureMatchResult) {
      return;
    }

    const finalRoundNumber = Math.max(totalRoundCount, 1);

    if (finalRoundNumber <= latestPresentedRoundRef.current) {
      return;
    }

    latestPresentedRoundRef.current = finalRoundNumber;
    setRoundResultOverlay({
      result: latestMyPictureMatchResult,
      roundNumber: finalRoundNumber,
      source: 'picture',
    });
  }, [isPictureMatchFinished, isPictureMatchGame, latestMyPictureMatchResult, totalRoundCount]);

  useEffect(() => {
    if (!isTypingGame || !latestTypingCompletedRound || isTypingMatchFinished) {
      return;
    }

    const completedRoundNumber = latestTypingCompletedRound.roundNumber ?? 0;

    if (completedRoundNumber <= 0 || completedRoundNumber <= latestTypingSyncRequestedRoundRef.current) {
      return;
    }

    latestTypingSyncRequestedRoundRef.current = completedRoundNumber;

    const timer = setTimeout(() => {
      requestTypingState(roomId);
    }, 3000);

    return () => clearTimeout(timer);
  }, [isTypingGame, isTypingMatchFinished, latestTypingCompletedRound, requestTypingState, roomId]);

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

    roundResultTimerRef.current = setTimeout(
      () => {
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
      },
      isMatchFinished ? 1800 : 1400,
    );

    return () => {
      if (roundResultTimerRef.current) {
        clearTimeout(roundResultTimerRef.current);
      }
    };
  }, [isMatchFinished, resultBackdropOpacity, resultOpacity, resultScale, roundResultOverlay]);

  const leaveCurrentRoom = React.useCallback(() => {
    if (__DEV__) {
      console.log('[CoinBattleRoomScreen] leaveCurrentRoom', {roomId});
    }

    if (!isRealtime) {
      confirmedLeaveRef.current = true;
      navigation.goBack();
      return;
    }

    leaveRoom(roomId, myUserId);

    if (leaveTimerRef.current) {
      clearTimeout(leaveTimerRef.current);
    }

    leaveTimerRef.current = setTimeout(() => {
      confirmedLeaveRef.current = true;
      if (navigation.canGoBack()) {
        navigation.goBack();
        return;
      }

      navigation.replace('CoinBattleHome');
    }, 120);
  }, [isRealtime, leaveRoom, myUserId, navigation, roomId]);

  const handleLeaveRoom = React.useCallback(() => {
    Alert.alert(
      '방에서 퇴장하시겠습니까?',
      '진행 중인 준비 상태와 게임 참여가 취소됩니다.',
      [
        {
          style: 'cancel',
          text: '취소',
        },
        {
          onPress: leaveCurrentRoom,
          style: 'destructive',
          text: '퇴장',
        },
      ],
    );
  }, [leaveCurrentRoom]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      handleLeaveRoom();
      return true;
    });

    return () => {
      subscription.remove();
    };
  }, [handleLeaveRoom]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', event => {
      if (confirmedLeaveRef.current) {
        return;
      }

      event.preventDefault();
      handleLeaveRoom();
    });

    return unsubscribe;
  }, [handleLeaveRoom, navigation]);

  const handleReady = () => {
    const nextReady = !myReady;

    if (isRealtime) {
      const requested = readyRoom(roomId, myUserId, nextReady);

      if (!requested) {
        return;
      }

      setReady(nextReady);
      setOptimisticReady(nextReady);
      requestRoomState(roomId);
      return;
    }

    setReady(nextReady);
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
      setRoomDetail(resetRoomForWaiting(currentRoom ?? liveRoom));
      setGameRoomSnapshot(undefined);
      setFinishedRoomSnapshot(undefined);
      setStartCountdownSeconds(null);
      setReady(false);
      setOptimisticReady(null);
      setPendingRpsChoice(null);
      startRequestedRef.current = false;
      latestPresentedRoundRef.current = 0;
      latestTypingSyncRequestedRoundRef.current = 0;
      coinRefreshRoomIdRef.current = null;
      resetRpsGame();
      resetPictureMatchGame();
      resetTypingGame();
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
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
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
                      {isTypingGame
                        ? '타자게임'
                        : isPictureMatchGame
                        ? '같은그림 맞추기'
                        : `라운드 ${isMatchFinished ? '종료' : currentRoundNumber} / ${totalRoundCount}`}
                    </Text>
                    <View style={styles.liveCompactDot} />
                    <Text style={styles.liveCompactMeta}>코인 {roomBetAmount}</Text>
                    <View style={styles.liveCompactDot} />
                    <Text style={styles.liveCompactMeta}>보유 {holdingCoin}개</Text>
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
                  {isTypingGame ? (
                    <TypingGamePanel
                      disabled={Boolean(roundResultOverlay)}
                      myUserId={myUserId}
                      myUserName={auth?.name}
                      onStickySentenceChange={setStickyTypingSentence}
                      onSubmit={handleSubmitTyping}
                      state={typingGameState}
                    />
                  ) : isPictureMatchGame ? (
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
                        <GamePanelHeader
                          badgeLabel={`ROUND ${currentRoundNumber} / ${totalRoundCount}`}
                          title="가위바위보"
                        />
                      ) : null}

                      {!isMatchFinished && latestJudgedRound && latestMyRoundResult ? (
                        <View
                          style={[
                            styles.latestResultBanner,
                            latestMyRoundResult === 'WIN' && styles.latestResultBannerWin,
                            latestMyRoundResult === 'LOSE' && styles.latestResultBannerLose,
                            latestMyRoundResult === 'DRAW' && styles.latestResultBannerDraw,
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
                            label={displayedMyChoice ? rpsChoiceById[displayedMyChoice].label : '선택 대기'}
                            name={myMember?.employeeName ?? auth?.name ?? '나'}
                            role="나"
                          />

                          <Text style={styles.vsText}>VS</Text>

                          <BattleSlotCard
                            choice={displayedOpponentChoice}
                            hiddenSubmitted={!displayedOpponentChoice && hasOpponentSubmitted}
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
                            {selectedRpsChoice ? '카드 선택 완료' : '카드 선택 대기'}
                          </Text>
                          <Text style={styles.choiceLockDescription}>
                            {selectedRpsChoice
                              ? '이번 라운드의 카드는 확정되었습니다.'
                              : '라운드 시작 시 카드 선택창이 열립니다.'}
                          </Text>
                        </View>
                      ) : null}

                      <View style={[styles.roundHistory, isMatchFinished && styles.roundHistoryFinished]}>
                        <Text style={styles.roundHistoryTitle}>라운드 기록</Text>
                        {rpsRoundResults.length > 0 ? (
                          rpsRoundResults
                            .slice()
                            .sort((left, right) => {
                              return (left.roundNumber ?? 0) - (right.roundNumber ?? 0);
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
                          <Text style={styles.roundHistoryEmpty}>아직 진행된 라운드가 없습니다.</Text>
                        )}
                      </View>
                    </>
                  )}
                </View>
              </>
            ) : (
              <>
                <View style={styles.hero}>
                  <View style={styles.heroTopRow}>
                    <View style={styles.statusChip}>
                      <Text style={styles.statusText}>{roomStatusLabel}</Text>
                    </View>
                  </View>
                  <Text style={styles.title}>{title}</Text>
                </View>

                <View style={styles.infoGrid}>
                  <View style={styles.infoCard}>
                    <Text style={styles.infoLabel}>게임</Text>
                    <Text style={styles.infoValue}>{game}</Text>
                  </View>
                  <View style={styles.infoCard}>
                    <Text style={styles.infoLabel}>베팅 코인</Text>
                    <Text style={styles.infoValue}>{roomBetAmount}개</Text>
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
                  <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>참가자</Text>
                    <View style={styles.sectionHoldingCoin}>
                      <Text style={styles.holdingCoinLabel}>보유코인 {holdingCoin}개</Text>
                    </View>
                  </View>
                  {roomMembers.length > 0 ? (
                    roomMembers.map(member => {
                      const memberIsOwner = currentRoom?.ownerEmployeeId === member.employeeId;
                      const isMe = String(member.employeeId) === String(myUserId);
                      const memberReady = isMe ? myReady : member.isReady;
                      const memberRecordText = formatRoomMemberRecord(member);
                      const memberProfileImageUri = getMemberProfileImageUri(member, isMe ? auth?.profile : undefined);

                      return (
                        <View key={member.employeeId} style={styles.memberRow}>
                          <Image
                            resizeMode="cover"
                            source={memberProfileImageUri ? {uri: memberProfileImageUri} : image.profile}
                            style={styles.avatar}
                          />
                          <View style={styles.memberText}>
                            <Text style={styles.memberName}>{member.employeeName}</Text>
                            <Text style={styles.memberRole}>
                              {memberIsOwner ? '방장' : '참가자'}
                              {memberRecordText ? ` · ${memberRecordText}` : ''}
                            </Text>
                          </View>
                          <View style={[styles.readyBadge, memberReady && styles.readyBadgeActive]}>
                            <Text style={styles.readyBadgeText}>{memberReady ? '준비완료' : '준비중'}</Text>
                          </View>
                        </View>
                      );
                    })
                  ) : (
                    <View style={styles.memberRow}>
                      <Image
                        resizeMode="cover"
                        source={myProfileImageUri ? {uri: myProfileImageUri} : image.profile}
                        style={styles.avatar}
                      />
                      <View style={styles.memberText}>
                        <Text style={styles.memberName}>{host}</Text>
                        <Text style={styles.memberRole}>방장</Text>
                      </View>
                      <View style={[styles.readyBadge, myReady && styles.readyBadgeActive]}>
                        <Text style={styles.readyBadgeText}>{myReady ? '준비완료' : '준비중'}</Text>
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
                  <AnimatedPressable
                    accessibilityRole="button"
                    onPress={handleReady}
                    style={[styles.readyButton, myReady && styles.readyButtonActive]}>
                    <Text style={[styles.readyButtonText, myReady && styles.readyButtonTextActive]}>
                      {myReady ? '준비 완료' : '준비하기'}
                    </Text>
                  </AnimatedPressable>
                  <AnimatedPressable accessibilityRole="button" onPress={handleLeaveRoom} style={styles.leaveButton}>
                    <Text style={styles.leaveButtonText}>나가기</Text>
                  </AnimatedPressable>
                </View>
              </>
            )}
          </Animated.View>
        </ScrollView>

        {stickyTypingSentence ? (
          <View pointerEvents="none" style={styles.typingStickySentence}>
            <Text style={styles.typingStickyLabel}>출제 문장</Text>
            <Text numberOfLines={3} style={styles.typingStickyText}>
              {stickyTypingSentence}
            </Text>
          </View>
        ) : null}

        {shouldShowGame && isMatchFinished && !isReturningToWaitingRoom ? (
          <View style={styles.finishDock}>
            <AnimatedPressable
              accessibilityRole="button"
              onPress={handleReturnToWaitingRoom}
              style={styles.finishButton}>
              <Text style={styles.finishButtonText}>대기방으로 돌아가기</Text>
            </AnimatedPressable>
          </View>
        ) : null}

        {startCountdownSeconds !== null ? (
          <Animated.View pointerEvents="none" style={[styles.countdownOverlay, {opacity: countdownBackdropOpacity}]}>
            <BlurView blurAmount={12} blurType="dark" style={styles.countdownBlur} />
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
              <Text style={styles.countdownValue}>{startCountdownSeconds === 0 ? 'START' : startCountdownSeconds}</Text>
              <Text style={styles.countdownHint}>{startCountdownSeconds === 0 ? '게임 시작' : '곧 시작합니다'}</Text>
            </Animated.View>
          </Animated.View>
        ) : null}

        {shouldShowChoiceOverlay ? (
          <View style={styles.choiceOverlay}>
            <BlurView blurAmount={12} blurType="dark" style={styles.choiceOverlayBlur} />
            <View style={styles.choiceOverlayTint} />
            <View style={styles.choiceOverlayContent}>
              <Text style={styles.choiceOverlayEyebrow}>ROUND {currentRoundNumber}</Text>
              <Text style={styles.choiceOverlayTitle}>카드를 선택하세요</Text>
              <Text style={styles.choiceOverlayHint}>한 번 고르면 이번 라운드에는 바꿀 수 없습니다.</Text>
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
              <AnimatedPressable
                accessibilityRole="button"
                disabled={!pendingRpsChoice}
                onPress={handleConfirmRpsChoice}
                style={[styles.choiceConfirmButton, !pendingRpsChoice && styles.choiceConfirmButtonDisabled]}>
                <Text
                  style={[styles.choiceConfirmButtonText, !pendingRpsChoice && styles.choiceConfirmButtonTextDisabled]}>
                  {pendingRpsChoice ? '이 카드로 확정' : '카드를 먼저 선택하세요'}
                </Text>
              </AnimatedPressable>
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
                {isMatchFinished ? 'FINAL ROUND' : `ROUND ${roundResultOverlay.roundNumber}`}
              </Text>
              <Text style={styles.resultValue}>
                {roundResultOverlay.result === 'WIN'
                  ? '승리'
                  : roundResultOverlay.result === 'LOSE'
                  ? '패배'
                  : '무승부'}
              </Text>
              <Text style={styles.resultHint}>
                {roundResultOverlay.source === 'typing' && roundResultOverlay.result === 'WIN'
                  ? '가장 먼저 입력했어요'
                  : roundResultOverlay.source === 'typing' && roundResultOverlay.result === 'DRAW'
                  ? '동시에 승부가 멈췄어요'
                  : roundResultOverlay.source === 'typing' && roundResultOverlay.winnerName
                  ? `${roundResultOverlay.winnerName}님이 먼저 입력했어요`
                  : roundResultOverlay.source === 'typing'
                  ? '다음 문장을 노려보세요'
                  : roundResultOverlay.source === 'picture' && roundResultOverlay.result === 'WIN'
                  ? '같은 그림을 더 많이 찾았어요'
                  : roundResultOverlay.source === 'picture' && roundResultOverlay.result === 'LOSE'
                  ? '상대가 더 많이 찾았어요'
                  : roundResultOverlay.source === 'picture'
                  ? '같은 수를 찾았어요'
                  : roundResultOverlay.result === 'WIN'
                  ? '멋져요!'
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
  const leftChoice = players.find(player => player.employeeId === leftMember?.employeeId) ?? players[0];
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
      player?.choice === 'ROCK' || player?.choice === 'PAPER' || player?.choice === 'SCISSORS' ? player.choice : null;
    const choiceMeta = normalizedChoice ? rpsChoices.find(choice => choice.id === normalizedChoice) : null;
    const result = normalizeRpsResult(player?.result);
    const resultMeta = result ? rpsResultMeta[result] : null;
    const isMe =
      (member && myUserId !== null && myUserId !== undefined && String(member.employeeId) === String(myUserId)) ||
      Boolean(myUserName && (member?.employeeName === myUserName || player?.employeeName === myUserName));

    return (
      <View style={[styles.roundPlayerLine, isMe && styles.roundPlayerLineMine]}>
        <Text style={[styles.roundPlayerName, isMe && styles.roundPlayerNameMine]}>
          {resultMeta ? `${resultMeta.label} · ` : ''}
          {member?.employeeName ?? player?.employeeName ?? fallbackName}
          {isMe ? ' (나)' : ''}
        </Text>
        <Text style={styles.roundPlayerChoice}>{choiceMeta ? choiceMeta.label : '대기'}</Text>
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

      return Boolean(myUserName && player.employeeName && player.employeeName === myUserName);
    }) ?? null;
  const myRoundResult = normalizeRpsResult(myRoundPlayer?.result);

  return (
    <View style={styles.roundHistoryItem}>
      <View style={styles.roundHistoryHeader}>
        <Text style={styles.roundHistoryItemTitle}>라운드 {round.roundNumber ?? '-'}</Text>
        {myRoundResult ? (
          <View
            style={[
              styles.roundResultChip,
              myRoundResult === 'WIN' && styles.roundResultChipWin,
              myRoundResult === 'LOSE' && styles.roundResultChipLose,
              myRoundResult === 'DRAW' && styles.roundResultChipDraw,
            ]}>
            <Text style={styles.roundResultChipText}>
              내 결과 {myRoundResult === 'WIN' ? '승' : myRoundResult === 'LOSE' ? '패' : '무'}
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
    paddingTop: 0,
    paddingBottom: 180,
  },
  hero: {
    borderRadius: 12,
    padding: 18,
    backgroundColor: '#171717',
    borderWidth: 1,
    borderColor: '#252525',
  },
  heroTopRow: {
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  statusChip: {
    alignSelf: 'flex-start',
    borderRadius: 8,
    backgroundColor: '#E50914',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  statusText: {
    color: '#FFFFFF',
    ...FONTS.font11B,
  },
  holdingCoinChip: {
    minHeight: 29,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E50914',
    // backgroundColor: '#ffffff',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  holdingCoinLabel: {
    color: '#FFFFFF',
    ...FONTS.font14B,
  },
  holdingCoinValue: {
    color: '#FFFFFF',
    ...FONTS.font11B,
  },
  title: {
    color: '#FFFFFF',
    ...FONTS.font22B,
    lineHeight: 30,
  },
  subtitle: {
    marginTop: 10,
    color: '#898989',
    ...FONTS.font12M,
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
    ...FONTS.font14B,
    letterSpacing: 2,
  },
  countdownValue: {
    marginTop: 4,
    color: '#FFFFFF',
    ...FONTS.font68B,
    lineHeight: 76,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: {width: 0, height: 3},
    textShadowRadius: 12,
  },
  countdownHint: {
    marginTop: -2,
    color: '#FFFFFF',
    ...FONTS.font14B,
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
    ...FONTS.font13B,
    letterSpacing: 2,
    opacity: 0.78,
  },
  resultValue: {
    marginTop: 8,
    color: '#FFFFFF',
    ...FONTS.font44B,
    lineHeight: 52,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: {width: 0, height: 3},
    textShadowRadius: 12,
  },
  resultHint: {
    marginTop: 6,
    color: '#FFFFFF',
    ...FONTS.font14B,
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
    borderRadius: 14,
    padding: 14,
    backgroundColor: '#111114',
    borderWidth: 1,
    borderColor: '#252525',
  },
  infoLabel: {
    color: '#8B8E96',
    ...FONTS.font12B,
  },
  infoValue: {
    marginTop: 8,
    color: '#FFFFFF',
    ...FONTS.font15B,
    lineHeight: 20,
  },
  liveCompactHeader: {
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#171717',
    borderWidth: 1,
    borderColor: '#252525',
  },
  liveCompactTitle: {
    color: '#FFFFFF',
    ...FONTS.font17B,
    lineHeight: 23,
  },
  liveCompactMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  liveCompactMeta: {
    color: '#A5A7AD',
    ...FONTS.font12B,
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
    ...FONTS.font13B,
    textAlign: 'center',
  },
  liveCompactVs: {
    color: '#E50914',
    ...FONTS.font12B,
    paddingHorizontal: 10,
  },
  section: {
    marginTop: 24,
  },
  sectionTitle: {
    color: '#FFFFFF',
    ...FONTS.font18B,
    marginBottom: 6,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionHoldingCoin: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2D2D2D',
    backgroundColor: '#252525',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  memberRow: {
    minHeight: 80,
    marginTop: 10,
    borderRadius: 12,
    backgroundColor: '#171717',
    borderWidth: 1,
    borderColor: '#252525',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    marginRight: 14,
    overflow: 'hidden',
  },
  memberText: {
    flex: 1,
  },
  memberName: {
    color: '#FFFFFF',
    ...FONTS.font14B,
    lineHeight: 19,
  },
  memberRole: {
    marginTop: 3,
    color: '#8B8E96',
    ...FONTS.font12M,
  },
  readyBadge: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  readyBadgeActive: {
    backgroundColor: '#E50914',
    borderColor: '#E50914',
  },
  readyBadgeText: {
    color: '#FFFFFF',
    ...FONTS.font11B,
  },
  emptySlot: {
    height: 58,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#2D2D2D',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  emptySlotText: {
    color: '#777777',
    ...FONTS.font13B,
  },
  gameSection: {
    marginTop: 24,
    borderRadius: 12,
    padding: 18,
    backgroundColor: '#171717',
    borderWidth: 1,
    borderColor: '#252525',
  },
  gameHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  gameEyebrow: {
    color: '#E50914',
    ...FONTS.font11B,
    letterSpacing: 1,
  },
  gameTitle: {
    marginTop: 6,
    color: '#FFFFFF',
    ...FONTS.font22B,
  },
  roundBadge: {
    borderRadius: 999,
    backgroundColor: 'rgba(229,9,20,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(229,9,20,0.45)',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  roundBadgeText: {
    color: '#FFFFFF',
    ...FONTS.font11B,
  },
  matchupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 22,
  },
  latestResultBanner: {
    marginTop: 18,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
  },
  latestResultBannerWin: {
    backgroundColor: 'rgba(62, 183, 105, 0.14)',
    borderColor: 'rgba(62, 183, 105, 0.55)',
  },
  latestResultBannerLose: {
    backgroundColor: 'rgba(229, 9, 20, 0.14)',
    borderColor: 'rgba(229, 9, 20, 0.55)',
  },
  latestResultBannerDraw: {
    backgroundColor: 'rgba(247, 206, 69, 0.14)',
    borderColor: 'rgba(247, 206, 69, 0.55)',
  },
  latestResultEyebrow: {
    color: '#C7C8CC',
    ...FONTS.font12B,
  },
  latestResultTitle: {
    marginTop: 4,
    color: '#FFFFFF',
    ...FONTS.font24B,
  },
  playerCard: {
    flex: 1,
    minHeight: 178,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: '#111114',
    borderWidth: 1,
    borderColor: '#252525',
    padding: 12,
  },
  playerCardLocked: {
    borderColor: '#E50914',
    backgroundColor: '#201012',
  },
  playerCardPulse: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(229, 9, 20, 0.18)',
  },
  playerRole: {
    color: '#FF8A94',
    ...FONTS.font11B,
    letterSpacing: 1,
  },
  playerCardName: {
    marginTop: 5,
    color: '#FFFFFF',
    ...FONTS.font14B,
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
    borderColor: '#E50914',
  },
  playerChoiceImage: {
    width: 48,
    height: 48,
  },
  playerChoicePlaceholder: {
    marginTop: 12,
    color: '#FFFFFF',
    ...FONTS.font38B,
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
    borderColor: '#E50914',
  },
  hiddenChoiceGlyph: {
    color: '#E50914',
    ...FONTS.font30B,
  },
  playerChoiceLabel: {
    marginTop: 8,
    color: '#C7C8CC',
    ...FONTS.font12B,
  },
  playerChoiceLabelReady: {
    color: '#E50914',
    ...FONTS.font12B,
  },
  vsText: {
    color: '#E50914',
    ...FONTS.font15B,
  },
  choiceLockCard: {
    marginTop: 22,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#252525',
    backgroundColor: '#111114',
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  choiceLockTitle: {
    color: '#E50914',
    ...FONTS.font14B,
  },
  choiceLockDescription: {
    marginTop: 4,
    color: '#C7C8CC',
    ...FONTS.font12B,
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
    backgroundColor: 'rgba(229, 9, 20, 0.62)',
  },
  choiceButton: {
    minHeight: 126,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#111114',
    borderWidth: 1,
    borderColor: '#252525',
  },
  choiceButtonActive: {
    backgroundColor: '#201012',
    borderColor: '#E50914',
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
    ...FONTS.font12B,
  },
  choiceLabelActive: {
    color: '#E50914',
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
    color: '#E50914',
    ...FONTS.font13B,
    letterSpacing: 1.5,
    textAlign: 'center',
  },
  choiceOverlayTitle: {
    marginTop: 10,
    color: '#FFFFFF',
    ...FONTS.font28B,
    textAlign: 'center',
  },
  choiceOverlayHint: {
    marginTop: 8,
    color: '#D4D4D4',
    ...FONTS.font13B,
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
    backgroundColor: '#E50914',
  },
  choiceConfirmButtonDisabled: {
    backgroundColor: '#323232',
  },
  choiceConfirmButtonText: {
    color: '#FFFFFF',
    ...FONTS.font15B,
  },
  choiceConfirmButtonTextDisabled: {
    color: '#A5A7AD',
  },
  roundHistory: {
    marginTop: 18,
    borderRadius: 12,
    backgroundColor: '#171717',
    borderWidth: 1,
    borderColor: '#252525',
    padding: 14,
  },
  roundHistoryFinished: {
    marginTop: 0,
  },
  roundHistoryTitle: {
    color: '#FFFFFF',
    ...FONTS.font14B,
  },
  roundHistoryEmpty: {
    marginTop: 8,
    color: '#8B8E96',
    ...FONTS.font13M,
  },
  roundHistoryItem: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#292929',
    paddingTop: 12,
  },
  roundHistoryItemTitle: {
    color: '#FFFFFF',
    ...FONTS.font13B,
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
    backgroundColor: 'rgba(229, 9, 20, 0.14)',
    borderColor: 'rgba(229, 9, 20, 0.55)',
  },
  roundResultChipDraw: {
    backgroundColor: 'rgba(247, 206, 69, 0.14)',
    borderColor: 'rgba(247, 206, 69, 0.55)',
  },
  roundResultChipText: {
    color: '#FFFFFF',
    ...FONTS.font11B,
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
    ...FONTS.font12B,
  },
  roundPlayerNameMine: {
    color: '#FFFFFF',
  },
  roundPlayerChoice: {
    color: '#FFFFFF',
    ...FONTS.font12B,
  },
  placeholderGameCard: {
    marginTop: 18,
    minHeight: 96,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#171717',
    borderWidth: 1,
    borderColor: '#252525',
  },
  placeholderGameText: {
    color: '#FFFFFF',
    ...FONTS.font14B,
  },
  pictureMatchPanel: {},
  pictureMatchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pictureMatchTitle: {
    color: '#FFFFFF',
    ...FONTS.font22B,
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
    borderColor: 'rgba(229, 9, 20, 0.48)',
    backgroundColor: 'rgba(229, 9, 20, 0.16)',
  },
  pictureMatchTurnText: {
    color: '#FFFFFF',
    ...FONTS.font11B,
  },
  pictureMatchScoreRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },
  pictureMatchScoreCard: {
    flex: 1,
    minHeight: 72,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#171717',
    borderWidth: 1,
    borderColor: '#252525',
  },
  pictureMatchMetaCard: {
    flex: 1,
    minHeight: 72,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(229, 9, 20, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(229, 9, 20, 0.4)',
  },
  pictureMatchScoreLabel: {
    color: '#8B8E96',
    ...FONTS.font11B,
  },
  pictureMatchScoreValue: {
    marginTop: 5,
    color: '#FFFFFF',
    ...FONTS.font22B,
  },
  pictureMatchMetaLabel: {
    color: '#FF8A94',
    ...FONTS.font11B,
  },
  pictureMatchMetaValue: {
    marginTop: 5,
    color: '#FFFFFF',
    ...FONTS.font22B,
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
    borderColor: '#E50914',
    backgroundColor: '#211113',
  },
  pictureMatchCardMatched: {
    borderColor: 'rgba(229, 9, 20, 0.7)',
  },
  pictureMatchImage: {
    width: '100%',
    height: '100%',
  },
  pictureMatchBackText: {
    color: '#FFFFFF',
    ...FONTS.font28B,
  },
  pictureMatchFallbackName: {
    color: '#FFFFFF',
    ...FONTS.font11B,
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
    backgroundColor: '#E50914',
  },
  pictureMatchMineBadgeIcon: {
    width: 10,
    height: 10,
    resizeMode: 'contain',
    tintColor: '#FFFFFF',
  },
  typingPanel: {},
  typingHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  typingTitle: {
    marginTop: 6,
    color: '#FFFFFF',
    ...FONTS.font22B,
  },
  typingSentenceCard: {
    marginTop: 18,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#252525',
    backgroundColor: '#171717',
    padding: 16,
  },
  typingSentenceLabel: {
    color: '#FF8A94',
    ...FONTS.font11B,
    letterSpacing: 0.6,
  },
  typingSentence: {
    marginTop: 8,
    color: '#FFFFFF',
    ...FONTS.font18B,
    lineHeight: 27,
  },
  typingStickySentence: {
    position: 'absolute',
    top: 68,
    left: 20,
    right: 20,
    zIndex: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(229, 9, 20, 0.5)',
    backgroundColor: 'rgba(16, 16, 16, 0.96)',
    paddingHorizontal: 14,
    paddingVertical: 12,
    shadowColor: '#000000',
    shadowOpacity: 0.32,
    shadowRadius: 12,
    shadowOffset: {width: 0, height: 8},
    elevation: 8,
  },
  typingStickyLabel: {
    color: '#FF8A94',
    ...FONTS.font10B,
    letterSpacing: 0.6,
  },
  typingStickyText: {
    marginTop: 5,
    color: '#FFFFFF',
    ...FONTS.font15B,
    lineHeight: 22,
  },
  typingProgressTrack: {
    height: 7,
    marginTop: 14,
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: '#292929',
  },
  typingProgressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#E50914',
  },
  typingInput: {
    minHeight: 88,
    marginTop: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#2D2D2D',
    backgroundColor: '#111114',
    color: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 13,
    textAlignVertical: 'top',
    ...FONTS.font15M,
  },
  typingInputError: {
    borderColor: '#E50914',
    backgroundColor: '#180C0E',
  },
  typingInputComplete: {
    borderColor: 'rgba(62, 183, 105, 0.65)',
    backgroundColor: 'rgba(62, 183, 105, 0.08)',
  },
  typingInputDisabled: {
    opacity: 0.62,
  },
  typingStatusRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  typingStatusText: {
    flex: 1,
    color: '#C7C8CC',
    ...FONTS.font12M,
  },
  typingStatusError: {
    color: '#FF8A94',
  },
  typingCountText: {
    color: '#8B8E96',
    ...FONTS.font12B,
  },
  typingButtonRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  typingSubButton: {
    flex: 1,
    height: 50,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#171717',
    borderWidth: 1,
    borderColor: '#343434',
  },
  typingSubButtonText: {
    color: '#FFFFFF',
    ...FONTS.font14B,
  },
  typingPrimaryButton: {
    flex: 1,
    height: 50,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E50914',
  },
  typingPrimaryButtonText: {
    color: '#FFFFFF',
    ...FONTS.font14B,
  },
  typingButtonDisabled: {
    opacity: 0.45,
  },
  typingPlayersCard: {
    marginTop: 16,
    borderRadius: 12,
    backgroundColor: '#171717',
    borderWidth: 1,
    borderColor: '#252525',
    padding: 14,
  },
  typingPlayerRow: {
    minHeight: 40,
    marginTop: 10,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 10,
    backgroundColor: '#111114',
  },
  typingPlayerRowMine: {
    backgroundColor: 'rgba(229, 9, 20, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(229, 9, 20, 0.35)',
  },
  typingPlayerName: {
    flex: 1,
    color: '#C7C8CC',
    ...FONTS.font12B,
  },
  typingPlayerNameMine: {
    color: '#FFFFFF',
  },
  typingPlayerMeta: {
    color: '#8B8E96',
    ...FONTS.font11B,
  },
  typingRankText: {
    width: 20,
    color: '#E50914',
    ...FONTS.font13B,
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
    backgroundColor: '#E50914',
    alignItems: 'center',
    justifyContent: 'center',
  },
  finishButtonText: {
    color: '#FFFFFF',
    ...FONTS.font14B,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 26,
  },
  readyButton: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#171717',
    borderWidth: 1,
    borderColor: '#2D2D2D',
    alignItems: 'center',
    justifyContent: 'center',
  },
  readyButtonActive: {
    backgroundColor: '#E50914',
  },
  readyButtonText: {
    color: '#FFFFFF',
    ...FONTS.font14B,
  },
  readyButtonTextActive: {
    color: '#FFFFFF',
  },
  leaveButton: {
    width: 92,
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#383838',
    alignItems: 'center',
    justifyContent: 'center',
  },
  leaveButtonText: {
    color: '#D7D7D7',
    ...FONTS.font14B,
  },
});
