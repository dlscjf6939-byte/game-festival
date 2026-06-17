import React, {useEffect, useState} from 'react';
import {useNavigation, useRoute, type RouteProp} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {Image, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, View} from 'react-native';
import {AnimatedPressable} from '../components/AnimatedPressable';
import {AppLoading} from '../components/AppLoading';
import {AppGnb} from '../components/AppGnb';
import {TabSceneTransition} from '../components/TabSceneTransition';
import {useAuth} from '../auth/AuthProvider';
import {icon} from '../assets/icons';
import {FONTS} from '../constants/theme';
import type {PredictionStackParamList} from '../navigation/types';
import {withMinimumLoadingTime} from '../utils/loading';

const API_BASE = 'http://121.254.240.93:8090';
const PREDICTION_FESTIVAL_ID = 3;
const MASK_SINGER_GAME_ID = 86;

type GameDetailMatch = {
  matchId: number;
  matchName: string;
  matchStatus: string;
  participantCount: number;
  roundName: string;
  scheduledAt: string;
};

type GameDetailApiResponse = {
  data?: {
    gameTitle?: string;
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

function formatMatchDateTime(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');

  return `${month}.${day} ${hour}:${minute}`;
}

function getMatchStatusLabel(status: string): string {
  switch (status) {
    case 'COUNTING':
      return '집계중';
    case 'FINISHED':
      return '종료';
    case 'IN_PROGRESS':
      return '게임중';
    case 'READY':
    case 'SCHEDULED':
      return '예측중';
    default:
      return status || '상태 미정';
  }
}

function toMatches(response: GameDetailApiResponse): GameDetailMatch[] {
  return (response.data?.matches ?? [])
    .filter(match => typeof match.matchId === 'number')
    .map(match => ({
      matchId: match.matchId!,
      matchName: match.matchName?.trim() || '경기',
      matchStatus: match.matchStatus?.trim() || 'UNKNOWN',
      participantCount: typeof match.participantCount === 'number' ? match.participantCount : 0,
      roundName: match.roundName?.trim() || '라운드',
      scheduledAt: match.scheduledAt?.trim() || '',
    }));
}

export function PredictionSelectScreen(): JSX.Element {
  const navigation = useNavigation<NativeStackNavigationProp<PredictionStackParamList>>();
  const route = useRoute<RouteProp<PredictionStackParamList, 'PredictionSelect'>>();
  const {auth} = useAuth();
  const [gameTitle, setGameTitle] = useState(route.params.gameTitle ?? '승부예측');
  const [isGameLoading, setIsGameLoading] = useState(true);
  const [loadErrorMessage, setLoadErrorMessage] = useState<string | null>(null);
  const [matches, setMatches] = useState<GameDetailMatch[]>([]);
  const [selectedMatchId, setSelectedMatchId] = useState<number | null>(null);
  const isMaskSingerGame = route.params.gameId === MASK_SINGER_GAME_ID;
  const selectedMatch = matches.find(match => match.matchId === selectedMatchId) ?? null;
  const isEmptyMatchState = !isGameLoading && !loadErrorMessage && matches.length === 0;

  useEffect(() => {
    const accessToken = auth?.accessToken;

    if (!accessToken) {
      setIsGameLoading(false);
      return;
    }

    let isMounted = true;

    async function fetchGameDetail(): Promise<void> {
      setIsGameLoading(true);
      setLoadErrorMessage(null);
      setGameTitle(route.params.gameTitle ?? '승부예측');
      setMatches([]);
      setSelectedMatchId(null);

      try {
        const response = await withMinimumLoadingTime(
          fetch(
            `${API_BASE}/api/festivals/${PREDICTION_FESTIVAL_ID}/games/${route.params.gameId}`,
            {
              headers: {
                Accept: 'application/json',
                Authorization: `Bearer ${accessToken}`,
              },
            },
          ),
        );
        const responseText = await response.text();
        const responseBody = JSON.parse(responseText) as GameDetailApiResponse;

        if (!response.ok || responseBody.success === false) {
          throw new Error(responseBody.message || '게임 상세 조회에 실패했습니다.');
        }

        if (isMounted) {
          const nextMatches = toMatches(responseBody);
          setGameTitle(responseBody.data?.gameTitle?.trim() || route.params.gameTitle || '승부예측');
          setMatches(nextMatches);
          setSelectedMatchId(nextMatches[0]?.matchId ?? null);
        }
      } catch (error) {
        console.log('[PredictionSelectScreen] game detail request failed', error);
        if (isMounted) {
          setLoadErrorMessage('게임 정보를 불러오지 못했습니다.');
        }
      } finally {
        if (isMounted) {
          setIsGameLoading(false);
        }
      }
    }

    fetchGameDetail();

    return () => {
      isMounted = false;
    };
  }, [auth?.accessToken, route.params.gameId, route.params.gameTitle]);

  const goNext = () => {
    if (selectedMatchId === null) {
      return;
    }

    navigation.navigate('PredictionDetail', {
      gameId: route.params.gameId,
      gameTitle,
      matchStatus: selectedMatch?.matchStatus,
      matchId: selectedMatchId,
    });
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
              onPress={() => navigation.goBack()}
              style={styles.backButton}>
              <Image source={icon.backBtn} style={styles.backIcon} />
            </AnimatedPressable>
          </View>

          {isGameLoading && !matches.length ? (
            <View style={styles.emptyStateScreen}>
              <View style={styles.heroBlock}>
                <Text style={styles.heroTitle}>{gameTitle}</Text>
                <Text style={styles.heroSubtitle}>
                  {isMaskSingerGame ? '투표할 무대를 선택해주세요.' : '예측할 경기를 선택해주세요.'}
                </Text>
              </View>
              <View style={styles.emptyMatchState}>
                <AppLoading label="경기 목록을 불러오는 중..." />
              </View>
            </View>
          ) : isEmptyMatchState ? (
            <View style={styles.emptyStateScreen}>
              <View style={styles.heroBlock}>
                <Text style={styles.heroTitle}>{gameTitle}</Text>
                <Text style={styles.heroSubtitle}>
                  {isMaskSingerGame ? '투표할 무대를 선택해주세요.' : '예측할 경기를 선택해주세요.'}
                </Text>
              </View>
              <View style={styles.emptyMatchState}>
                <Text style={styles.emptyMatchText}>현재 진행중인 경기가 없습니다.</Text>
              </View>
            </View>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
              <View style={styles.heroBlock}>
                <Text style={styles.heroTitle}>{gameTitle}</Text>
                <Text style={styles.heroSubtitle}>
                  {isMaskSingerGame ? '투표할 무대를 선택해주세요.' : '예측할 경기를 선택해주세요.'}
                </Text>
              </View>

              {loadErrorMessage ? <Text style={styles.errorText}>{loadErrorMessage}</Text> : null}

              {matches.length ? (
                <View style={styles.matchList}>
                  {matches.map(match => (
                    <AnimatedPressable
                      key={match.matchId}
                      accessibilityRole="button"
                      onPress={() => setSelectedMatchId(match.matchId)}
                      style={[styles.matchCard, selectedMatchId === match.matchId && styles.matchCardSelected]}>
                      <View style={styles.matchCardHeader}>
                        <Text style={styles.matchRoundName}>{match.roundName}</Text>
                        <View style={styles.matchStatusBadge}>
                          <Text style={styles.matchStatusText}>{getMatchStatusLabel(match.matchStatus)}</Text>
                        </View>
                      </View>
                      <Text style={styles.matchName}>{match.matchName}</Text>
                      <View style={styles.matchMetaRow}>
                        <Text style={styles.matchMetaText}>{formatMatchDateTime(match.scheduledAt)}</Text>
                        {/* <Text style={styles.matchMetaText}>참가 {match.participantCount}팀</Text> */}
                      </View>
                    </AnimatedPressable>
                  ))}
                </View>
              ) : null}
            </ScrollView>
          )}

          {matches.length ? (
            <View style={styles.bottomActionWrap}>
              <AnimatedPressable
                accessibilityRole="button"
                disabled={selectedMatchId === null || isGameLoading}
                onPress={goNext}
                style={[
                  styles.nextButton,
                  (selectedMatchId === null || isGameLoading) && styles.nextButtonDisabled,
                ]}>
                <Text
                  style={[
                    styles.nextButtonText,
                    (selectedMatchId === null || isGameLoading) && styles.nextButtonTextDisabled,
                  ]}>
                  {isMaskSingerGame && selectedMatch?.matchStatus === 'COUNTING'
                    ? '집계 보기'
                    : isMaskSingerGame && selectedMatch?.matchStatus === 'FINISHED'
                    ? '결과 보기'
                    : isMaskSingerGame
                    ? '투표하기'
                    : '다음'}
                </Text>
              </AnimatedPressable>
            </View>
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
  backRow: {
    paddingHorizontal: 20,
    height: 56,
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
  content: {
    paddingBottom: 112,
  },
  heroBlock: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 24,
  },
  heroTitle: {
    color: '#FFFFFF',
    ...FONTS.font24B,
    lineHeight: 31,
  },
  heroSubtitle: {
    marginTop: 8,
    color: 'rgba(255,255,255,0.7)',
    ...FONTS.font16M,
    lineHeight: 21,
  },
  matchList: {
    marginHorizontal: 20,
    gap: 12,
  },
  errorText: {
    marginHorizontal: 20,
    marginBottom: 12,
    color: '#E50914',
    ...FONTS.font14B,
    lineHeight: 19,
  },
  matchCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#252525',
    backgroundColor: '#171717',
    paddingHorizontal: 16,
    paddingVertical: 15,
  },
  matchCardSelected: {
    borderColor: '#E50914',
    backgroundColor: 'rgba(229,9,20,0.12)',
  },
  matchCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  matchRoundName: {
    color: '#E50914',
    ...FONTS.font12B,
    lineHeight: 16,
  },
  matchStatusBadge: {
    minHeight: 24,
    borderRadius: 8,
    paddingHorizontal: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  matchStatusText: {
    color: '#FFFFFF',
    ...FONTS.font11B,
    lineHeight: 15,
  },
  matchName: {
    marginTop: 8,
    color: '#FFFFFF',
    ...FONTS.font16B,
    lineHeight: 21,
  },
  matchMetaRow: {
    marginTop: 8,
    flexDirection: 'row',
    gap: 12,
  },
  matchMetaText: {
    color: '#8A8D95',
    ...FONTS.font12M,
    lineHeight: 16,
  },
  teamList: {
    marginTop: 22,
    paddingHorizontal: 20,
    gap: 12,
  },
  emptyTeamText: {
    paddingVertical: 24,
    color: '#8A8D95',
    textAlign: 'center',
    ...FONTS.font14M,
    lineHeight: 19,
  },
  emptyMatchText: {
    color: '#8A8D95',
    textAlign: 'center',
    ...FONTS.font14M,
    lineHeight: 19,
  },
  emptyMatchState: {
    flex: 1,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyStateScreen: {
    flex: 1,
  },
  teamCard: {
    minHeight: 116,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#252525',
    backgroundColor: '#171717',
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  teamCardSelected: {
    borderColor: '#E50914',
    backgroundColor: 'rgba(229,9,20,0.14)',
  },
  teamLogo: {
    width: 72,
    height: 72,
    marginRight: 14,
  },
  teamTextBlock: {
    flex: 1,
  },
  teamName: {
    color: '#FFFFFF',
    ...FONTS.font18B,
    lineHeight: 24,
  },
  teamMembers: {
    marginTop: 6,
    color: '#AEB1BA',
    ...FONTS.font13M,
    lineHeight: 18,
  },
  selectBadge: {
    minWidth: 58,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2A2B31',
  },
  selectBadgeActive: {
    backgroundColor: '#E50914',
  },
  selectBadgeText: {
    color: '#FFFFFF',
    ...FONTS.font12B,
    lineHeight: 16,
  },
  bottomActionWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 24,
    backgroundColor: '#000000',
    borderTopWidth: 1,
    borderTopColor: '#1F2025',
  },
  nextButton: {
    height: 54,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E50914',
  },
  nextButtonDisabled: {
    backgroundColor: '#242428',
  },
  nextButtonText: {
    color: '#FFFFFF',
    ...FONTS.font18B,
    lineHeight: 24,
  },
  nextButtonTextDisabled: {
    color: '#777A82',
  },
});
