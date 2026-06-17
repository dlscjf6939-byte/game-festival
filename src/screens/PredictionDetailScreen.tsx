import React, {useCallback, useEffect, useRef, useState} from 'react';
import {useFocusEffect, useNavigation, useRoute, type RouteProp} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import LottieView from 'lottie-react-native';
import {
  Alert,
  Animated,
  Easing,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ImageSourcePropType,
} from 'react-native';
import {AnimatedPressable} from '../components/AnimatedPressable';
import {AppLoading} from '../components/AppLoading';
import {AppGnb} from '../components/AppGnb';
import {TabSceneTransition} from '../components/TabSceneTransition';
import {useAuth} from '../auth/AuthProvider';
import {image} from '../assets/images';
import {icon} from '../assets/icons';
import {logo} from '../assets/logo';
import type {PredictionStackParamList} from '../navigation/types';
import {FONTS} from '../constants/theme';
import {withMinimumLoadingTime} from '../utils/loading';
import {getProfileImageUriFromRecord} from '../utils/profileImage';

const API_BASE = 'http://121.254.240.93:8090';
const PREDICTION_FESTIVAL_ID = 3;
const MASK_SINGER_GAME_ID = 86;
const countingLottie = require('../assets/lotties/Counting.json');

const teams = [
  {
    id: 'team-red',
    imageSource: logo.boongkwon,
    members: ['이인철', '김아랑', '정현석'],
    name: '전국붕권노동조합총연맹',
    tone: '#E50914',
  },
  {
    id: 'team-black',
    imageSource: logo.gwantaekdong,
    members: ['서현택', '김정관', '황동익'],
    name: '관택동',
    tone: '#8A8D95',
  },
] as const;

type TeamId = (typeof teams)[number]['id'];
type PredictionStep = 'select' | 'comment' | 'counting' | 'result';

type PredictionTeam = {
  id: TeamId;
  imageSource: ImageSourcePropType;
  members: string[];
  name: string;
  participantId?: number;
  predictionRate?: number;
  tone: string;
};

type GameDetailMatch = {
  matchId: number;
  matchName: string;
  matchStatus: string;
  participantCount: number;
  roundName: string;
  scheduledAt: string;
};

type GameDetail = {
  gameId: number;
  gameTitle: string;
  gameType?: string;
  matchType?: string;
  matches: GameDetailMatch[];
};

type GameDetailApiResponse = {
  code?: string;
  data?: {
    gameId?: number;
    gameTitle?: string;
    gameType?: string;
    matchType?: string;
    matches?: Array<{
      matchId?: number;
      matchName?: string;
      matchStatus?: string;
      participantCount?: number;
      roundName?: string;
      scheduledAt?: string;
    }>;
  };
  message?: string;
  success?: boolean;
};

type MatchDetailApiResponse = {
  data?: {
    matchStatus?: string;
    matchName?: string;
    participants?: Array<{
      logoImageUrl?: string;
      participantName?: string;
      participantId?: number;
      name?: string;
      predictionRate?: number;
      participantType?: string;
      participantMembers?: Array<{
        nickname?: string;
      }>;
    }>;
    pickedParticipant?: {
      logoImageUrl?: string;
      participantId?: number;
      name?: string;
      participantType?: string;
    } | null;
    pickedParticipantId?: number | null;
    roundName?: string;
  };
  message?: string;
  success?: boolean;
};

type MatchOverviewApiResponse = {
  data?: {
    comments?: Array<{
      comment?: string;
      elapsedTime?: string;
      pickedParticipant?: {
        participantId?: number;
        participantName?: string;
      };
      predictionId?: number;
      writer?: {
        department?: string;
        employeeId?: number;
        employeeName?: string;
        profileImageUrl?: string | null;
      };
    }>;
    gameId?: number;
    gameName?: string;
    matchId?: number;
    matchName?: string;
    matchStatus?: string;
    matchType?: string;
    participants?: Array<{
      logoImageUrl?: string;
      participantId?: number;
      participantName?: string;
      participantType?: string;
      predictionRate?: number;
    }>;
    pickedParticipant?: {
      participantId?: number;
      participantName?: string;
    } | null;
  };
  message?: string;
  success?: boolean;
};

type PredictionSubmitResponse = {
  message?: string;
  success?: boolean;
};

type CheerComment = {
  id: string;
  avatar: ImageSourcePropType;
  isMine?: boolean;
  name: string;
  teamId: TeamId;
  text: string;
  time: string;
};

function getTeamIdFromParticipantType(participantType: string | undefined, fallbackIndex = 0): TeamId {
  if (participantType === 'TEAM_BLUE') {
    return 'team-black';
  }

  if (participantType === 'TEAM_RED') {
    return 'team-red';
  }

  return fallbackIndex === 1 ? 'team-black' : 'team-red';
}

function toPredictionRate(value: unknown): number | undefined {
  const numericValue = typeof value === 'string' ? Number(value) : value;

  if (typeof numericValue !== 'number' || !Number.isFinite(numericValue)) {
    return undefined;
  }

  return Math.max(0, Math.min(100, numericValue));
}

function normalizeMatchStatus(value: unknown): string {
  return typeof value === 'string' ? value.trim().toUpperCase() : 'READY';
}

function getInitialPredictionStep(
  startStep: PredictionStep | undefined,
  matchStatus: unknown,
  isMaskSingerGame: boolean,
): PredictionStep {
  if (startStep === 'comment' || startStep === 'counting' || startStep === 'result') {
    return startStep;
  }

  if (!isMaskSingerGame) {
    return 'select';
  }

  const normalizedStatus = normalizeMatchStatus(matchStatus);

  if (normalizedStatus === 'COUNTING') {
    return 'counting';
  }

  if (normalizedStatus === 'FINISHED') {
    return 'result';
  }

  return 'select';
}

function toGameDetail(data: GameDetailApiResponse['data']): GameDetail | null {
  if (!data || typeof data.gameId !== 'number' || !data.gameTitle?.trim()) {
    return null;
  }

  const matches = (data.matches ?? [])
    .filter(
      (match): match is Required<Pick<GameDetailMatch, 'matchId'>> & Partial<GameDetailMatch> =>
        typeof match.matchId === 'number',
    )
    .map(match => ({
      matchId: match.matchId,
      matchName: match.matchName?.trim() || '경기',
      matchStatus: match.matchStatus?.trim() || 'UNKNOWN',
      participantCount: typeof match.participantCount === 'number' ? match.participantCount : 0,
      roundName: match.roundName?.trim() || '라운드',
      scheduledAt: match.scheduledAt?.trim() || '',
    }));

  return {
    gameId: data.gameId,
    gameTitle: data.gameTitle.trim(),
    gameType: data.gameType,
    matchType: data.matchType,
    matches,
  };
}

function toPredictionTeam(
  participant: NonNullable<NonNullable<MatchDetailApiResponse['data']>['participants']>[number],
  index = 0,
): PredictionTeam | null {
  if (typeof participant.participantId !== 'number') {
    return null;
  }

  const teamId = getTeamIdFromParticipantType(participant.participantType, index);
  const fallbackTeam = teamId === 'team-red' ? teams[0] : teams[1];
  const logoImageUrl = participant.logoImageUrl?.trim();

  return {
    id: fallbackTeam.id,
    imageSource: logoImageUrl ? {uri: logoImageUrl} : fallbackTeam.imageSource,
    members: (participant.participantMembers ?? [])
      .map(member => member.nickname?.trim())
      .filter((nickname): nickname is string => Boolean(nickname)),
    name: participant.participantName?.trim() || participant.name?.trim() || `참가팀 ${index + 1}`,
    participantId: participant.participantId,
    predictionRate: toPredictionRate(participant.predictionRate),
    tone: fallbackTeam.tone,
  };
}

