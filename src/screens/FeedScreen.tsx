import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import BottomSheet, {BottomSheetBackdrop, BottomSheetFlatList, BottomSheetTextInput} from '@gorhom/bottom-sheet';
import {
  Animated,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ImageSourcePropType,
  useWindowDimensions,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import {launchImageLibrary} from 'react-native-image-picker';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {AnimatedPressable} from '../components/AnimatedPressable';
import {AppGnb} from '../components/AppGnb';
import {TabSceneTransition} from '../components/TabSceneTransition';
import {icon} from '../assets/icons';
import {image} from '../assets/images';
import {useAuth} from '../auth/AuthProvider';
import {FONTS} from '../constants/theme';
import {useFeed} from '../feed/FeedProvider';
import {
  highlightGroups,
  type FeedComment,
  type FeedPost,
  feedPosts,
} from '../dummyData/feedDummyData';

type ComposeStep = 'select' | 'details';

function formatCount(count: number): string {
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}천`;
  }

  return String(count);
}

function getProfileText(profile: Record<string, unknown> | undefined, keys: string[]): string | null {
  if (!profile) {
    return null;
  }

  for (const key of keys) {
    const value = profile[key];

    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return null;
}

export function FeedScreen(): JSX.Element {
  const bottomSheetRef = useRef<BottomSheet>(null);
  const {auth} = useAuth();
  const {posts, setPosts} = useFeed();
  const {width: screenWidth} = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const scrollY = useRef(new Animated.Value(0)).current;
  const commentSubmitProgress = useRef(new Animated.Value(0)).current;
  const snapPoints = useMemo(() => ['66%'], []);
  const [commentDraft, setCommentDraft] = useState('');
  const [selectedPostId, setSelectedPostId] = useState(feedPosts[0].id);
  const [selectedHighlightId, setSelectedHighlightId] = useState<string | null>(null);
  const [selectedHighlightIndex, setSelectedHighlightIndex] = useState(0);
  const [likedPostIds, setLikedPostIds] = useState<string[]>(['main-event']);
  const [expandedCaptionPostIds, setExpandedCaptionPostIds] = useState<string[]>([]);
  const [truncatedCaptionPostIds, setTruncatedCaptionPostIds] = useState<string[]>([]);
  const [isComposeVisible, setIsComposeVisible] = useState(false);
  const [composeStep, setComposeStep] = useState<ComposeStep>('select');
  const [composeImageUris, setComposeImageUris] = useState<string[]>([]);
  const [composeCaption, setComposeCaption] = useState('');
  const [composeTags, setComposeTags] = useState<string[]>([]);
  const [composeTagDraft, setComposeTagDraft] = useState('');
  const [composeErrorMessage, setComposeErrorMessage] = useState<string | null>(null);
  const [activePostImageIndexes, setActivePostImageIndexes] = useState<Record<string, number>>({});
  const [commentsByPost, setCommentsByPost] = useState<Record<string, FeedComment[]>>(() =>
    feedPosts.reduce<Record<string, FeedComment[]>>((commentsMap, post) => {
      commentsMap[post.id] = post.comments;
      return commentsMap;
    }, {}),
  );

  const selectedPost = posts.find(post => post.id === selectedPostId) ?? posts[0] ?? feedPosts[0];
  const selectedComments = commentsByPost[selectedPost.id] ?? [];
  const selectedHighlightGroup = highlightGroups.find(group => group.id === selectedHighlightId);
  const selectedHighlightItem = selectedHighlightGroup?.items[selectedHighlightIndex];
  const isHighlightVisible = Boolean(selectedHighlightGroup && selectedHighlightItem);
  const topSafeArea = Math.max(insets.top, StatusBar.currentHeight ?? 0);
  const highlightContentTop = topSafeArea;
  const highlightProgressTop = topSafeArea + 8;
  const highlightHeaderTop = topSafeArea + 22;
  const highlightTextBottom = Math.max(insets.bottom + 32, 42);
  const isCommentSubmittable = commentDraft.trim().length > 0;
  const profileImageUri = typeof auth?.profile?.profileImageUri === 'string' ? auth.profile.profileImageUri : null;
  const myAvatarSource = useMemo<ImageSourcePropType>(
    () => (profileImageUri ? {uri: profileImageUri} : image.profile),
    [profileImageUri],
  );
  const myName = auth?.name ?? '이인철';
  const myTeamName =
    getProfileText(auth?.profile, [
      'teamName',
      'teamNm',
      'team',
      'departmentName',
      'departmentNm',
      'department',
      'deptName',
      'deptNm',
      'dept',
    ]) ?? '서비스개발팀';
  const isComposeSubmittable = Boolean(composeCaption.trim());
  const commentSubmitAnimatedStyle = {
    backgroundColor: commentSubmitProgress.interpolate({
      inputRange: [0, 1],
      outputRange: ['#3A3B40', '#E50914'],
    }),
  };

  useEffect(() => {
    Animated.timing(commentSubmitProgress, {
      toValue: isCommentSubmittable ? 1 : 0,
      duration: 180,
      useNativeDriver: false,
    }).start();
  }, [commentSubmitProgress, isCommentSubmittable]);

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

  const expandCaption = useCallback((postId: string) => {
    setExpandedCaptionPostIds(prevPostIds => (prevPostIds.includes(postId) ? prevPostIds : [...prevPostIds, postId]));
  }, []);

  const markCaptionAsTruncated = useCallback((postId: string, lineCount: number) => {
    setTruncatedCaptionPostIds(prevPostIds => {
      const isTruncated = lineCount > 2;
      const alreadyMarked = prevPostIds.includes(postId);

      if (isTruncated && !alreadyMarked) {
        return [...prevPostIds, postId];
      }

      if (!isTruncated && alreadyMarked) {
        return prevPostIds.filter(id => id !== postId);
      }

      return prevPostIds;
    });
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
          time: '방금 전',
        },
      ],
    }));
    setCommentDraft('');
  }, [commentDraft, selectedPost.id]);

  const openCompose = useCallback(() => {
    setComposeErrorMessage(null);
    setComposeStep('select');
    setIsComposeVisible(true);
  }, []);

  const closeCompose = useCallback(() => {
    setIsComposeVisible(false);
    setComposeImageUris([]);
    setComposeCaption('');
    setComposeTags([]);
    setComposeTagDraft('');
    setComposeErrorMessage(null);
    setComposeStep('select');
  }, []);

  const openComposeImageLibrary = useCallback(async () => {
    setComposeErrorMessage(null);

    const result = await launchImageLibrary({
      mediaType: 'photo',
      quality: 0.8,
      selectionLimit: 6,
    });

    if (result.didCancel) {
      return;
    }

    if (result.errorCode) {
      setComposeErrorMessage(result.errorMessage || '사진을 불러오지 못했습니다.');
      return;
    }

    const selectedUris = result.assets?.map(asset => asset.uri).filter((uri): uri is string => Boolean(uri)) ?? [];

    if (!selectedUris.length) {
      setComposeErrorMessage('선택한 사진을 확인할 수 없습니다.');
      return;
    }

    setComposeImageUris(selectedUris.slice(0, 6));
    setComposeStep('details');
  }, []);

  const goToComposeDetails = useCallback(() => {
    setComposeErrorMessage(null);
    setComposeStep('details');
  }, []);

  const addComposeTags = useCallback((rawTags: string[]) => {
    setComposeTags(prevTags => {
      const nextTags = [...prevTags];

      rawTags.forEach(rawTag => {
        const normalizedTag = rawTag.replace(/^#+/, '').trim();

        if (!normalizedTag || nextTags.length >= 6) {
          return;
        }

        const displayTag = `#${normalizedTag}`;
        const alreadyAdded = nextTags.some(tag => tag.toLowerCase() === displayTag.toLowerCase());

        if (!alreadyAdded) {
          nextTags.push(displayTag);
        }
      });

      return nextTags;
    });
  }, []);

  const handleComposeTagDraftChange = useCallback(
    (nextValue: string) => {
      if (/[\s,]/.test(nextValue)) {
        const rawTags = nextValue.split(/[\s,]+/).filter(Boolean);
        addComposeTags(rawTags);
        setComposeTagDraft('');
        return;
      }

      setComposeTagDraft(nextValue);
    },
    [addComposeTags],
  );

  const removeComposeTag = useCallback((tagToRemove: string) => {
    setComposeTags(prevTags => prevTags.filter(tag => tag !== tagToRemove));
  }, []);

  const setActivePostImageIndex = useCallback((postId: string, index: number) => {
    setActivePostImageIndexes(prevIndexes => ({
      ...prevIndexes,
      [postId]: index,
    }));
  }, []);

  const finalizeComposeTagDraft = useCallback(() => {
    if (!composeTagDraft.trim()) {
      return;
    }

    addComposeTags([composeTagDraft]);
    setComposeTagDraft('');
  }, [addComposeTags, composeTagDraft]);

  const submitCompose = useCallback(() => {
    const caption = composeCaption.trim();
    const draftTag = composeTagDraft.trim();

    if (!caption) {
      setComposeErrorMessage('내용을 입력해주세요.');
      return;
    }

    const newPost: FeedPost = {
      id: `local-post-${Date.now()}`,
      user: myName,
      role: myTeamName,
      avatar: myAvatarSource,
      images: composeImageUris.map(uri => ({uri})),
      title: '현장 피드',
      caption,
      hashtags: (draftTag
        ? [...composeTags, `#${draftTag.replace(/^#+/, '')}`].filter(
            (tag, index, tags) => tags.findIndex(item => item.toLowerCase() === tag.toLowerCase()) === index,
          )
        : composeTags
      ).slice(0, 6),
      time: '방금 전',
      likes: 0,
      comments: [],
    };

    setPosts(prevPosts => [newPost, ...prevPosts]);
    setCommentsByPost(prevComments => ({
      ...prevComments,
      [newPost.id]: [],
    }));
    setSelectedPostId(newPost.id);
    closeCompose();
  }, [
    closeCompose,
    composeCaption,
    composeImageUris,
    composeTagDraft,
    composeTags,
    myAvatarSource,
    myName,
    myTeamName,
  ]);

  const renderBackdrop = useCallback(
    (props: React.ComponentProps<typeof BottomSheetBackdrop>) => (
      <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} opacity={0.56} pressBehavior="close" />
    ),
    [],
  );

  const renderComment = useCallback(
    ({item}: {item: FeedComment}) => (
      <View style={styles.commentRow}>
        <Image source={image.profile} style={styles.commentAvatar} />
        <View style={styles.commentBody}>
          <Text style={styles.commentLine}>
            <Text style={styles.commentUser}>{item.user}</Text> {item.text}
          </Text>
          <Text style={styles.commentMeta}>{item.time || '방금 전'}</Text>
        </View>
      </View>
    ),
    [],
  );

  return (
    <TabSceneTransition>
      <View style={[styles.safeArea, {paddingTop: topSafeArea}]}>
        <StatusBar barStyle="light-content" backgroundColor="#000000" hidden={isHighlightVisible} />

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
            <ScrollView horizontal contentContainerStyle={styles.highlightRow} showsHorizontalScrollIndicator={false}>
              {highlightGroups.map((group, index) => (
                <AnimatedPressable
                  key={group.id}
                  onPress={() => openHighlight(group.id)}
                  style={[styles.highlightItem, index === highlightGroups.length - 1 && styles.highlightItemLast]}>
                  <View style={styles.storyAvatarWrap}>
                    <LinearGradient
                      colors={['#E50914', '#E50914', '#85000C']}
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
                </AnimatedPressable>
              ))}
            </ScrollView>

            <View style={styles.postStack}>
              {posts.map(post => {
                const isLiked = likedPostIds.includes(post.id);
                const isCaptionExpanded = expandedCaptionPostIds.includes(post.id);
                const isCaptionTruncated = truncatedCaptionPostIds.includes(post.id);
                const comments = commentsByPost[post.id] ?? [];
                const likeCount = post.likes + (isLiked ? 1 : 0);
                const postImages = post.images ?? (post.image ? [post.image] : []);
                const activeImageIndex = activePostImageIndexes[post.id] ?? 0;

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
                      <AnimatedPressable accessibilityRole="button" style={styles.moreButton}>
                        <Text style={styles.moreIcon}>...</Text>
                      </AnimatedPressable>
                    </View>

                    {postImages.length ? (
                      <View style={styles.postImageWrap}>
                        <ScrollView
                          horizontal
                          pagingEnabled
                          directionalLockEnabled
                          nestedScrollEnabled
                          style={styles.postImageCarousel}
                          showsHorizontalScrollIndicator={false}
                          onMomentumScrollEnd={({nativeEvent}) => {
                            const nextIndex = Math.round(
                              nativeEvent.contentOffset.x / nativeEvent.layoutMeasurement.width,
                            );
                            setActivePostImageIndex(post.id, nextIndex);
                          }}>
                          {postImages.map((postImage, index) => (
                            <Image
                              key={`${post.id}-image-${index}`}
                              source={postImage}
                              style={[styles.postImage, {width: screenWidth}]}
                              resizeMode="cover"
                            />
                          ))}
                        </ScrollView>
                        <LinearGradient
                          pointerEvents="none"
                          colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.78)']}
                          style={styles.postImageGradient}
                        />
                        {postImages.length > 1 ? (
                          <>
                            <View pointerEvents="none" style={styles.postImageCountBadge}>
                              <Text style={styles.postImageCountText}>
                                {activeImageIndex + 1}/{postImages.length}
                              </Text>
                            </View>
                            <View pointerEvents="none" style={styles.postImageDotRow}>
                              {postImages.map((_, index) => (
                                <View
                                  key={`${post.id}-dot-${index}`}
                                  style={[styles.postImageDot, index === activeImageIndex && styles.postImageDotActive]}
                                />
                              ))}
                            </View>
                          </>
                        ) : null}
                        <View
                          pointerEvents="none"
                          style={[styles.imageTitleWrap, postImages.length > 1 && styles.imageTitleWrapWithDots]}>
                          <Text style={styles.imageTitle}>{post.title}</Text>
                          <Text style={styles.imageTime}>{post.time}</Text>
                        </View>
                      </View>
                    ) : (
                      <View style={styles.textOnlyPostIntro}>
                        <Text style={styles.textOnlyPostTitle}>{post.title}</Text>
                        <Text style={styles.textOnlyPostTime}>{post.time}</Text>
                      </View>
                    )}

                    <View style={styles.actionRow}>
                      <View style={styles.leftActions}>
                        <AnimatedPressable
                          accessibilityLabel="좋아요"
                          accessibilityRole="button"
                          onPress={() => toggleLike(post.id)}
                          style={styles.iconButton}>
                          <Image
                            source={isLiked ? icon.heartFilled : icon.heartOutline}
                            style={styles.actionIconImage}
                            resizeMode="contain"
                          />
                        </AnimatedPressable>
                        <AnimatedPressable
                          accessibilityLabel="댓글 보기"
                          accessibilityRole="button"
                          onPress={() => openComments(post.id)}
                          style={styles.iconButton}>
                          <Image source={icon.commentOutline} style={styles.actionIconImage} resizeMode="contain" />
                        </AnimatedPressable>
                      </View>
                    </View>

                    <View style={styles.captionBlock}>
                      <Text style={styles.likeText}>좋아요 {formatCount(likeCount)}개</Text>
                      <Text
                        style={styles.captionMeasureLine}
                        onTextLayout={({nativeEvent}) => markCaptionAsTruncated(post.id, nativeEvent.lines.length)}>
                        <Text style={styles.captionUser}>{post.user} </Text>
                        {post.caption}
                      </Text>
                      <Text
                        ellipsizeMode="tail"
                        numberOfLines={isCaptionExpanded ? undefined : 2}
                        style={styles.captionLine}>
                        <Text style={styles.captionUser}>{post.user} </Text>
                        {post.caption}
                      </Text>
                      {isCaptionTruncated && !isCaptionExpanded ? (
                        <AnimatedPressable accessibilityRole="button" onPress={() => expandCaption(post.id)}>
                          <Text style={styles.captionMoreText}>더보기</Text>
                        </AnimatedPressable>
                      ) : null}
                      <View style={styles.hashtagRow}>
                        {post.hashtags.map(hashtag => (
                          <Text key={hashtag} style={styles.hashtagText}>
                            {hashtag}
                          </Text>
                        ))}
                      </View>
                      <AnimatedPressable onPress={() => openComments(post.id)}>
                        <Text style={styles.commentLink}>댓글 {comments.length}개 모두 보기</Text>
                      </AnimatedPressable>
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

          <AnimatedPressable
            accessibilityLabel="게시글 등록"
            accessibilityRole="button"
            onPress={openCompose}
            style={styles.composeFloatingButton}>
            <View style={styles.composePlusGlyph}>
              <View style={[styles.composePlusLine, styles.composePlusHorizontal]} />
              <View style={[styles.composePlusLine, styles.composePlusVertical]} />
            </View>
          </AnimatedPressable>

          <BottomSheet
            ref={bottomSheetRef}
            index={-1}
            snapPoints={snapPoints}
            android_keyboardInputMode="adjustResize"
            enablePanDownToClose
            keyboardBehavior="interactive"
            keyboardBlurBehavior="restore"
            backdropComponent={renderBackdrop}
            handleIndicatorStyle={styles.sheetHandle}
            handleStyle={styles.sheetHandleArea}
            backgroundStyle={styles.sheetBackground}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>댓글</Text>
            </View>

            <BottomSheetFlatList
              data={selectedComments}
              keyExtractor={item => item.id}
              renderItem={renderComment}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.commentListContent}
            />

            <View style={[styles.commentInputWrap, {paddingBottom: Math.max(insets.bottom + 12, 24)}]}>
              <Image source={image.profile} style={styles.inputAvatar} />
              <BottomSheetTextInput
                placeholder="댓글 달기"
                placeholderTextColor="#8A8D95"
                style={styles.commentInput}
                value={commentDraft}
                onChangeText={setCommentDraft}
              />
              <AnimatedPressable
                accessibilityRole="button"
                disabled={!isCommentSubmittable}
                style={styles.commentSubmitPressable}
                onPress={handleCommentSubmit}>
                <Animated.View style={[styles.commentSubmitButton, commentSubmitAnimatedStyle]}>
                  <Text style={styles.commentSubmitIcon}>↑</Text>
                </Animated.View>
              </AnimatedPressable>
            </View>
          </BottomSheet>

          <Modal animationType="fade" onRequestClose={closeHighlight} transparent visible={isHighlightVisible}>
            {selectedHighlightGroup && selectedHighlightItem ? (
              <View style={styles.highlightViewer}>
                <View style={[styles.highlightProgressRow, {top: highlightProgressTop}]}>
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

                <View style={[styles.highlightViewerHeader, {top: highlightHeaderTop}]}>
                  <View style={styles.highlightViewerIdentity}>
                    <Image source={selectedHighlightGroup.cover} style={styles.highlightViewerAvatar} />
                    <View>
                      <Text style={styles.highlightViewerLabel}>{selectedHighlightGroup.label}</Text>
                      <Text style={styles.highlightViewerTime}>{selectedHighlightItem.time}</Text>
                    </View>
                  </View>
                  <AnimatedPressable
                    accessibilityLabel="하이라이트 닫기"
                    accessibilityRole="button"
                    onPress={closeHighlight}
                    style={styles.highlightCloseButton}>
                    <Image source={icon.closeBtn} style={styles.closeIcon} />
                  </AnimatedPressable>
                </View>

                <View style={[styles.highlightMediaFrame, {top: highlightContentTop}]}>
                  <Image source={selectedHighlightItem.image} style={styles.highlightViewerImage} resizeMode="cover" />
                  <LinearGradient
                    colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.88)']}
                    style={styles.highlightViewerGradient}
                  />
                </View>

                <View style={[styles.highlightViewerText, {bottom: highlightTextBottom}]}>
                  <Text style={styles.highlightViewerTitle}>{selectedHighlightItem.title}</Text>
                  <Text style={styles.highlightViewerDescription}>{selectedHighlightItem.description}</Text>
                </View>

                <View style={styles.highlightTapLayer}>
                  <AnimatedPressable
                    accessibilityLabel="이전 하이라이트"
                    accessibilityRole="button"
                    onPress={showPreviousHighlight}
                    style={styles.highlightTapZone}
                  />
                  <AnimatedPressable
                    accessibilityLabel="다음 하이라이트"
                    accessibilityRole="button"
                    onPress={showNextHighlight}
                    style={styles.highlightTapZone}
                  />
                </View>
              </View>
            ) : null}
          </Modal>

          <Modal animationType="slide" onRequestClose={closeCompose} visible={isComposeVisible}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.composeScreen}>
              <StatusBar barStyle="light-content" backgroundColor="#050505" />

              <View style={[styles.composeHeader, {paddingTop: topSafeArea + 12}]}>
                <AnimatedPressable
                  accessibilityLabel="게시물 작성 닫기"
                  accessibilityRole="button"
                  onPress={closeCompose}
                  style={styles.composeHeaderButton}>
                  <Image source={icon.closeBtn} style={styles.closeIcon} />
                </AnimatedPressable>
                <Text style={styles.composeTitle}>{composeStep === 'select' ? '새 게시물' : '문구 입력'}</Text>
                <View style={styles.composeHeaderButton} />
              </View>

              <ScrollView
                automaticallyAdjustKeyboardInsets
                keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                style={styles.composeScroll}
                contentContainerStyle={[styles.composeContent, {paddingBottom: Math.max(insets.bottom + 24, 40)}]}>
                {composeStep === 'select' ? (
                  <>
                    <AnimatedPressable
                      accessibilityRole="button"
                      onPress={openComposeImageLibrary}
                      style={styles.composeInstagramPreview}>
                      {composeImageUris.length ? (
                        <>
                          <Image
                            source={{uri: composeImageUris[0]}}
                            style={styles.composePreviewImage}
                            resizeMode="cover"
                          />
                          {composeImageUris.length > 1 ? (
                            <View style={styles.composeSelectedCountBadge}>
                              <Text style={styles.composeSelectedCountText}>{composeImageUris.length}장</Text>
                            </View>
                          ) : null}
                        </>
                      ) : (
                        <View style={styles.composeImagePlaceholder}>
                          <Text style={styles.composeImagePlus}>＋</Text>
                          <Text style={styles.composeImageTitle}>사진을 선택하세요</Text>
                          <Text style={styles.composeImageDescription}>피드에 올릴 현장 사진을 먼저 골라주세요.</Text>
                        </View>
                      )}
                    </AnimatedPressable>

                    <View style={styles.composeAlbumBar}>
                      <View>
                        <Text style={styles.composeAlbumTitle}>최근 항목</Text>
                        <Text style={styles.composeAlbumDescription}>기기 사진앨범에서 최대 6장을 선택합니다.</Text>
                      </View>
                      <AnimatedPressable
                        accessibilityRole="button"
                        onPress={openComposeImageLibrary}
                        style={styles.composeAlbumButton}>
                        <Text style={styles.composeAlbumButtonText}>사진 선택</Text>
                      </AnimatedPressable>
                    </View>
                  </>
                ) : (
                  <>
                    <View style={styles.composeShareRow}>
                      {composeImageUris.length ? (
                        <ScrollView
                          horizontal
                          showsHorizontalScrollIndicator={false}
                          style={styles.composeShareThumbList}
                          contentContainerStyle={styles.composeShareThumbContent}>
                          {composeImageUris.map((uri, index) => (
                            <View key={`${uri}-${index}`} style={styles.composeShareThumbWrap}>
                              <Image source={{uri}} style={styles.composeShareThumb} resizeMode="cover" />
                              {composeImageUris.length > 1 ? (
                                <View style={styles.composeShareThumbBadge}>
                                  <Text style={styles.composeShareThumbBadgeText}>{index + 1}</Text>
                                </View>
                              ) : null}
                            </View>
                          ))}
                        </ScrollView>
                      ) : null}
                      <TextInput
                        multiline
                        placeholder="문구 입력..."
                        placeholderTextColor="#777A82"
                        style={styles.composeInstagramCaptionInput}
                        textAlignVertical="top"
                        value={composeCaption}
                        onChangeText={setComposeCaption}
                      />
                    </View>

                    <AnimatedPressable
                      accessibilityRole="button"
                      onPress={openComposeImageLibrary}
                      style={styles.composeChangeImageRow}>
                      <Text style={styles.composeChangeImageText}>사진 다시 선택</Text>
                    </AnimatedPressable>

                    <View style={styles.composeProfileRow}>
                      <Image source={myAvatarSource} style={styles.composeAvatar} resizeMode="cover" />
                      <View>
                        <Text style={styles.composeProfileName}>{myName}</Text>
                        <Text style={styles.composeProfileRole}>{myTeamName} 게시글</Text>
                      </View>
                    </View>

                    <View style={styles.composeInputBlock}>
                      <Text style={styles.composeLabel}>태그</Text>
                      <View style={styles.composeTagBox}>
                        {composeTags.map(tag => (
                          <AnimatedPressable
                            key={tag}
                            accessibilityLabel={`${tag} 태그 삭제`}
                            accessibilityRole="button"
                            onPress={() => removeComposeTag(tag)}
                            style={styles.composeTagChip}>
                            <Text style={styles.composeTagChipText}>{tag}</Text>
                            <Text style={styles.composeTagChipRemove}>×</Text>
                          </AnimatedPressable>
                        ))}
                        <TextInput
                          autoCapitalize="none"
                          blurOnSubmit={false}
                          onBlur={finalizeComposeTagDraft}
                          onSubmitEditing={finalizeComposeTagDraft}
                          placeholder={composeTags.length ? '태그 추가' : '#철권7 #응원 #현장스냅'}
                          placeholderTextColor="#777A82"
                          returnKeyType="done"
                          style={styles.composeTagInput}
                          value={composeTagDraft}
                          onChangeText={handleComposeTagDraftChange}
                        />
                      </View>
                      <Text style={styles.composeHelperText}>띄어쓰기나 쉼표를 입력하면 태그가 뱃지로 바뀌어요.</Text>
                    </View>
                  </>
                )}

                {composeErrorMessage ? <Text style={styles.composeErrorText}>{composeErrorMessage}</Text> : null}
              </ScrollView>

              <View style={[styles.composeFooter, {paddingBottom: Math.max(insets.bottom + 12, 24)}]}>
                <AnimatedPressable
                  accessibilityRole="button"
                  disabled={composeStep === 'details' && !isComposeSubmittable}
                  onPress={composeStep === 'select' ? goToComposeDetails : submitCompose}
                  style={[
                    styles.composePrimaryButton,
                    composeStep === 'details' && !isComposeSubmittable && styles.composePrimaryButtonDisabled,
                  ]}>
                  <Text
                    style={[
                      styles.composePrimaryButtonText,
                      composeStep === 'details' && !isComposeSubmittable && styles.composePrimaryButtonTextDisabled,
                    ]}>
                    {composeStep === 'select' ? '다음' : '공유하기'}
                  </Text>
                </AnimatedPressable>
              </View>
            </KeyboardAvoidingView>
          </Modal>
        </View>
      </View>
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
  highlightRow: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 18,
  },
  highlightItem: {
    width: 74,
    alignItems: 'center',
    marginRight: 14,
  },
  highlightItemLast: {
    marginRight: 0,
  },
  storyAvatarWrap: {
    position: 'relative',
    width: 72,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
  },
  storyRingGradient: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  storyRing: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#000000',
    padding: 3,
    overflow: 'hidden',
  },
  storyImage: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#1A1A1A',
  },
  highlightCountBadge: {
    position: 'absolute',
    right: 1,
    bottom: 0,
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#E50914',
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
    borderColor: '#E50914',
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
  postImageCarousel: {
    width: '100%',
    height: '100%',
  },
  postImage: {
    width: '100%',
    height: '100%',
  },
  postImageGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  postImageCountBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    height: 28,
    borderRadius: 14,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.58)',
  },
  postImageCountText: {
    color: '#FFFFFF',
    ...FONTS.font12B,
    lineHeight: 16,
  },
  postImageDotRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 14,
    zIndex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  postImageDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.42)',
  },
  postImageDotActive: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
  },
  imageTitleWrap: {
    position: 'absolute',
    left: 14,
    right: 14,
    bottom: 14,
  },
  imageTitleWrapWithDots: {
    bottom: 38,
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
  textOnlyPostIntro: {
    marginHorizontal: 20,
    marginBottom: 2,
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 18,
    backgroundColor: '#111114',
    borderWidth: 1,
    borderColor: '#242428',
  },
  textOnlyPostTitle: {
    color: '#FFFFFF',
    ...FONTS.font20B,
    lineHeight: 26,
  },
  textOnlyPostTime: {
    marginTop: 7,
    color: '#8A8D95',
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
  actionIconImage: {
    width: 28,
    height: 28,
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
  captionMeasureLine: {
    position: 'absolute',
    left: 20,
    right: 20,
    opacity: 0,
    zIndex: -1,
    color: '#E9E9EC',
    ...FONTS.font14R,
    lineHeight: 21,
  },
  captionUser: {
    color: '#FFFFFF',
    ...FONTS.font14B,
  },
  captionMoreText: {
    alignSelf: 'flex-start',
    color: '#8A8D95',
    ...FONTS.font14R,
    lineHeight: 18,
  },
  hashtagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingTop: 1,
  },
  hashtagText: {
    color: '#7EA7FF',
    ...FONTS.font13M,
    lineHeight: 18,
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
    marginTop: 6,
    color: '#8A8D95',
    ...FONTS.font12M,
    lineHeight: 16,
  },
  commentInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingTop: 12,
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  commentSubmitPressable: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  commentSubmitIcon: {
    color: '#FFFFFF',
    ...FONTS.font22B,
    lineHeight: 24,
  },
  composeFloatingButton: {
    position: 'absolute',
    right: 20,
    bottom: 21,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E50914',
    shadowColor: '#E50914',
    shadowOpacity: 0.38,
    shadowRadius: 16,
    shadowOffset: {width: 0, height: 8},
    elevation: 8,
  },
  composePlusGlyph: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  composePlusLine: {
    position: 'absolute',
    borderRadius: 2,
    backgroundColor: '#FFFFFF',
  },
  composePlusHorizontal: {
    width: 20,
    height: 2,
  },
  composePlusVertical: {
    width: 2,
    height: 20,
  },
  composeScreen: {
    flex: 1,
    backgroundColor: '#050505',
  },
  composeHeader: {
    minHeight: 74,
    paddingHorizontal: 18,
    paddingBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#050505',
    borderBottomWidth: 1,
    borderBottomColor: '#191919',
  },
  composeHeaderButton: {
    minWidth: 58,
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  composeHeaderButtonDisabled: {
    opacity: 0.55,
  },
  closeIcon: {
    width: 24,
    height: 24,
    resizeMode: 'contain',
  },
  composeTitle: {
    color: '#FFFFFF',
    ...FONTS.font18B,
    lineHeight: 24,
  },
  composeSubmitText: {
    color: '#E50914',
    ...FONTS.font16B,
    lineHeight: 21,
  },
  composeSubmitTextDisabled: {
    color: '#777A82',
  },
  composeScroll: {
    flex: 1,
  },
  composeContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  composeInstagramPreview: {
    width: '100%',
    aspectRatio: 1,
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: '#151519',
  },
  composeSelectedCountBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    height: 30,
    borderRadius: 15,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.62)',
  },
  composeSelectedCountText: {
    color: '#FFFFFF',
    ...FONTS.font13B,
    lineHeight: 17,
  },
  composeAlbumBar: {
    marginTop: 18,
    minHeight: 70,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#111114',
    borderWidth: 1,
    borderColor: '#242428',
  },
  composeAlbumTitle: {
    color: '#FFFFFF',
    ...FONTS.font16B,
    lineHeight: 21,
  },
  composeAlbumDescription: {
    marginTop: 5,
    color: '#8A8D95',
    ...FONTS.font12R,
    lineHeight: 16,
  },
  composeAlbumButton: {
    height: 36,
    borderRadius: 18,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#25262B',
  },
  composeAlbumButtonText: {
    color: '#FFFFFF',
    ...FONTS.font13B,
    lineHeight: 17,
  },
  composeShareRow: {
    minHeight: 132,
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#242428',
    paddingBottom: 18,
  },
  composeShareThumbList: {
    maxWidth: 112,
    marginRight: 14,
  },
  composeShareThumbContent: {
    gap: 8,
  },
  composeShareThumbWrap: {
    position: 'relative',
    width: 96,
    height: 96,
  },
  composeShareThumb: {
    width: 96,
    height: 96,
    backgroundColor: '#151519',
  },
  composeShareThumbBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.62)',
  },
  composeShareThumbBadgeText: {
    color: '#FFFFFF',
    ...FONTS.font11B,
    lineHeight: 15,
  },
  composeInstagramCaptionInput: {
    flex: 1,
    minHeight: 108,
    color: '#FFFFFF',
    paddingTop: 0,
    paddingHorizontal: 0,
    paddingBottom: 10,
    ...FONTS.font16R,
    lineHeight: 23,
  },
  composeChangeImageRow: {
    minHeight: 48,
    justifyContent: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#242428',
  },
  composeChangeImageText: {
    color: '#7EA7FF',
    ...FONTS.font14M,
    lineHeight: 19,
  },
  composeImagePicker: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 26,
    overflow: 'hidden',
    backgroundColor: '#151519',
    borderWidth: 1,
    borderColor: '#282A30',
  },
  composePreviewImage: {
    width: '100%',
    height: '100%',
  },
  composeImagePlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    backgroundColor: '#151519',
  },
  composeImagePlus: {
    color: '#FFFFFF',
    ...FONTS.font44B,
    lineHeight: 46,
  },
  composeImageTitle: {
    marginTop: 12,
    color: '#FFFFFF',
    ...FONTS.font18B,
    lineHeight: 24,
  },
  composeImageDescription: {
    marginTop: 7,
    color: '#8A8D95',
    textAlign: 'center',
    ...FONTS.font14R,
    lineHeight: 20,
  },
  composeProfileRow: {
    marginTop: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  composeAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    marginRight: 11,
    backgroundColor: '#242428',
  },
  composeProfileName: {
    color: '#FFFFFF',
    ...FONTS.font15B,
    lineHeight: 20,
  },
  composeProfileRole: {
    marginTop: 3,
    color: '#8A8D95',
    ...FONTS.font12R,
    lineHeight: 16,
  },
  composeInputBlock: {
    marginTop: 24,
  },
  composeLabel: {
    marginBottom: 10,
    color: '#FFFFFF',
    ...FONTS.font15B,
    lineHeight: 20,
  },
  composeCaptionInput: {
    minHeight: 136,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#151519',
    borderWidth: 1,
    borderColor: '#282A30',
    color: '#FFFFFF',
    ...FONTS.font15R,
    lineHeight: 22,
  },
  composeTagBox: {
    minHeight: 50,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 9,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#151519',
    borderWidth: 1,
    borderColor: '#282A30',
  },
  composeTagChip: {
    minHeight: 32,
    borderRadius: 16,
    paddingLeft: 12,
    paddingRight: 10,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(126,167,255,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(126,167,255,0.42)',
  },
  composeTagChipText: {
    color: '#9CB9FF',
    ...FONTS.font13B,
    lineHeight: 17,
  },
  composeTagChipRemove: {
    marginLeft: 7,
    color: '#DDE7FF',
    ...FONTS.font15B,
    lineHeight: 18,
  },
  composeTagInput: {
    minWidth: 120,
    flexGrow: 1,
    minHeight: 32,
    paddingHorizontal: 0,
    paddingVertical: 4,
    color: '#FFFFFF',
    ...FONTS.font15R,
  },
  composeHelperText: {
    marginTop: 8,
    color: '#777A82',
    ...FONTS.font12R,
    lineHeight: 17,
  },
  composeErrorText: {
    marginTop: 16,
    color: '#E50914',
    ...FONTS.font13M,
    lineHeight: 18,
  },
  composeFooter: {
    paddingHorizontal: 20,
    paddingTop: 12,
    backgroundColor: '#050505',
    borderTopWidth: 1,
    borderTopColor: '#191919',
  },
  composePrimaryButton: {
    height: 54,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E50914',
  },
  composePrimaryButtonDisabled: {
    backgroundColor: '#242428',
  },
  composePrimaryButtonText: {
    color: '#FFFFFF',
    ...FONTS.font16B,
    lineHeight: 21,
  },
  composePrimaryButtonTextDisabled: {
    color: '#777A82',
  },
  highlightViewer: {
    flex: 1,
    backgroundColor: '#000000',
  },
  highlightMediaFrame: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#000000',
    overflow: 'hidden',
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
  highlightCloseButton: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
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
