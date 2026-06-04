import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import BottomSheet, {BottomSheetBackdrop, BottomSheetFlatList, BottomSheetTextInput} from '@gorhom/bottom-sheet';
import {
  Animated,
  Image,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  RefreshControl,
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
import {launchImageLibrary, type Asset as PickerAsset} from 'react-native-image-picker';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {AnimatedPressable} from '../components/AnimatedPressable';
import {AppLoading} from '../components/AppLoading';
import {AppGnb} from '../components/AppGnb';
import {TabSceneTransition} from '../components/TabSceneTransition';
import {icon} from '../assets/icons';
import {image} from '../assets/images';
import {useAuth} from '../auth/AuthProvider';
import {FONTS} from '../constants/theme';
import {useFeed} from '../feed/FeedProvider';
import {type FeedComment} from '../dummyData/feedDummyData';

type ComposeStep = 'select' | 'details';
type ComposeImageAsset = {
  fileName: string | undefined;
  fileSize: number | undefined;
  type: string | undefined;
  uri: string;
};

const MAX_COMPOSE_IMAGE_COUNT = 5;

function formatCount(count: number): string {
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}천`;
  }

  return String(count);
}

function getEditableCommentId(comment: FeedComment): string | null {
  if (comment.commentId) {
    return comment.commentId;
  }

  return /^\d+$/.test(comment.id) ? comment.id : null;
}

export function FeedScreen(): JSX.Element {
  const bottomSheetRef = useRef<BottomSheet>(null);
  const prefetchedHighlightIdsRef = useRef<Set<string>>(new Set());
  const {auth} = useAuth();
  const {
    createComment,
    createPost,
    deleteComment,
    fetchComments,
    highlightGroups,
    isLoading,
    posts,
    refreshHighlights,
    refreshHighlightPosts,
    refreshPosts,
    togglePostLike,
    updateComment,
  } = useFeed();
  const {width: screenWidth} = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const scrollY = useRef(new Animated.Value(0)).current;
  const commentSubmitProgress = useRef(new Animated.Value(0)).current;
  const snapPoints = useMemo(() => ['66%'], []);
  const [commentDraft, setCommentDraft] = useState('');
  const [commentActionError, setCommentActionError] = useState<string | null>(null);
  const [editingCommentDraft, setEditingCommentDraft] = useState('');
  const [selectedCommentForAction, setSelectedCommentForAction] = useState<FeedComment | null>(null);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [selectedHighlightId, setSelectedHighlightId] = useState<string | null>(null);
  const [selectedHighlightIndex, setSelectedHighlightIndex] = useState(0);
  const [loadingHighlightIds, setLoadingHighlightIds] = useState<Record<string, boolean>>({});
  const [expandedCaptionPostIds, setExpandedCaptionPostIds] = useState<string[]>([]);
  const [truncatedCaptionPostIds, setTruncatedCaptionPostIds] = useState<string[]>([]);
  const [isComposeVisible, setIsComposeVisible] = useState(false);
  const [composeStep, setComposeStep] = useState<ComposeStep>('select');
  const [composeImageUris, setComposeImageUris] = useState<string[]>([]);
  const [composeImageAssets, setComposeImageAssets] = useState<ComposeImageAsset[]>([]);
  const [composeTitle, setComposeTitle] = useState('');
  const [composeCaption, setComposeCaption] = useState('');
  const [composeTags, setComposeTags] = useState<string[]>([]);
  const [composeTagDraft, setComposeTagDraft] = useState('');
  const [composeErrorMessage, setComposeErrorMessage] = useState<string | null>(null);
  const [isSubmittingCompose, setIsSubmittingCompose] = useState(false);
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [isEditingComment, setIsEditingComment] = useState(false);
  const [isMutatingComment, setIsMutatingComment] = useState(false);
  const [isLoadingComments, setIsLoadingComments] = useState(false);
  const [isRefreshingFeed, setIsRefreshingFeed] = useState(false);
  const [activePostImageIndexes, setActivePostImageIndexes] = useState<Record<string, number>>({});
  const [commentsByPost, setCommentsByPost] = useState<Record<string, FeedComment[]>>({});

  useEffect(() => {
    setCommentsByPost(prevCommentsByPost =>
      posts.reduce<Record<string, FeedComment[]>>((nextCommentsByPost, post) => {
        nextCommentsByPost[post.id] = prevCommentsByPost[post.id] ?? post.comments ?? [];
        return nextCommentsByPost;
      }, {}),
    );
  }, [posts]);

  useEffect(() => {
    if (!posts.length) {
      return;
    }

    if (!posts.some(post => post.id === selectedPostId)) {
      setSelectedPostId(posts[0].id);
    }
  }, [posts, selectedPostId]);

  const selectedComments = selectedPostId ? commentsByPost[selectedPostId] ?? [] : [];
  const selectedHighlightGroup = highlightGroups.find(group => group.id === selectedHighlightId);
  const selectedHighlightItem = selectedHighlightGroup?.items[selectedHighlightIndex];
  const isSelectedHighlightLoading = selectedHighlightId ? Boolean(loadingHighlightIds[selectedHighlightId]) : false;
  const isHighlightVisible = Boolean(selectedHighlightGroup);
  const topSafeArea = Math.max(insets.top, StatusBar.currentHeight ?? 0);
  const highlightContentTop = topSafeArea;
  const highlightProgressTop = topSafeArea + 8;
  const highlightHeaderTop = topSafeArea + 22;
  const highlightTextBottom = Math.max(insets.bottom + 32, 42);
  const isCommentSubmittable = commentDraft.trim().length > 0 && !isSubmittingComment;
  const profileImageUri = typeof auth?.profile?.profileImageUri === 'string' ? auth.profile.profileImageUri : null;
  const myAvatarSource = useMemo<ImageSourcePropType>(
    () => (profileImageUri ? {uri: profileImageUri} : image.profile),
    [profileImageUri],
  );
  const myName = auth?.name ?? '이인철';
  const isComposeSubmittable = Boolean(composeTitle.trim()) && Boolean(composeCaption.trim()) && !isSubmittingCompose;
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

  useEffect(() => {
    highlightGroups.forEach(group => {
      if (group.items.length || prefetchedHighlightIdsRef.current.has(group.id)) {
        return;
      }

      prefetchedHighlightIdsRef.current.add(group.id);
      refreshHighlightPosts(group.id).catch(error => {
        prefetchedHighlightIdsRef.current.delete(group.id);
        console.log('[FeedScreen] prefetch highlight failed', {error, highlightId: group.id});
      });
    });
  }, [highlightGroups, refreshHighlightPosts]);

  const openComments = useCallback((postId: string) => {
    setSelectedPostId(postId);
    bottomSheetRef.current?.snapToIndex(0);
    setIsLoadingComments(true);
    fetchComments(postId)
      .then(comments => {
        setCommentsByPost(prevComments => ({
          ...prevComments,
          [postId]: comments,
        }));
      })
      .catch(error => {
        console.log('[FeedScreen] fetchComments failed', {error, postId});
      })
      .finally(() => {
        setIsLoadingComments(false);
      });
  }, [fetchComments]);

  const openHighlight = useCallback(
    (highlightId: string) => {
      const targetGroup = highlightGroups.find(group => group.id === highlightId);

      setSelectedHighlightId(highlightId);
      setSelectedHighlightIndex(0);

      if (targetGroup?.items.length) {
        return;
      }

      setLoadingHighlightIds(prevLoadingIds => ({...prevLoadingIds, [highlightId]: true}));
      refreshHighlightPosts(highlightId)
        .catch(error => {
          console.log('[FeedScreen] refreshHighlightPosts failed', {error, highlightId});
        })
        .finally(() => {
          setLoadingHighlightIds(prevLoadingIds => ({...prevLoadingIds, [highlightId]: false}));
        });
    },
    [highlightGroups, refreshHighlightPosts],
  );

  const closeHighlight = useCallback(() => {
    setSelectedHighlightId(null);
    setSelectedHighlightIndex(0);
  }, []);

  const highlightSwipeResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dy) > 18 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx) * 1.2;
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy < -70) {
          closeHighlight();
        }
      },
    }),
  ).current;

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

  const toggleLike = useCallback(
    (postId: string) => {
      void togglePostLike(postId);
    },
    [togglePostLike],
  );

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

  const handleCommentSubmit = useCallback(async () => {
    const trimmedComment = commentDraft.trim();
    if (!trimmedComment || isSubmittingComment || !selectedPostId) {
      return;
    }

    setIsSubmittingComment(true);

    try {
      const createdCommentId = await createComment(selectedPostId, trimmedComment);
      setCommentsByPost(prevComments => ({
        ...prevComments,
        [selectedPostId]: [
          ...(prevComments[selectedPostId] ?? []),
          {
            commentId: createdCommentId ?? undefined,
            id: `${selectedPostId}-${Date.now()}`,
            user: myName,
            text: trimmedComment,
            time: '방금 전',
          },
        ],
      }));
      setCommentDraft('');
    } catch (error) {
      console.log('[FeedScreen] createComment failed', error);
    } finally {
      setIsSubmittingComment(false);
    }
  }, [commentDraft, createComment, isSubmittingComment, myName, selectedPostId]);

  const openCommentActions = useCallback(
    (comment: FeedComment) => {
      if (!comment.isMine && comment.user !== myName) {
        return;
      }

      setCommentActionError(null);
      setSelectedCommentForAction(comment);
    },
    [myName],
  );

  const closeCommentActions = useCallback(() => {
    setCommentActionError(null);
    setSelectedCommentForAction(null);
  }, []);

  const openCommentEditor = useCallback(() => {
    if (!selectedCommentForAction) {
      return;
    }

    setEditingCommentDraft(selectedCommentForAction.text);
    setCommentActionError(null);
    setIsEditingComment(true);
  }, [selectedCommentForAction]);

  const closeCommentEditor = useCallback(() => {
    setIsEditingComment(false);
    setEditingCommentDraft('');
    setCommentActionError(null);
  }, []);

  const handleCommentUpdate = useCallback(async () => {
    const comment = selectedCommentForAction;
    const commentId = comment ? getEditableCommentId(comment) : null;
    const nextText = editingCommentDraft.trim();

    if (!comment || !commentId || !nextText || isMutatingComment || !selectedPostId) {
      if (!commentId) {
        setCommentActionError('서버 댓글 ID가 없어 수정할 수 없습니다.');
      }
      return;
    }

    setIsMutatingComment(true);
    setCommentActionError(null);

    try {
      await updateComment(selectedPostId, commentId, nextText);
      setCommentsByPost(prevComments => ({
        ...prevComments,
        [selectedPostId]: (prevComments[selectedPostId] ?? []).map(item =>
          item.id === comment.id ? {...item, text: nextText} : item,
        ),
      }));
      closeCommentEditor();
      closeCommentActions();
    } catch (error) {
      setCommentActionError(error instanceof Error && error.message ? error.message : '댓글 수정에 실패했습니다.');
    } finally {
      setIsMutatingComment(false);
    }
  }, [
    closeCommentActions,
    closeCommentEditor,
    editingCommentDraft,
    isMutatingComment,
    selectedCommentForAction,
    selectedPostId,
    updateComment,
  ]);

  const handleCommentDelete = useCallback(async () => {
    const comment = selectedCommentForAction;
    const commentId = comment ? getEditableCommentId(comment) : null;

    if (!comment || !commentId || isMutatingComment || !selectedPostId) {
      if (!commentId) {
        setCommentActionError('서버 댓글 ID가 없어 삭제할 수 없습니다.');
      }
      return;
    }

    setIsMutatingComment(true);
    setCommentActionError(null);

    try {
      await deleteComment(selectedPostId, commentId);
      setCommentsByPost(prevComments => ({
        ...prevComments,
        [selectedPostId]: (prevComments[selectedPostId] ?? []).filter(item => item.id !== comment.id),
      }));
      closeCommentActions();
    } catch (error) {
      setCommentActionError(error instanceof Error && error.message ? error.message : '댓글 삭제에 실패했습니다.');
    } finally {
      setIsMutatingComment(false);
    }
  }, [closeCommentActions, deleteComment, isMutatingComment, selectedCommentForAction, selectedPostId]);

  const openCompose = useCallback(() => {
    setComposeErrorMessage(null);
    setComposeStep('select');
    setIsComposeVisible(true);
  }, []);

  const closeCompose = useCallback(() => {
    setIsComposeVisible(false);
    setIsSubmittingCompose(false);
    setComposeImageAssets([]);
    setComposeImageUris([]);
    setComposeTitle('');
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
      maxHeight: 3000,
      maxWidth: 3000,
      quality: 0.9,
      selectionLimit: MAX_COMPOSE_IMAGE_COUNT,
    });

    if (result.didCancel) {
      return;
    }

    if (result.errorCode) {
      setComposeErrorMessage(result.errorMessage || '사진을 불러오지 못했습니다.');
      return;
    }

    const selectedAssets =
      result.assets
        ?.filter((asset): asset is PickerAsset & {uri: string} => typeof asset.uri === 'string' && asset.uri.length > 0)
        .map(asset => ({
          fileName: asset.fileName,
          fileSize: asset.fileSize,
          type: asset.type,
          uri: asset.uri,
        })) ?? [];

    if (!selectedAssets.length) {
      setComposeErrorMessage('선택한 사진을 확인할 수 없습니다.');
      return;
    }

    setComposeImageAssets(selectedAssets);
    setComposeImageUris(selectedAssets.map(asset => asset.uri));
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

  const submitCompose = useCallback(async () => {
    const title = composeTitle.trim();
    const caption = composeCaption.trim();
    const draftTag = composeTagDraft.trim();

    if (!title) {
      setComposeErrorMessage('제목을 입력해주세요.');
      return;
    }

    if (!caption) {
      setComposeErrorMessage('내용을 입력해주세요.');
      return;
    }

    const normalizedTags = (draftTag ? [...composeTags, `#${draftTag.replace(/^#+/, '')}`] : composeTags)
      .map(tag => tag.replace(/^#+/, '').trim())
      .filter((tag, index, tags) => Boolean(tag) && tags.findIndex(item => item.toLowerCase() === tag.toLowerCase()) === index)
      .slice(0, 6);

    setComposeErrorMessage(null);
    setIsSubmittingCompose(true);
    console.log('[FeedScreen] submitCompose start', {
      captionLength: caption.length,
      imageCount: composeImageAssets.length,
      tags: normalizedTags,
      title,
    });

    try {
      await createPost({
        content: caption,
        hashTags: normalizedTags,
        images: composeImageAssets,
        title,
      });
      console.log('[FeedScreen] submitCompose success');
      closeCompose();
    } catch (error) {
      console.log('[FeedScreen] submitCompose failed', error);
      if (error instanceof Error && error.message) {
        setComposeErrorMessage(error.message);
      } else {
        setComposeErrorMessage('게시글 등록에 실패했습니다.');
      }
      setIsSubmittingCompose(false);
    }
  }, [
    closeCompose,
    composeCaption,
    composeImageAssets,
    composeTagDraft,
    composeTags,
    composeTitle,
    createPost,
  ]);

  const renderBackdrop = useCallback(
    (props: React.ComponentProps<typeof BottomSheetBackdrop>) => (
      <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} opacity={0.56} pressBehavior="close" />
    ),
    [],
  );

  const renderComment = useCallback(
    ({item}: {item: FeedComment}) => (
      <AnimatedPressable
        accessibilityRole={item.isMine || item.user === myName ? 'button' : undefined}
        onPress={() => openCommentActions(item)}
        style={styles.commentRow}>
        <Image source={image.profile} style={styles.commentAvatar} />
        <View style={styles.commentBody}>
          <Text style={styles.commentLine}>
            <Text style={styles.commentUser}>{item.user}</Text> {item.text}
          </Text>
          <Text style={styles.commentMeta}>{item.time || '방금 전'}</Text>
        </View>
      </AnimatedPressable>
    ),
    [myName, openCommentActions],
  );

  const handleFeedRefresh = useCallback(async () => {
    if (isRefreshingFeed) {
      return;
    }

    setIsRefreshingFeed(true);

    try {
      await Promise.all([refreshPosts(), refreshHighlights()]);
    } finally {
      setIsRefreshingFeed(false);
    }
  }, [isRefreshingFeed, refreshHighlights, refreshPosts]);

  return (
    <TabSceneTransition>
      <View style={[styles.safeArea, {paddingTop: topSafeArea}]}>
        <StatusBar barStyle="light-content" backgroundColor="#000000" hidden={isHighlightVisible} />

        <View style={styles.screen}>
          <AppGnb scrollY={scrollY} />

          <Animated.ScrollView
            bounces
            contentContainerStyle={styles.feedFrame}
            refreshControl={
              <RefreshControl
                progressBackgroundColor="#151519"
                refreshing={isRefreshingFeed}
                tintColor="#FFFFFF"
                onRefresh={handleFeedRefresh}
              />
            }
            showsVerticalScrollIndicator={false}
            onScroll={Animated.event([{nativeEvent: {contentOffset: {y: scrollY}}}], {
              useNativeDriver: true,
            })}
            scrollEventThrottle={16}>
            {highlightGroups.length ? (
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
                        <Text style={styles.highlightCountText}>{group.postCount ?? group.items.length}</Text>
                      </View>
                    </View>
                    <Text numberOfLines={1} style={styles.storyName}>
                      {group.label}
                    </Text>
                  </AnimatedPressable>
                ))}
              </ScrollView>
            ) : null}

            <View style={[styles.postStack, isLoading && !posts.length && styles.feedLoadingStack]}>
              {isLoading && !posts.length ? (
                <View style={styles.feedLoadingState}>
                  <AppLoading label="피드를 불러오는 중..." />
                </View>
              ) : !posts.length ? (
                <Text style={styles.emptyFeedText}>표시할 게시글이 없습니다.</Text>
              ) : posts.map(post => {
                const isLiked = Boolean(post.isLiked);
                const isCaptionExpanded = expandedCaptionPostIds.includes(post.id);
                const isCaptionTruncated = truncatedCaptionPostIds.includes(post.id);
                const comments = commentsByPost[post.id] ?? [];
                const likeCount = post.likes;
                const commentCount = typeof post.commentCount === 'number' ? post.commentCount : comments.length;
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
                            <View key={`${post.id}-image-${index}`} style={[styles.postImageSlide, {width: screenWidth}]}>
                              <Image
                                blurRadius={14}
                                source={postImage}
                                style={styles.postImageBackdrop}
                                resizeMode="cover"
                              />
                              <Image source={postImage} style={styles.postImage} resizeMode="contain" />
                            </View>
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
                        <Text style={styles.commentLink}>댓글 {commentCount}개 모두 보기</Text>
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
              ListEmptyComponent={
                isLoadingComments ? (
                  <View style={styles.commentLoadingState}>
                    <AppLoading label="댓글을 불러오는 중..." />
                  </View>
                ) : (
                  <Text style={styles.commentEmptyText}>아직 댓글이 없습니다.</Text>
                )
              }
              keyExtractor={item => item.id}
              renderItem={renderComment}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={[
                styles.commentListContent,
                isLoadingComments && !selectedComments.length && styles.commentListLoadingContent,
              ]}
            />

            <View style={[styles.commentInputWrap, {paddingBottom: Math.max(insets.bottom + 12, 24)}]}>
              <Image source={myAvatarSource} style={styles.inputAvatar} />
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

          <Modal
            animationType="fade"
            onRequestClose={closeCommentActions}
            transparent
            visible={Boolean(selectedCommentForAction) && !isEditingComment}>
            <View style={styles.commentActionOverlay}>
              <View style={styles.commentActionSheet}>
                <Text style={styles.commentActionTitle}>댓글 관리</Text>
                <Text numberOfLines={2} style={styles.commentActionPreview}>
                  {selectedCommentForAction?.text}
                </Text>
                {commentActionError ? <Text style={styles.commentActionError}>{commentActionError}</Text> : null}
                <AnimatedPressable
                  accessibilityRole="button"
                  disabled={isMutatingComment}
                  onPress={openCommentEditor}
                  style={styles.commentActionButton}>
                  <Text style={styles.commentActionButtonText}>수정하기</Text>
                </AnimatedPressable>
                <AnimatedPressable
                  accessibilityRole="button"
                  disabled={isMutatingComment}
                  onPress={handleCommentDelete}
                  style={[styles.commentActionButton, styles.commentDeleteButton]}>
                  <Text style={[styles.commentActionButtonText, styles.commentDeleteButtonText]}>
                    {isMutatingComment ? '삭제 중...' : '삭제하기'}
                  </Text>
                </AnimatedPressable>
                <AnimatedPressable
                  accessibilityRole="button"
                  disabled={isMutatingComment}
                  onPress={closeCommentActions}
                  style={styles.commentCancelButton}>
                  <Text style={styles.commentCancelButtonText}>취소</Text>
                </AnimatedPressable>
              </View>
            </View>
          </Modal>

          <Modal animationType="fade" onRequestClose={closeCommentEditor} transparent visible={isEditingComment}>
            <View style={styles.commentActionOverlay}>
              <View style={styles.commentEditCard}>
                <Text style={styles.commentActionTitle}>댓글 수정</Text>
                <TextInput
                  multiline
                  placeholder="댓글을 입력하세요"
                  placeholderTextColor="#777A82"
                  style={styles.commentEditInput}
                  value={editingCommentDraft}
                  onChangeText={setEditingCommentDraft}
                />
                {commentActionError ? <Text style={styles.commentActionError}>{commentActionError}</Text> : null}
                <View style={styles.commentEditButtonRow}>
                  <AnimatedPressable
                    accessibilityRole="button"
                    disabled={isMutatingComment}
                    onPress={closeCommentEditor}
                    style={[styles.commentEditButton, styles.commentEditCancelButton]}>
                    <Text style={styles.commentCancelButtonText}>취소</Text>
                  </AnimatedPressable>
                  <AnimatedPressable
                    accessibilityRole="button"
                    disabled={isMutatingComment || !editingCommentDraft.trim()}
                    onPress={handleCommentUpdate}
                    style={[
                      styles.commentEditButton,
                      styles.commentEditSaveButton,
                      (isMutatingComment || !editingCommentDraft.trim()) && styles.commentEditSaveButtonDisabled,
                    ]}>
                    <Text style={styles.commentEditSaveButtonText}>
                      {isMutatingComment ? '저장 중...' : '저장'}
                    </Text>
                  </AnimatedPressable>
                </View>
              </View>
            </View>
          </Modal>

          <Modal animationType="fade" onRequestClose={closeHighlight} transparent visible={isHighlightVisible}>
            {selectedHighlightGroup ? (
              <View style={styles.highlightViewer} {...highlightSwipeResponder.panHandlers}>
                {selectedHighlightItem ? (
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
                ) : null}

                <View style={[styles.highlightViewerHeader, {top: highlightHeaderTop}]}>
                  <View style={styles.highlightViewerIdentity}>
                    <Image source={selectedHighlightGroup.cover} style={styles.highlightViewerAvatar} />
                    <View>
                      <Text style={styles.highlightViewerLabel}>{selectedHighlightGroup.label}</Text>
                      <Text style={styles.highlightViewerTime}>
                        {selectedHighlightItem?.time ?? (isSelectedHighlightLoading ? '불러오는 중' : '게시글 없음')}
                      </Text>
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

                {selectedHighlightItem ? (
                  <>
                    <View style={[styles.highlightMediaFrame, {top: highlightContentTop}]}>
                      <Image
                        blurRadius={18}
                        source={selectedHighlightItem.image}
                        style={styles.highlightViewerBackdropImage}
                        resizeMode="cover"
                      />
                      <View style={styles.highlightViewerImageWrap}>
                        <Image
                          source={selectedHighlightItem.image}
                          style={styles.highlightViewerImage}
                          resizeMode="contain"
                        />
                      </View>
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
                  </>
                ) : (
                  <View style={styles.highlightLoadingState}>
                    {isSelectedHighlightLoading ? (
                      <AppLoading label="하이라이트를 불러오는 중..." />
                    ) : (
                      <Text style={styles.highlightEmptyText}>표시할 하이라이트가 없습니다.</Text>
                    )}
                  </View>
                )}
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
                        <Text style={styles.composeAlbumDescription}>
                          최대 5장까지 선택할 수 있고, 10MB 초과 사진은 자동으로 줄여 업로드합니다.
                        </Text>
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
                    <View style={styles.composeTitleBlock}>
                      <Text style={styles.composeLabel}>제목</Text>
                      <TextInput
                        maxLength={60}
                        placeholder="제목을 입력하세요"
                        placeholderTextColor="#777A82"
                        returnKeyType="next"
                        style={styles.composeTitleInput}
                        value={composeTitle}
                        onChangeText={setComposeTitle}
                      />
                      <Text style={styles.composeHelperText}>게시물 목록과 상세 영역에 표시될 제목입니다.</Text>
                    </View>

                    <View style={styles.composePhotoBlock}>
                      <Text style={styles.composeLabel}>사진</Text>
                      {composeImageUris.length ? (
                        <ScrollView
                          horizontal
                          showsHorizontalScrollIndicator={false}
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
                    </View>

                    <AnimatedPressable
                      accessibilityRole="button"
                      onPress={openComposeImageLibrary}
                      style={styles.composeChangeImageRow}>
                      <Text style={styles.composeChangeImageText}>사진 다시 선택</Text>
                    </AnimatedPressable>

                    <View style={styles.composeInputBlock}>
                      <Text style={styles.composeLabel}>문구</Text>
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
                  onPress={composeStep === 'select' ? goToComposeDetails : () => void submitCompose()}
                  style={[
                    styles.composePrimaryButton,
                    composeStep === 'details' && !isComposeSubmittable && styles.composePrimaryButtonDisabled,
                  ]}>
                  <Text
                    style={[
                      styles.composePrimaryButtonText,
                      composeStep === 'details' && !isComposeSubmittable && styles.composePrimaryButtonTextDisabled,
                    ]}>
                    {composeStep === 'select' ? '다음' : isSubmittingCompose ? '공유 중...' : '공유하기'}
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
  feedLoadingStack: {
    minHeight: 520,
  },
  feedLoadingState: {
    flex: 1,
    minHeight: 520,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyFeedText: {
    paddingHorizontal: 20,
    paddingVertical: 48,
    color: '#8A8D95',
    textAlign: 'center',
    ...FONTS.font14M,
    lineHeight: 19,
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
  postImageSlide: {
    position: 'relative',
    height: '100%',
    overflow: 'hidden',
    backgroundColor: '#0D0D0F',
  },
  postImageBackdrop: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.36,
    transform: [{scale: 1.08}],
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
  commentListLoadingContent: {
    flexGrow: 1,
  },
  commentLoadingState: {
    flex: 1,
    minHeight: 360,
    alignItems: 'center',
    justifyContent: 'center',
  },
  commentEmptyText: {
    paddingVertical: 28,
    color: '#8A8D95',
    textAlign: 'center',
    ...FONTS.font14R,
    lineHeight: 20,
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
  commentActionOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.56)',
  },
  commentActionSheet: {
    marginHorizontal: 12,
    marginBottom: 18,
    borderRadius: 18,
    backgroundColor: '#1B1C20',
    padding: 16,
    borderWidth: 1,
    borderColor: '#303139',
  },
  commentActionTitle: {
    color: '#FFFFFF',
    ...FONTS.font18B,
    lineHeight: 24,
  },
  commentActionPreview: {
    marginTop: 8,
    color: '#B9BBC3',
    ...FONTS.font13R,
    lineHeight: 18,
  },
  commentActionError: {
    marginTop: 10,
    color: '#E50914',
    ...FONTS.font12M,
    lineHeight: 16,
  },
  commentActionButton: {
    marginTop: 14,
    minHeight: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2A2B31',
  },
  commentActionButtonText: {
    color: '#FFFFFF',
    ...FONTS.font15B,
    lineHeight: 20,
  },
  commentDeleteButton: {
    marginTop: 8,
    backgroundColor: 'rgba(229,9,20,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(229,9,20,0.34)',
  },
  commentDeleteButtonText: {
    color: '#FF5962',
  },
  commentCancelButton: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  commentCancelButtonText: {
    color: '#B9BBC3',
    ...FONTS.font15M,
    lineHeight: 20,
  },
  commentEditCard: {
    marginHorizontal: 16,
    marginBottom: 32,
    borderRadius: 18,
    backgroundColor: '#1B1C20',
    padding: 16,
    borderWidth: 1,
    borderColor: '#303139',
  },
  commentEditInput: {
    marginTop: 14,
    minHeight: 112,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#303139',
    backgroundColor: '#121317',
    color: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 12,
    textAlignVertical: 'top',
    ...FONTS.font15R,
    lineHeight: 21,
  },
  commentEditButtonRow: {
    marginTop: 14,
    flexDirection: 'row',
    gap: 10,
  },
  commentEditButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  commentEditCancelButton: {
    backgroundColor: '#2A2B31',
  },
  commentEditSaveButton: {
    backgroundColor: '#E50914',
  },
  commentEditSaveButtonDisabled: {
    backgroundColor: '#3A3B40',
  },
  commentEditSaveButtonText: {
    color: '#FFFFFF',
    ...FONTS.font15B,
    lineHeight: 20,
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
  composePhotoBlock: {
    marginTop: 4,
  },
  composeShareThumbContent: {
    paddingVertical: 2,
    gap: 8,
  },
  composeShareThumbWrap: {
    position: 'relative',
    width: 112,
    height: 112,
  },
  composeShareThumb: {
    width: 112,
    height: 112,
    borderRadius: 14,
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
    minHeight: 132,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2F3036',
    backgroundColor: '#151519',
    color: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 12,
    ...FONTS.font16R,
    lineHeight: 23,
  },
  composeTitleInput: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2F3036',
    backgroundColor: '#151519',
    color: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 12,
    ...FONTS.font16M,
    lineHeight: 22,
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
  composeInputBlock: {
    marginTop: 24,
  },
  composeTitleBlock: {
    marginTop: 24,
    marginBottom: 18,
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
  highlightLoadingState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  highlightEmptyText: {
    color: '#D6D8DE',
    textAlign: 'center',
    ...FONTS.font15M,
    lineHeight: 21,
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
  highlightViewerBackdropImage: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.42,
    transform: [{scale: 1.08}],
  },
  highlightViewerImageWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 86,
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
