import React, {useCallback, useEffect, useRef, useState} from 'react';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {Animated, Image, RefreshControl, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, View} from 'react-native';
import {AnimatedPressable} from '../components/AnimatedPressable';
import {AppLoading} from '../components/AppLoading';
import {AppGnb} from '../components/AppGnb';
import {SlidingSegmentedTabs, SwipeableTabView} from '../components/SlidingSegmentedTabs';
import {TabSceneTransition} from '../components/TabSceneTransition';
import {image} from '../assets/images';
import {useAuth} from '../auth/AuthProvider';
import type {PredictionStackParamList} from '../navigation/types';
import {FONTS} from '../constants/theme';
import {withMinimumLoadingTime} from '../utils/loading';
import {registerScrollToTopHandler} from '../navigation/scrollToTopEvents';

const API_BASE = 'http://121.254.240.93:8090';
const PREDICTION_FESTIVAL_ID = 3;
const MASK_SINGER_GAME_ID = 86;
const EXECUTIVE_GAME_ID = 106;
const participantTones = ['#E50914', '#8A8D95', '#3F8CFF', '#F4B740', '#21B37B'];

type PredictionCardItem = {
  description: string;
  gameId?: number;
  id: string;
  posterSource: typeof image.tekken;
  title: string;
  wordmarkSource: typeof image.tekkenLetter;
};

const fallbackPredictionCards: PredictionCardItem[] = [
  {
    id: 'tekken7',
    title: '철권',
    description: '한 번의 빈틈이 곧 패배! 주먹과 심리전이 폭발하는 최후의 1:1 격투전!',
    posterSource: image.tekken,
    wordmarkSource: image.tekkenLetter,
  },
  {
    id: 'starcraft',
    title: '스타크래프트',
    description: '자원, 병력, 전략까지 단 한순간도 방심할 수 없는 실시간 전쟁!',
    posterSource: image.starcraft,
    wordmarkSource: image.starcraftLetter,
  },
  {
    id: 'crazyarcade',
    title: '크레이지 아케이드',
    description: '터지는 물풍선, 좁혀오는 압박! 살아남는 팀만이 승리를 가져간다!',
    posterSource: image.crazyarcade,
    wordmarkSource: image.crazyarcadeLetter,
  },
  {
    id: 'maskSinger',
    title: '복면가왕',
    description: '복면을 쓴 프로들의 대결! 과연 누가 우승할 것 인가?',
    posterSource: image.maskSinger,
    wordmarkSource: image.maskSingerLetter,
  },
   {
    id: 'executive',
    title: '임원전 철권',
    description: '복면을 쓴 프로들의 대결! 과연 누가 우승할 것 인가?',
    posterSource: image.executive,
    wordmarkSource: image.executiveLetter,
  }
];

type GameApiItem = {
  gameId?: number;
  gameTitle?: string;
  matchType?: string;
};

type GamesApiResponse = {
  code?: string;
  data?: GameApiItem[];
  message?: string;
  success?: boolean;
};

type GameDetailApiResponse = {
  data?: {
    gameId?: number;
    gameTitle?: string;
    matchType?: string;
    matches?: Array<{
      matchId?: number;
      matchName?: string;
      matchStatus?: string;
      roundName?: string;
    }>;
  };
  message?: string;
  success?: boolean;
};

type MatchDetailApiResponse = {
  data?: {
    matchStatus?: string;
    matchType?: string;
    participants?: PredictionParticipant[];
    pickedParticipant?: {
      participantId?: number;
      participantName?: string;
      name?: string;
    } | null;
    pickedParticipantId?: number | null;
  };
  message?: string;
  success?: boolean;
};

type MatchOverviewApiResponse = {
  data?: {
    matchStatus?: string;
    matchType?: string;
    participants?: PredictionParticipant[];
    pickedParticipant?: {
      participantId?: number;
      participantName?: string;
      name?: string;
    } | null;
    pickedParticipantId?: number | null;
  };
  message?: string;
  success?: boolean;
};

