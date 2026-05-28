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
import {AppGnb} from '../components/AppGnb';
import {TabSceneTransition} from '../components/TabSceneTransition';
import {useAuth} from '../auth/AuthProvider';
import {image} from '../assets/images';
import {icon} from '../assets/icons';
import {logo} from '../assets/logo';
import type {PredictionStackParamList} from '../navigation/types';
import {FONTS} from '../constants/theme';

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
    tone: '#4B5568',
  },
] as const;

const compareVsLottie = require('../assets/lotties/Compare.json');
const isLottieNativeAvailable = Boolean(UIManager.getViewManagerConfig?.('LottieAnimationView'));

type TeamId = (typeof teams)[number]['id'];
type PredictionStep = 'select' | 'comment' | 'result';

type CheerComment = {
  id: string;
  avatar: ImageSourcePropType;
  isMine?: boolean;
  name: string;
  teamId: TeamId;
  text: string;
  time: string;
};

const initialVoteCounts: Record<TeamId, number> = {
  'team-red': 46,
  'team-black': 39,
};

const initialCheerComments: CheerComment[] = [
  {
    id: 'cheer-1',
    avatar: image.profile,
    name: '김소진',
    teamId: 'team-red',
    text: '레드팀 오늘 합이 너무 좋아요. 마지막까지 밀어붙입시다!',
    time: '2분 전',
  },
  {
    id: 'cheer-2',
    avatar: image.profile,
    name: '길기환',
    teamId: 'team-black',
    text: '블랙팀 역전각 봅니다. 후반 집중력 믿어요.',
    time: '5분 전',
  },
  {
    id: 'cheer-3',
    avatar: image.profile,
    name: '이인철',
    teamId: 'team-red',
    text: '현장 분위기는 레드 쪽이 더 뜨겁네요.',
    time: '8분 전',
  },
];

function getTeamName(teamId: TeamId): string {
  return teams.find(team => team.id === teamId)?.name ?? '붕권';
}

function ChoiceCard({
  isSelected,
  onPress,
  team,
}: {
  isSelected: boolean;
  onPress: () => void;
  team: (typeof teams)[number];
}): JSX.Element {
  const selectAnim = useRef(new Animated.Value(isSelected ? 1 : 0)).current;
  const pressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(selectAnim, {
      toValue: isSelected ? 1 : 0,
      speed: 16,
      bounciness: 7,
      useNativeDriver: true,
    }).start();
  }, [isSelected, selectAnim]);

  const handlePressIn = () => {
    Animated.spring(pressAnim, {
      toValue: 1,
      speed: 26,
      bounciness: 4,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(pressAnim, {
      toValue: 0,
      speed: 18,
      bounciness: 8,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Animated.View
      style={[
        styles.choiceCardShell,
        {
          transform: [
            {
              scale: pressAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [1, 0.986],
              }),
            },
            {
              scale: selectAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [1, 1.01],
              }),
            },
          ],
        },
      ]}>
      <AnimatedPressable
        accessibilityRole="button"
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={styles.choicePressable}>
        <Animated.View style={[styles.choiceCard, isSelected && styles.choiceCardSelected]}>
          <View style={styles.teamLogoBox}>
            <Animated.Image
              source={team.imageSource}
              style={[
                styles.teamCardImage,
                {
                  transform: [
                    {
                      scale: selectAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.92, 1.12],
                      }),
                    },
                  ],
                },
              ]}
              resizeMode="contain"
            />
          </View>
          <View style={styles.teamCardTextBlock}>
            <Text numberOfLines={1} adjustsFontSizeToFit style={styles.teamCardName}>
              {team.name}
            </Text>
            <Text numberOfLines={2} style={styles.teamCardMembers}>
              {team.members.join(' / ')}
            </Text>
          </View>

          <Animated.View
            style={[
              styles.selectChip,
              isSelected && styles.selectChipSelected,
              {
                transform: [
                  {
                    scale: selectAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [1, 1.08],
                    }),
                  },
                ],
              },
            ]}>
            <Text style={styles.selectChipText}>{isSelected ? '선택됨' : '선택'}</Text>
          </Animated.View>
        </Animated.View>
      </AnimatedPressable>
    </Animated.View>
  );
}