function toCheerComment(
  comment: NonNullable<NonNullable<MatchOverviewApiResponse['data']>['comments']>[number],
  index: number,
  predictionTeams: PredictionTeam[],
  myEmployeeId?: number | string,
  myName?: string,
): CheerComment | null {
  const text = comment.comment?.trim();

  if (!text) {
    return null;
  }

  const participantId = comment.pickedParticipant?.participantId;
  const matchedTeam = predictionTeams.find(team => team.participantId === participantId);
  const writerName = comment.writer?.employeeName?.trim() || '익명';
  const writerEmployeeId = comment.writer?.employeeId;
  const isMineById =
    writerEmployeeId !== undefined && myEmployeeId !== undefined && String(writerEmployeeId) === String(myEmployeeId);
  const isMineByName = Boolean(writerName && myName && writerName === myName);
  const profileImageUrl = comment.writer?.profileImageUrl?.trim();

  return {
    avatar: profileImageUrl ? {uri: profileImageUrl} : image.profile,
    id: comment.predictionId !== undefined ? String(comment.predictionId) : `cheer-${index}`,
    isMine: isMineById || isMineByName,
    name: writerName,
    teamId: matchedTeam?.id ?? 'team-red',
    text,
    time: comment.elapsedTime?.trim() || '방금 전',
  };
}

