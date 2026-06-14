import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {useFocusEffect, useNavigation, useRoute, type RouteProp} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {
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
  UIManager,
  View,
  type ImageSourcePropType,
} from 'react-native';
import LottieView from 'lottie-react-native';
import LinearGradient from 'react-native-linear-gradient';
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

const compareVsLottie = require('../assets/lotties/Compare.json');
const isLottieNativeAvailable = Boolean(UIManager.getViewManagerConfig?.('LottieAnimationView'));

type TeamId = (typeof teams)[number]['id'];
type PredictionStep = 'select' | 'comment' | 'result';

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
  const profileImageUri = getProfileImageUriFromRecord(auth?.profile);
  const myAvatarSource = profileImageUri ? {uri: profileImageUri} : image.profile;
  const myName = auth?.name ?? '이인철';
  const initialSelectedTeam = route.params?.selectedTeamId ?? 'team-red';
  const isParticipatedDetail = route.params?.mode === 'participated';
  const [step, setStep] = useState<PredictionStep>(route.params?.startStep === 'comment' ? 'comment' : 'select');
  const [selectedTeam, setSelectedTeam] = useState<TeamId>(initialSelectedTeam);
  const [expandedTeam, setExpandedTeam] = useState<TeamId | null>(null);
  const [matchupStageSize, setMatchupStageSize] = useState({height: 0, width: 0});
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
  const teamDetailProgress = useRef(new Animated.Value(0)).current;
  const toastProgress = useRef(new Animated.Value(0)).current;
  const selectedTeamInfo = predictionTeams.find(team => team.id === selectedTeam) ?? null;
  const expandedTeamInfo = expandedTeam
    ? predictionTeams.find(team => team.id === expandedTeam) ?? null
    : null;
  const leftTeamInfo = predictionTeams[0] ?? null;
  const rightTeamInfo = predictionTeams[1] ?? null;
  const displayGameTitle = gameDetail?.gameTitle ?? routeGameTitle ?? '경기 정보';
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
  const matchupSplitLineStyle = useMemo(() => {
    const {height, width} = matchupStageSize;
    const lineBleed = 96;

    if (!width || !height) {
      return {
        marginLeft: -(width + lineBleed) / 2,
        transform: [{rotate: '-35deg'}],
        width: width + lineBleed,
      };
    }

    const diagonalLength = Math.sqrt(width * width + height * height) + lineBleed;
    const diagonalAngle = Math.atan2(height, width) * (180 / Math.PI);

    return {
      marginLeft: -diagonalLength / 2,
      transform: [{rotate: `${-diagonalAngle}deg`}],
      width: diagonalLength,
    };
  }, [matchupStageSize]);
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
        translateX: stageIntroProgress.interpolate({
          inputRange: [0, 1],
          outputRange: [-136, 0],
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
        translateX: stageIntroProgress.interpolate({
          inputRange: [0, 1],
          outputRange: [136, 0],
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
  const teamDetailStyle = {
    opacity: teamDetailProgress,
    transform: [
      {
        translateY: teamDetailProgress.interpolate({
          inputRange: [0, 1],
          outputRange: [28, 0],
        }),
      },
      {
        scale: teamDetailProgress.interpolate({
          inputRange: [0, 1],
          outputRange: [0.78, 1],
        }),
      },
    ],
  };
  const matchupIdleStyle = {
    opacity: expandedTeam
      ? teamDetailProgress.interpolate({
          inputRange: [0, 1],
          outputRange: [1, 0],
        })
      : 1,
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
  }, [auth?.accessToken, auth?.employeeId, auth?.name, routeGameId, routeMatchId]);

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
  }, [auth?.accessToken, routeGameId]);

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
  }, [auth?.accessToken, isParticipatedDetail, routeGameId, routeMatchId]);

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

  const showSubmitToast = useCallback(() => {
    toastProgress.stopAnimation();
    toastProgress.setValue(0);
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
    if (!expandedTeam) {
      return;
    }

    transitionToStep('comment');
  };

  const handleTeamLogoPress = useCallback(
    (teamId: TeamId) => {
      setSelectedTeam(teamId);
      setExpandedTeam(teamId);
      teamDetailProgress.stopAnimation();
      teamDetailProgress.setValue(0);
      Animated.spring(teamDetailProgress, {
        toValue: 1,
        speed: 15,
        bounciness: 10,
        useNativeDriver: true,
      }).start();
    },
    [teamDetailProgress],
  );

  const handleCloseTeamDetail = useCallback(() => {
    teamDetailProgress.stopAnimation();
    Animated.timing(teamDetailProgress, {
      toValue: 0,
      duration: 160,
      useNativeDriver: true,
    }).start(() => {
      setExpandedTeam(null);
    });
  }, [teamDetailProgress]);

  const openSubmitConfirm = () => {
    const trimmedComment = cheerDraft.trim();

    if (!trimmedComment) {
      return;
    }

    setPredictionSubmitError(null);
    setIsConfirmVisible(true);
  };

  const submitPrediction = useCallback(
    async (participantId: number, commentText: string) => {
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
              commentText,
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

    if (!trimmedComment || isSubmittingPrediction) {
      return;
    }

    if (typeof participantId !== 'number') {
      setPredictionSubmitError('참가팀 정보를 확인할 수 없습니다.');
      return;
    }

    setIsSubmittingPrediction(true);
    setPredictionSubmitError(null);

    try {
      await submitPrediction(participantId, trimmedComment);
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
      showSubmitToast();
      transitionToStep('result');
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
            {step === 'result' ? (
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.resultContent}>
                <View style={styles.resultHero}>
                  <Text style={styles.resultEyebrow}>내 선택</Text>
                  <Text style={styles.resultTitle}>{displayTeamName(selectedTeam)}</Text>
                  <Text style={styles.resultSubtitle}>경기 종료 후 결과에 따라 코인을 지급받을 수 있어요</Text>
                </View>

                <View style={styles.voteCard}>
                  <View style={styles.voteHeader}>
                    <Text style={styles.voteTitle}>투표 현황</Text>
                    <Text style={styles.voteTotal}>실시간 투표율</Text>
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
                                comment.teamId === 'team-red' ? styles.cheerTeamBadgeRed : styles.cheerTeamBadgeBlack,
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
                        : '승리할 팀을 선택해주세요.'}
                    </Text>
                  </View>

                  {isMatchDetailLoading && !predictionTeams.length ? (
                    <View style={styles.teamStateCenter}>
                      <AppLoading label="참가팀을 불러오는 중..." />
                    </View>
                  ) : predictionTeams.length && leftTeamInfo ? (
                    <View
                      onLayout={({nativeEvent}) => {
                        const {height, width} = nativeEvent.layout;
                        setMatchupStageSize(prev =>
                          prev.width === width && prev.height === height ? prev : {height, width},
                        );
                      }}
                      style={styles.matchupStageWrapper}>
                      <Animated.View pointerEvents="none" style={[styles.matchupGlobalLineLayer, matchupIdleStyle]}>
                        <View pointerEvents="none" style={[styles.matchupSplitLineCoreWrap, matchupSplitLineStyle]}>
                          <LinearGradient
                            pointerEvents="none"
                            colors={['rgba(229,9,20,0)', 'rgba(229,9,20,1)', 'rgba(229,9,20,0)']}
                            end={{x: 1, y: 0.5}}
                            start={{x: 0, y: 0.5}}
                            style={styles.matchupSplitLineGlobal}
                          />
                        </View>
                      </Animated.View>

                      <View style={styles.matchupStage}>
                        <Animated.View pointerEvents="none" style={[styles.matchupIdleLayer, matchupIdleStyle]}>
                          <View pointerEvents="none" style={styles.vsBadgeCenter}>
                            {isLottieNativeAvailable ? (
                              <LottieView
                                autoPlay
                                loop={false}
                                speed={0.8}
                                source={compareVsLottie}
                                style={styles.vsLottie}
                              />
                            ) : (
                              <View style={styles.vsFallbackBadge}>
                                <Text style={styles.vsFallbackText}>VS</Text>
                              </View>
                            )}
                          </View>
                        </Animated.View>

                        <Animated.View
                          style={[styles.wallLogoPressable, styles.wallLogoLeft, leftLogoIntroStyle, matchupIdleStyle]}>
                          <AnimatedPressable
                            accessibilityRole="button"
                            disabled={Boolean(expandedTeam)}
                            onPress={() => handleTeamLogoPress(leftTeamInfo.id)}
                            style={styles.wallLogoTouchArea}>
                            <Animated.View
                              style={[
                                styles.wallLogoShell,
                                styles.wallLogoShellLeft,
                                selectedTeam === leftTeamInfo.id && styles.wallLogoShellActive,
                              ]}>
                              <Image
                                source={leftTeamInfo.imageSource}
                                resizeMode="contain"
                                style={styles.wallTeamLogo}
                              />
                            </Animated.View>
                          </AnimatedPressable>
                        </Animated.View>

                        {rightTeamInfo ? (
                          <Animated.View
                            style={[
                              styles.wallLogoPressable,
                              styles.wallLogoRight,
                              rightLogoIntroStyle,
                              matchupIdleStyle,
                            ]}>
                            <AnimatedPressable
                              accessibilityRole="button"
                              disabled={Boolean(expandedTeam)}
                              onPress={() => handleTeamLogoPress(rightTeamInfo.id)}
                              style={styles.wallLogoTouchArea}>
                              <Animated.View
                                style={[
                                  styles.wallLogoShell,
                                  styles.wallLogoShellRight,
                                  selectedTeam === rightTeamInfo.id && styles.wallLogoShellActive,
                                ]}>
                                <Image
                                  source={rightTeamInfo.imageSource}
                                  resizeMode="contain"
                                  style={styles.wallTeamLogo}
                                />
                              </Animated.View>
                            </AnimatedPressable>
                          </Animated.View>
                        ) : null}

                        {expandedTeamInfo ? (
                          <Animated.View style={[styles.expandedTeamPanel, teamDetailStyle]}>
                            <AnimatedPressable
                              accessibilityLabel="팀 상세 닫기"
                              accessibilityRole="button"
                              onPress={handleCloseTeamDetail}
                              style={styles.expandedCloseButton}>
                              <Image source={icon.closeBtn} style={styles.expandedCloseIcon} />
                            </AnimatedPressable>
                            <View style={styles.expandedLogoRing}>
                              <Image
                                source={expandedTeamInfo.imageSource}
                                resizeMode="contain"
                                style={styles.expandedTeamLogo}
                              />
                            </View>
                            <View style={styles.expandedTextBlock}>
                              <Text numberOfLines={1} adjustsFontSizeToFit style={styles.expandedTeamName}>
                                {expandedTeamInfo.name}
                              </Text>
                              <Text numberOfLines={2} style={styles.expandedTeamMembers}>
                                {expandedTeamInfo.members.join(' / ')}
                              </Text>
                            </View>
                          </Animated.View>
                        ) : null}
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
                    disabled={!expandedTeam || !selectedTeamInfo || typeof selectedTeamInfo.participantId !== 'number'}
                    onPress={handleSelectNext}
                    style={[
                      styles.nextButton,
                      (!expandedTeam || !selectedTeamInfo || typeof selectedTeamInfo.participantId !== 'number') &&
                        styles.nextButtonDisabled,
                    ]}>
                      <Text
                        style={[
                          styles.nextButtonText,
                          (!expandedTeam || !selectedTeamInfo || typeof selectedTeamInfo.participantId !== 'number') &&
                            styles.nextButtonTextDisabled,
                        ]}>
                      다음
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
                <Text style={styles.confirmEyebrow}>승부예측 확인</Text>
                <Text style={styles.confirmTitle}>
                  {selectedTeamInfo?.name ?? '참가팀'}에 투표하고{'\n'}응원댓글을 등록할까요?
                </Text>
                <Text numberOfLines={3} style={styles.confirmCommentPreview}>
                  “{cheerDraft.trim()}”
                </Text>
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
                    <Text style={styles.confirmSubmitText}>{isSubmittingPrediction ? '등록 중...' : '등록'}</Text>
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
              <Text style={styles.toastText}>응원댓글이 등록됐어요</Text>
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
    height: 360,
    position: 'relative',
  },
  matchupGlobalLineLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
    overflow: 'visible',
  },
  matchupSplitLineCoreWrap: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginTop: -3,
    height: 6,
    borderRadius: 999,
  },
  matchupSplitLineGlobal: {
    width: '100%',
    height: '100%',
    borderRadius: 999,
  },
  matchupStage: {
    height: '100%',
    position: 'relative',
    zIndex: 2,
    borderRadius: 12,
    overflow: 'hidden',
    // backgroundColor: '#0B0B0D',
  },
  matchupIdleLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 2,
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
  wallLogoPressable: {
    position: 'absolute',
    width: 156,
    height: 156,
    zIndex: 5,
  },
  wallLogoTouchArea: {
    width: 156,
    height: 156,
  },
  wallLogoLeft: {
    left: -16,
    top: 2,
  },
  wallLogoRight: {
    right: -16,
    bottom: 2,
  },
  wallLogoShell: {
    width: 156,
    height: 156,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wallLogoShellLeft: {
    paddingLeft: 30,
    paddingTop: 20,
  },
  wallLogoShellRight: {
    paddingRight: 30,
    paddingBottom: 20,
  },
  wallLogoShellActive: {
    transform: [{scale: 1.04}],
  },
  wallTeamLogo: {
    width: 122,
    height: 122,
  },
  vsBadgeCenter: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 112,
    height: 112,
    marginTop: -56,
    marginLeft: -56,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 4,
  },
  vsLottie: {
    width: 112,
    height: 112,
  },
  vsFallbackBadge: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E50914',
    borderWidth: 3,
    borderColor: '#252525',
    shadowColor: '#E50914',
    shadowOpacity: 0.42,
    shadowRadius: 18,
    shadowOffset: {width: 0, height: 8},
    elevation: 8,
  },
  vsFallbackText: {
    color: '#FFFFFF',
    ...FONTS.font24B,
    lineHeight: 30,
  },
  expandedTeamPanel: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingVertical: 30,
    zIndex: 8,
  },
  expandedCloseButton: {
    position: 'absolute',
    top: 18,
    right: 18,
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  expandedCloseIcon: {
    width: 24,
    height: 24,
    resizeMode: 'contain',
  },
  expandedLogoRing: {
    width: 178,
    height: 178,
    borderRadius: 54,
    alignItems: 'center',
    justifyContent: 'center',
  },
  expandedTeamLogo: {
    width: 152,
    height: 152,
  },
  expandedTextBlock: {
    width: '100%',
    marginTop: 24,
    alignItems: 'center',
  },
  expandedTeamName: {
    width: '100%',
    color: '#FFFFFF',
    textAlign: 'center',
    ...FONTS.font24B,
    lineHeight: 30,
  },
  expandedTeamMembers: {
    marginTop: 8,
    width: '100%',
    color: '#DADDE4',
    textAlign: 'center',
    ...FONTS.font14B,
    lineHeight: 20,
  },
  matchupCards: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 2,
  },
  diagonalCardSlot: {
    position: 'absolute',
    width: '74%',
  },
  diagonalCardSlotTop: {
    left: 0,
    top: 0,
  },
  diagonalCardSlotBottom: {
    right: 0,
    bottom: 0,
  },
  vsBadge: {
    position: 'absolute',
    top: 149,
    left: '50%',
    width: 84,
    height: 84,
    marginLeft: -42,
    borderRadius: 42,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#171717',
    borderWidth: 3,
    borderColor: '#252525',
    shadowColor: '#E50914',
    shadowOpacity: 0.36,
    shadowRadius: 18,
    shadowOffset: {width: 0, height: 8},
    elevation: 8,
    zIndex: 5,
    overflow: 'hidden',
  },
  vsText: {
    color: '#E50914',
    ...FONTS.font20B,
    lineHeight: 24,
  },
  choiceCardShell: {
    width: '100%',
  },
  choicePressable: {
    width: '100%',
  },
  choiceCard: {
    width: '100%',
    height: 164,
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
  teamCardTextBlock: {
    flex: 1,
    marginLeft: 13,
    paddingBottom: 36,
    alignItems: 'flex-start',
  },
  teamCardName: {
    color: '#FFFFFF',
    textAlign: 'left',
    ...FONTS.font22B,
    lineHeight: 28,
  },
  teamCardMembers: {
    marginTop: 7,
    color: '#C9CBD2',
    textAlign: 'left',
    ...FONTS.font12M,
    lineHeight: 18,
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
