import React, {useCallback, useEffect, useRef, useState} from 'react';
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
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ImageSourcePropType,
} from 'react-native';
import {AppGnb} from '../components/AppGnb';
import {TabSceneTransition} from '../components/TabSceneTransition';
import {useAuth} from '../auth/AuthProvider';
import {image} from '../assets/images';
import type {PredictionStackParamList} from '../navigation/types';
import {FONTS} from '../constants/theme';

const teams = [
  {id: 'team-red', imageSource: image.tekken, name: 'TEAM RED', tone: '#F40D21'},
  {id: 'team-black', imageSource: image.tekken7, name: 'TEAM BLACK', tone: '#4B5568'},
] as const;

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
  return teams.find(team => team.id === teamId)?.name ?? 'TEAM RED';
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
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}>
        <Animated.View
          style={[styles.choiceCard, isSelected && styles.choiceCardSelected]}>
          <View style={[styles.placeholderArt, {backgroundColor: team.tone}]}>
            <Image source={team.imageSource} style={styles.teamCardImage} resizeMode="cover" />
            <View style={styles.teamCardDim} />
            <View style={styles.teamCardTextBlock}>
              <Text style={styles.teamCardName}>{team.name}</Text>
              <Text style={styles.teamCardHint}>승리 예측</Text>
            </View>
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
            <Text style={styles.selectChipText}>
              {isSelected ? '선택됨' : '선택'}
            </Text>
          </Animated.View>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

function BackIcon(): JSX.Element {
  return (
    <View style={styles.backIconWrap}>
      <View style={[styles.backStroke, styles.backStrokeTop]} />
      <View style={[styles.backStroke, styles.backStrokeBottom]} />
    </View>
  );
}

