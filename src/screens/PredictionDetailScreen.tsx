import React, {useCallback, useEffect, useRef, useState} from 'react';
import {useFocusEffect, useNavigation, useRoute, type RouteProp} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import LottieView from 'lottie-react-native';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
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
  type NativeScrollEvent,
  type NativeSyntheticEvent,
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
const EXECUTIVE_GAME_ID = 106;
const countingLottie = require('../assets/lotties/Counting.json');
const participantTones = ['#E50914', '#3F8CFF', '#F4B740', '#21B37B', '#B05CFF'];
const {width: SCREEN_WIDTH, height: SCREEN_HEIGHT} = Dimensions.get('window');
const MAIN_POSTER_CARD_WIDTH = 327;
const MAIN_POSTER_CARD_HEIGHT = 474;
const MAIN_POSTER_ASPECT_RATIO = MAIN_POSTER_CARD_WIDTH / MAIN_POSTER_CARD_HEIGHT;
const PARTICIPANT_POSTER_MAX_HEIGHT = Math.min(MAIN_POSTER_CARD_HEIGHT, Math.max(240, SCREEN_HEIGHT * 0.38));
const PARTICIPANT_POSTER_MAX_WIDTH = Math.min(MAIN_POSTER_CARD_WIDTH, SCREEN_WIDTH - 48);
const PARTICIPANT_POSTER_CARD_WIDTH = Math.round(
  Math.min(PARTICIPANT_POSTER_MAX_WIDTH, PARTICIPANT_POSTER_MAX_HEIGHT * MAIN_POSTER_ASPECT_RATIO),
);
const PARTICIPANT_POSTER_CARD_HEIGHT = Math.round(PARTICIPANT_POSTER_CARD_WIDTH / MAIN_POSTER_ASPECT_RATIO);
const PARTICIPANT_POSTER_CARD_GAP = 18;
const PARTICIPANT_POSTER_ITEM_WIDTH = PARTICIPANT_POSTER_CARD_WIDTH + PARTICIPANT_POSTER_CARD_GAP;
const PARTICIPANT_POSTER_SNAP_INTERVAL = PARTICIPANT_POSTER_ITEM_WIDTH;
const PARTICIPANT_POSTER_STAGE_HEIGHT = PARTICIPANT_POSTER_CARD_HEIGHT + 36;
const PARTICIPANT_POSTER_SIDE_PADDING = (SCREEN_WIDTH - PARTICIPANT_POSTER_ITEM_WIDTH) / 2;
const EXECUTIVE_PROFILE_AVAILABLE_HEIGHT = Math.max(300, SCREEN_HEIGHT - 314);
const EXECUTIVE_PROFILE_CARD_HEIGHT = Math.round(Math.min(372, EXECUTIVE_PROFILE_AVAILABLE_HEIGHT));
const EXECUTIVE_RESULT_BAR_MAX_HEIGHT = 136;

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

type PredictionStep = 'select' | 'comment' | 'counting' | 'result';

type PredictionTeam = {
  department?: string;
  id: string;
  imageSource?: ImageSourcePropType;
  isIndividual?: boolean;
  members: string[];
  name: string;
  participantId?: number;
  predictionRate?: number;
  tone: string;
};

type ExecutiveProfile = {
  department?: string;
  imageSource?: ImageSourcePropType;
  name: string;
  participantId?: number;
};

type MatchParticipant = {
  department?: string;
  logoImageUrl?: string;
  name?: string;
  participantName?: string;
  participantId?: number;
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
    matchType?: string;
    participants?: Array<{
      logoImageUrl?: string;
      participantName?: string;
      participantId?: number;
      name?: string;
      department?: string;
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
      department?: string;
      logoImageUrl?: string;
      participantId?: number;
      participantName?: string;
      participantType?: string;
      name?: string;
      predictionRate?: number;
    }>;
    pickedParticipant?: {
      participantId?: number;
      participantName?: string;
    } | null;
    pickedParticipantId?: number | null;
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
  teamId: string;
  text: string;
  time: string;
};