type PredictionParticipant = {
  participantId?: number;
  participantName?: string;
  name?: string;
  predictionPercentage?: number | string | null;
  predictionPercent?: number | string | null;
  predictionRate?: number | string | null;
  predictionRatio?: number | string | null;
  rate?: number | string | null;
  ratio?: number | string | null;
  votePercentage?: number | string | null;
  voteRate?: number | string | null;
  voteRatio?: number | string | null;
};

const tabs = [
  {id: 'prediction', label: '승부예측'},
  {id: 'participated', label: '예측현황'},
] as const;

type PredictionTabId = (typeof tabs)[number]['id'];

function getFallbackCardByTitle(gameTitle: string): PredictionCardItem {
  if (gameTitle.includes('복면')) {
    return fallbackPredictionCards[3];
  }

  if (gameTitle.includes('임원전') || gameTitle.includes('임원')) {
    return fallbackPredictionCards[4];
  }

  if (gameTitle.includes('철권')) {
    return fallbackPredictionCards[0];
  }

  if (gameTitle.includes('스타')) {
    return fallbackPredictionCards[1];
  }

  if (gameTitle.includes('크레이지') || gameTitle.includes('아케이드')) {
    return fallbackPredictionCards[2];
  }

  return fallbackPredictionCards[0];
}

function toPredictionCard(game: GameApiItem): PredictionCardItem | null {
  if (typeof game.gameId !== 'number' || !game.gameTitle?.trim()) {
    return null;
  }

  const gameTitle = game.gameTitle.trim();
  const fallbackCard =
    game.gameId === MASK_SINGER_GAME_ID
      ? fallbackPredictionCards[3]
      : game.gameId === EXECUTIVE_GAME_ID
      ? fallbackPredictionCards[4]
      : getFallbackCardByTitle(gameTitle);
    
  return {
    ...fallbackCard,
    gameId: game.gameId,
    id: String(game.gameId),
    title: gameTitle,
  };
}

type ParticipatedPrediction = {
  gameId: number;
  id: string;
  matchId: number;
  matchName: string;
  matchStatus?: string;
  matchType?: string;
  roundName: string;
  selectedParticipantId: number;
  selectedTeam: string;
  segments: Array<{
    id: string;
    name: string;
    rate: number;
    tone: string;
  }>;
  status: string;
  title: string;
};

function normalizeMatchStatus(value: unknown): string {
  return typeof value === 'string' ? value.trim().toUpperCase() : 'UNKNOWN';
}

function getParticipatedStatusLabel(status: string): string {
  const normalizedStatus = normalizeMatchStatus(status);

  if (normalizedStatus === 'FINISHED') {
    return '결과 공개';
  }

  if (normalizedStatus === 'COUNTING') {
    return '집계중';
  }

  return '참여 완료';
}

function toFiniteNumber(value: unknown): number | null {
  const numericValue = typeof value === 'string' ? Number(value.trim().replace(/%$/, '')) : value;

  if (typeof numericValue !== 'number' || !Number.isFinite(numericValue)) {
    return null;
  }

  return numericValue;
}

function clampRate(value: number): number {
  return Math.round(Math.max(0, Math.min(100, value)) * 10) / 10;
}

function toRateFromParticipant(participant: PredictionParticipant): number {
  const rateCandidate =
    participant.predictionRate ??
    participant.predictionPercent ??
    participant.predictionPercentage ??
    participant.voteRate ??
    participant.votePercentage ??
    participant.rate;
  const numericRate = toFiniteNumber(rateCandidate);

  if (numericRate !== null) {
    return clampRate(numericRate);
  }

  const ratioCandidate = participant.predictionRatio ?? participant.voteRatio ?? participant.ratio;
  const numericRatio = toFiniteNumber(ratioCandidate);

  if (numericRatio !== null) {
    return clampRate(numericRatio <= 1 ? numericRatio * 100 : numericRatio);
  }

  return 0;
}

