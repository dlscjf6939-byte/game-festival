import React, {useCallback, useMemo, useRef, useState} from 'react';
import BottomSheet, {BottomSheetBackdrop, BottomSheetFlatList, BottomSheetTextInput} from '@gorhom/bottom-sheet';
import {
  Animated,
  Image,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
  type ImageSourcePropType,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import {AppGnb} from '../components/AppGnb';
import {TabSceneTransition} from '../components/TabSceneTransition';
import {image} from '../assets/images';
import {FONTS} from '../constants/theme';

type HighlightItem = {
  id: string;
  image: ImageSourcePropType;
  title: string;
  description: string;
  time: string;
};

type HighlightGroup = {
  id: string;
  label: string;
  cover: ImageSourcePropType;
  items: HighlightItem[];
};

type Comment = {
  id: string;
  user: string;
  text: string;
};

type FeedPost = {
  id: string;
  user: string;
  role: string;
  avatar: ImageSourcePropType;
  image: ImageSourcePropType;
  title: string;
  caption: string;
  tag: string;
  time: string;
  likes: number;
  comments: Comment[];
};

const highlightGroups: HighlightGroup[] = [
  {
    id: 'tekken7',
    label: '철권7',
    cover: image.tekken7,
    items: [
      {
        id: 'tekken-bracket',
        image: image.tekken,
        title: '철권7 결승 진출전',
        description: '마지막 라운드까지 이어진 긴장감 넘치는 플레이.',
        time: '12분 전',
      },
      {
        id: 'tekken-main',
        image: image.poster,
        title: '오늘의 메인 매치',
        description: '결승 무대를 앞둔 선수들의 현장 스냅.',
        time: '21분 전',
      },
    ],
  },
  {
    id: 'final',
    label: '결승전',
    cover: image.homeBanner,
    items: [
      {
        id: 'final-red-black',
        image: image.homeBanner,
        title: 'TEAM RED vs TEAM BLACK',
        description: '오늘 가장 뜨거운 결승전 매치업.',
        time: '방금 전',
      },
      {
        id: 'final-poster',
        image: image.poster,
        title: '결승전 타임라인',
        description: '응원 댓글과 승부예측이 가장 많이 몰린 경기.',
        time: '8분 전',
      },
    ],
  },
  {
    id: 'coin-mission',
    label: '코인미션',
    cover: image.poster,
    items: [
      {
        id: 'coin-qr',
        image: image.poster,
        title: '오늘의 응원 미션',
        description: '피드 댓글과 현장 QR 참여로 보너스 코인을 받아보세요.',
        time: '28분 전',
      },
      {
        id: 'coin-prediction',
        image: image.homeBanner,
        title: '승부예측 참여 보상',
        description: '예측 참여 완료 시 코인 변동 내역에 바로 반영됩니다.',
        time: '35분 전',
      },
    ],
  },
  {
    id: 'snap',
    label: '현장스냅',
    cover: image.profile,
    items: [
      {
        id: 'snap-lobby',
        image: image.profile,
        title: '현장 입장 인증',
        description: '서비스개발팀부터 운영팀까지 하나씩 모이는 중.',
        time: '42분 전',
      },
      {
        id: 'snap-games',
        image: image.crazyarcade,
        title: '대기존 분위기',
        description: '다음 경기를 기다리는 동안 미니게임으로 몸풀기.',
        time: '51분 전',
      },
    ],
  },
  {
    id: 'starcraft',
    label: '스타전',
    cover: image.starcraft,
    items: [
      {
        id: 'starcraft-pick',
        image: image.starcraft,
        title: '스타크래프트 인기 픽',
        description: '승부예측 참여율이 빠르게 올라가고 있어요.',
        time: '1시간 전',
      },
    ],
  },
];

const feedPosts: FeedPost[] = [
  {
    id: 'main-event',
    user: 'Game Festival',
    role: '공식 운영팀',
    avatar: image.logo,
    image: image.homeBanner,
    title: 'TEAM RED vs TEAM BLACK',
    caption: '오늘 가장 뜨거운 매치업. 응원 댓글과 승부예측으로 코인을 모아보세요.',
    tag: 'MAIN EVENT',
    time: '방금 전',
    likes: 248,
    comments: [
      {id: '1', user: '이인철', text: '레드팀 폼 미쳤다. 오늘은 이긴다.'},
      {id: '2', user: '김소진', text: '블랙팀 응원합니다. 코인 걸었어요.'},
      {id: '3', user: '길기환', text: '현장 분위기 진짜 좋네요.'},
    ],
  },
  {
    id: 'tekken-highlight',
    user: 'Junior Board',
    role: '대회 스냅',
    avatar: image.profile,
    image: image.tekken,
    title: '철권7 결승 진출전',
    caption: '마지막 라운드까지 손에 땀 나는 경기. 다음 경기도 피드에서 바로 확인하세요.',
    tag: 'HIGHLIGHT',
    time: '12분 전',
    likes: 186,
    comments: [
      {id: '4', user: '김소진', text: '콤보 들어가는 순간 다 같이 소리 질렀어요.'},
      {id: '5', user: '이인철', text: '리플레이 필요합니다.'},
    ],
  },
  {
    id: 'coin-mission',
    user: 'Coin Crew',
    role: '코인 미션',
    avatar: image.profile,
    image: image.poster,
    title: '오늘의 응원 미션 오픈',
    caption: '피드에 응원 댓글을 남기고 현장 QR까지 찍으면 보너스 코인이 지급됩니다.',
    tag: 'COIN MISSION',
    time: '28분 전',
    likes: 132,
    comments: [
      {id: '6', user: '길기환', text: '보너스 코인까지 야무지게 챙깁니다.'},
      {id: '7', user: '김소진', text: '응원 댓글 완료!'},
    ],
  },
];

function formatCount(count: number): string {
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}천`;
  }

  return String(count);
}

export function FeedScreen(): JSX.Element {
  const bottomSheetRef = useRef<BottomSheet>(null);
  const scrollY = useRef(new Animated.Value(0)).current;
  const snapPoints = useMemo(() => ['66%'], []);
  const [commentDraft, setCommentDraft] = useState('');
  const [selectedPostId, setSelectedPostId] = useState(feedPosts[0].id);
  const [selectedHighlightId, setSelectedHighlightId] = useState<string | null>(null);
  const [selectedHighlightIndex, setSelectedHighlightIndex] = useState(0);
  const [likedPostIds, setLikedPostIds] = useState<string[]>(['main-event']);
  const [savedPostIds, setSavedPostIds] = useState<string[]>([]);
  const [commentsByPost, setCommentsByPost] = useState<Record<string, Comment[]>>(() =>
    feedPosts.reduce<Record<string, Comment[]>>((commentsMap, post) => {
      commentsMap[post.id] = post.comments;
      return commentsMap;
    }, {}),
  );

  const selectedPost = feedPosts.find(post => post.id === selectedPostId) ?? feedPosts[0];
  const selectedComments = commentsByPost[selectedPost.id] ?? [];
  const selectedHighlightGroup = highlightGroups.find(group => group.id === selectedHighlightId);
  const selectedHighlightItem = selectedHighlightGroup?.items[selectedHighlightIndex];

  const openComments = useCallback((postId: string) => {
    setSelectedPostId(postId);
    bottomSheetRef.current?.snapToIndex(0);
  }, []);

  const openHighlight = useCallback((highlightId: string) => {
    setSelectedHighlightId(highlightId);
    setSelectedHighlightIndex(0);
  }, []);

  const closeHighlight = useCallback(() => {
    setSelectedHighlightId(null);
    setSelectedHighlightIndex(0);
  }, []);

  const showPreviousHighlight = useCallback(() => {
    setSelectedHighlightIndex(currentIndex => Math.max(currentIndex - 1, 0));
  }, []);

  const showNextHighlight = useCallback(() => {
    if (!selectedHighlightGroup) {
      return;
    }

    setSelectedHighlightIndex(currentIndex => {
      const nextIndex = currentIndex + 1;

      if (nextIndex >= selectedHighlightGroup.items.length) {
        closeHighlight();
        return currentIndex;
      }

      return nextIndex;
    });
  }, [closeHighlight, selectedHighlightGroup]);

  const toggleLike = useCallback((postId: string) => {
    setLikedPostIds(prevPostIds =>
      prevPostIds.includes(postId) ? prevPostIds.filter(id => id !== postId) : [...prevPostIds, postId],
    );
  }, []);

  const toggleSave = useCallback((postId: string) => {
    setSavedPostIds(prevPostIds =>
      prevPostIds.includes(postId) ? prevPostIds.filter(id => id !== postId) : [...prevPostIds, postId],
    );
  }, []);

  const handleCommentSubmit = useCallback(() => {
    const trimmedComment = commentDraft.trim();
    if (!trimmedComment) {
      return;
    }

    setCommentsByPost(prevComments => ({
      ...prevComments,
      [selectedPost.id]: [
        ...(prevComments[selectedPost.id] ?? []),
        {
          id: `${selectedPost.id}-${Date.now()}`,
          user: '이인철',
          text: trimmedComment,
        },
      ],
    }));
    setCommentDraft('');
  }, [commentDraft, selectedPost.id]);

  const renderBackdrop = useCallback(
    (props: React.ComponentProps<typeof BottomSheetBackdrop>) => (
      <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} opacity={0.56} pressBehavior="close" />
    ),
    [],
  );

  const renderComment = useCallback(
    ({item}: {item: Comment}) => (
      <View style={styles.commentRow}>
        <Image source={image.profile} style={styles.commentAvatar} />
        <View style={styles.commentBody}>
          <Text style={styles.commentLine}>
            <Text style={styles.commentUser}>{item.user}</Text> {item.text}
          </Text>
          <Text style={styles.commentMeta}>좋아요 답글</Text>
        </View>
      </View>
    ),
    [],
  );

  return (
    <TabSceneTransition>
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="light-content" backgroundColor="#000000" />

        <View style={styles.screen}>
          <AppGnb scrollY={scrollY} />

          <Animated.ScrollView
            bounces={false}
            contentContainerStyle={styles.feedFrame}
            showsVerticalScrollIndicator={false}
            onScroll={Animated.event([{nativeEvent: {contentOffset: {y: scrollY}}}], {
              useNativeDriver: true,
            })}
            scrollEventThrottle={16}>
            <View style={styles.feedHeader}>
              <Text style={styles.feedTitle}>피드</Text>
              <Text style={styles.feedSubtitle}>게임대회 현장의 순간을 모아봤어요</Text>
            </View>

            <ScrollView horizontal contentContainerStyle={styles.highlightRow} showsHorizontalScrollIndicator={false}>
              {highlightGroups.map(group => (
                <Pressable key={group.id} onPress={() => openHighlight(group.id)} style={styles.highlightItem}>
                  <View style={styles.storyAvatarWrap}>
                    <LinearGradient
                      colors={['#FF6A61', '#F40D21', '#8E0710']}
                      start={{x: 0.2, y: 0}}
                      end={{x: 0.85, y: 1}}
                      style={styles.storyRingGradient}>
                      <View style={styles.storyRing}>
                        <Image source={group.cover} style={styles.storyImage} resizeMode="cover" />
                      </View>
                    </LinearGradient>
                    <View style={styles.highlightCountBadge}>
                      <Text style={styles.highlightCountText}>{group.items.length}</Text>
                    </View>
                  </View>
                  <Text numberOfLines={1} style={styles.storyName}>
                    {group.label}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>

            <View style={styles.postStack}>
              {feedPosts.map(post => {
                const isLiked = likedPostIds.includes(post.id);
                const isSaved = savedPostIds.includes(post.id);
                const comments = commentsByPost[post.id] ?? [];
                const likeCount = post.likes + (isLiked ? 1 : 0);

                return (
                  <View key={post.id} style={styles.postCard}>
                    <View style={styles.postHeader}>
                      <View style={styles.postHeaderLeft}>
                        <View style={styles.profileRing}>
                          <Image source={post.avatar} style={styles.profileImage} resizeMode="cover" />
                        </View>
                        <View>
                          <Text style={styles.profileName}>{post.user}</Text>
                          <Text style={styles.profileRole}>{post.role}</Text>
                        </View>
                      </View>
                      <Pressable accessibilityRole="button" style={styles.moreButton}>
                        <Text style={styles.moreIcon}>...</Text>
                      </Pressable>
                    </View>

                    <View style={styles.postImageWrap}>
                      <Image source={post.image} style={styles.postImage} resizeMode="cover" />
                      <LinearGradient colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.78)']} style={styles.postImageGradient} />
                      <View style={styles.postTag}>
                        <Text style={styles.postTagText}>{post.tag}</Text>
                      </View>
                      <View style={styles.imageTitleWrap}>
                        <Text style={styles.imageTitle}>{post.title}</Text>
                        <Text style={styles.imageTime}>{post.time}</Text>
                      </View>
                    </View>

                    <View style={styles.actionRow}>
                      <View style={styles.leftActions}>
                        <Pressable
                          accessibilityLabel="좋아요"
                          accessibilityRole="button"
                          onPress={() => toggleLike(post.id)}
                          style={styles.iconButton}>
                          <Text style={[styles.actionIcon, isLiked && styles.actionIconActive]}>
                            {isLiked ? '♥' : '♡'}
                          </Text>
                        </Pressable>
                        <Pressable
                          accessibilityLabel="댓글 보기"
                          accessibilityRole="button"
                          onPress={() => openComments(post.id)}
                          style={styles.iconButton}>
                          <Text style={styles.actionIcon}>◌</Text>
                        </Pressable>
                        <Pressable accessibilityLabel="공유" accessibilityRole="button" style={styles.iconButton}>
                          <Text style={styles.actionIcon}>↗</Text>
                        </Pressable>
                      </View>
                      <Pressable
                        accessibilityLabel="저장"
                        accessibilityRole="button"
                        onPress={() => toggleSave(post.id)}
                        style={styles.iconButton}>
                        <Text style={[styles.actionIcon, isSaved && styles.savedIcon]}>{isSaved ? '■' : '□'}</Text>
                      </Pressable>
                    </View>

                    <View style={styles.captionBlock}>
                      <Text style={styles.likeText}>좋아요 {formatCount(likeCount)}개</Text>
                      <Text style={styles.captionLine}>
                        <Text style={styles.captionUser}>{post.user} </Text>
                        {post.caption}
                      </Text>
                      <Pressable onPress={() => openComments(post.id)}>
                        <Text style={styles.commentLink}>댓글 {comments.length}개 모두 보기</Text>
                      </Pressable>
                      {comments[0] ? (
                        <Text numberOfLines={1} style={styles.previewComment}>
                          <Text style={styles.captionUser}>{comments[0].user} </Text>
                          {comments[0].text}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                );
              })}
            </View>
          </Animated.ScrollView>

          <BottomSheet
            ref={bottomSheetRef}
            index={-1}
            snapPoints={snapPoints}
            enablePanDownToClose
            backdropComponent={renderBackdrop}
            handleIndicatorStyle={styles.sheetHandle}
            handleStyle={styles.sheetHandleArea}
            backgroundStyle={styles.sheetBackground}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>댓글</Text>
              <Text numberOfLines={1} style={styles.sheetSubtitle}>
                {selectedPost.title}
              </Text>
            </View>

            <BottomSheetFlatList
              data={selectedComments}
              keyExtractor={item => item.id}
              renderItem={renderComment}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.commentListContent}
            />

            <View style={styles.commentInputWrap}>
              <Image source={image.profile} style={styles.inputAvatar} />
              <BottomSheetTextInput
                placeholder="응원 댓글 달기"
                placeholderTextColor="#8A8D95"
                style={styles.commentInput}
                value={commentDraft}
                onChangeText={setCommentDraft}
              />
              <Pressable
                accessibilityRole="button"
                disabled={!commentDraft.trim()}
                style={[styles.commentSubmitButton, !commentDraft.trim() && styles.commentSubmitButtonDisabled]}
                onPress={handleCommentSubmit}>
                <Text style={styles.commentSubmitIcon}>↑</Text>
              </Pressable>
            </View>
          </BottomSheet>

          <Modal
            animationType="fade"
            onRequestClose={closeHighlight}
            transparent
            visible={Boolean(selectedHighlightGroup && selectedHighlightItem)}>
            {selectedHighlightGroup && selectedHighlightItem ? (
              <SafeAreaView style={styles.highlightViewer}>
                <View style={styles.highlightProgressRow}>
                  {selectedHighlightGroup.items.map((item, index) => (
                    <View key={item.id} style={styles.highlightProgressTrack}>
                      <View
                        style={[
                          styles.highlightProgressFill,
                          index <= selectedHighlightIndex && styles.highlightProgressFillActive,
                        ]}
                      />
                    </View>
                  ))}
                </View>

                <View style={styles.highlightViewerHeader}>
                  <View style={styles.highlightViewerIdentity}>
                    <Image source={selectedHighlightGroup.cover} style={styles.highlightViewerAvatar} />
                    <View>
                      <Text style={styles.highlightViewerLabel}>{selectedHighlightGroup.label}</Text>
                      <Text style={styles.highlightViewerTime}>{selectedHighlightItem.time}</Text>
                    </View>
                  </View>
                  <Pressable accessibilityLabel="하이라이트 닫기" accessibilityRole="button" onPress={closeHighlight}>
                    <Text style={styles.highlightCloseText}>×</Text>
                  </Pressable>
                </View>

                <Image source={selectedHighlightItem.image} style={styles.highlightViewerImage} resizeMode="cover" />
                <LinearGradient colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.88)']} style={styles.highlightViewerGradient} />

                <View style={styles.highlightViewerText}>
                  <Text style={styles.highlightViewerTitle}>{selectedHighlightItem.title}</Text>
                  <Text style={styles.highlightViewerDescription}>{selectedHighlightItem.description}</Text>
                </View>

                <View style={styles.highlightTapLayer}>
                  <Pressable
                    accessibilityLabel="이전 하이라이트"
                    accessibilityRole="button"
                    onPress={showPreviousHighlight}
                    style={styles.highlightTapZone}
                  />
                  <Pressable
                    accessibilityLabel="다음 하이라이트"
                    accessibilityRole="button"
                    onPress={showNextHighlight}
                    style={styles.highlightTapZone}
                  />
                </View>
              </SafeAreaView>
            ) : null}
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
  feedFrame: {
    paddingBottom: 36,
  },
  feedHeader: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 16,
  },
  feedTitle: {
    color: '#FFFFFF',
    ...FONTS.font28B,
    lineHeight: 34,
  },
  feedSubtitle: {
    marginTop: 8,
    color: '#A9ABB2',
    ...FONTS.font14R,
    lineHeight: 20,
  },
  highlightRow: {
    paddingHorizontal: 20,
    paddingBottom: 18,
    gap: 14,
  },
  highlightItem: {
    width: 76,
    alignItems: 'center',
  },
  storyAvatarWrap: {
    position: 'relative',
    width: 70,
    height: 70,
  },
  storyRingGradient: {
    width: 70,
    height: 70,
    borderRadius: 35,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 3,
  },
  storyRing: {
    width: '100%',
    height: '100%',
    borderRadius: 32,
    backgroundColor: '#000000',
    padding: 3,
    overflow: 'hidden',
  },
  storyImage: {
    width: '100%',
    height: '100%',
    borderRadius: 29,
    backgroundColor: '#1A1A1A',
  },
  highlightCountBadge: {
    position: 'absolute',
    right: -1,
    bottom: -4,
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#F40D21',
    borderWidth: 2,
    borderColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  highlightCountText: {
    color: '#FFFFFF',
    ...FONTS.font10B,
    lineHeight: 12,
  },
  storyName: {
    marginTop: 9,
    color: '#D6D8DE',
    ...FONTS.font12M,
    lineHeight: 16,
  },
  postStack: {
    borderTopWidth: 1,
    borderTopColor: '#161616',
  },
  postCard: {
    backgroundColor: '#000000',
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A1A',
    paddingBottom: 14,
  },
  postHeader: {
    minHeight: 64,
    paddingHorizontal: 20,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  postHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  profileRing: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#F40D21',
    backgroundColor: '#1A1A1A',
    padding: 2,
    marginRight: 10,
  },
  profileImage: {
    width: '100%',
    height: '100%',
    borderRadius: 18,
  },
  profileName: {
    color: '#FFFFFF',
    ...FONTS.font15B,
    lineHeight: 19,
  },
  profileRole: {
    marginTop: 3,
    color: '#8A8D95',
    ...FONTS.font12R,
    lineHeight: 15,
  },
  moreButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moreIcon: {
    color: '#FFFFFF',
    ...FONTS.font22R,
    lineHeight: 22,
    letterSpacing: 1,
  },
  postImageWrap: {
    position: 'relative',
    width: '100%',
    aspectRatio: 1,
    backgroundColor: '#1A1A1A',
  },
  postImage: {
    width: '100%',
    height: '100%',
  },
  postImageGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  postTag: {
    position: 'absolute',
    left: 14,
    top: 14,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: 'rgba(244,13,33,0.88)',
  },
  postTagText: {
    color: '#FFFFFF',
    ...FONTS.font11B,
    lineHeight: 13,
  },
  imageTitleWrap: {
    position: 'absolute',
    left: 14,
    right: 14,
    bottom: 14,
  },
  imageTitle: {
    color: '#FFFFFF',
    ...FONTS.font24B,
    lineHeight: 29,
  },
  imageTime: {
    marginTop: 5,
    color: '#C9CBD1',
    ...FONTS.font12M,
    lineHeight: 16,
  },
  actionRow: {
    minHeight: 48,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  leftActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionIcon: {
    color: '#FFFFFF',
    ...FONTS.font28R,
    lineHeight: 32,
  },
  actionIconActive: {
    color: '#F40D21',
  },
  savedIcon: {
    color: '#F7CE45',
  },
  captionBlock: {
    paddingHorizontal: 20,
    paddingBottom: 4,
    gap: 7,
  },
  likeText: {
    color: '#FFFFFF',
    ...FONTS.font14B,
    lineHeight: 18,
  },
  captionLine: {
    color: '#E9E9EC',
    ...FONTS.font14R,
    lineHeight: 21,
  },
  captionUser: {
    color: '#FFFFFF',
    ...FONTS.font14B,
  },
  commentLink: {
    color: '#8A8D95',
    ...FONTS.font14R,
    lineHeight: 18,
  },
  previewComment: {
    color: '#D6D8DE',
    ...FONTS.font13R,
    lineHeight: 18,
  },
  sheetHandleArea: {
    paddingTop: 10,
  },
  sheetHandle: {
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#777A82',
  },
  sheetBackground: {
    backgroundColor: '#171717',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  sheetHeader: {
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#282828',
    alignItems: 'center',
  },
  sheetTitle: {
    color: '#FFFFFF',
    ...FONTS.font20B,
    lineHeight: 26,
  },
  sheetSubtitle: {
    marginTop: 6,
    color: '#A9ABB2',
    ...FONTS.font12R,
    lineHeight: 16,
  },
  commentListContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
  commentRow: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  commentAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    marginRight: 10,
    backgroundColor: '#2A2A2A',
  },
  commentBody: {
    flex: 1,
  },
  commentLine: {
    color: '#F5F5F5',
    ...FONTS.font14R,
    lineHeight: 20,
  },
  commentUser: {
    color: '#FFFFFF',
    ...FONTS.font14B,
  },
  commentMeta: {
    marginTop: 5,
    color: '#777A82',
    ...FONTS.font12M,
    lineHeight: 15,
  },
  commentInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 24,
    borderTopWidth: 1,
    borderTopColor: '#282828',
    backgroundColor: '#111111',
  },
  inputAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#2A2A2A',
  },
  commentInput: {
    flex: 1,
    minHeight: 42,
    borderRadius: 8,
    backgroundColor: '#232427',
    color: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 10,
    ...FONTS.font14R,
  },
  commentSubmitButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F40D21',
    alignItems: 'center',
    justifyContent: 'center',
  },
  commentSubmitButtonDisabled: {
    backgroundColor: '#3A3B40',
  },
  commentSubmitIcon: {
    color: '#FFFFFF',
    ...FONTS.font22B,
    lineHeight: 24,
  },
  highlightViewer: {
    flex: 1,
    backgroundColor: '#000000',
  },
  highlightProgressRow: {
    position: 'absolute',
    top: 10,
    left: 12,
    right: 12,
    zIndex: 5,
    flexDirection: 'row',
    gap: 5,
  },
  highlightProgressTrack: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.32)',
    overflow: 'hidden',
  },
  highlightProgressFill: {
    width: '0%',
    height: '100%',
    backgroundColor: '#FFFFFF',
  },
  highlightProgressFillActive: {
    width: '100%',
  },
  highlightViewerHeader: {
    position: 'absolute',
    top: 24,
    left: 12,
    right: 12,
    zIndex: 5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  highlightViewerIdentity: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  highlightViewerAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    marginRight: 10,
    backgroundColor: '#1A1A1A',
  },
  highlightViewerLabel: {
    color: '#FFFFFF',
    ...FONTS.font15B,
    lineHeight: 19,
  },
  highlightViewerTime: {
    marginTop: 3,
    color: '#D6D8DE',
    ...FONTS.font12R,
    lineHeight: 15,
  },
  highlightCloseText: {
    color: '#FFFFFF',
    ...FONTS.font34R,
    lineHeight: 38,
  },
  highlightViewerImage: {
    width: '100%',
    height: '100%',
  },
  highlightViewerGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  highlightViewerText: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 42,
    zIndex: 4,
  },
  highlightViewerTitle: {
    color: '#FFFFFF',
    ...FONTS.font28B,
    lineHeight: 34,
  },
  highlightViewerDescription: {
    marginTop: 10,
    color: '#D6D8DE',
    ...FONTS.font15R,
    lineHeight: 22,
  },
  highlightTapLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 3,
    flexDirection: 'row',
  },
  highlightTapZone: {
    flex: 1,
  },
});