function getTeamIdFromParticipantType(
  participantType: string | undefined,
  participantId: number,
  fallbackIndex = 0,
): string {
  if (participantType === 'TEAM_BLUE') {
    return 'team-black';
  }

  if (participantType === 'TEAM_RED') {
    return 'team-red';
  }

  if (participantType === 'TEAM_RED') {
    return 'team-red';
  }

  return fallbackIndex < 2 ? `team-${fallbackIndex}` : `participant-${participantId}`;
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
  isVoteOnlyGame: boolean,
): PredictionStep {
  if (startStep === 'comment' || startStep === 'counting' || startStep === 'result') {
    return startStep;
  }

  if (!isVoteOnlyGame) {
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

function getSeparatedParticipantName(participant: MatchParticipant, preferNameField: boolean): string | undefined {
  const department = participant.department?.trim();
  const rawName = preferNameField
    ? participant.name?.trim() || participant.participantName?.trim()
    : participant.participantName?.trim() || participant.name?.trim();

  if (!rawName || !department) {
    return rawName;
  }

  return (
    rawName
      .replace(department, '')
      .replace(/\(\s*\)|\[\s*\]|\s*[-/|·]\s*$/g, '')
      .trim() || rawName
  );
}

function toExecutiveProfile(participant: MatchParticipant | undefined): ExecutiveProfile | null {
  if (!participant) {
    return null;
  }

  const name = getSeparatedParticipantName(participant, true);
  const logoImageUrl = participant.logoImageUrl?.trim();

  if (!name) {
    return null;
  }

  return {
    department: participant.department?.trim(),
    imageSource: logoImageUrl ? {uri: logoImageUrl} : image.human,
    name,
    participantId: participant.participantId,
  };
}

function toPredictionTeam(
  participant: NonNullable<NonNullable<MatchDetailApiResponse['data']>['participants']>[number],
  index = 0,
  matchType?: string,
  isExecutiveGame = false,
): PredictionTeam | null {
  if (typeof participant.participantId !== 'number') {
    return null;
  }

  const normalizedMatchType = typeof matchType === 'string' ? matchType.trim().toUpperCase() : '';
  const isIndividual = normalizedMatchType === 'INDIVIDUAL' || Boolean(participant.department?.trim());
  const teamId = isIndividual
    ? `participant-${participant.participantId}`
    : getTeamIdFromParticipantType(participant.participantType, participant.participantId, index);
  const fallbackTeam = teamId === 'team-black' ? teams[1] : teams[0];
  const logoImageUrl = participant.logoImageUrl?.trim();
  const department = participant.department?.trim();
  const fallbackName = isExecutiveGame && index === 1 ? '일반사원' : `참가자 ${index + 1}`;
  const displayName = getSeparatedParticipantName(participant, isExecutiveGame);

  return {
    department,
    id: isIndividual ? teamId : fallbackTeam.id,
    imageSource: logoImageUrl ? {uri: logoImageUrl} : isIndividual ? image.human : fallbackTeam.imageSource,
    isIndividual,
    members: department
      ? [department]
      : (participant.participantMembers ?? [])
          .map(member => member.nickname?.trim())
          .filter((nickname): nickname is string => Boolean(nickname)),
    name: displayName || fallbackName,
    participantId: participant.participantId,
    predictionRate: toPredictionRate(participant.predictionRate),
    tone: isIndividual ? participantTones[index % participantTones.length] : fallbackTeam.tone,
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

function getPickedParticipantId(
  data: MatchDetailApiResponse['data'] | MatchOverviewApiResponse['data'] | undefined,
): number | null {
  const pickedParticipantId = data?.pickedParticipantId ?? data?.pickedParticipant?.participantId;
  return typeof pickedParticipantId === 'number' ? pickedParticipantId : null;
}

export function PredictionDetailScreen(): JSX.Element {
  const navigation = useNavigation<NativeStackNavigationProp<PredictionStackParamList>>();
  const route = useRoute<RouteProp<PredictionStackParamList, 'PredictionDetail'>>();
  const {auth, refreshProfile} = useAuth();
  const routeGameId = route.params?.gameId;
  const routeGameTitle = route.params?.gameTitle;
  const routeMatchId = route.params?.matchId;
  const isMaskSingerGame = routeGameId === MASK_SINGER_GAME_ID;
  const isExecutiveGame = routeGameId === EXECUTIVE_GAME_ID || routeGameTitle?.includes('임원') === true;
  const isVoteOnlyGame = isMaskSingerGame || isExecutiveGame;
  const profileImageUri = getProfileImageUriFromRecord(auth?.profile);
  const myAvatarSource = profileImageUri ? {uri: profileImageUri} : image.profile;
  const myName = auth?.name ?? '이인철';
  const initialSelectedTeam = route.params?.selectedTeamId ?? '';
  const isParticipatedDetail = route.params?.mode === 'participated';
  const [step, setStep] = useState<PredictionStep>(() =>
    getInitialPredictionStep(route.params?.startStep, route.params?.matchStatus, isVoteOnlyGame),
  );
  const [selectedTeam, setSelectedTeam] = useState<string>(initialSelectedTeam);
  const [matchStatus, setMatchStatus] = useState(() => normalizeMatchStatus(route.params?.matchStatus));
  const [matchType, setMatchType] = useState(() => route.params?.matchType?.trim().toUpperCase() ?? '');
  const [pickedParticipantId, setPickedParticipantId] = useState<number | null>(
    typeof route.params?.pickedParticipantId === 'number' ? route.params.pickedParticipantId : null,
  );
  const [cheerDraft, setCheerDraft] = useState('');
  const [cheerComments, setCheerComments] = useState<CheerComment[]>([]);
  const [gameDetail, setGameDetail] = useState<GameDetail | null>(null);
  const [predictionTeams, setPredictionTeams] = useState<PredictionTeam[]>([]);
  const [executiveProfile, setExecutiveProfile] = useState<ExecutiveProfile | null>(null);
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
  const participantPosterScrollX = useRef(new Animated.Value(0)).current;
  const toastProgress = useRef(new Animated.Value(0)).current;
  const selectedTeamInfo = predictionTeams.find(team => team.id === selectedTeam) ?? null;
  const isSelectedTeamInfoPending =
    !selectedTeamInfo &&
    (isGameDetailLoading || isMatchDetailLoading || isSubmittingPrediction || !predictionTeams.length);
  const canProceedToComment = Boolean(selectedTeamInfo && typeof selectedTeamInfo.participantId === 'number');
  const leftTeamInfo = predictionTeams[0] ?? null;
  const rightTeamInfo = predictionTeams[1] ?? null;
  const executiveTeamInfo = isExecutiveGame ? predictionTeams[0] ?? null : null;
  const employeeTeamInfo = isExecutiveGame ? predictionTeams[1] ?? null : null;
  const executiveDisplayProfile = executiveProfile;
  const displayGameTitle = gameDetail?.gameTitle ?? routeGameTitle ?? '경기 정보';
  const isIndividualMatch =
    !isMaskSingerGame && !isExecutiveGame && (matchType === 'INDIVIDUAL' || predictionTeams.length > 2);
  const maskSingerTeams = predictionTeams.slice(0, 4);
  const individualStageStyle = isIndividualMatch
    ? {
        height: PARTICIPANT_POSTER_STAGE_HEIGHT,
      }
    : undefined;
  const pickedTeamInfo =
    pickedParticipantId !== null
      ? predictionTeams.find(team => team.participantId === pickedParticipantId) ?? selectedTeamInfo
      : selectedTeamInfo;
  const getExecutiveVoteOptionLabel = useCallback(
    (team: PredictionTeam | null | undefined) => {
      if (!team) {
        return '참가자';
      }

      if (!isExecutiveGame) {
        return team.name;
      }

      if (team.participantId === executiveTeamInfo?.participantId) {
        return 'O';
      }

      if (team.participantId === employeeTeamInfo?.participantId) {
        return 'X';
      }

      return team.name;
    },
    [employeeTeamInfo?.participantId, executiveTeamInfo?.participantId, isExecutiveGame],
  );
  const displayTeamName = useCallback(
    (teamId: string) => getExecutiveVoteOptionLabel(predictionTeams.find(team => team.id === teamId)) ?? '참가팀',
    [getExecutiveVoteOptionLabel, predictionTeams],
  );
  const getTeamTone = useCallback(
    (teamId: string) => predictionTeams.find(team => team.id === teamId)?.tone ?? '#E50914',
    [predictionTeams],
  );
  const executiveVoteResultTeams = [executiveTeamInfo, employeeTeamInfo].filter(
    (team): team is PredictionTeam => Boolean(team),
  );
  const hasVoteRate = predictionTeams.some(team => (team.predictionRate ?? 0) > 0);
  const getExecutiveVoteBarStyle = useCallback(
    (team: PredictionTeam, index: number) => {
      const rate = hasVoteRate ? Math.max(team.predictionRate ?? 0, 0) : 50;

      return [
        styles.executiveResultBarFill,
        {
          backgroundColor: index === 0 ? '#E50914' : '#3A3B40',
          height: Math.max(8, Math.round((Math.min(rate, 100) / 100) * EXECUTIVE_RESULT_BAR_MAX_HEIGHT)),
        },
      ];
    },
    [hasVoteRate],
  );
  const getVoteGraphSegmentStyle = useCallback(
    (team: PredictionTeam) => [
      styles.voteGraphSegment,
      {
        backgroundColor: team.tone,
        flex: hasVoteRate ? Math.max(team.predictionRate ?? 0, 0.001) : 1,
      },
    ],
    [hasVoteRate],
  );
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
          outputRange: [-10, 0],
        }),
      },
      {
        scale: stageIntroProgress.interpolate({
          inputRange: [0, 0.7, 1],
          outputRange: [0.94, 1.015, 1],
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
          outputRange: [10, 0],
        }),
      },
      {
        scale: stageIntroProgress.interpolate({
          inputRange: [0, 0.7, 1],
          outputRange: [0.94, 1.015, 1],
        }),
      },
    ],
  };
  const matchupIdleStyle = {
    opacity: 1,
  };
  const renderParticipantPosterCard = useCallback(
    ({item: team, index}: {item: PredictionTeam; index: number}) => {
      const inputRange = [
        (index - 1) * PARTICIPANT_POSTER_SNAP_INTERVAL,
        index * PARTICIPANT_POSTER_SNAP_INTERVAL,
        (index + 1) * PARTICIPANT_POSTER_SNAP_INTERVAL,
      ];
      const scale = participantPosterScrollX.interpolate({
        inputRange,
        outputRange: [0.92, 1, 0.92],
        extrapolate: 'clamp',
      });
      const opacity = participantPosterScrollX.interpolate({
        inputRange,
        outputRange: [0.72, 1, 0.72],
        extrapolate: 'clamp',
      });
      const translateY = participantPosterScrollX.interpolate({
        inputRange,
        outputRange: [14, 0, 14],
        extrapolate: 'clamp',
      });
      const rotate = participantPosterScrollX.interpolate({
        inputRange,
        outputRange: ['5deg', '0deg', '-5deg'],
        extrapolate: 'clamp',
      });
      const selectionRingOpacity = participantPosterScrollX.interpolate({
        inputRange,
        outputRange: [0, 1, 0],
        extrapolate: 'clamp',
      });
      return (
        <View style={styles.participantPosterItem}>
          <AnimatedPressable
            accessibilityRole="button"
            onPress={() => setSelectedTeam(team.id)}
            style={styles.participantPosterPressable}>
            <Animated.View
              style={[
                styles.participantPosterCard,
                {
                  opacity,
                  transform: [{translateY}, {scale}, {rotate}],
                },
              ]}>
              <View style={styles.participantPosterFace}>
                {team.imageSource ? (
                  <Image resizeMode="cover" source={team.imageSource} style={styles.participantPosterImage} />
                ) : (
                  <View style={styles.participantPosterPlaceholder}>
                    <Text style={styles.participantPosterInitial}>{team.name.trim().slice(0, 1)}</Text>
                  </View>
                )}
                <View style={styles.participantPosterNoise} />
                <View pointerEvents="none" style={styles.participantPosterTextBlock}>
                  <Text numberOfLines={2} adjustsFontSizeToFit style={styles.participantPosterName}>
                    {team.name}
                  </Text>
                  <Text numberOfLines={2} adjustsFontSizeToFit style={styles.participantPosterDepartment}>
                    {team.department ?? team.members.join(' / ')}
                  </Text>
                </View>
              </View>
            </Animated.View>
            <Animated.View
              pointerEvents="none"
              style={[
                styles.participantPosterSelectionRing,
                {
                  opacity: selectionRingOpacity,
                },
              ]}
            />
          </AnimatedPressable>
        </View>
      );
    },
    [participantPosterScrollX],
  );
  const selectCenteredParticipantPoster = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>, teamsToSelect: PredictionTeam[]) => {
      if (!teamsToSelect.length) {
        return;
      }

      const offsetX = event.nativeEvent.contentOffset.x;
      const centeredIndex = Math.max(
        0,
        Math.min(teamsToSelect.length - 1, Math.round(offsetX / PARTICIPANT_POSTER_SNAP_INTERVAL)),
      );
      const centeredTeam = teamsToSelect[centeredIndex];

      if (centeredTeam && centeredTeam.id !== selectedTeam) {
        setSelectedTeam(centeredTeam.id);
      }
    },
    [selectedTeam],
  );
  const renderParticipantPosterPagination = useCallback(
    (teamsToRender: PredictionTeam[]) => (
      <View style={styles.participantPosterPagination}>
        {teamsToRender.map((team, index) => {
          const inputRange = [
            (index - 1) * PARTICIPANT_POSTER_SNAP_INTERVAL,
            index * PARTICIPANT_POSTER_SNAP_INTERVAL,
            (index + 1) * PARTICIPANT_POSTER_SNAP_INTERVAL,
          ];
          const opacity = participantPosterScrollX.interpolate({
            inputRange,
            outputRange: [0.3, 1, 0.3],
            extrapolate: 'clamp',
          });

          return (
            <Animated.View
              key={team.id}
              style={[
                styles.participantPosterPaginationDot,
                {
                  opacity,
                },
              ]}
            />
          );
        })}
      </View>
    ),
    [participantPosterScrollX],
  );

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

  useEffect(() => {
    if (step !== 'select') {
      return;
    }

    const posterTeams = isMaskSingerGame ? maskSingerTeams : isIndividualMatch ? predictionTeams : [];

    if (!posterTeams.length || posterTeams.some(team => team.id === selectedTeam)) {
      return;
    }

    setSelectedTeam(posterTeams[0].id);
  }, [isIndividualMatch, isMaskSingerGame, maskSingerTeams, predictionTeams, selectedTeam, step]);

  useEffect(() => {
    if (!isVoteOnlyGame) {
      return;
    }

    if (matchStatus === 'FINISHED') {
      setStep('result');
      return;
    }

    if (matchStatus === 'COUNTING') {
      setStep(pickedParticipantId === null ? 'select' : 'counting');
    }
  }, [isVoteOnlyGame, matchStatus, pickedParticipantId]);

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

      if (isVoteOnlyGame && nextStatus === 'FINISHED') {
        setStep('result');
      }
    }

    if (responseBody.data?.matchType) {
      setMatchType(responseBody.data.matchType.trim().toUpperCase());
    }

    const responseParticipants = responseBody.data?.participants ?? [];

    if (isExecutiveGame) {
      setExecutiveProfile(toExecutiveProfile(responseParticipants[0]));
    }

    const responseMatchType = responseBody.data?.matchType?.trim().toUpperCase() ?? matchType;
    const nextTeams = responseParticipants
      .map((participant, index) => toPredictionTeam(participant, index, responseMatchType, isExecutiveGame))
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

    const nextPickedParticipantId = getPickedParticipantId(responseBody.data);
    const pickedTeam = nextTeams.find(team => team.participantId === nextPickedParticipantId);

    setPickedParticipantId(nextPickedParticipantId);

    if (pickedTeam) {
      setSelectedTeam(pickedTeam.id);
    }

    return true;
  }, [
    auth?.accessToken,
    auth?.employeeId,
    auth?.name,
    isExecutiveGame,
    isVoteOnlyGame,
    matchType,
    routeGameId,
    routeMatchId,
  ]);

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
          if (nextGameDetail.matchType) {
            setMatchType(nextGameDetail.matchType.trim().toUpperCase());
          }
          const currentMatch = nextGameDetail.matches.find(match => match.matchId === routeMatchId);
          const nextStatus = normalizeMatchStatus(currentMatch?.matchStatus);

          if (currentMatch) {
            setMatchStatus(nextStatus);

            if (isVoteOnlyGame && nextStatus === 'FINISHED') {
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
  }, [auth?.accessToken, isVoteOnlyGame, routeGameId, routeMatchId]);

  useEffect(() => {
    const accessToken = auth?.accessToken;

    if (!accessToken || typeof routeGameId !== 'number' || typeof routeMatchId !== 'number') {
      return;
    }

    let isMounted = true;

    async function fetchMatchDetail(): Promise<void> {
      setIsMatchDetailLoading(true);

      if (!isParticipatedDetail) {
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

          if (isVoteOnlyGame && nextStatus === 'FINISHED') {
            setStep('result');
          }
        }

        if (isMounted && responseBody.data?.matchType) {
          setMatchType(responseBody.data.matchType.trim().toUpperCase());
        }

        const responseParticipants = responseBody.data?.participants ?? [];

        if (isMounted && isExecutiveGame) {
          setExecutiveProfile(toExecutiveProfile(responseParticipants[0]));
        }

        const responseMatchType = responseBody.data?.matchType?.trim().toUpperCase() ?? matchType;
        const nextTeams = responseParticipants
          .map((participant, index) => toPredictionTeam(participant, index, responseMatchType, isExecutiveGame))
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

          const nextPickedParticipantId = getPickedParticipantId(responseBody.data);
          const pickedTeam = nextTeams.find(team => team.participantId === nextPickedParticipantId);

          setPickedParticipantId(nextPickedParticipantId);

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
  }, [auth?.accessToken, isExecutiveGame, isParticipatedDetail, isVoteOnlyGame, matchType, routeGameId, routeMatchId]);

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

  const showSubmitToast = useCallback(
    (message: string) => {
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
    },
    [toastProgress],
  );

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

    if (isVoteOnlyGame) {
      if (matchStatus === 'FINISHED') {
        transitionToStep('result');
        return;
      }

      setPredictionSubmitError(null);
      setIsConfirmVisible(true);
      return;
    }

    transitionToStep('comment');
  };

  const handleExecutiveVotePress = (team: PredictionTeam | null) => {
    if (!team || typeof team.participantId !== 'number') {
      setPredictionSubmitError('투표지 정보를 확인할 수 없습니다.');
      return;
    }

    if (matchStatus === 'FINISHED') {
      setSelectedTeam(team.id);
      transitionToStep('result');
      return;
    }

    setSelectedTeam(team.id);
    setPredictionSubmitError(null);
    setIsConfirmVisible(true);
  };

  const openSubmitConfirm = () => {
    const trimmedComment = cheerDraft.trim();

    if (!isVoteOnlyGame && !trimmedComment) {
      return;
    }

    if (isVoteOnlyGame && matchStatus === 'FINISHED') {
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

    if ((!isVoteOnlyGame && !trimmedComment) || isSubmittingPrediction) {
      return;
    }

    if (typeof participantId !== 'number') {
      setPredictionSubmitError('참가팀 정보를 확인할 수 없습니다.');
      return;
    }

    setIsSubmittingPrediction(true);
    setPredictionSubmitError(null);

    try {
      if (isVoteOnlyGame) {
        const latestStatus = await requestLatestMatchStatus();

        if (latestStatus === 'FINISHED') {
          setMatchStatus(latestStatus);
          setIsConfirmVisible(false);
          Alert.alert('이미 끝난 경기입니다');

          try {
            await fetchMatchOverview();
          } catch (overviewError) {
            console.log('[PredictionDetailScreen] overview refresh after closed vote failed', overviewError);
          }

          transitionToStep('result');
          return;
        }

        if (latestStatus) {
          setMatchStatus(latestStatus);
        }
      }

      await submitPrediction(participantId, isVoteOnlyGame ? undefined : trimmedComment);
      setPickedParticipantId(participantId);
      await refreshProfile();
      let didRefreshOverview = false;

      try {
        didRefreshOverview = await fetchMatchOverview();
      } catch (overviewError) {
        console.log('[PredictionDetailScreen] overview refresh after submit failed', overviewError);
      }

      if (isVoteOnlyGame || didRefreshOverview) {
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
      showSubmitToast(
        isVoteOnlyGame ? '투표가 완료됐어요' : isIndividualMatch ? '응원이 완료됐어요' : '응원댓글이 등록됐어요',
      );
      transitionToStep(isVoteOnlyGame ? 'counting' : 'result');
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
            {(step === 'counting' || step === 'result') && !pickedTeamInfo && isSelectedTeamInfoPending ? (
              <View style={styles.fullScreenLoadingState}>
                <AppLoading label={isIndividualMatch ? '내 응원을 불러오는 중...' : '내 투표를 불러오는 중...'} />
              </View>
            ) : step === 'counting' ? (
              <View style={styles.countingContent}>
                <View style={styles.countingCard}>
                  <Text style={styles.countingEyebrow}>{isIndividualMatch ? '응원 집계중' : '투표 집계중'}</Text>
                  <Text style={styles.countingTitle}>
                    {isIndividualMatch ? '응원 결과를 집계하고 있어요' : '결과를 집계하고 있어요'}
                  </Text>
                  <LottieView autoPlay loop source={countingLottie} style={styles.countingLottie} />
                  <Text style={styles.countingSubtitle}>
                    {isIndividualMatch
                      ? '내 응원이 접수되었습니다.\n결과 공개 후 다시 확인해주세요.'
                      : '내 투표가 접수되었습니다.\n결과 공개 후 다시 확인해주세요.'}
                  </Text>
                  {pickedTeamInfo ? (
                    <View style={styles.countingSelectionBox}>
                      <Text style={styles.countingSelectionLabel}>{isIndividualMatch ? '내 응원' : '내 투표'}</Text>
                      <Text style={styles.countingSelectionName}>{getExecutiveVoteOptionLabel(pickedTeamInfo)}</Text>
                    </View>
                  ) : null}
                </View>
              </View>
            ) : step === 'result' ? (
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.resultContent}>
                <View style={styles.resultHero}>
                  <Text style={styles.resultEyebrow}>
                    {isVoteOnlyGame ? '내 투표' : isIndividualMatch ? '내 응원' : '내 선택'}
                  </Text>
                  <Text style={styles.resultTitle}>
                    {pickedTeamInfo ? getExecutiveVoteOptionLabel(pickedTeamInfo) : displayTeamName(selectedTeam)}
                  </Text>
                  <Text style={styles.resultSubtitle}>
                    {isVoteOnlyGame
                      ? '종료되어 결과를 확인할 수 있어요'
                      : '경기 종료 후 결과에 따라 코인을 지급받을 수 있어요'}
                  </Text>
                </View>

                {isExecutiveGame ? (
                  <View style={[styles.voteCard, styles.executiveResultCard]}>
                    <View style={styles.voteHeader}>
                      <Text style={styles.voteTitle}>OX 투표 결과</Text>
                      <Text style={styles.voteTotal}>최종 투표율</Text>
                    </View>

                    <View style={styles.executiveResultChart}>
                      {executiveVoteResultTeams.map((team, index) => (
                        <View key={team.id} style={styles.executiveResultColumn}>
                          <Text style={styles.executiveResultRate}>{team.predictionRate ?? 0}%</Text>
                          <View style={styles.executiveResultBarTrack}>
                            <View style={getExecutiveVoteBarStyle(team, index)} />
                          </View>
                          <View
                            style={[
                              styles.executiveResultMarkBadge,
                              index === 0 ? styles.executiveResultMarkBadgeO : styles.executiveResultMarkBadgeX,
                            ]}>
                            <Text style={styles.executiveResultMark}>{getExecutiveVoteOptionLabel(team)}</Text>
                          </View>
                          <Text style={styles.executiveResultLabel}>
                            {index === 0 ? '임원 승리' : '일반사원 승리'}
                          </Text>
                        </View>
                      ))}
                      {executiveVoteResultTeams.length === 2 ? (
                        <View pointerEvents="none" style={styles.executiveResultVsBadge}>
                          <Text style={styles.executiveResultVsText}>VS</Text>
                        </View>
                      ) : null}
                    </View>
                  </View>
                ) : (
                  <View style={styles.voteCard}>
                    <View style={styles.voteHeader}>
                      <Text style={styles.voteTitle}>{isIndividualMatch ? '응원 결과' : '투표 결과'}</Text>
                      <Text style={styles.voteTotal}>최종 {isIndividualMatch ? '응원율' : '투표율'}</Text>
                    </View>

                    <View style={styles.voteGraphTrack}>
                      {predictionTeams.map(team => (
                        <View key={team.id} style={getVoteGraphSegmentStyle(team)} />
                      ))}
                    </View>

                    <View style={styles.voteLegendRow}>
                      {predictionTeams.map(team => (
                        <View key={team.id} style={styles.voteLegendItem}>
                          <View style={[styles.voteDot, {backgroundColor: team.tone}]} />
                          <Text style={styles.voteLegendText}>
                            {getExecutiveVoteOptionLabel(team)} {team.predictionRate ?? 0}%
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}

                {!isVoteOnlyGame ? (
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
                                <View style={[styles.cheerTeamBadge, {borderColor: getTeamTone(comment.teamId)}]}>
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
                  contentContainerStyle={[
                    styles.voteInputContent,
                    (isExecutiveGame || isIndividualMatch || isMaskSingerGame) && styles.participantPosterSelectContent,
                  ]}>
                  <View style={styles.heroBlock}>
                    <Text style={styles.heroTitle}>{displayGameTitle}</Text>
                    <Text style={styles.heroSubtitle}>
                      {isGameDetailLoading || isMatchDetailLoading
                        ? '경기 정보를 불러오는 중...'
                        : isExecutiveGame
                        ? '임원이 승리한다고 생각하면 O, 일반사원이 승리한다고 생각하면 X를 선택하세요.'
                        : isIndividualMatch
                        ? '응원할 임원을 선택해주세요.'
                        : isMaskSingerGame
                        ? '더 잘한것 같은 사람에게 투표하세요.'
                        : '승리할 팀을 선택해주세요.'}
                    </Text>
                  </View>

                  {(isMatchDetailLoading && !predictionTeams.length) || (isExecutiveGame && !executiveDisplayProfile) ? (
                    <View style={styles.teamStateCenter}>
                      <AppLoading label="참가팀을 불러오는 중..." />
                    </View>
                  ) : predictionTeams.length && leftTeamInfo && (!isExecutiveGame || executiveDisplayProfile) ? (
                    <View
                      style={[
                        styles.matchupStageWrapper,
                        isMaskSingerGame && styles.maskSingerStageWrapper,
                        isExecutiveGame && styles.executiveVoteStageWrapper,
                        isIndividualMatch && styles.individualStageWrapper,
                        (isExecutiveGame || isMaskSingerGame || isIndividualMatch) && styles.participantPosterStageWrapper,
                        !isExecutiveGame && individualStageStyle,
                      ]}>
                      <View style={styles.matchupStage}>
                        {isExecutiveGame && executiveDisplayProfile ? (
                          <View style={styles.executiveVoteCardShell}>
                            <View style={styles.executiveProfileImageContainer}>
                              {executiveDisplayProfile.imageSource ? (
                                <Image
                                  resizeMode="cover"
                                  source={executiveDisplayProfile.imageSource}
                                  style={styles.executiveProfileImage}
                                />
                              ) : (
                                <View style={styles.executiveProfilePlaceholder}>
                                  <Text style={styles.participantPosterInitial}>
                                    {executiveDisplayProfile.name.trim().slice(0, 1)}
                                  </Text>
                                </View>
                              )}
                              <View pointerEvents="none" style={styles.executiveProfileNameBadge}>
                                <Text numberOfLines={1} adjustsFontSizeToFit style={styles.executiveProfileName}>
                                  {executiveDisplayProfile.name}
                                </Text>
                              </View>
                              {executiveDisplayProfile.department ? (
                                <Text numberOfLines={1} pointerEvents="none" style={styles.executiveProfileDepartment}>
                                  {executiveDisplayProfile.department}
                                </Text>
                              ) : null}
                            </View>
                          </View>
                        ) : isIndividualMatch ? (
                          <Animated.View style={[styles.participantPosterChoiceStage, matchupIdleStyle]}>
                            <Animated.FlatList
                              data={predictionTeams}
                              decelerationRate="fast"
                              disableIntervalMomentum
                              getItemLayout={(_, index) => ({
                                index,
                                length: PARTICIPANT_POSTER_SNAP_INTERVAL,
                                offset: PARTICIPANT_POSTER_SNAP_INTERVAL * index,
                              })}
                              horizontal
                              initialNumToRender={predictionTeams.length}
                              keyExtractor={team => team.id}
                              nestedScrollEnabled
                              onScroll={Animated.event(
                                [{nativeEvent: {contentOffset: {x: participantPosterScrollX}}}],
                                {useNativeDriver: true},
                              )}
                              onMomentumScrollEnd={event => selectCenteredParticipantPoster(event, predictionTeams)}
                              onScrollEndDrag={event => selectCenteredParticipantPoster(event, predictionTeams)}
                              renderItem={renderParticipantPosterCard}
                              showsHorizontalScrollIndicator={false}
                              snapToInterval={PARTICIPANT_POSTER_SNAP_INTERVAL}
                              style={styles.participantPosterList}
                              contentContainerStyle={styles.participantPosterListContent}
                            />
                            {renderParticipantPosterPagination(predictionTeams)}
                          </Animated.View>
                        ) : isMaskSingerGame ? (
                          <Animated.View style={[styles.participantPosterChoiceStage, matchupIdleStyle]}>
                            <Animated.FlatList
                              data={maskSingerTeams}
                              decelerationRate="fast"
                              disableIntervalMomentum
                              getItemLayout={(_, index) => ({
                                index,
                                length: PARTICIPANT_POSTER_SNAP_INTERVAL,
                                offset: PARTICIPANT_POSTER_SNAP_INTERVAL * index,
                              })}
                              horizontal
                              initialNumToRender={maskSingerTeams.length}
                              keyExtractor={team => team.id}
                              nestedScrollEnabled
                              onScroll={Animated.event(
                                [{nativeEvent: {contentOffset: {x: participantPosterScrollX}}}],
                                {useNativeDriver: true},
                              )}
                              onMomentumScrollEnd={event => selectCenteredParticipantPoster(event, maskSingerTeams)}
                              onScrollEndDrag={event => selectCenteredParticipantPoster(event, maskSingerTeams)}
                              renderItem={renderParticipantPosterCard}
                              showsHorizontalScrollIndicator={false}
                              snapToInterval={PARTICIPANT_POSTER_SNAP_INTERVAL}
                              style={styles.participantPosterList}
                              contentContainerStyle={styles.participantPosterListContent}
                            />
                            {renderParticipantPosterPagination(maskSingerTeams)}
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
                                      source={leftTeamInfo.imageSource ?? logo.boongkwon}
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
                                        source={rightTeamInfo.imageSource ?? logo.gwantaekdong}
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

                <View
                  style={[
                    styles.bottomActionWrap,
                    (isExecutiveGame || isIndividualMatch || isMaskSingerGame) && styles.participantPosterBottomActionWrap,
                  ]}>
                  {isExecutiveGame ? (
                    <View style={styles.executiveVoteButtonRow}>
                      <AnimatedPressable
                        accessibilityLabel="임원이 승리한다 O"
                        accessibilityRole="button"
                        disabled={!executiveTeamInfo}
                        onPress={() => handleExecutiveVotePress(executiveTeamInfo)}
                        style={[
                          styles.executiveVoteButton,
                          styles.executiveVoteButtonO,
                          !executiveTeamInfo && styles.nextButtonDisabled,
                        ]}>
                        <Text
                          style={[
                            styles.executiveVoteButtonMark,
                            !executiveTeamInfo && styles.nextButtonTextDisabled,
                          ]}>
                          O
                        </Text>
                      </AnimatedPressable>
                      <AnimatedPressable
                        accessibilityLabel="일반사원이 승리한다 X"
                        accessibilityRole="button"
                        disabled={!employeeTeamInfo}
                        onPress={() => handleExecutiveVotePress(employeeTeamInfo)}
                        style={[
                          styles.executiveVoteButton,
                          styles.executiveVoteButtonX,
                          !employeeTeamInfo && styles.nextButtonDisabled,
                        ]}>
                        <Text
                          style={[
                            styles.executiveVoteButtonMark,
                            !employeeTeamInfo && styles.nextButtonTextDisabled,
                          ]}>
                          X
                        </Text>
                      </AnimatedPressable>
                    </View>
                  ) : (
                    <AnimatedPressable
                      accessibilityRole="button"
                      disabled={!canProceedToComment}
                      onPress={handleSelectNext}
                      style={[styles.nextButton, !canProceedToComment && styles.nextButtonDisabled]}>
                      <Text style={[styles.nextButtonText, !canProceedToComment && styles.nextButtonTextDisabled]}>
                        {isMaskSingerGame ? '투표하기' : '다음'}
                      </Text>
                    </AnimatedPressable>
                  )}
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
                      {selectedTeamInfo.imageSource ? (
                        <Image
                          source={selectedTeamInfo.imageSource}
                          style={styles.selectedTeamImage}
                          resizeMode="contain"
                        />
                      ) : (
                        <View style={[styles.selectedIndividualAvatar, {borderColor: selectedTeamInfo.tone}]}>
                          <Text style={styles.selectedIndividualAvatarText}>{selectedTeamInfo.name.slice(0, 1)}</Text>
                        </View>
                      )}
                      <View style={styles.selectedTeamTextBlock}>
                        <Text style={styles.selectedTeamEyebrow}>
                          {isIndividualMatch ? '내가 응원할 임원' : '내가 선택한 팀'}
                        </Text>
                        <Text adjustsFontSizeToFit numberOfLines={1} style={styles.selectedTeamName}>
                          {selectedTeamInfo.name}
                        </Text>
                        <Text style={styles.selectedTeamMembers}>
                          {selectedTeamInfo.department ?? selectedTeamInfo.members.join(' / ')}
                        </Text>
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
                      placeholder={
                        selectedTeamInfo
                          ? `${selectedTeamInfo.name} 응원댓글 달기`
                          : '참가팀 정보를 불러온 뒤 입력할 수 있습니다.'
                      }
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
                <Text style={styles.confirmEyebrow}>
                  {isVoteOnlyGame ? '투표 확인' : isIndividualMatch ? '응원 확인' : '승부예측 확인'}
                </Text>
                <Text style={styles.confirmTitle}>
                  {isExecutiveGame
                    ? `${getExecutiveVoteOptionLabel(selectedTeamInfo)}에 투표할까요?`
                    : isIndividualMatch
                    ? `${selectedTeamInfo?.name ?? '참가자'}님을 응원할까요?`
                    : isMaskSingerGame
                    ? `${selectedTeamInfo?.name ?? '참가자'}에게 투표할까요?`
                    : `${selectedTeamInfo?.name ?? '참가팀'}에 투표하고\n응원댓글을 등록할까요?`}
                </Text>
                {!isVoteOnlyGame ? (
                  <Text numberOfLines={3} style={styles.confirmCommentPreview}>
                    “{cheerDraft.trim()}”
                  </Text>
                ) : null}
                {predictionSubmitError ? <Text style={styles.confirmErrorText}>{predictionSubmitError}</Text> : null}
                {isSubmittingPrediction ? (
                  <View style={styles.confirmLoadingRow}>
                    <ActivityIndicator color="#E50914" size="small" />
                    <Text style={styles.confirmLoadingText}>
                      {isVoteOnlyGame ? '투표를 등록하고 있어요' : '응원을 등록하고 있어요'}
                    </Text>
                  </View>
                ) : null}

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
                      {isSubmittingPrediction
                        ? '처리 중...'
                        : isVoteOnlyGame
                        ? '투표'
                        : isIndividualMatch
                        ? '응원'
                        : '등록'}
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
  participantPosterSelectContent: {
    flexGrow: 0,
    paddingBottom: 6,
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
  maskSingerStageWrapper: {
    height: PARTICIPANT_POSTER_STAGE_HEIGHT,
  },
  individualStageWrapper: {
    height: PARTICIPANT_POSTER_STAGE_HEIGHT,
  },
  executiveVoteStageWrapper: {
    height: EXECUTIVE_PROFILE_CARD_HEIGHT + 10,
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
  participantPosterStageWrapper: {
    marginHorizontal: 0,
  },
  participantPosterChoiceStage: {
    flex: 1,
  },
  executiveVoteCardShell: {
    height: EXECUTIVE_PROFILE_CARD_HEIGHT + 10,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  executiveProfileImageContainer: {
    width: '100%',
    height: '100%',
    overflow: 'hidden',
    position: 'relative',
  },
  executiveProfileImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  executiveProfilePlaceholder: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#18181C',
  },
  executiveProfileNameBadge: {
    position: 'absolute',
    left: 18,
    top: 18,
    minHeight: 34,
    maxWidth: SCREEN_WIDTH - 72,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 18,
    backgroundColor: 'rgba(11,11,13,0.72)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  executiveProfileName: {
    maxWidth: SCREEN_WIDTH - 100,
    color: '#F9F9F9',
    textAlign: 'left',
    ...FONTS.font18B,
    lineHeight: 22,
  },
  executiveProfileDepartment: {
    position: 'absolute',
    left: 18,
    top: 62,
    maxWidth: SCREEN_WIDTH - 76,
    color: 'rgba(249,249,249,0.76)',
    textAlign: 'left',
    ...FONTS.font15R,
    lineHeight: 22,
  },
  participantPosterList: {
    height: PARTICIPANT_POSTER_CARD_HEIGHT + 8,
  },
  participantPosterListContent: {
    paddingTop: 8,
    paddingHorizontal: PARTICIPANT_POSTER_SIDE_PADDING,
  },
  participantPosterItem: {
    width: PARTICIPANT_POSTER_ITEM_WIDTH,
    alignItems: 'center',
  },
  participantPosterPressable: {
    width: PARTICIPANT_POSTER_CARD_WIDTH,
    height: PARTICIPANT_POSTER_CARD_HEIGHT,
    position: 'relative',
  },
  participantPosterCard: {
    width: PARTICIPANT_POSTER_CARD_WIDTH,
    height: PARTICIPANT_POSTER_CARD_HEIGHT,
    borderRadius: 12,
    backgroundColor: '#171717',
    borderWidth: 1,
    borderColor: '#E5091455',
    overflow: 'hidden',
    position: 'relative',
  },
  participantPosterFace: {
    ...StyleSheet.absoluteFillObject,
    backfaceVisibility: 'hidden',
  },
  participantPosterImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  participantPosterPlaceholder: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#18181C',
  },
  participantPosterInitial: {
    color: '#FFFFFF',
    ...FONTS.font40B,
    lineHeight: 48,
  },
  participantPosterNoise: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  participantPosterSelectionRing: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E50914',
  },
  participantPosterTextBlock: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 18,
  },
  participantPosterName: {
    color: '#FFFFFF',
    ...FONTS.font24B,
    lineHeight: 30,
    textShadowColor: 'rgba(0,0,0,0.72)',
    textShadowOffset: {width: 0, height: 2},
    textShadowRadius: 6,
  },
  participantPosterDepartment: {
    marginTop: 6,
    color: '#FFFFFF',
    ...FONTS.font13B,
    lineHeight: 18,
    textShadowColor: 'rgba(0,0,0,0.78)',
    textShadowOffset: {width: 0, height: 1},
    textShadowRadius: 5,
  },
  participantPosterPagination: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 10,
  },
  participantPosterPaginationDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
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
  selectedIndividualAvatar: {
    width: Platform.OS === 'android' ? 86 : 112,
    height: Platform.OS === 'android' ? 86 : 112,
    borderRadius: Platform.OS === 'android' ? 43 : 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    backgroundColor: '#17171B',
  },
  selectedIndividualAvatarText: {
    color: '#FFFFFF',
    ...FONTS.font40B,
    lineHeight: 46,
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
  confirmLoadingRow: {
    marginTop: 14,
    minHeight: 38,
    borderRadius: 12,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0B0B0D',
    borderWidth: 1,
    borderColor: '#25252A',
  },
  confirmLoadingText: {
    marginLeft: 10,
    color: '#D6D8DE',
    ...FONTS.font13B,
    lineHeight: 18,
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
  participantPosterBottomActionWrap: {
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 18 : 14,
  },
  executiveVoteButtonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  executiveVoteButton: {
    flex: 1,
    height: 54,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  executiveVoteButtonO: {
    backgroundColor: '#E50914',
  },
  executiveVoteButtonX: {
    backgroundColor: '#242428',
  },
  executiveVoteButtonMark: {
    color: '#FFFFFF',
    ...FONTS.font24B,
    lineHeight: 30,
  },
  nextButton: {
    height: 54,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E50914',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
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
  executiveResultCard: {
    paddingBottom: 22,
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
  voteGraphSegment: {
    minWidth: 2,
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
  executiveResultChart: {
    marginTop: 20,
    minHeight: 232,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 42,
    position: 'relative',
  },
  executiveResultColumn: {
    width: 104,
    alignItems: 'center',
  },
  executiveResultRate: {
    marginBottom: 10,
    color: '#FFFFFF',
    ...FONTS.font28B,
    lineHeight: 34,
  },
  executiveResultBarTrack: {
    width: 52,
    height: EXECUTIVE_RESULT_BAR_MAX_HEIGHT,
    borderRadius: 26,
    justifyContent: 'flex-end',
    overflow: 'hidden',
    backgroundColor: '#242428',
    borderWidth: 1,
    borderColor: '#323238',
  },
  executiveResultBarFill: {
    width: '100%',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
  },
  executiveResultMarkBadge: {
    width: 58,
    height: 58,
    marginTop: 14,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  executiveResultMarkBadgeO: {
    backgroundColor: '#E50914',
    borderColor: '#FF6B72',
  },
  executiveResultMarkBadgeX: {
    backgroundColor: '#242428',
    borderColor: '#5A5C65',
  },
  executiveResultMark: {
    color: '#FFFFFF',
    ...FONTS.font30B,
    lineHeight: 36,
  },
  executiveResultLabel: {
    marginTop: 8,
    color: '#D6D8DE',
    textAlign: 'center',
    ...FONTS.font13B,
    lineHeight: 18,
  },
  executiveResultVsBadge: {
    position: 'absolute',
    top: 82,
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0B0B0D',
    borderWidth: 1,
    borderColor: '#34343A',
  },
  executiveResultVsText: {
    color: '#8A8D95',
    ...FONTS.font13B,
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