function getParticipantDisplayName(participant: Pick<PredictionParticipant, 'name' | 'participantName'>): string | null {
  const displayName = participant.participantName?.trim() || participant.name?.trim() || '';
  const hasVisibleName = displayName.replace(/[\s()[\]{}]/g, '').length > 0;

  return hasVisibleName ? displayName : null;
}

function isExecutiveParticipatedGame(game: NonNullable<GameDetailApiResponse['data']>): boolean {
  const gameTitle = game.gameTitle?.trim() ?? '';
  return game.gameId === EXECUTIVE_GAME_ID || gameTitle.includes('임원');
}

function canShowCountingForParticipatedPrediction(item: Pick<ParticipatedPrediction, 'gameId' | 'title'>): boolean {
  return item.gameId === MASK_SINGER_GAME_ID || item.title.includes('복면');
}

function isMaskSingerPredictionCard(card: Pick<PredictionCardItem, 'gameId' | 'id' | 'title'>): boolean {
  return card.gameId === MASK_SINGER_GAME_ID || card.id === 'maskSinger' || card.title.includes('복면');
}

function isExecutivePredictionCard(card: Pick<PredictionCardItem, 'gameId' | 'id' | 'title'>): boolean {
  return card.gameId === EXECUTIVE_GAME_ID || card.id === 'executive' || card.title.includes('임원');
}

function getParticipatedDetailStartStep(item: ParticipatedPrediction): 'counting' | 'result' {
  if (normalizeMatchStatus(item.matchStatus) === 'FINISHED') {
    return 'result';
  }

  return canShowCountingForParticipatedPrediction(item) ? 'counting' : 'result';
}

function getPickedParticipantId(data: MatchDetailApiResponse['data']): number | null {
  const pickedParticipantId = data?.pickedParticipantId ?? data?.pickedParticipant?.participantId;
  return typeof pickedParticipantId === 'number' ? pickedParticipantId : null;
}

function toParticipatedPrediction(
  game: NonNullable<GameDetailApiResponse['data']>,
  match: NonNullable<NonNullable<GameDetailApiResponse['data']>['matches']>[number],
  detail: MatchDetailApiResponse['data'],
  overview?: MatchOverviewApiResponse['data'],
): ParticipatedPrediction | null {
  if (typeof game.gameId !== 'number' || typeof match.matchId !== 'number') {
    return null;
  }

  const pickedParticipantId = getPickedParticipantId(overview) ?? getPickedParticipantId(detail);

  if (pickedParticipantId === null) {
    return null;
  }

  const rawParticipants = overview?.participants?.length ? overview.participants : detail?.participants ?? [];
  const shouldHideNamelessParticipants = isExecutiveParticipatedGame(game);
  const participants = shouldHideNamelessParticipants
    ? rawParticipants.filter(participant => Boolean(getParticipantDisplayName(participant)))
    : rawParticipants;
  const pickedParticipant =
    rawParticipants.find(participant => participant.participantId === pickedParticipantId) ??
    overview?.pickedParticipant ??
    detail?.pickedParticipant;
  const selectedTeam =
    (pickedParticipant ? getParticipantDisplayName(pickedParticipant) : null) ??
    (shouldHideNamelessParticipants ? '선택 완료' : `참가자 ${pickedParticipantId}`);
  const segments = participants.map((participant, index) => ({
    id: String(participant.participantId ?? index),
    name: getParticipantDisplayName(participant) ?? `참가자 ${index + 1}`,
    rate: toRateFromParticipant(participant),
    tone: participantTones[index % participantTones.length],
  }));
  const matchStatus = overview?.matchStatus ?? detail?.matchStatus ?? match.matchStatus;

  return {
    gameId: game.gameId,
    id: `${game.gameId}-${match.matchId}`,
    matchId: match.matchId,
    matchName: match.matchName?.trim() || '경기',
    matchStatus,
    matchType: overview?.matchType ?? detail?.matchType ?? game.matchType,
    roundName: match.roundName?.trim() || '라운드',
    selectedParticipantId: pickedParticipantId,
    selectedTeam,
    segments,
    status: getParticipatedStatusLabel(matchStatus ?? ''),
    title: game.gameTitle?.trim() || '승부예측',
  };
}