export function PredictionDetailScreen(): JSX.Element {
  const navigation = useNavigation<NativeStackNavigationProp<PredictionStackParamList>>();
  const route = useRoute<RouteProp<PredictionStackParamList, 'PredictionDetail'>>();
  const {auth} = useAuth();
  const profileImageUri = typeof auth?.profile?.profileImageUri === 'string' ? auth.profile.profileImageUri : null;
  const myAvatarSource = profileImageUri ? {uri: profileImageUri} : image.profile;
  const myName = auth?.name ?? '이인철';
  const initialSelectedTeam = route.params?.selectedTeamId ?? 'team-red';
  const isParticipatedDetail = route.params?.mode === 'participated';
  const [step, setStep] = useState<PredictionStep>(isParticipatedDetail ? 'result' : 'select');
  const [selectedTeam, setSelectedTeam] = useState<TeamId>(initialSelectedTeam);
  const [expandedTeam, setExpandedTeam] = useState<TeamId | null>(isParticipatedDetail ? initialSelectedTeam : null);
  const [matchupStageSize, setMatchupStageSize] = useState({height: 0, width: 0});
  const [cheerDraft, setCheerDraft] = useState('');
  const [isConfirmVisible, setIsConfirmVisible] = useState(false);
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
  const teamDetailProgress = useRef(new Animated.Value(isParticipatedDetail ? 1 : 0)).current;
  const toastProgress = useRef(new Animated.Value(0)).current;
  const selectedTeamInfo = teams.find(team => team.id === selectedTeam) ?? teams[0];
  const expandedTeamInfo = expandedTeam ? teams.find(team => team.id === expandedTeam) ?? teams[0] : null;

  const voteCounts = {
    ...initialVoteCounts,
    ...(submittedComment
      ? {
          [submittedComment.teamId]: initialVoteCounts[submittedComment.teamId] + 1,
        }
      : {}),
  };
  const totalVotes = voteCounts['team-red'] + voteCounts['team-black'];
  const redRatio = totalVotes ? Math.round((voteCounts['team-red'] / totalVotes) * 100) : 0;
  const blackRatio = 100 - redRatio;
  const cheerComments = submittedComment ? [submittedComment, ...initialCheerComments] : initialCheerComments;
  const matchupSplitLineStyle = useMemo(() => {
    const {height, width} = matchupStageSize;

    if (!width || !height) {
      return {
        marginLeft: -1,
        transform: [{rotate: '-35deg'}],
        width: 2,
      };
    }

    const diagonalLength = Math.sqrt(width * width + height * height);
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
    if (step !== 'select') {
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
  }, [stageIntroProgress, step]);

  useEffect(() => {
    playStageIntro();
  }, [playStageIntro]);

  useFocusEffect(
    useCallback(() => {
      playStageIntro();
    }, [playStageIntro]),
  );

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

    setIsConfirmVisible(true);
  };

  const handleConfirmSubmit = () => {
    const trimmedComment = cheerDraft.trim();

    if (!trimmedComment) {
      setIsConfirmVisible(false);
      return;
    }

    setSubmittedComment({
      id: `my-cheer-${Date.now()}`,
      avatar: myAvatarSource,
      isMine: true,
      name: myName,
      teamId: selectedTeam,
      text: trimmedComment,
      time: '방금 전',
    });
    setIsConfirmVisible(false);
    showSubmitToast();
    transitionToStep('result');
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
            {step === 'result' && submittedComment ? (
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.resultContent}>
                <View style={styles.resultHero}>
                  <Text style={styles.resultEyebrow}>내 선택</Text>
                  <Text style={styles.resultTitle}>{getTeamName(submittedComment.teamId)}</Text>
                  <Text style={styles.resultSubtitle}>경기 종료 후 결과에 따라 코인을 지급받을 수 있어요</Text>
                </View>

                <View style={styles.voteCard}>
                  <View style={styles.voteHeader}>
                    <Text style={styles.voteTitle}>투표 현황</Text>
                    <Text style={styles.voteTotal}>총 {totalVotes}표</Text>
                  </View>

                  <View style={styles.voteGraphTrack}>
                    <View style={[styles.voteGraphRed, {flex: voteCounts['team-red']}]} />
                    <View style={[styles.voteGraphBlack, {flex: voteCounts['team-black']}]} />
                  </View>

                  <View style={styles.voteLegendRow}>
                    <View style={styles.voteLegendItem}>
                      <View style={[styles.voteDot, {backgroundColor: '#E50914'}]} />
                      <Text style={styles.voteLegendText}>
                        {getTeamName('team-red')} {voteCounts['team-red']}표 · {redRatio}%
                      </Text>
                    </View>
                    <View style={styles.voteLegendItem}>
                      <View style={[styles.voteDot, {backgroundColor: '#4B5568'}]} />
                      <Text style={styles.voteLegendText}>
                        {getTeamName('team-black')} {voteCounts['team-black']}표 · {blackRatio}%
                      </Text>
                    </View>
                  </View>
                </View>

                <View style={styles.commentSectionHeader}>
                  <Text style={styles.commentSectionTitle}>전체 응원댓글</Text>
                  <Text style={styles.commentSectionCount}>{cheerComments.length}개</Text>
                </View>

                <View style={styles.cheerCommentList}>
                  {cheerComments.map(comment => (
                    <View key={comment.id} style={[styles.cheerCommentRow, comment.isMine && styles.myCheerCommentRow]}>
                      <Image source={comment.avatar} style={styles.cheerAvatar} resizeMode="cover" />
                      <View style={styles.cheerCommentBody}>
                        <View style={styles.cheerCommentMetaRow}>
                          <Text style={styles.cheerName}>{comment.name}</Text>
                          <View
                            style={[
                              styles.cheerTeamBadge,
                              comment.teamId === 'team-red' ? styles.cheerTeamBadgeRed : styles.cheerTeamBadgeBlack,
                            ]}>
                            <Text style={styles.cheerTeamBadgeText}>{getTeamName(comment.teamId)}</Text>
                          </View>
                          {comment.isMine ? <Text style={styles.mineLabel}>내 댓글</Text> : null}
                        </View>
                        <Text style={styles.cheerText}>{comment.text}</Text>
                        <Text style={styles.cheerTime}>{comment.time}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              </ScrollView>
            ) : step === 'select' ? (
              <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                style={styles.voteInputStep}>
                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.voteInputContent}>
                  <View style={styles.heroBlock}>
                    <Text style={styles.heroTitle}>철권7 결승전</Text>
                    <Text style={styles.heroSubtitle}>승리할 팀을 선택해주세요.</Text>
                  </View>

                  <View
                    onLayout={({nativeEvent}) => {
                      const {height, width} = nativeEvent.layout;
                      setMatchupStageSize(prev =>
                        prev.width === width && prev.height === height ? prev : {height, width},
                      );
                    }}
                    style={styles.matchupStage}>
                    <Animated.View pointerEvents="none" style={[styles.matchupIdleLayer, matchupIdleStyle]}>
                      <LinearGradient
                        pointerEvents="none"
                        colors={[
                          'rgba(229,9,20,0)',
                          'rgba(229,9,20,0.95)',
                          'rgba(229,9,20,0.95)',
                          'rgba(229,9,20,0)',
                        ]}
                        end={{x: 1, y: 0.5}}
                        locations={[0, 0.1, 0.9, 1]}
                        start={{x: 0, y: 0.5}}
                        style={[styles.matchupSplitLine, matchupSplitLineStyle]}
                      />

                      <View pointerEvents="none" style={styles.vsBadgeCenter}>
                        {isLottieNativeAvailable ? (
                          <LottieView autoPlay loop source={compareVsLottie} style={styles.vsLottie} />
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
                        onPress={() => handleTeamLogoPress(teams[0].id)}
                        style={styles.wallLogoTouchArea}>
                        <Animated.View
                          style={[
                          styles.wallLogoShell,
                          styles.wallLogoShellLeft,
                          selectedTeam === teams[0].id && styles.wallLogoShellActive,
                        ]}>
                          <Image source={teams[0].imageSource} resizeMode="contain" style={styles.wallTeamLogo} />
                        </Animated.View>
                      </AnimatedPressable>
                    </Animated.View>

                    <Animated.View
                      style={[styles.wallLogoPressable, styles.wallLogoRight, rightLogoIntroStyle, matchupIdleStyle]}>
                      <AnimatedPressable
                        accessibilityRole="button"
                        disabled={Boolean(expandedTeam)}
                        onPress={() => handleTeamLogoPress(teams[1].id)}
                        style={styles.wallLogoTouchArea}>
                        <Animated.View
                          style={[
                          styles.wallLogoShell,
                          styles.wallLogoShellRight,
                          selectedTeam === teams[1].id && styles.wallLogoShellActive,
                        ]}>
                          <Image source={teams[1].imageSource} resizeMode="contain" style={styles.wallTeamLogo} />
                        </Animated.View>
                      </AnimatedPressable>
                    </Animated.View>

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
                </ScrollView>

                <View style={styles.bottomActionWrap}>
                  <AnimatedPressable
                    accessibilityRole="button"
                    disabled={!expandedTeam}
                    onPress={handleSelectNext}
                    style={[styles.nextButton, !expandedTeam && styles.nextButtonDisabled]}>
                    <Text style={[styles.nextButtonText, !expandedTeam && styles.nextButtonTextDisabled]}>다음</Text>
                  </AnimatedPressable>
                </View>
              </KeyboardAvoidingView>
            ) : (
              <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                style={styles.voteInputStep}>
                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.voteInputContent}>
                  <View style={[styles.selectedTeamHero, {backgroundColor: selectedTeamInfo.tone}]}>
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

                  <View style={styles.commentOnlyInputBlock}>
                    <Text style={styles.commentOnlyLabel}>응원댓글</Text>
                    <TextInput
                      multiline
                      autoFocus
                      placeholder={`${selectedTeamInfo.name} 응원댓글 달기`}
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
                    disabled={!cheerDraft.trim()}
                    onPress={openSubmitConfirm}
                    style={[styles.nextButton, !cheerDraft.trim() && styles.nextButtonDisabled]}>
                    <Text style={[styles.nextButtonText, !cheerDraft.trim() && styles.nextButtonTextDisabled]}>
                      다음
                    </Text>
                  </AnimatedPressable>
                </View>
              </KeyboardAvoidingView>
            )}
          </Animated.View>

          <Modal
            animationType="fade"
            onRequestClose={() => setIsConfirmVisible(false)}
            transparent
            visible={isConfirmVisible}>
            <View style={styles.confirmOverlay}>
              <Pressable
                accessibilityLabel="확인창 닫기"
                accessibilityRole="button"
                onPress={() => setIsConfirmVisible(false)}
                style={styles.confirmBackdrop}
              />
              <View style={styles.confirmCard}>
                <Text style={styles.confirmEyebrow}>승부예측 확인</Text>
                <Text style={styles.confirmTitle}>
                  {selectedTeamInfo.name}에 투표하고{'\n'}응원댓글을 등록할까요?
                </Text>
                <Text numberOfLines={3} style={styles.confirmCommentPreview}>
                  “{cheerDraft.trim()}”
                </Text>

                <View style={styles.confirmActions}>
                  <AnimatedPressable
                    accessibilityRole="button"
                    onPress={() => setIsConfirmVisible(false)}
                    style={[styles.confirmButton, styles.confirmCancelButton]}>
                    <Text style={styles.confirmCancelText}>취소</Text>
                  </AnimatedPressable>
                  <AnimatedPressable
                    accessibilityRole="button"
                    onPress={handleConfirmSubmit}
                    style={[styles.confirmButton, styles.confirmSubmitButton]}>
                    <Text style={styles.confirmSubmitText}>등록</Text>
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
  voteInputContent: {
    paddingBottom: 112,
  },
  backRow: {
    paddingHorizontal: 20,
    paddingTop: 12,
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
    paddingTop: 20,
    paddingBottom: 30,
  },
  heroTitle: {
    color: '#FFFFFF',
    ...FONTS.font22B,
    lineHeight: 30,
  },
  heroSubtitle: {
    marginTop: 8,
    color: 'rgba(255,255,255,0.7)',
    ...FONTS.font16M,
    lineHeight: 21,
  },
  matchupStage: {
    marginHorizontal: 20,
    marginTop: 8,
    height: 360,
    position: 'relative',
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#0B0B0D',
  },
  matchupIdleLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 2,
  },
  matchupSplitLine: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginTop: -3,
    height: 6,
    borderRadius: 999,
    zIndex: 3,
  },
  teamInfoBlock: {
    position: 'absolute',
    width: '44%',
    padding: 14,
    borderRadius: 18,
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
    borderColor: '#FFFFFF',
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
    backgroundColor: '#FFFFFF',
    borderWidth: 3,
    borderColor: '#000000',
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
    borderRadius: 22,
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
    // marginHorizontal: 20,
    marginTop: 20,
    minHeight: 260,
    borderRadius: 28,
    padding: 24,
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
    width: '76%',
    height: 126,
  },
  selectedTeamTextBlock: {
    width: '100%',
  },
  commentOnlyInputBlock: {
    marginHorizontal: 20,
    // marginTop: 22,
    borderRadius: 22,
    padding: 18,
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
    minHeight: 130,
    marginTop: 14,
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
    borderRadius: 26,
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 18,
    backgroundColor: '#151519',
    borderWidth: 1,
    borderColor: '#2A2B31',
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
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#D8DAE0',
    backgroundColor: '#0B0B0D',
    ...FONTS.font14R,
    lineHeight: 21,
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
    marginTop: 24,
    borderRadius: 22,
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
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 24,
    backgroundColor: '#000000',
    borderTopWidth: 1,
    borderTopColor: '#171717',
  },
  nextButton: {
    height: 54,
    borderRadius: 16,
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
    paddingTop: 20,
    paddingBottom: 42,
  },
  resultHero: {
    borderRadius: 24,
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
    marginTop: 18,
    borderRadius: 24,
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
    backgroundColor: '#4B5568',
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
  voteLegendText: {
    color: '#D6D8DE',
    ...FONTS.font13M,
    lineHeight: 18,
  },
  commentSectionHeader: {
    marginTop: 26,
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
  cheerCommentRow: {
    flexDirection: 'row',
    borderRadius: 20,
    padding: 14,
    backgroundColor: '#0B0B0D',
    borderWidth: 1,
    borderColor: '#1B1B1F',
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
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cheerTeamBadgeRed: {
    backgroundColor: 'rgba(229,9,20,0.24)',
  },
  cheerTeamBadgeBlack: {
    backgroundColor: 'rgba(75,85,104,0.5)',
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