export function PredictionDetailScreen(): JSX.Element {
  const navigation = useNavigation<NativeStackNavigationProp<PredictionStackParamList>>();
  const route = useRoute<RouteProp<PredictionStackParamList, 'PredictionDetail'>>();
  const {auth, refreshProfile} = useAuth();
  const routeGameId = route.params?.gameId;
  const routeGameTitle = route.params?.gameTitle;
  const routeMatchId = route.params?.matchId;
  const isMaskSingerGame = routeGameId === MASK_SINGER_GAME_ID;
  const profileImageUri = getProfileImageUriFromRecord(auth?.profile);
  const myAvatarSource = profileImageUri ? {uri: profileImageUri} : image.profile;
  const myName = auth?.name ?? '이인철';
  const initialSelectedTeam = route.params?.selectedTeamId ?? 'team-red';
  const isParticipatedDetail = route.params?.mode === 'participated';
  const [step, setStep] = useState<PredictionStep>(() =>
    getInitialPredictionStep(route.params?.startStep, route.params?.matchStatus, isMaskSingerGame),
  );
  const [selectedTeam, setSelectedTeam] = useState<TeamId>(initialSelectedTeam);
  const [matchStatus, setMatchStatus] = useState(() => normalizeMatchStatus(route.params?.matchStatus));
  const [cheerDraft, setCheerDraft] = useState('');
  const [cheerComments, setCheerComments] = useState<CheerComment[]>([]);
  const [gameDetail, setGameDetail] = useState<GameDetail | null>(null);
  const [predictionTeams, setPredictionTeams] = useState<PredictionTeam[]>([]);
  const [isGameDetailLoading, setIsGameDetailLoading] = useState(false);
  const [isMatchDetailLoading, setIsMatchDetailLoading] = useState(false);
  const [isConfirmVisible, setIsConfirmVisible] = useState(false);
  const [isSubmittingPrediction, setIsSubmittingPrediction] = useState(false);
  const [predictionSubmitError, setPredictionSubmitError] = useState<string | null>(null);
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('응원댓글이 등록됐어요');
  const [submittedComment, setSubmittedComment] = useState<CheerComment | null>(() => {
    if (!isParticipatedDetail) {
      return null;
    }

    return {
      id: 'my-participated-cheer',
      avatar: myAvatarSource,
      isMine: true,
      name: myName,
      teamId: initialSelectedTeam,
      text: route.params?.cheerComment ?? '',
      time: '참여 완료',
    };
  });
  const stepTransition = useRef(new Animated.Value(1)).current;
  const stageIntroProgress = useRef(new Animated.Value(0)).current;
  const toastProgress = useRef(new Animated.Value(0)).current;
  const selectedTeamInfo = predictionTeams.find(team => team.id === selectedTeam) ?? null;
  const isSelectedTeamInfoPending =
    !selectedTeamInfo && (isGameDetailLoading || isMatchDetailLoading || isSubmittingPrediction || !predictionTeams.length);
  const canProceedToComment = Boolean(
    selectedTeamInfo && typeof selectedTeamInfo.participantId === 'number',
  );
  const leftTeamInfo = predictionTeams[0] ?? null;
  const rightTeamInfo = predictionTeams[1] ?? null;
  const displayGameTitle = gameDetail?.gameTitle ?? routeGameTitle ?? '경기 정보';
  const isMatchReady = matchStatus === 'READY' || matchStatus === 'SCHEDULED';
  const isMatchCounting = matchStatus === 'COUNTING';
  const displayTeamName = useCallback(
    (teamId: TeamId) => predictionTeams.find(team => team.id === teamId)?.name ?? '참가팀',
    [predictionTeams],
  );
  const redRatio = predictionTeams.find(team => team.id === 'team-red')?.predictionRate ?? 0;
  const blackRatio = predictionTeams.find(team => team.id === 'team-black')?.predictionRate ?? 0;
  const voteGraphRedFlex = redRatio > 0 || blackRatio > 0 ? redRatio : 1;
  const voteGraphBlackFlex = redRatio > 0 || blackRatio > 0 ? blackRatio : 1;
  const displayCheerComments = submittedComment
    ? [submittedComment, ...cheerComments.filter(comment => comment.id !== submittedComment.id)]
    : cheerComments;
  const stepTransitionStyle = {
    opacity: stepTransition,
    transform: [
      {
        translateY: stepTransition.interpolate({
          inputRange: [0, 1],
          outputRange: [18, 0],
        }),
      },
    ],
  };
  const leftLogoIntroStyle = {
    opacity: stageIntroProgress,
    transform: [
      {
        translateY: stageIntroProgress.interpolate({
          inputRange: [0, 1],
          outputRange: [-28, 0],
        }),
      },
      {
        scale: stageIntroProgress.interpolate({
          inputRange: [0, 0.7, 1],
          outputRange: [0.72, 1.08, 1],
        }),
      },
    ],
  };
  const rightLogoIntroStyle = {
    opacity: stageIntroProgress,
    transform: [
      {
        translateY: stageIntroProgress.interpolate({
          inputRange: [0, 1],
          outputRange: [28, 0],
        }),
      },
      {
        scale: stageIntroProgress.interpolate({
          inputRange: [0, 0.7, 1],
          outputRange: [0.72, 1.08, 1],
        }),
      },
    ],
  };
  const matchupIdleStyle = {
    opacity: 1,
  };

  const playStageIntro = useCallback(() => {
    if (step !== 'select' || !predictionTeams.length) {
      stageIntroProgress.setValue(0);
      return;
    }

    stageIntroProgress.setValue(0);
    Animated.sequence([
      Animated.delay(360),
      Animated.timing(stageIntroProgress, {
        toValue: 1,
        duration: 760,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [predictionTeams.length, stageIntroProgress, step]);

  useEffect(() => {
    playStageIntro();
  }, [playStageIntro]);

  useFocusEffect(
    useCallback(() => {
      playStageIntro();
    }, [playStageIntro]),
  );

  const fetchMatchOverview = useCallback(async (): Promise<boolean> => {
    if (!auth?.accessToken || typeof routeGameId !== 'number' || typeof routeMatchId !== 'number') {
      return false;
    }

    const response = await withMinimumLoadingTime(
      fetch(
        `${API_BASE}/api/festivals/${PREDICTION_FESTIVAL_ID}/games/${routeGameId}/matches/${routeMatchId}/overview`,
        {
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${auth.accessToken}`,
          },
        },
      ),
    );
    const responseText = await response.text();
    let responseBody: MatchOverviewApiResponse | null = null;

    try {
      responseBody = JSON.parse(responseText) as MatchOverviewApiResponse;
    } catch {
      throw new Error('승부예측 현황 응답을 해석하지 못했습니다.');
    }

    if (!response.ok || responseBody.success === false) {
      throw new Error(responseBody.message || '승부예측 현황 조회에 실패했습니다.');
    }

    const nextStatus = normalizeMatchStatus(responseBody.data?.matchStatus);

    if (responseBody.data?.matchStatus) {
      setMatchStatus(nextStatus);

      if (isMaskSingerGame && nextStatus === 'COUNTING') {
        setStep('counting');
      }

      if (isMaskSingerGame && nextStatus === 'FINISHED') {
        setStep('result');
      }
    }

    const nextTeams = (responseBody.data?.participants ?? [])
      .map((participant, index) => toPredictionTeam(participant, index))
      .filter((team): team is PredictionTeam => Boolean(team));

    if (nextTeams.length) {
      setPredictionTeams(previousTeams =>
        nextTeams.map(team => {
          const previousTeam =
            previousTeams.find(previous => previous.participantId === team.participantId) ??
            previousTeams.find(previous => previous.id === team.id);

          return {
            ...team,
            members: team.members.length ? team.members : previousTeam?.members ?? [],
            predictionRate: team.predictionRate ?? previousTeam?.predictionRate,
          };
        }),
      );
    }

    const nextComments = (responseBody.data?.comments ?? [])
      .map((comment, index) => toCheerComment(comment, index, nextTeams, auth.employeeId, auth.name))
      .filter((comment): comment is CheerComment => Boolean(comment));

    setCheerComments(nextComments);

    const pickedParticipantId = responseBody.data?.pickedParticipant?.participantId;
    const pickedTeam = nextTeams.find(team => team.participantId === pickedParticipantId);

    if (pickedTeam) {
      setSelectedTeam(pickedTeam.id);
    }

    return true;
  }, [auth?.accessToken, auth?.employeeId, auth?.name, isMaskSingerGame, routeGameId, routeMatchId]);

  useEffect(() => {
    const accessToken = auth?.accessToken;

    if (!accessToken || typeof routeGameId !== 'number') {
      return;
    }

    let isMounted = true;

    async function fetchGameDetail(): Promise<void> {
      setIsGameDetailLoading(true);

      try {
        const response = await withMinimumLoadingTime(
          fetch(`${API_BASE}/api/festivals/${PREDICTION_FESTIVAL_ID}/games/${routeGameId}`, {
            headers: {
              Accept: 'application/json',
              Authorization: `Bearer ${accessToken}`,
            },
          }),
        );
        const responseText = await response.text();
        let responseBody: GameDetailApiResponse | null = null;

        try {
          responseBody = JSON.parse(responseText) as GameDetailApiResponse;
        } catch {
          throw new Error('게임 상세 응답을 해석하지 못했습니다.');
        }

        if (!response.ok || responseBody.success === false) {
          throw new Error(responseBody.message || '게임 상세 조회에 실패했습니다.');
        }

        const nextGameDetail = toGameDetail(responseBody.data);

        if (isMounted && nextGameDetail) {
          setGameDetail(nextGameDetail);
          const currentMatch = nextGameDetail.matches.find(match => match.matchId === routeMatchId);
          const nextStatus = normalizeMatchStatus(currentMatch?.matchStatus);

          if (currentMatch) {
            setMatchStatus(nextStatus);

            if (isMaskSingerGame && nextStatus === 'COUNTING') {
              setStep('counting');
            }

            if (isMaskSingerGame && nextStatus === 'FINISHED') {
              setStep('result');
            }
          }
        }
      } catch (error) {
        console.log('[PredictionDetailScreen] game detail request failed', {error, routeGameId});
      } finally {
        if (isMounted) {
          setIsGameDetailLoading(false);
        }
      }
    }

    fetchGameDetail();

    return () => {
      isMounted = false;
    };
  }, [auth?.accessToken, isMaskSingerGame, routeGameId, routeMatchId]);

  useEffect(() => {
    const accessToken = auth?.accessToken;

    if (!accessToken || typeof routeGameId !== 'number' || typeof routeMatchId !== 'number') {
      return;
    }

    let isMounted = true;

    async function fetchMatchDetail(): Promise<void> {
      setIsMatchDetailLoading(true);

      if (!isParticipatedDetail) {
        setExpandedTeam(null);
        setPredictionTeams([]);
      }

      try {
        const response = await withMinimumLoadingTime(
          fetch(`${API_BASE}/api/festivals/${PREDICTION_FESTIVAL_ID}/games/${routeGameId}/matches/${routeMatchId}`, {
            headers: {
              Accept: 'application/json',
              Authorization: `Bearer ${accessToken}`,
            },
          }),
        );
        const responseText = await response.text();
        let responseBody: MatchDetailApiResponse | null = null;

        try {
          responseBody = JSON.parse(responseText) as MatchDetailApiResponse;
        } catch {
          throw new Error('경기 상세 응답을 해석하지 못했습니다.');
        }

        if (!response.ok || responseBody.success === false) {
          throw new Error(responseBody.message || '경기 상세 조회에 실패했습니다.');
        }

        const nextStatus = normalizeMatchStatus(responseBody.data?.matchStatus);

        if (isMounted && responseBody.data?.matchStatus) {
          setMatchStatus(nextStatus);

          if (isMaskSingerGame && nextStatus === 'COUNTING') {
            setStep('counting');
          }

          if (isMaskSingerGame && nextStatus === 'FINISHED') {
            setStep('result');
          }
        }

        const nextTeams = (responseBody.data?.participants ?? [])
          .map(toPredictionTeam)
          .filter((team): team is PredictionTeam => Boolean(team));

        if (isMounted && nextTeams.length) {
          setPredictionTeams(previousTeams =>
            nextTeams.map(team => {
              const previousTeam =
                previousTeams.find(previous => previous.participantId === team.participantId) ??
                previousTeams.find(previous => previous.id === team.id);

              return {
                ...team,
                predictionRate: previousTeam?.predictionRate ?? team.predictionRate,
              };
            }),
          );

          const pickedParticipantId =
            responseBody?.data?.pickedParticipantId ?? responseBody?.data?.pickedParticipant?.participantId;
          const pickedTeam = nextTeams.find(team => team.participantId === pickedParticipantId);

          if (pickedTeam) {
            setSelectedTeam(pickedTeam.id);
          }
        }
      } catch (error) {
        console.log('[PredictionDetailScreen] match detail request failed', {error, routeGameId, routeMatchId});
      } finally {
        if (isMounted) {
          setIsMatchDetailLoading(false);
        }
      }
    }

    fetchMatchDetail();

    return () => {
      isMounted = false;
    };
  }, [auth?.accessToken, isMaskSingerGame, isParticipatedDetail, routeGameId, routeMatchId]);

  useEffect(() => {
    if (!auth?.accessToken || typeof routeGameId !== 'number' || typeof routeMatchId !== 'number') {
      return;
    }

    let isMounted = true;

    async function loadMatchOverview(): Promise<void> {
      setIsMatchDetailLoading(true);

      try {
        const didLoad = await fetchMatchOverview();

        if (isMounted && didLoad) {
          setSubmittedComment(null);
        }
      } catch (error) {
        console.log('[PredictionDetailScreen] match overview request failed', {error, routeGameId, routeMatchId});
      } finally {
        if (isMounted) {
          setIsMatchDetailLoading(false);
        }
      }
    }

    loadMatchOverview();

    return () => {
      isMounted = false;
    };
  }, [auth?.accessToken, fetchMatchOverview, routeGameId, routeMatchId]);

  const transitionToStep = useCallback(
    (nextStep: PredictionStep) => {
      Animated.timing(stepTransition, {
        toValue: 0,
        duration: 90,
        useNativeDriver: true,
      }).start(() => {
        setStep(nextStep);
        requestAnimationFrame(() => {
          Animated.spring(stepTransition, {
            toValue: 1,
            speed: 18,
            bounciness: 5,
            useNativeDriver: true,
          }).start();
        });
      });
    },
    [stepTransition],
  );

  const showSubmitToast = useCallback((message: string) => {
    toastProgress.stopAnimation();
    toastProgress.setValue(0);
    setToastMessage(message);
    setToastVisible(true);

    Animated.sequence([
      Animated.timing(toastProgress, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.delay(3000),
      Animated.timing(toastProgress, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start(({finished}) => {
      if (finished) {
        setToastVisible(false);
      }
    });
  }, [toastProgress]);

  const handleBackPress = () => {
    if (step === 'comment') {
      if (route.params?.startStep === 'comment') {
        navigation.goBack();
        return;
      }

      transitionToStep('select');
      return;
    }

    navigation.goBack();
  };

  const handleSelectNext = () => {
    if (!canProceedToComment) {
      return;
    }

    if (isMaskSingerGame) {
      if (!isMatchReady) {
        if (isMatchCounting) {
          transitionToStep('counting');
          return;
        }

        transitionToStep('result');
        return;
      }

      setPredictionSubmitError(null);
      setIsConfirmVisible(true);
      return;
    }

    transitionToStep('comment');
  };

  const openSubmitConfirm = () => {
    const trimmedComment = cheerDraft.trim();

    if (!isMaskSingerGame && !trimmedComment) {
      return;
    }

    if (isMaskSingerGame && !isMatchReady) {
      if (isMatchCounting) {
        transitionToStep('counting');
        return;
      }

      transitionToStep('result');
      return;
    }

    setPredictionSubmitError(null);
    setIsConfirmVisible(true);
  };

  const requestLatestMatchStatus = useCallback(async (): Promise<string | null> => {
    if (!auth?.accessToken || typeof routeGameId !== 'number' || typeof routeMatchId !== 'number') {
      return null;
    }

    const response = await fetch(`${API_BASE}/api/festivals/${PREDICTION_FESTIVAL_ID}/games/${routeGameId}`, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${auth.accessToken}`,
      },
    });
    const responseText = await response.text();
    const responseBody = JSON.parse(responseText) as GameDetailApiResponse;

    if (!response.ok || responseBody.success === false) {
      throw new Error(responseBody.message || '경기 상태 조회에 실패했습니다.');
    }

    const currentMatch = toGameDetail(responseBody.data)?.matches.find(match => match.matchId === routeMatchId);
    return currentMatch ? normalizeMatchStatus(currentMatch.matchStatus) : null;
  }, [auth?.accessToken, routeGameId, routeMatchId]);

  const submitPrediction = useCallback(
    async (participantId: number, commentText?: string) => {
      if (!auth?.accessToken || typeof routeGameId !== 'number' || typeof routeMatchId !== 'number') {
        throw new Error('예측을 등록할 수 없습니다.');
      }

      const response = await withMinimumLoadingTime(
        fetch(
          `${API_BASE}/api/festivals/${PREDICTION_FESTIVAL_ID}/games/${routeGameId}/matches/${routeMatchId}/predict`,
          {
            method: 'POST',
            headers: {
              Accept: 'application/json',
              Authorization: `Bearer ${auth.accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              participantId,
              ...(commentText ? {commentText} : {}),
            }),
          },
        ),
      );
      const responseText = await response.text();
      let responseBody: PredictionSubmitResponse | null = null;

      try {
        responseBody = JSON.parse(responseText) as PredictionSubmitResponse;
      } catch {
        responseBody = null;
      }

      if (!response.ok || responseBody?.success === false) {
        throw new Error(responseBody?.message || responseText || '승부예측 등록에 실패했습니다.');
      }
    },
    [auth?.accessToken, routeGameId, routeMatchId],
  );

  const handleConfirmSubmit = async () => {
    const trimmedComment = cheerDraft.trim();
    const participantId = selectedTeamInfo?.participantId;

    if ((!isMaskSingerGame && !trimmedComment) || isSubmittingPrediction) {
      return;
    }

    if (typeof participantId !== 'number') {
      setPredictionSubmitError('참가팀 정보를 확인할 수 없습니다.');
      return;
    }

    setIsSubmittingPrediction(true);
    setPredictionSubmitError(null);

    try {
      if (isMaskSingerGame) {
        const latestStatus = await requestLatestMatchStatus();

        if (latestStatus && latestStatus !== 'READY' && latestStatus !== 'SCHEDULED') {
          setMatchStatus(latestStatus);
          setIsConfirmVisible(false);
          Alert.alert('이미 끝난 경기입니다');

          try {
            await fetchMatchOverview();
          } catch (overviewError) {
            console.log('[PredictionDetailScreen] overview refresh after closed vote failed', overviewError);
          }

          transitionToStep(latestStatus === 'COUNTING' ? 'counting' : 'result');
          return;
        }
      }

      await submitPrediction(participantId, isMaskSingerGame ? undefined : trimmedComment);
      await refreshProfile();
      let didRefreshOverview = false;

      try {
        didRefreshOverview = await fetchMatchOverview();
      } catch (overviewError) {
        console.log('[PredictionDetailScreen] overview refresh after submit failed', overviewError);
      }

      if (didRefreshOverview) {
        setSubmittedComment(null);
      } else {
        setSubmittedComment({
          id: `my-cheer-${Date.now()}`,
          avatar: myAvatarSource,
          isMine: true,
          name: myName,
          teamId: selectedTeam,
          text: trimmedComment,
          time: '방금 전',
        });
      }

      setIsConfirmVisible(false);
      showSubmitToast(isMaskSingerGame ? '투표가 완료됐어요' : '응원댓글이 등록됐어요');
      transitionToStep(isMaskSingerGame ? 'counting' : 'result');
    } catch (error) {
      setPredictionSubmitError(error instanceof Error ? error.message : '승부예측 등록에 실패했습니다.');
    } finally {
      setIsSubmittingPrediction(false);
    }
  };

  return (
    <TabSceneTransition>
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="light-content" backgroundColor="#000000" />

        <View style={styles.screen}>
          <AppGnb />

          <View style={styles.backRow}>
            <AnimatedPressable
              accessibilityLabel="뒤로가기"
              accessibilityRole="button"
              onPress={handleBackPress}
              style={styles.backButton}>
              <Image source={icon.backBtn} style={styles.backIcon} />
            </AnimatedPressable>
          </View>

          <Animated.View style={[styles.stepAnimatedShell, stepTransitionStyle]}>
            {(step === 'counting' || step === 'result') && isSelectedTeamInfoPending ? (
              <View style={styles.fullScreenLoadingState}>
                <AppLoading label="내 투표를 불러오는 중..." />
              </View>
            ) : step === 'counting' ? (
              <View style={styles.countingContent}>
                <View style={styles.countingCard}>
                  <Text style={styles.countingEyebrow}>투표 집계중</Text>
                  <Text style={styles.countingTitle}>결과를 집계하고 있어요</Text>
                  <LottieView autoPlay loop source={countingLottie} style={styles.countingLottie} />
                  <Text style={styles.countingSubtitle}>
                    투표가 마감되었습니다.{'\n'}결과 공개 후 다시 확인해주세요.
                  </Text>
                  {selectedTeamInfo ? (
                    <View style={styles.countingSelectionBox}>
                      <Text style={styles.countingSelectionLabel}>내 투표</Text>
                      <Text style={styles.countingSelectionName}>{selectedTeamInfo.name}</Text>
                    </View>
                  ) : null}
                </View>
              </View>
            ) : step === 'result' ? (
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.resultContent}>
                <View style={styles.resultHero}>
                  <Text style={styles.resultEyebrow}>{isMaskSingerGame ? '내 투표' : '내 선택'}</Text>
                  <Text style={styles.resultTitle}>{selectedTeamInfo?.name ?? displayTeamName(selectedTeam)}</Text>
                  <Text style={styles.resultSubtitle}>
                    {isMaskSingerGame ? '투표가 종료되어 결과를 확인할 수 있어요' : '경기 종료 후 결과에 따라 코인을 지급받을 수 있어요'}
                  </Text>
                </View>

                <View style={styles.voteCard}>
                  <View style={styles.voteHeader}>
                    <Text style={styles.voteTitle}>{isMaskSingerGame ? '투표 결과' : '투표 현황'}</Text>
                    <Text style={styles.voteTotal}>{isMaskSingerGame ? '최종 투표율' : '실시간 투표율'}</Text>
                  </View>

                  <View style={styles.voteGraphTrack}>
                    <View style={[styles.voteGraphRed, {flex: voteGraphRedFlex}]} />
                    <View style={[styles.voteGraphBlack, {flex: voteGraphBlackFlex}]} />
                  </View>

                  <View style={styles.voteLegendRow}>
                    <View style={styles.voteLegendItem}>
                      <View style={[styles.voteDot, styles.voteDotRed]} />
                      <Text style={styles.voteLegendText}>
                        {displayTeamName('team-red')} {redRatio}%
                      </Text>
                    </View>
                    <View style={styles.voteLegendItem}>
                      <View style={[styles.voteDot, styles.voteDotBlack]} />
                      <Text style={styles.voteLegendText}>
                        {displayTeamName('team-black')} {blackRatio}%
                      </Text>
                    </View>
                  </View>
                </View>

                {!isMaskSingerGame ? (
                  <>
                    <View style={styles.commentSectionHeader}>
                      <Text style={styles.commentSectionTitle}>전체 응원댓글</Text>
                      <Text style={styles.commentSectionCount}>{displayCheerComments.length}개</Text>
                    </View>

                    <View style={styles.cheerCommentList}>
                      {displayCheerComments.length ? (
                        displayCheerComments.map(comment => (
                          <View
                            key={comment.id}
                            style={[styles.cheerCommentRow, comment.isMine && styles.myCheerCommentRow]}>
                            <Image source={comment.avatar} style={styles.cheerAvatar} resizeMode="cover" />
                            <View style={styles.cheerCommentBody}>
                              <View style={styles.cheerCommentMetaRow}>
                                <Text style={styles.cheerName}>{comment.name}</Text>
                                <View
                                  style={[
                                    styles.cheerTeamBadge,
                                    comment.teamId === 'team-red'
                                      ? styles.cheerTeamBadgeRed
                                      : styles.cheerTeamBadgeBlack,
                                  ]}>
                                  <Text style={styles.cheerTeamBadgeText}>{displayTeamName(comment.teamId)}</Text>
                                </View>
                                {comment.isMine ? <Text style={styles.mineLabel}>내 댓글</Text> : null}
                              </View>
                              <Text style={styles.cheerText}>{comment.text}</Text>
                              <Text style={styles.cheerTime}>{comment.time}</Text>
                            </View>
                          </View>
                        ))
                      ) : (
                        <View style={styles.emptyCommentState}>
                          <Text style={styles.emptyText}>아직 등록된 응원댓글이 없습니다.</Text>
                        </View>
                      )}
                    </View>
                  </>
                ) : null}
              </ScrollView>
            ) : step === 'select' ? (
              <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                style={styles.voteInputStep}>
                <ScrollView
                  automaticallyAdjustKeyboardInsets
                  keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={false}
                  style={styles.voteInputScroll}
                  contentContainerStyle={styles.voteInputContent}>
                  <View style={styles.heroBlock}>
                    <Text style={styles.heroTitle}>{displayGameTitle}</Text>
                    <Text style={styles.heroSubtitle}>
                      {isGameDetailLoading || isMatchDetailLoading
                        ? '경기 정보를 불러오는 중...'
                        : isMaskSingerGame
                        ? '더 잘한것 같은 사람에게 투표하세요.'
                        : '승리할 팀을 선택해주세요.'}
                    </Text>
                  </View>

                  {isMatchDetailLoading && !predictionTeams.length ? (
                    <View style={styles.teamStateCenter}>
                      <AppLoading label="참가팀을 불러오는 중..." />
                    </View>
                  ) : predictionTeams.length && leftTeamInfo ? (
                    <View style={styles.matchupStageWrapper}>
                      <View style={styles.matchupStage}>
                        {isMaskSingerGame ? (
                          <Animated.View style={[styles.maskSingerChoiceRow, matchupIdleStyle]}>
                            <Animated.View style={[styles.maskSingerChoiceShell, leftLogoIntroStyle]}>
                              <AnimatedPressable
                                accessibilityRole="button"
                                onPress={() => setSelectedTeam(leftTeamInfo.id)}
                                style={styles.choicePressable}>
                                <Animated.View
                                  style={[
                                    styles.maskSingerChoiceCard,
                                    selectedTeam !== leftTeamInfo.id && styles.choiceCardMuted,
                                    selectedTeam === leftTeamInfo.id && styles.choiceCardSelected,
                                  ]}>
                                  <View style={styles.maskSingerImageBox}>
                                    <Image
                                      source={leftTeamInfo.imageSource}
                                      resizeMode="contain"
                                      style={[
                                        styles.maskSingerImage,
                                        selectedTeam !== leftTeamInfo.id && styles.teamCardImageMuted,
                                      ]}
                                    />
                                  </View>
                                  <Text
                                    numberOfLines={2}
                                    adjustsFontSizeToFit
                                    style={[
                                      styles.maskSingerName,
                                      selectedTeam !== leftTeamInfo.id && styles.teamCardNameMuted,
                                    ]}>
                                    {leftTeamInfo.name}
                                  </Text>
                                  <Text
                                    numberOfLines={1}
                                    adjustsFontSizeToFit
                                    style={[
                                      styles.maskSingerMembers,
                                      selectedTeam !== leftTeamInfo.id && styles.teamCardMembersMuted,
                                    ]}>
                                    {leftTeamInfo.members.join(' / ')}
                                  </Text>
                                  <View
                                    style={[
                                      styles.maskSingerSelectChip,
                                      selectedTeam !== leftTeamInfo.id && styles.selectChipMuted,
                                      selectedTeam === leftTeamInfo.id && styles.selectChipSelected,
                                    ]}>
                                    <Text style={styles.selectChipText}>
                                      {selectedTeam === leftTeamInfo.id ? '선택됨' : '선택'}
                                    </Text>
                                  </View>
                                </Animated.View>
                              </AnimatedPressable>
                            </Animated.View>

                            {rightTeamInfo ? (
                              <Animated.View style={[styles.maskSingerChoiceShell, rightLogoIntroStyle]}>
                                <AnimatedPressable
                                  accessibilityRole="button"
                                  onPress={() => setSelectedTeam(rightTeamInfo.id)}
                                  style={styles.choicePressable}>
                                  <Animated.View
                                    style={[
                                      styles.maskSingerChoiceCard,
                                      selectedTeam !== rightTeamInfo.id && styles.choiceCardMuted,
                                      selectedTeam === rightTeamInfo.id && styles.choiceCardSelected,
                                    ]}>
                                    <View style={styles.maskSingerImageBox}>
                                      <Image
                                        source={rightTeamInfo.imageSource}
                                        resizeMode="contain"
                                        style={[
                                          styles.maskSingerImage,
                                          selectedTeam !== rightTeamInfo.id && styles.teamCardImageMuted,
                                        ]}
                                      />
                                    </View>
                                    <Text
                                      numberOfLines={2}
                                      adjustsFontSizeToFit
                                      style={[
                                        styles.maskSingerName,
                                        selectedTeam !== rightTeamInfo.id && styles.teamCardNameMuted,
                                      ]}>
                                      {rightTeamInfo.name}
                                    </Text>
                                    <Text
                                      numberOfLines={1}
                                      adjustsFontSizeToFit
                                      style={[
                                        styles.maskSingerMembers,
                                        selectedTeam !== rightTeamInfo.id && styles.teamCardMembersMuted,
                                      ]}>
                                      {rightTeamInfo.members.join(' / ')}
                                    </Text>
                                    <View
                                      style={[
                                        styles.maskSingerSelectChip,
                                        selectedTeam !== rightTeamInfo.id && styles.selectChipMuted,
                                        selectedTeam === rightTeamInfo.id && styles.selectChipSelected,
                                      ]}>
                                      <Text style={styles.selectChipText}>
                                        {selectedTeam === rightTeamInfo.id ? '선택됨' : '선택'}
                                      </Text>
                                    </View>
                                  </Animated.View>
                                </AnimatedPressable>
                              </Animated.View>
                            ) : null}
                          </Animated.View>
                        ) : (
                          <Animated.View style={[styles.matchupChoiceStack, matchupIdleStyle]}>
                          <Animated.View style={[styles.choiceCardShell, leftLogoIntroStyle]}>
                            <AnimatedPressable
                              accessibilityRole="button"
                              onPress={() => setSelectedTeam(leftTeamInfo.id)}
                              style={styles.choicePressable}>
                              <Animated.View
                                style={[
                                  styles.choiceCard,
                                  selectedTeam !== leftTeamInfo.id && styles.choiceCardMuted,
                                  selectedTeam === leftTeamInfo.id && styles.choiceCardSelected,
                                ]}>
                                <View style={styles.teamLogoBox}>
                                  <Image
                                    source={leftTeamInfo.imageSource}
                                    resizeMode="contain"
                                    style={[
                                      styles.teamCardImage,
                                      selectedTeam !== leftTeamInfo.id && styles.teamCardImageMuted,
                                    ]}
                                  />
                                </View>
                                <View style={styles.teamCardTextBlock}>
                                  <Text
                                    numberOfLines={1}
                                    adjustsFontSizeToFit
                                    style={[
                                      styles.teamCardName,
                                      selectedTeam !== leftTeamInfo.id && styles.teamCardNameMuted,
                                    ]}>
                                    {leftTeamInfo.name}
                                  </Text>
                                  <Text
                                    numberOfLines={1}
                                    adjustsFontSizeToFit
                                    style={[
                                      styles.teamCardMembers,
                                      selectedTeam !== leftTeamInfo.id && styles.teamCardMembersMuted,
                                    ]}>
                                    {leftTeamInfo.members.join(' / ')}
                                  </Text>
                                </View>
                                <View
                                  style={[
                                    styles.selectChip,
                                    selectedTeam !== leftTeamInfo.id && styles.selectChipMuted,
                                    selectedTeam === leftTeamInfo.id && styles.selectChipSelected,
                                  ]}>
                                  <Text style={styles.selectChipText}>
                                    {selectedTeam === leftTeamInfo.id ? '선택됨' : '선택'}
                                  </Text>
                                </View>
                              </Animated.View>
                            </AnimatedPressable>
                          </Animated.View>

                          {rightTeamInfo ? (
                            <Animated.View style={[styles.choiceCardShell, rightLogoIntroStyle]}>
                              <AnimatedPressable
                                accessibilityRole="button"
                                onPress={() => setSelectedTeam(rightTeamInfo.id)}
                                style={styles.choicePressable}>
                                <Animated.View
                                  style={[
                                    styles.choiceCard,
                                    selectedTeam !== rightTeamInfo.id && styles.choiceCardMuted,
                                    selectedTeam === rightTeamInfo.id && styles.choiceCardSelected,
                                  ]}>
                                  <View style={styles.teamLogoBox}>
                                    <Image
                                      source={rightTeamInfo.imageSource}
                                      resizeMode="contain"
                                      style={[
                                        styles.teamCardImage,
                                        selectedTeam !== rightTeamInfo.id && styles.teamCardImageMuted,
                                      ]}
                                    />
                                  </View>
                                  <View style={styles.teamCardTextBlock}>
                                    <Text
                                      numberOfLines={1}
                                      adjustsFontSizeToFit
                                      style={[
                                        styles.teamCardName,
                                        selectedTeam !== rightTeamInfo.id && styles.teamCardNameMuted,
                                      ]}>
                                      {rightTeamInfo.name}
                                    </Text>
                                    <Text
                                      numberOfLines={1}
                                      adjustsFontSizeToFit
                                      style={[
                                        styles.teamCardMembers,
                                        selectedTeam !== rightTeamInfo.id && styles.teamCardMembersMuted,
                                      ]}>
                                      {rightTeamInfo.members.join(' / ')}
                                    </Text>
                                  </View>
                                  <View
                                    style={[
                                      styles.selectChip,
                                      selectedTeam !== rightTeamInfo.id && styles.selectChipMuted,
                                      selectedTeam === rightTeamInfo.id && styles.selectChipSelected,
                                    ]}>
                                    <Text style={styles.selectChipText}>
                                      {selectedTeam === rightTeamInfo.id ? '선택됨' : '선택'}
                                    </Text>
                                  </View>
                                </Animated.View>
                              </AnimatedPressable>
                            </Animated.View>
                          ) : null}
                          </Animated.View>
                        )}
                      </View>
                    </View>
                  ) : (
                    <View style={styles.teamStateCenter}>
                      <Text style={styles.emptyText}>참가팀 정보가 없습니다.</Text>
                    </View>
                  )}
                </ScrollView>

                <View style={styles.bottomActionWrap}>
                  <AnimatedPressable
                    accessibilityRole="button"
                    disabled={!canProceedToComment}
                    onPress={handleSelectNext}
                    style={[styles.nextButton, !canProceedToComment && styles.nextButtonDisabled]}>
                    <Text style={[styles.nextButtonText, !canProceedToComment && styles.nextButtonTextDisabled]}>
                      {isMaskSingerGame ? '투표하기' : '다음'}
                    </Text>
                  </AnimatedPressable>
                </View>
              </KeyboardAvoidingView>
            ) : (
              <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                style={styles.voteInputStep}>
                <ScrollView
                  automaticallyAdjustKeyboardInsets
                  keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={false}
                  style={styles.voteInputScroll}
                  contentContainerStyle={styles.voteInputContent}>
                  {selectedTeamInfo ? (
                    <View style={styles.selectedTeamHero}>
                      <Image
                        source={selectedTeamInfo.imageSource}
                        style={styles.selectedTeamImage}
                        resizeMode="contain"
                      />
                      <View style={styles.selectedTeamTextBlock}>
                        <Text style={styles.selectedTeamEyebrow}>내가 선택한 팀</Text>
                        <Text adjustsFontSizeToFit numberOfLines={1} style={styles.selectedTeamName}>
                          {selectedTeamInfo.name}
                        </Text>
                        <Text style={styles.selectedTeamMembers}>{selectedTeamInfo.members.join(' / ')}</Text>
                        {/* <Text style={styles.selectedTeamDescription}>응원댓글을 남기면 투표 결과를 볼 수 있어요.</Text> */}
                      </View>
                    </View>
                  ) : (
                    <View style={styles.teamStateCenter}>
                      <Text style={styles.emptyText}>참가팀 정보가 없습니다.</Text>
                    </View>
                  )}

                  <View style={styles.commentOnlyInputBlock}>
                    <Text style={styles.commentOnlyLabel}>응원댓글</Text>
                    <TextInput
                      multiline
                      autoFocus
                      editable={Boolean(selectedTeamInfo)}
                      placeholder={selectedTeamInfo ? `${selectedTeamInfo.name} 응원댓글 달기` : '참가팀 정보를 불러온 뒤 입력할 수 있습니다.'}
                      placeholderTextColor="#777A82"
                      style={styles.commentOnlyInput}
                      value={cheerDraft}
                      onChangeText={setCheerDraft}
                    />
                  </View>
                </ScrollView>

                <View style={styles.bottomActionWrap}>
                  <AnimatedPressable
                    accessibilityRole="button"
                    disabled={!selectedTeamInfo || !cheerDraft.trim()}
                    onPress={openSubmitConfirm}
                    style={[styles.nextButton, (!selectedTeamInfo || !cheerDraft.trim()) && styles.nextButtonDisabled]}>
                    <Text
                      style={[
                        styles.nextButtonText,
                        (!selectedTeamInfo || !cheerDraft.trim()) && styles.nextButtonTextDisabled,
                      ]}>
                      다음
                    </Text>
                  </AnimatedPressable>
                </View>
              </KeyboardAvoidingView>
            )}
          </Animated.View>

          <Modal
            animationType="fade"
            onRequestClose={() => {
              if (!isSubmittingPrediction) {
                setIsConfirmVisible(false);
              }
            }}
            transparent
            visible={isConfirmVisible}>
            <View style={styles.confirmOverlay}>
              <Pressable
                accessibilityLabel="확인창 닫기"
                accessibilityRole="button"
                disabled={isSubmittingPrediction}
                onPress={() => setIsConfirmVisible(false)}
                style={styles.confirmBackdrop}
              />
              <View style={styles.confirmCard}>
                <Text style={styles.confirmEyebrow}>{isMaskSingerGame ? '투표 확인' : '승부예측 확인'}</Text>
                <Text style={styles.confirmTitle}>
                  {isMaskSingerGame
                    ? `${selectedTeamInfo?.name ?? '참가자'}에게 투표할까요?`
                    : `${selectedTeamInfo?.name ?? '참가팀'}에 투표하고\n응원댓글을 등록할까요?`}
                </Text>
                {!isMaskSingerGame ? (
                  <Text numberOfLines={3} style={styles.confirmCommentPreview}>
                    “{cheerDraft.trim()}”
                  </Text>
                ) : null}
                {predictionSubmitError ? <Text style={styles.confirmErrorText}>{predictionSubmitError}</Text> : null}

                <View style={styles.confirmActions}>
                  <AnimatedPressable
                    accessibilityRole="button"
                    disabled={isSubmittingPrediction}
                    onPress={() => setIsConfirmVisible(false)}
                    style={[styles.confirmButton, styles.confirmCancelButton]}>
                    <Text style={styles.confirmCancelText}>취소</Text>
                  </AnimatedPressable>
                  <AnimatedPressable
                    accessibilityRole="button"
                    disabled={isSubmittingPrediction}
                    onPress={handleConfirmSubmit}
                    style={[
                      styles.confirmButton,
                      styles.confirmSubmitButton,
                      isSubmittingPrediction && styles.confirmSubmitButtonDisabled,
                    ]}>
                    <Text style={styles.confirmSubmitText}>
                      {isSubmittingPrediction ? '처리 중...' : isMaskSingerGame ? '투표' : '등록'}
                    </Text>
                  </AnimatedPressable>
                </View>
              </View>
            </View>
          </Modal>

          {toastVisible ? (
            <Animated.View
              pointerEvents="none"
              style={[
                styles.toast,
                {
                  opacity: toastProgress,
                  transform: [
                    {
                      translateY: toastProgress.interpolate({
                        inputRange: [0, 1],
                        outputRange: [-14, 0],
                      }),
                    },
                  ],
                },
              ]}>
              <View style={styles.toastAccent} />
              <Text style={styles.toastText}>{toastMessage}</Text>
            </Animated.View>
          ) : null}
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
  stepAnimatedShell: {
    flex: 1,
  },
  fullScreenLoadingState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  voteInputStep: {
    flex: 1,
  },
  voteInputScroll: {
    flex: 1,
  },
  voteInputContent: {
    flexGrow: 1,
    paddingBottom: 28,
  },
  backRow: {
    height: 56,
    paddingHorizontal: 20,
    justifyContent: 'center',
  },
  backButton: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: {
    width: 24,
    height: 24,
    resizeMode: 'contain',
  },
  heroBlock: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 22,
  },
  heroTitle: {
    color: '#FFFFFF',
    ...FONTS.font22B,
    lineHeight: 30,
  },
  heroSubtitle: {
    marginTop: 8,
    color: '#A9ABB2',
    ...FONTS.font16M,
    lineHeight: 21,
  },
  emptyText: {
    paddingHorizontal: 20,
    color: '#8A8D95',
    textAlign: 'center',
    ...FONTS.font14M,
    lineHeight: 19,
  },
  teamStateCenter: {
    flex: 1,
    minHeight: 360,
    alignItems: 'center',
    justifyContent: 'center',
  },
  matchupStageWrapper: {
    marginHorizontal: 20,
    marginTop: 0,
    height: 352,
    position: 'relative',
  },
  matchupStage: {
    height: '100%',
    position: 'relative',
    zIndex: 2,
    borderRadius: 12,
    overflow: 'hidden',
    // backgroundColor: '#0B0B0D',
  },
  matchupChoiceStack: {
    flex: 1,
    justifyContent: 'space-between',
    gap: 12,
  },
  maskSingerChoiceRow: {
    flex: 1,
    flexDirection: 'row',
    gap: 12,
  },
  maskSingerChoiceShell: {
    flex: 1,
  },
  maskSingerChoiceCard: {
    flex: 1,
    minHeight: 332,
    borderRadius: 12,
    backgroundColor: '#111111',
    overflow: 'hidden',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 18,
    paddingBottom: 14,
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  maskSingerImageBox: {
    width: '100%',
    height: 154,
    alignItems: 'center',
    justifyContent: 'center',
  },
  maskSingerImage: {
    width: '100%',
    height: 142,
  },
  maskSingerName: {
    width: '100%',
    marginTop: 14,
    color: '#FFFFFF',
    textAlign: 'center',
    ...FONTS.font18B,
    lineHeight: 24,
  },
  maskSingerMembers: {
    width: '100%',
    marginTop: 7,
    color: '#C9CBD2',
    textAlign: 'center',
    ...FONTS.font12M,
    lineHeight: 17,
  },
  maskSingerSelectChip: {
    marginTop: 'auto',
    minWidth: 68,
    height: 32,
    borderRadius: 16,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E50914',
  },
  teamInfoBlock: {
    position: 'absolute',
    width: '44%',
    padding: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(17,17,20,0.9)',
    borderWidth: 1,
    borderColor: '#27292F',
  },
  teamInfoBlockTop: {
    left: 14,
    top: 18,
    alignItems: 'flex-start',
  },
  teamInfoBlockBottom: {
    right: 14,
    bottom: 18,
    alignItems: 'flex-end',
  },
  teamInfoBlockActive: {
    borderColor: '#E50914',
    backgroundColor: 'rgba(38,12,16,0.95)',
  },
  teamInfoLogo: {
    width: 56,
    height: 56,
  },
  teamInfoLabel: {
    marginTop: 10,
    color: '#9EA6B6',
    ...FONTS.font12B,
    lineHeight: 16,
  },
  teamInfoName: {
    marginTop: 4,
    color: '#FFFFFF',
    ...FONTS.font18B,
    lineHeight: 23,
  },
  teamInfoMembers: {
    marginTop: 4,
    color: '#D0D4DC',
    ...FONTS.font12M,
    lineHeight: 17,
  },
  choiceCardShell: {
    width: '100%',
  },
  choicePressable: {
    width: '100%',
  },
  choiceCard: {
    width: '100%',
    height: 170,
    borderRadius: 12,
    backgroundColor: '#111111',
    position: 'relative',
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  choiceCardMuted: {
    backgroundColor: '#242428',
    borderColor: '#3A3B40',
  },
  choiceCardSelected: {
    borderWidth: 2,
    borderColor: '#E50914',
    backgroundColor: '#180C0E',
  },
  teamLogoBox: {
    width: 112,
    height: 112,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  teamCardImage: {
    width: 96,
    height: 88,
  },
  teamCardImageMuted: {
    opacity: 0.45,
  },
  teamCardTextBlock: {
    flex: 1,
    height: 112,
    marginLeft: 13,
    paddingRight: 0,
    alignSelf: 'stretch',
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  teamCardName: {
    alignSelf: 'stretch',
    color: '#FFFFFF',
    textAlign: 'left',
    ...FONTS.font22B,
    lineHeight: 28,
  },
  teamCardNameMuted: {
    color: '#9A9DA6',
  },
  teamCardMembers: {
    alignSelf: 'stretch',
    marginTop: 7,
    color: '#C9CBD2',
    textAlign: 'left',
    ...FONTS.font12M,
    lineHeight: 18,
  },
  teamCardMembersMuted: {
    color: '#858893',
  },
  selectChip: {
    position: 'absolute',
    right: 12,
    bottom: 12,
    borderRadius: 30,
    paddingHorizontal: 12,
    paddingVertical: 8,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#E50914',
  },
  selectChipMuted: {
    backgroundColor: '#4B4D55',
  },
  selectChipSelected: {
    backgroundColor: '#E50914',
  },
  selectChipText: {
    color: '#FFFFFF',
    ...FONTS.font14B,
    lineHeight: 18,
  },
  selectedTeamHero: {
    marginHorizontal: 20,
    marginTop: 0,
    minHeight: Platform.OS === 'android' ? 188 : 248,
    borderRadius: 12,
    padding: Platform.OS === 'android' ? 16 : 20,
    alignItems: 'center',
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  selectedTeamEyebrow: {
    color: 'rgba(255,255,255,0.82)',
    ...FONTS.font14B,
    lineHeight: 19,
  },
  selectedTeamName: {
    marginTop: 8,
    color: '#FFFFFF',
    ...FONTS.font40B,
    lineHeight: 46,
  },
  selectedTeamDescription: {
    marginTop: 8,
    color: 'rgba(255,255,255,0.78)',
    ...FONTS.font14M,
    lineHeight: 20,
  },
  selectedTeamMembers: {
    marginTop: 8,
    color: 'rgba(255,255,255,0.84)',
    ...FONTS.font14B,
    lineHeight: 19,
  },
  selectedTeamImage: {
    width: Platform.OS === 'android' ? '58%' : '76%',
    height: Platform.OS === 'android' ? 82 : 126,
  },
  selectedTeamTextBlock: {
    width: '100%',
  },
  commentOnlyInputBlock: {
    marginHorizontal: 20,
    marginTop: Platform.OS === 'android' ? 8 : 14,
    borderRadius: 12,
    padding: Platform.OS === 'android' ? 16 : 18,
    backgroundColor: '#111114',
    borderWidth: 1,
    borderColor: '#242428',
  },
  commentOnlyLabel: {
    color: '#FFFFFF',
    ...FONTS.font16B,
    lineHeight: 21,
  },
  commentOnlyInput: {
    // minHeight: 130,
    marginTop: Platform.OS === 'android' ? 8 : 14,
    padding: 0,
    color: '#FFFFFF',
    ...FONTS.font16R,
    lineHeight: 24,
  },
  confirmOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  confirmBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.72)',
  },
  confirmCard: {
    width: '100%',
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 18,
    backgroundColor: '#171717',
    borderWidth: 1,
    borderColor: '#252525',
  },
  confirmEyebrow: {
    color: '#E50914',
    ...FONTS.font13B,
    lineHeight: 18,
  },
  confirmTitle: {
    marginTop: 8,
    color: '#FFFFFF',
    ...FONTS.font22B,
    lineHeight: 28,
  },
  confirmCommentPreview: {
    marginTop: 14,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#D8DAE0',
    backgroundColor: '#0B0B0D',
    ...FONTS.font14R,
    lineHeight: 21,
  },
  confirmErrorText: {
    marginTop: 10,
    color: '#E66B70',
    ...FONTS.font12M,
    lineHeight: 17,
  },
  confirmActions: {
    marginTop: 18,
    flexDirection: 'row',
    gap: 10,
  },
  confirmButton: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmCancelButton: {
    backgroundColor: '#242428',
  },
  confirmSubmitButton: {
    backgroundColor: '#E50914',
  },
  confirmSubmitButtonDisabled: {
    opacity: 0.65,
  },
  confirmCancelText: {
    color: '#D6D8DE',
    ...FONTS.font15B,
    lineHeight: 20,
  },
  confirmSubmitText: {
    color: '#FFFFFF',
    ...FONTS.font15B,
    lineHeight: 20,
  },
  countingContent: {
    flex: 1,
    paddingHorizontal: 20,
    justifyContent: 'center',
  },
  countingCard: {
    borderRadius: 12,
    paddingHorizontal: 22,
    paddingTop: 22,
    paddingBottom: 30,
    backgroundColor: '#141416',
    borderWidth: 1,
    borderColor: '#25252A',
    alignItems: 'center',
  },
  countingLottie: {
    width: 120,
    height: 120,
    // marginTop: 12,
    // marginBottom: 8,
  },
  countingEyebrow: {
    color: '#E50914',
    ...FONTS.font13B,
    lineHeight: 18,
  },
  countingTitle: {
    marginTop: 10,
    color: '#FFFFFF',
    textAlign: 'center',
    ...FONTS.font24B,
    lineHeight: 31,
  },
  countingSubtitle: {
    marginTop: 10,
    color: '#A9ABB2',
    textAlign: 'center',
    ...FONTS.font14M,
    lineHeight: 20,
  },
  countingSelectionBox: {
    width: '100%',
    marginTop: 22,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: '#0B0B0D',
    borderWidth: 1,
    borderColor: '#25252A',
    alignItems: 'center',
  },
  countingSelectionLabel: {
    color: '#8A8D95',
    ...FONTS.font12B,
    lineHeight: 16,
  },
  countingSelectionName: {
    marginTop: 6,
    color: '#FFFFFF',
    textAlign: 'center',
    ...FONTS.font18B,
    lineHeight: 24,
  },
  toast: {
    position: 'absolute',
    left: 14,
    right: 14,
    top: 58,
    minHeight: 42,
    borderRadius: 14,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(18,18,20,0.96)',
    borderWidth: 1,
    borderColor: '#2C2D33',
  },
  toastAccent: {
    width: 7,
    height: 7,
    borderRadius: 4,
    marginRight: 10,
    backgroundColor: '#E50914',
  },
  toastText: {
    color: '#FFFFFF',
    ...FONTS.font14B,
    lineHeight: 19,
  },
  cheerInputCard: {
    marginHorizontal: 20,
    marginTop: 20,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    backgroundColor: '#111114',
    borderWidth: 1,
    borderColor: '#242428',
  },
  inputAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    marginRight: 12,
    backgroundColor: '#242428',
  },
  cheerInputBody: {
    flex: 1,
  },
  cheerInputName: {
    color: '#FFFFFF',
    ...FONTS.font14B,
    lineHeight: 19,
  },
  cheerInput: {
    minHeight: 78,
    marginTop: 8,
    padding: 0,
    color: '#FFFFFF',
    ...FONTS.font15R,
    lineHeight: 22,
  },
  bottomActionWrap: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 24,
    backgroundColor: '#000000',
    borderTopWidth: 1,
    borderTopColor: '#171717',
  },
  nextButton: {
    height: 54,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E50914',
  },
  nextButtonDisabled: {
    backgroundColor: '#242428',
  },
  nextButtonText: {
    color: '#FFFFFF',
    ...FONTS.font16B,
    lineHeight: 21,
  },
  nextButtonTextDisabled: {
    color: '#777A82',
  },
  resultContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 42,
  },
  resultHero: {
    borderRadius: 12,
    padding: 20,
    backgroundColor: '#111114',
    borderWidth: 1,
    borderColor: '#242428',
  },
  resultEyebrow: {
    color: '#E50914',
    ...FONTS.font13B,
    lineHeight: 18,
  },
  resultTitle: {
    marginTop: 8,
    color: '#FFFFFF',
    ...FONTS.font30B,
    lineHeight: 36,
  },
  resultSubtitle: {
    marginTop: 8,
    color: '#A9ABB2',
    ...FONTS.font14R,
    lineHeight: 20,
  },
  voteCard: {
    marginTop: 20,
    borderRadius: 12,
    padding: 18,
    backgroundColor: '#111114',
    borderWidth: 1,
    borderColor: '#242428',
  },
  voteHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  voteTitle: {
    color: '#FFFFFF',
    ...FONTS.font17B,
    lineHeight: 22,
  },
  voteTotal: {
    color: '#8A8D95',
    ...FONTS.font12M,
    lineHeight: 16,
  },
  voteGraphTrack: {
    height: 16,
    marginTop: 18,
    borderRadius: 8,
    flexDirection: 'row',
    overflow: 'hidden',
    backgroundColor: '#242428',
  },
  voteGraphRed: {
    backgroundColor: '#E50914',
  },
  voteGraphBlack: {
    backgroundColor: '#8A8D95',
  },
  voteLegendRow: {
    marginTop: 14,
    gap: 8,
  },
  voteLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  voteDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 7,
  },
  voteDotRed: {
    backgroundColor: '#E50914',
  },
  voteDotBlack: {
    backgroundColor: '#8A8D95',
  },
  voteLegendText: {
    color: '#D6D8DE',
    ...FONTS.font13M,
    lineHeight: 18,
  },
  commentSectionHeader: {
    marginTop: 22,
    marginBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  commentSectionTitle: {
    color: '#FFFFFF',
    ...FONTS.font18B,
    lineHeight: 24,
  },
  commentSectionCount: {
    color: '#8A8D95',
    ...FONTS.font13M,
    lineHeight: 18,
  },
  cheerCommentList: {
    gap: 14,
  },
  emptyCommentState: {
    minHeight: 140,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: '#171717',
    borderWidth: 1,
    borderColor: '#252525',
  },
  cheerCommentRow: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 14,
    backgroundColor: '#171717',
    borderWidth: 1,
    borderColor: '#252525',
  },
  myCheerCommentRow: {
    backgroundColor: 'rgba(229,9,20,0.12)',
    borderColor: 'rgba(229,9,20,0.5)',
  },
  cheerAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    marginRight: 11,
    backgroundColor: '#242428',
  },
  cheerCommentBody: {
    flex: 1,
  },
  cheerCommentMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  cheerName: {
    color: '#FFFFFF',
    ...FONTS.font14B,
    lineHeight: 19,
  },
  cheerTeamBadge: {
    height: 20,
    borderRadius: 8,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cheerTeamBadgeRed: {
    borderWidth: 1,
    borderColor: 'rgba(229,9,20,0.48)',
  },
  cheerTeamBadgeBlack: {
    backgroundColor: '#171717',
    borderWidth: 1,
    borderColor: '#2D2D2D',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cheerTeamBadgeText: {
    color: '#FFFFFF',
    ...FONTS.font10B,
    lineHeight: 13,
  },
  mineLabel: {
    color: '#E50914',
    ...FONTS.font11B,
    lineHeight: 15,
  },
  cheerText: {
    marginTop: 8,
    color: '#F2F2F4',
    ...FONTS.font14R,
    lineHeight: 21,
  },
  cheerTime: {
    marginTop: 7,
    color: '#8A8D95',
    ...FONTS.font12R,
    lineHeight: 16,
  },
});