function PredictionCard({
  card,
  disabled,
  index,
  onPress,
}: {
  card: PredictionCardItem;
  disabled?: boolean;
  index: number;
  onPress: () => void;
}): JSX.Element {
  const entranceProgress = useRef(new Animated.Value(0)).current;
  const translateY = entranceProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [18, 0],
  });

  useEffect(() => {
    entranceProgress.setValue(0);

    Animated.timing(entranceProgress, {
      toValue: 1,
      delay: index * 58,
      duration: 260,
      useNativeDriver: true,
    }).start();
  }, [entranceProgress, index]);

  return (
    <Animated.View
      style={{
        opacity: entranceProgress,
        transform: [{translateY}],
      }}>
      <AnimatedPressable
        accessibilityLabel={`${card.title} 예측하기`}
        accessibilityRole="button"
        disabled={disabled}
        onPress={onPress}
        style={[styles.card, disabled && styles.cardDisabled]}>
        <Image source={card.posterSource} resizeMode="cover" style={styles.cardImage} />

        <View style={styles.cardContent}>
          <Image
            source={card.wordmarkSource}
            resizeMode="contain"
            style={[styles.cardWordmark, isMaskSingerPredictionCard(card) && styles.maskSingerCardWordmark, isExecutivePredictionCard(card) && styles.executiveCardWordmark]}
          />
          <Text style={styles.cardTitle}>{card.title}</Text>
          <Text numberOfLines={2} style={styles.cardDescription}>
            {card.description}
          </Text>

          <View style={[styles.predictButton, disabled && styles.predictButtonDisabled]}>
            <Text style={[styles.predictButtonText, disabled && styles.predictButtonTextDisabled]}>
              {disabled ? '준비 중' : '예측하기'}
            </Text>
          </View>
        </View>
      </AnimatedPressable>
    </Animated.View>
  );
}

function ParticipatedPredictionCard({
  index,
  isActive,
  item,
  onDetailPress,
  onPress,
}: {
  index: number;
  isActive: boolean;
  item: ParticipatedPrediction;
  onDetailPress: () => void;
  onPress: () => void;
}): JSX.Element {
  const entranceProgress = useRef(new Animated.Value(0)).current;
  const liftProgress = useRef(new Animated.Value(isActive ? 1 : 0)).current;
  const hasRate = item.segments.some(segment => segment.rate > 0);
  const getSegmentStyle = (segment: ParticipatedPrediction['segments'][number]) => [
    styles.participatedGraphSegment,
    {
      backgroundColor: segment.tone,
      flex: hasRate ? Math.max(segment.rate, 0.001) : 1,
    },
  ];
  const entranceTranslateY = entranceProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [16, 0],
  });

  useEffect(() => {
    entranceProgress.setValue(0);

    Animated.timing(entranceProgress, {
      toValue: 1,
      delay: index * 58,
      duration: 260,
      useNativeDriver: true,
    }).start();
  }, [entranceProgress, index]);

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
          opacity: entranceProgress,
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
            {translateY: entranceTranslateY},
          ],
        },
      ]}>
      <AnimatedPressable onPress={onPress} style={[styles.participatedCard, isActive && styles.participatedCardActive]}>
        <View style={styles.participatedHeader}>
          <View>
            <Text style={styles.participatedTitle}>{item.title}</Text>
            <Text style={[styles.participatedStatus, styles.participatedStatusDone]}>{item.status}</Text>
          </View>
          <View style={styles.selectedTeamBadge}>
            <Text style={styles.selectedTeamBadgeText}>{item.selectedTeam}</Text>
          </View>
        </View>

        <View style={styles.predictionSummaryRow}>
          <Text style={styles.predictionSummaryLabel}>내 선택</Text>
          <Text style={styles.predictionSummaryValue}>{item.selectedTeam}</Text>
        </View>

        <Text style={styles.participatedMatchName}>
          {item.roundName} · {item.matchName}
        </Text>

        <View style={styles.participatedGraph}>
          {item.segments.length ? (
            item.segments.map(segment => <View key={segment.id} style={getSegmentStyle(segment)} />)
          ) : (
            <View style={[styles.participatedGraphSegment, styles.participatedGraphSegmentEmpty]} />
          )}
        </View>
        <View style={styles.participatedRatioRow}>
          {item.segments.slice(0, 3).map(segment => (
            <Text key={segment.id} numberOfLines={1} style={styles.participatedRatioText}>
              {segment.name} {segment.rate}%
            </Text>
          ))}
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
            <AnimatedPressable accessibilityRole="button" onPress={onDetailPress} style={styles.detailButton}>
              <Text style={styles.detailButtonText}>상세보기</Text>
            </AnimatedPressable>
          </Animated.View>
        ) : null}
      </AnimatedPressable>
    </Animated.View>
  );
}