export function PredictionDetailScreen(): JSX.Element {
  const navigation =
    useNavigation<NativeStackNavigationProp<PredictionStackParamList>>();
  const {auth} = useAuth();
  const profileImageUri =
    typeof auth?.profile?.profileImageUri === 'string'
      ? auth.profile.profileImageUri
      : null;
  const myAvatarSource = profileImageUri ? {uri: profileImageUri} : image.profile;
  const myName = auth?.name ?? '이인철';
  const [step, setStep] = useState<PredictionStep>('select');
  const [selectedTeam, setSelectedTeam] = useState<TeamId>('team-red');
  const [cheerDraft, setCheerDraft] = useState('');
  const [isConfirmVisible, setIsConfirmVisible] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);
  const [submittedComment, setSubmittedComment] = useState<CheerComment | null>(
    null,
  );
  const stepTransition = useRef(new Animated.Value(1)).current;
  const toastProgress = useRef(new Animated.Value(0)).current;
  const selectedTeamInfo =
    teams.find(team => team.id === selectedTeam) ?? teams[0];

  const voteCounts = {
    ...initialVoteCounts,
    ...(submittedComment
      ? {
          [submittedComment.teamId]:
            initialVoteCounts[submittedComment.teamId] + 1,
        }
      : {}),
  };
  const totalVotes = voteCounts['team-red'] + voteCounts['team-black'];
  const redRatio = totalVotes
    ? Math.round((voteCounts['team-red'] / totalVotes) * 100)
    : 0;
  const blackRatio = 100 - redRatio;
  const cheerComments = submittedComment
    ? [submittedComment, ...initialCheerComments]
    : initialCheerComments;
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
    transitionToStep('comment');
  };

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
            <Pressable
              accessibilityLabel="뒤로가기"
              accessibilityRole="button"
              onPress={handleBackPress}
              style={styles.backButton}>
              <BackIcon />
            </Pressable>
          </View>

          <Animated.View style={[styles.stepAnimatedShell, stepTransitionStyle]}>
            {step === 'result' && submittedComment ? (
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.resultContent}>
              <View style={styles.resultHero}>
                <Text style={styles.resultEyebrow}>내 선택</Text>
                <Text style={styles.resultTitle}>{getTeamName(submittedComment.teamId)}</Text>
                <Text style={styles.resultSubtitle}>
                  내 응원댓글이 전체 댓글에 반영됐어요.
                </Text>
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
                    <View style={[styles.voteDot, {backgroundColor: '#F40D21'}]} />
                    <Text style={styles.voteLegendText}>
                      TEAM RED {voteCounts['team-red']}표 · {redRatio}%
                    </Text>
                  </View>
                  <View style={styles.voteLegendItem}>
                    <View style={[styles.voteDot, {backgroundColor: '#4B5568'}]} />
                    <Text style={styles.voteLegendText}>
                      TEAM BLACK {voteCounts['team-black']}표 · {blackRatio}%
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
                  <View
                    key={comment.id}
                    style={[
                      styles.cheerCommentRow,
                      comment.isMine && styles.myCheerCommentRow,
                    ]}>
                    <Image
                      source={comment.avatar}
                      style={styles.cheerAvatar}
                      resizeMode="cover"
                    />
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
                          <Text style={styles.cheerTeamBadgeText}>
                            {getTeamName(comment.teamId)}
                          </Text>
                        </View>
                        {comment.isMine ? (
                          <Text style={styles.mineLabel}>내 댓글</Text>
                        ) : null}
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
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.voteInputContent}>
                <View style={styles.heroBlock}>
                  <Text style={styles.heroTitle}>
                    어느 팀이{'\n'}우승을 할지 맞춰보세요.
                  </Text>
                  <Text style={styles.heroSubtitle}>
                    먼저 응원할 팀을 선택해주세요.
                  </Text>
                </View>

                <View style={styles.cardList}>
                  {teams.map(team => {
                    const isSelected = selectedTeam === team.id;

                    return (
                      <ChoiceCard
                        key={team.id}
                        team={team}
                        onPress={() => setSelectedTeam(team.id)}
                        isSelected={isSelected}
                      />
                    );
                  })}
                </View>

              </ScrollView>

              <View style={styles.bottomActionWrap}>
                <Pressable
                  accessibilityRole="button"
                  onPress={handleSelectNext}
                  style={styles.nextButton}>
                  <Text style={styles.nextButtonText}>
                    다음
                  </Text>
                </Pressable>
              </View>
              </KeyboardAvoidingView>
            ) : (
              <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                style={styles.voteInputStep}>
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.voteInputContent}>
                <View
                  style={[
                    styles.selectedTeamHero,
                    {backgroundColor: selectedTeamInfo.tone},
                  ]}>
                  <Image source={selectedTeamInfo.imageSource} style={styles.selectedTeamImage} resizeMode="cover" />
                  <View style={styles.selectedTeamDim} />
                  <View style={styles.selectedTeamTextBlock}>
                    <Text style={styles.selectedTeamEyebrow}>내가 선택한 팀</Text>
                    <Text style={styles.selectedTeamName}>{selectedTeamInfo.name}</Text>
                    <Text style={styles.selectedTeamDescription}>
                      응원댓글을 남기면 투표 결과를 볼 수 있어요.
                    </Text>
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
                <Pressable
                  accessibilityRole="button"
                  disabled={!cheerDraft.trim()}
                  onPress={openSubmitConfirm}
                  style={[
                    styles.nextButton,
                    !cheerDraft.trim() && styles.nextButtonDisabled,
                  ]}>
                  <Text
                    style={[
                      styles.nextButtonText,
                      !cheerDraft.trim() && styles.nextButtonTextDisabled,
                    ]}>
                    다음
                  </Text>
                </Pressable>
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
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => setIsConfirmVisible(false)}
                    style={[styles.confirmButton, styles.confirmCancelButton]}>
                    <Text style={styles.confirmCancelText}>취소</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    onPress={handleConfirmSubmit}
                    style={[styles.confirmButton, styles.confirmSubmitButton]}>
                    <Text style={styles.confirmSubmitText}>등록</Text>
                  </Pressable>
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
  backIconWrap: {
    width: 24,
    height: 24,
    justifyContent: 'center',
  },
  backStroke: {
    position: 'absolute',
    left: 4,
    width: 11,
    height: 2.5,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
  },
  backStrokeTop: {
    transform: [{rotate: '-45deg'}],
    top: 8,
  },
  backStrokeBottom: {
    transform: [{rotate: '45deg'}],
    top: 14,
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
  cardList: {
    paddingHorizontal: 20,
    gap: 20,
  },
  choiceCardShell: {},
  choiceCard: {
    height: 140,
    borderRadius: 22,
    backgroundColor: '#111114',
    position: 'relative',
    overflow: 'hidden',
  },
  choiceCardSelected: {
    borderWidth: 2,
    borderColor: '#E50914',
  },
  placeholderArt: {
    flex: 1,
    padding: 20,
    justifyContent: 'flex-end',
  },
  teamCardImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  teamCardDim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.42)',
  },
  teamCardTextBlock: {
    position: 'relative',
    zIndex: 1,
  },
  teamCardName: {
    color: '#FFFFFF',
    ...FONTS.font28B,
    lineHeight: 34,
  },
  teamCardHint: {
    marginTop: 5,
    color: 'rgba(255,255,255,0.78)',
    ...FONTS.font13M,
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
    marginTop: 20,
    minHeight: 220,
    borderRadius: 28,
    padding: 24,
    justifyContent: 'flex-end',
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
  selectedTeamImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  selectedTeamDim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  selectedTeamTextBlock: {
    position: 'relative',
    zIndex: 1,
  },
  commentOnlyInputBlock: {
    marginHorizontal: 20,
    marginTop: 22,
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
    color: '#F40D21',
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
    backgroundColor: '#F40D21',
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
    backgroundColor: '#F40D21',
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
    backgroundColor: '#F40D21',
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
    color: '#F40D21',
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
    backgroundColor: '#F40D21',
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
    backgroundColor: 'rgba(244,13,33,0.12)',
    borderColor: 'rgba(244,13,33,0.5)',
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
    backgroundColor: 'rgba(244,13,33,0.24)',
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
    color: '#FF6A61',
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