export function PredictionScreen(): JSX.Element {
  const navigation = useNavigation<NativeStackNavigationProp<PredictionStackParamList>>();
  const {auth} = useAuth();
  const scrollY = useRef(new Animated.Value(0)).current;
  const scrollRef = useRef<ScrollView | null>(null);
  const tabContentProgress = useRef(new Animated.Value(1)).current;
  const participatedTabRefreshInFlightRef = useRef(false);
  const [activeTab, setActiveTab] = useState<PredictionTabId>('prediction');
  const [activePredictionId, setActivePredictionId] = useState<string | null>(null);
  const [predictionCards, setPredictionCards] = useState<PredictionCardItem[]>([]);
  const [participatedPredictions, setParticipatedPredictions] = useState<ParticipatedPrediction[]>([]);
  const [isGamesLoading, setIsGamesLoading] = useState(true);
  const [isParticipatedLoading, setIsParticipatedLoading] = useState(true);
  const [isRefreshingPrediction, setIsRefreshingPrediction] = useState(false);
  const [gamesErrorMessage, setGamesErrorMessage] = useState<string | null>(null);
  const [participatedErrorMessage, setParticipatedErrorMessage] = useState<string | null>(null);
  const tabContentTranslateY = tabContentProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [14, 0],
  });

  useEffect(() => {
    tabContentProgress.setValue(0);

    Animated.timing(tabContentProgress, {
      toValue: 1,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [activeTab, tabContentProgress]);

  const fetchPredictionData = useCallback(async (showLoading = true) => {
    const accessToken = auth?.accessToken;

    if (!accessToken) {
      setIsGamesLoading(false);
      setIsParticipatedLoading(false);
      return;
    }

    if (showLoading) {
      setIsGamesLoading(true);
      setIsParticipatedLoading(true);
    }

    setGamesErrorMessage(null);
    setParticipatedErrorMessage(null);

    try {
      const response = await withMinimumLoadingTime(
        fetch(`${API_BASE}/api/festivals/${PREDICTION_FESTIVAL_ID}/games`, {
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
        }),
      );
      const responseText = await response.text();
      let responseBody: GamesApiResponse | null = null;

      try {
        responseBody = JSON.parse(responseText) as GamesApiResponse;
      } catch {
        throw new Error('게임 목록 응답을 해석하지 못했습니다.');
      }

      if (!response.ok || responseBody.success === false) {
        throw new Error(responseBody.message || '게임 목록 조회에 실패했습니다.');
      }

      const gamesWithId = (responseBody.data ?? []).filter(
        (game): game is GameApiItem & {gameId: number} => typeof game.gameId === 'number',
      );
      const nextCards = (responseBody.data ?? [])
        .map(toPredictionCard)
        .filter((card): card is PredictionCardItem => Boolean(card));

      setPredictionCards(nextCards);

      const gameDetailResults = await Promise.allSettled(
        gamesWithId.map(async game => {
          const gameDetailResponse = await fetch(
            `${API_BASE}/api/festivals/${PREDICTION_FESTIVAL_ID}/games/${game.gameId}`,
            {
              headers: {
                Accept: 'application/json',
                Authorization: `Bearer ${accessToken}`,
              },
            },
          );
          const gameDetailBody = (await gameDetailResponse.json()) as GameDetailApiResponse;

          if (!gameDetailResponse.ok || gameDetailBody.success === false || !gameDetailBody.data) {
            throw new Error(gameDetailBody.message || '게임 상세 조회에 실패했습니다.');
          }

          return {
            detail: gameDetailBody.data,
            game,
          };
        }),
      );
      const validGameDetails = gameDetailResults
        .filter(
          (
            result,
          ): result is PromiseFulfilledResult<{
            detail: NonNullable<GameDetailApiResponse['data']>;
            game: GameApiItem & {gameId: number};
          }> => result.status === 'fulfilled',
        )
        .map(result => result.value);

      gameDetailResults.forEach((result, index) => {
        if (result.status === 'rejected') {
          console.log('[PredictionScreen] skipped participated game detail', {
            error: result.reason,
            gameId: gamesWithId[index]?.gameId,
          });
        }
      });

      const participatedResults = await Promise.allSettled(
        validGameDetails.map(async ({detail: gameDetail, game}) => {
          const matchResults = await Promise.allSettled(
            (gameDetail.matches ?? [])
              .filter(match => typeof match.matchId === 'number')
              .map(async match => {
                const matchDetailResponse = await fetch(
                  `${API_BASE}/api/festivals/${PREDICTION_FESTIVAL_ID}/games/${game.gameId}/matches/${match.matchId}`,
                  {
                    headers: {
                      Accept: 'application/json',
                      Authorization: `Bearer ${accessToken}`,
                    },
                  },
                );
                const matchDetailBody = (await matchDetailResponse.json()) as MatchDetailApiResponse;

                if (!matchDetailResponse.ok || matchDetailBody.success === false) {
                  throw new Error(matchDetailBody.message || '경기 상세 조회에 실패했습니다.');
                }

                let overviewData: MatchOverviewApiResponse['data'] | undefined;

                try {
                  const matchOverviewResponse = await fetch(
                    `${API_BASE}/api/festivals/${PREDICTION_FESTIVAL_ID}/games/${game.gameId}/matches/${match.matchId}/overview`,
                    {
                      headers: {
                        Accept: 'application/json',
                        Authorization: `Bearer ${accessToken}`,
                      },
                    },
                  );
                  const matchOverviewBody = (await matchOverviewResponse.json()) as MatchOverviewApiResponse;

                  if (matchOverviewResponse.ok && matchOverviewBody.success !== false) {
                    overviewData = matchOverviewBody.data;
                  }
                } catch (error) {
                  console.log('[PredictionScreen] match overview request failed', {
                    error,
                    gameId: game.gameId,
                    matchId: match.matchId,
                  });
                }

                return toParticipatedPrediction(gameDetail, match, matchDetailBody.data, overviewData);
              }),
          );

          return matchResults
            .filter(
              (result): result is PromiseFulfilledResult<ParticipatedPrediction | null> =>
                result.status === 'fulfilled',
            )
            .map(result => result.value)
            .filter((item): item is ParticipatedPrediction => Boolean(item));
        }),
      );

      const nextParticipatedPredictions = participatedResults
        .filter((result): result is PromiseFulfilledResult<ParticipatedPrediction[]> => result.status === 'fulfilled')
        .flatMap(result => result.value);

      setParticipatedPredictions(nextParticipatedPredictions);
    } catch (error) {
      console.log('[PredictionScreen] games request failed', error);

      if (showLoading) {
          setPredictionCards([]);
          setParticipatedPredictions([]);
      }

      setGamesErrorMessage(error instanceof Error ? error.message : '게임 목록 조회에 실패했습니다.');
      setParticipatedErrorMessage('예측현황을 불러오지 못했습니다.');
    } finally {
      if (showLoading) {
        setIsGamesLoading(false);
        setIsParticipatedLoading(false);
      }
    }
  }, [auth?.accessToken]);

  useEffect(() => {
    fetchPredictionData().catch(error => {
      console.log('[PredictionScreen] games effect failed', error);
    });
  }, [fetchPredictionData]);

  const handlePredictionRefresh = useCallback(async () => {
    if (isRefreshingPrediction) {
      return;
    }

    setIsRefreshingPrediction(true);

    try {
      await fetchPredictionData(false);
    } finally {
      setIsRefreshingPrediction(false);
    }
  }, [fetchPredictionData, isRefreshingPrediction]);

  const handleTabPress = useCallback(
    (nextTab: PredictionTabId) => {
      setActiveTab(nextTab);

      if (nextTab !== 'participated' || participatedTabRefreshInFlightRef.current) {
        return;
      }

      participatedTabRefreshInFlightRef.current = true;
      fetchPredictionData(false)
        .catch(error => {
          console.log('[PredictionScreen] participated tab refresh failed', error);
        })
        .finally(() => {
          participatedTabRefreshInFlightRef.current = false;
        });
    },
    [fetchPredictionData],
  );

  useEffect(() => {
    return registerScrollToTopHandler('Prediction', () => {
      scrollRef.current?.scrollTo({animated: true, y: 0});
    });
  }, []);

  const handlePredictionPress = (card: PredictionCardItem) => {
    if (typeof card.gameId !== 'number') {
      return;
    }

    navigation.navigate('PredictionSelect', {
      gameId: card.gameId,
      gameTitle: card.title,
    });
  };

  return (
    <TabSceneTransition>
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="light-content" backgroundColor="#000000" />

        <AppGnb scrollY={scrollY} />

        <Animated.ScrollView
          ref={scrollRef}
          bounces
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl
              colors={['#E50914']}
              progressBackgroundColor="#151519"
              refreshing={isRefreshingPrediction}
              tintColor="#FFFFFF"
              onRefresh={handlePredictionRefresh}
            />
          }
          showsVerticalScrollIndicator={false}
          onScroll={Animated.event([{nativeEvent: {contentOffset: {y: scrollY}}}], {useNativeDriver: true})}
          scrollEventThrottle={16}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>승부예측</Text>
          </View>

          <View style={styles.tabRow}>
            <SlidingSegmentedTabs activeTab={activeTab} onTabPress={handleTabPress} tabs={tabs} />
          </View>

          <SwipeableTabView activeTab={activeTab} onTabPress={handleTabPress} tabs={tabs}>
            <Animated.View
              style={{
                opacity: tabContentProgress,
                transform: [{translateY: tabContentTranslateY}],
              }}>
              {activeTab === 'prediction' ? (
                <View style={styles.cardStack}>
                  {isGamesLoading ? (
                    <View style={styles.loadingCenterState}>
                      <AppLoading label="게임 목록을 불러오는 중..." />
                    </View>
                  ) : predictionCards.length ? (
                    predictionCards.map((card, index) => (
                      <PredictionCard
                        key={card.id}
                        card={card}
                        disabled={typeof card.gameId !== 'number'}
                        index={index}
                        onPress={() => handlePredictionPress(card)}
                      />
                    ))
                  ) : (
                    <View style={styles.emptyCenterState}>
                      <Text style={styles.emptyText}>{gamesErrorMessage ?? '예측 가능한 게임이 없습니다.'}</Text>
                    </View>
                  )}
                </View>
              ) : (
                <View style={styles.participatedStack}>
                  {isParticipatedLoading ? (
                    <View style={styles.loadingCenterState}>
                      <AppLoading label="예측현황을 불러오는 중..." />
                    </View>
                  ) : participatedPredictions.length ? (
                    participatedPredictions.map((item, index) => (
                      <ParticipatedPredictionCard
                        key={item.id}
                        index={index}
                        item={item}
                        isActive={activePredictionId === item.id}
                        onPress={() => setActivePredictionId(item.id)}
                        onDetailPress={() =>
                          navigation.navigate('PredictionDetail', {
                            gameId: item.gameId,
                            gameTitle: item.title,
                            matchId: item.matchId,
                            matchStatus: item.matchStatus,
                            matchType: item.matchType,
                            pickedParticipantId: item.selectedParticipantId,
                            startStep: getParticipatedDetailStartStep(item),
                          })
                        }
                      />
                    ))
                  ) : (
                    <View style={styles.emptyCenterState}>
                      <Text style={styles.emptyText}>{participatedErrorMessage ?? '참여한 예측이 없습니다.'}</Text>
                    </View>
                  )}
                </View>
              )}
            </Animated.View>
          </SwipeableTabView>
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
    paddingHorizontal: 20,
    marginBottom: 22,
  },
  cardStack: {
    paddingHorizontal: 20,
    gap: 20,
  },
  loadingCenterState: {
    minHeight: 420,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: '#8A8D95',
    textAlign: 'center',
    ...FONTS.font14M,
    lineHeight: 19,
  },
  emptyCenterState: {
    minHeight: 360,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    borderWidth: 1,
    borderColor: '#2A2A2F',
    borderRadius: 12,
    overflow: 'hidden',
    paddingBottom: 16,
    backgroundColor: '#141416',
  },
  cardDisabled: {
    opacity: 0.62,
  },
  cardImage: {
    width: '100%',
    height: 200,
    backgroundColor: '#252525',
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
  maskSingerCardWordmark: {
    width: 78,
    height: 42,
    marginTop: -4,
  },
  executiveCardWordmark: {
    width: 128,
    height: 42,
    marginTop: -4,
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
    width: 126,
    height: 38,
    borderRadius: 6,
    backgroundColor: '#E50914',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  predictButtonDisabled: {
    backgroundColor: '#3A3B40',
  },
  predictButtonText: {
    color: '#FFFFFF',
    ...FONTS.font14B,
    lineHeight: 24,
  },
  predictButtonTextDisabled: {
    color: '#9A9DA6',
  },
  participatedStack: {
    paddingHorizontal: 20,
    gap: 12,
  },
  participatedCardLift: {
    borderRadius: 12,
  },
  participatedCardLiftActive: {
    zIndex: 3,
    shadowColor: '#E50914',
    shadowOpacity: 0.14,
    shadowRadius: 12,
    shadowOffset: {width: 0, height: 6},
    elevation: 4,
  },
  participatedCard: {
    borderRadius: 12,
    padding: 16,
    backgroundColor: '#141416',
    borderWidth: 1,
    borderColor: '#2A2A2F',
  },
  participatedCardActive: {
    borderWidth: 1,
    borderColor: '#E50914',
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
    color: '#E50914',
  },
  selectedTeamBadge: {
    minHeight: 26,
    borderRadius: 13,
    paddingHorizontal: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(229,9,20,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(229,9,20,0.42)',
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
  participatedMatchName: {
    marginTop: 10,
    color: '#A9ABB2',
    ...FONTS.font12M,
    lineHeight: 16,
  },
  participatedGraph: {
    height: 8,
    marginTop: 14,
    borderRadius: 4,
    flexDirection: 'row',
    overflow: 'hidden',
    backgroundColor: '#242428',
  },
  participatedGraphSegment: {
    minWidth: 2,
  },
  participatedGraphSegmentEmpty: {
    flex: 1,
    backgroundColor: '#3A3B40',
  },
  participatedRatioRow: {
    marginTop: 8,
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  participatedRatioText: {
    flex: 1,
    color: '#A9ABB2',
    ...FONTS.font12M,
    lineHeight: 16,
  },
  cardDetailActionWrap: {
    marginTop: 16,
  },
  detailButton: {
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E50914',
  },
  detailButtonText: {
    color: '#FFFFFF',
    ...FONTS.font14B,
    lineHeight: 18,
  },
});
