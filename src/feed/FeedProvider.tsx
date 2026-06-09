import React, {createContext, useCallback, useContext, useEffect, useMemo, useRef, useState} from 'react';
import {Platform} from 'react-native';
import ImageResizer from '@bam.tech/react-native-image-resizer';
import {useAuth} from '../auth/AuthProvider';
import {image} from '../assets/images';
import {
  type FeedPost,
  type FeedComment,
  type HighlightGroup,
  type HighlightItem,
} from '../dummyData/feedDummyData';
import {withMinimumLoadingTime} from '../utils/loading';
import {getProfileImageUriFromRecord} from '../utils/profileImage';

const API_BASE = 'http://121.254.240.93:8090';
const FEED_BOARD_ID = 21;
const FEED_POST_PAGE = 1;
const FEED_POST_SIZE = 5;
const MAX_FEED_IMAGE_COUNT = 5;
const MAX_FEED_IMAGE_FILE_SIZE = 10 * 1024 * 1024;
const FEED_IMAGE_RESIZE_STEPS = [
  {maxSize: 2400, quality: 82},
  {maxSize: 2000, quality: 76},
  {maxSize: 1600, quality: 70},
  {maxSize: 1280, quality: 64},
  {maxSize: 1024, quality: 58},
] as const;

type FeedUploadImage = {
  fileName?: string;
  fileSize?: number;
  type?: string;
  uri: string;
};

type FeedContextValue = {
  createComment: (postId: string, content: string) => Promise<string | null>;
  createPost: (payload: {
    content: string;
    hashTags: string[];
    images: FeedUploadImage[];
    title: string;
  }) => Promise<void>;
  isLoading: boolean;
  isLoadingMorePosts: boolean;
  lastError: string | null;
  lastResponseBody: unknown;
  hasMorePosts: boolean;
  highlightGroups: HighlightGroup[];
  loadMorePosts: () => Promise<void>;
  posts: FeedPost[];
  fetchComments: (postId: string) => Promise<FeedComment[]>;
  refreshHighlights: () => Promise<void>;
  refreshHighlightPosts: (highlightId: string) => Promise<void>;
  refreshPosts: () => Promise<void>;
  setPosts: React.Dispatch<React.SetStateAction<FeedPost[]>>;
  togglePostLike: (postId: string) => Promise<void>;
  updateComment: (postId: string, commentId: string, content: string) => Promise<void>;
  deleteComment: (postId: string, commentId: string) => Promise<void>;
};

const FeedContext = createContext<FeedContextValue | undefined>(undefined);

type FeedPostApiResponse = {
  code?: string;
  data?: {
    content?: FeedPostItemApi[];
    last?: boolean;
    number?: number;
    page?: number;
    size?: number;
    totalPages?: number;
  };
  message?: string;
  success?: boolean;
};

type FeedMemberApi = {
  department?: string;
  employeeId?: number | string;
  employeeName?: string;
  profileImageUrl?: string;
};

type FeedPostItemApi = {
  commentCount?: number;
  comments?: FeedCommentItemApi[];
  content?: string;
  elapsedTime?: string;
  hashTags?: string[];
  isLiked?: boolean;
  likeCount?: number;
  likedMembers?: FeedMemberApi[];
  postId?: number;
  title?: string;
  uploadImages?: Array<{
    imageUrl?: string;
  }>;
  writer?: FeedMemberApi;
};

type FeedHighlightApiResponse = {
  code?: string;
  data?: FeedHighlightItemApi[];
  message?: string;
  success?: boolean;
};

type FeedHighlightItemApi = {
  imageUrl?: string;
  postCount?: number;
  tagId?: number;
  tagName?: string;
};

type FeedHighlightPostApiResponse = {
  code?: string;
  data?: FeedHighlightPostItemApi[];
  message?: string;
  success?: boolean;
};

type FeedHighlightPostItemApi = {
  content?: string;
  elapsedTime?: string;
  imageUrl?: string;
  postId?: number;
  title?: string;
};

type CommentMutationResponse = {
  data?: unknown;
  message?: string;
  success?: boolean;
};

type FeedCommentApiResponse = {
  code?: string;
  data?:
    | FeedCommentItemApi[]
    | {
        comments?: FeedCommentItemApi[];
        commentCount?: number;
        content?: FeedCommentItemApi[];
        elapsedTime?: string;
        isLiked?: boolean;
        likeCount?: number;
        likedMembers?: FeedMemberApi[];
        postId?: number;
      };
  message?: string;
  success?: boolean;
};

type FeedCommentItemApi = {
  authorName?: string;
  commentId?: number | string;
  commentContent?: string;
  content?: string;
  createdAt?: string;
  elapsedTime?: string;
  employeeId?: number | string;
  employeeName?: string;
  profileImageUrl?: string;
  id?: number | string;
  isMine?: boolean;
  mine?: boolean;
  writer?: {
    employeeId?: number | string;
    department?: string;
    employeeNickname?: string;
    employeeName?: string;
    memberName?: string;
    name?: string;
    nickname?: string;
    profileImageUrl?: string;
  };
  writerName?: string;
};

function getDisplayElapsedTime(value: unknown): string {
  return typeof value === 'string' && value.trim() ? value.trim() : '방금 전';
}

function getArrayCount(value: unknown): number | null {
  return Array.isArray(value) ? value.length : null;
}

function toFeedPost(post: FeedPostItemApi): FeedPost | null {
  if (typeof post.postId !== 'number') {
    return null;
  }

  const images = (post.uploadImages ?? [])
    .map(item => item.imageUrl?.trim())
    .filter((imageUrl): imageUrl is string => Boolean(imageUrl))
    .map(imageUrl => ({uri: imageUrl}));

  const hashtags = (post.hashTags ?? []).map(tag => `#${tag.replace(/^#+/, '').trim()}`).filter(Boolean);

  const profileImageUri = getProfileImageUriFromRecord(post.writer);
  const likedMemberCount = getArrayCount(post.likedMembers);
  const commentArrayCount = getArrayCount(post.comments);

  return {
    avatar: profileImageUri ? {uri: profileImageUri} : image.profile,
    caption: (post.content ?? '').trim(),
    commentCount: commentArrayCount ?? (typeof post.commentCount === 'number' ? post.commentCount : 0),
    comments: [],
    hashtags,
    id: String(post.postId),
    image: images[0],
    images,
    isLiked: Boolean(post.isLiked),
    likes: likedMemberCount ?? (typeof post.likeCount === 'number' ? post.likeCount : 0),
    role: post.writer?.department?.trim() || '부서 미지정',
    time: getDisplayElapsedTime(post.elapsedTime),
    title: (post.title ?? '제목 없음').trim() || '제목 없음',
    user: post.writer?.employeeName?.trim() || '이름 없음',
    writerEmployeeId:
      typeof post.writer?.employeeId === 'number' || typeof post.writer?.employeeId === 'string'
        ? String(post.writer.employeeId)
        : undefined,
  };
}

function getHasMorePosts(responseBody: FeedPostApiResponse, requestedPage: number, receivedCount: number): boolean {
  const pageData = responseBody.data;

  if (typeof pageData?.last === 'boolean') {
    return !pageData.last;
  }

  if (typeof pageData?.totalPages === 'number' && pageData.totalPages > 0) {
    return requestedPage < pageData.totalPages;
  }

  return receivedCount >= FEED_POST_SIZE;
}

function appendUniquePosts(previousPosts: FeedPost[], nextPosts: FeedPost[]): FeedPost[] {
  const knownPostIds = new Set(previousPosts.map(post => post.id));
  const uniqueNextPosts = nextPosts.filter(post => {
    if (knownPostIds.has(post.id)) {
      return false;
    }

    knownPostIds.add(post.id);
    return true;
  });

  return [...previousPosts, ...uniqueNextPosts];
}

function toHighlightGroup(item: FeedHighlightItemApi): HighlightGroup | null {
  if (typeof item.tagId !== 'number') {
    return null;
  }

  const imageUrl = item.imageUrl?.trim();

  return {
    cover: imageUrl ? {uri: imageUrl} : image.profile,
    id: String(item.tagId),
    items: [],
    label: item.tagName?.trim() || '태그',
    postCount: typeof item.postCount === 'number' ? item.postCount : 0,
  };
}

function toHighlightItem(post: FeedHighlightPostItemApi, fallbackImage: HighlightGroup['cover']): HighlightItem | null {
  if (typeof post.postId !== 'number') {
    return null;
  }

  const imageUrl = post.imageUrl?.trim();

  return {
    description: (post.content ?? '').trim(),
    id: String(post.postId),
    image: imageUrl ? {uri: imageUrl} : fallbackImage,
    time: getDisplayElapsedTime(post.elapsedTime),
    title: (post.title ?? '제목 없음').trim() || '제목 없음',
  };
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return '피드 조회 중 오류가 발생했습니다.';
}

function getCommentIdFromResponse(value: unknown): string | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const record = value as Record<string, unknown>;
  const directId = record.commentId ?? record.id;

  if (typeof directId === 'number' || typeof directId === 'string') {
    return String(directId);
  }

  return getCommentIdFromResponse(record.data);
}

function getCommentsFromResponseData(data: FeedCommentApiResponse['data']): FeedCommentItemApi[] {
  if (Array.isArray(data)) {
    return data;
  }

  return data?.comments ?? data?.content ?? [];
}

function getPostElapsedTimeFromDetail(data: FeedCommentApiResponse['data']): string | null {
  if (!data || Array.isArray(data)) {
    return null;
  }

  const elapsedTime = getDisplayElapsedTime(data.elapsedTime);
  return elapsedTime === '방금 전' ? null : elapsedTime;
}

function getPostPatchFromDetail(data: FeedCommentApiResponse['data']): Partial<FeedPost> {
  if (!data || Array.isArray(data)) {
    return {};
  }

  const commentArrayCount = getArrayCount(data.comments);
  const likedMemberCount = getArrayCount(data.likedMembers);
  const elapsedTime = getPostElapsedTimeFromDetail(data);
  const patch: Partial<FeedPost> = {};

  if (commentArrayCount !== null) {
    patch.commentCount = commentArrayCount;
  } else if (typeof data.commentCount === 'number') {
    patch.commentCount = data.commentCount;
  }

  if (likedMemberCount !== null) {
    patch.likes = likedMemberCount;
  } else if (typeof data.likeCount === 'number') {
    patch.likes = data.likeCount;
  }

  if (typeof data.isLiked === 'boolean') {
    patch.isLiked = data.isLiked;
  }

  if (elapsedTime) {
    patch.time = elapsedTime;
  }

  return patch;
}

function toFeedComment(
  comment: FeedCommentItemApi,
  fallbackIndex: number,
  myName?: string,
  myEmployeeId?: number | string,
): FeedComment | null {
  const commentId = comment.commentId ?? comment.id;
  const text = (comment.commentContent ?? comment.content)?.trim();

  if (!text) {
    return null;
  }

  const writerEmployeeId = comment.writer?.employeeId ?? comment.employeeId;
  const profileImageUri = getProfileImageUriFromRecord(comment.writer) ?? getProfileImageUriFromRecord(comment);
  const user =
    comment.writer?.employeeName?.trim() ||
    comment.writer?.name?.trim() ||
    comment.writer?.memberName?.trim() ||
    comment.writer?.nickname?.trim() ||
    comment.writer?.employeeNickname?.trim() ||
    comment.employeeName?.trim() ||
    comment.writerName?.trim() ||
    comment.authorName?.trim() ||
    '이름 없음';

  return {
    avatar: profileImageUri ? {uri: profileImageUri} : undefined,
    commentId: typeof commentId === 'number' || typeof commentId === 'string' ? String(commentId) : undefined,
    id:
      typeof commentId === 'number' || typeof commentId === 'string'
        ? String(commentId)
        : `comment-${Date.now()}-${fallbackIndex}`,
    isMine:
      comment.isMine ??
      comment.mine ??
      (myEmployeeId !== undefined && writerEmployeeId !== undefined
        ? String(myEmployeeId) === String(writerEmployeeId)
        : myName
        ? user === myName
        : false),
    text,
    time: getDisplayElapsedTime(comment.elapsedTime ?? comment.createdAt),
    user,
  };
}

function getImageFileInfo(uri: string, index: number, fileName?: string, mimeType?: string): {name: string; type: string} {
  const cleanedUri = uri.split('?')[0];
  const baseFileName = fileName?.trim() || cleanedUri.split('/').pop()?.trim() || `upload-${Date.now()}-${index}.jpg`;
  const safeFileName = baseFileName
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9._-]/g, '')
    .replace(/^$/, `upload-${Date.now()}-${index}.jpg`);
  const loweredFileName = safeFileName.toLowerCase();

  if (mimeType?.trim()) {
    return {name: safeFileName, type: mimeType.trim()};
  }

  if (loweredFileName.endsWith('.png')) {
    return {name: safeFileName, type: 'image/png'};
  }

  if (loweredFileName.endsWith('.webp')) {
    return {name: safeFileName, type: 'image/webp'};
  }

  if (loweredFileName.endsWith('.heic')) {
    return {name: safeFileName, type: 'image/heic'};
  }

  return {name: safeFileName, type: 'image/jpeg'};
}

function normalizeUploadUri(uri: string): string {
  if (Platform.OS === 'ios' && uri.startsWith('file://')) {
    return uri.replace('file://', '');
  }

  return uri;
}

async function resizeImageToUploadLimit(asset: FeedUploadImage): Promise<FeedUploadImage> {
  if (typeof asset.fileSize !== 'number' || asset.fileSize <= MAX_FEED_IMAGE_FILE_SIZE) {
    return asset;
  }

  let latestAsset = asset;

  for (const step of FEED_IMAGE_RESIZE_STEPS) {
    const resizedImage = await ImageResizer.createResizedImage(
      latestAsset.uri,
      step.maxSize,
      step.maxSize,
      'JPEG',
      step.quality,
      0,
      null,
      false,
      {mode: 'contain', onlyScaleDown: true},
    );

    latestAsset = {
      fileName: resizedImage.name || asset.fileName,
      fileSize: resizedImage.size,
      type: 'image/jpeg',
      uri: resizedImage.uri,
    };

    if (resizedImage.size <= MAX_FEED_IMAGE_FILE_SIZE) {
      return latestAsset;
    }
  }

  return latestAsset;
}

async function prepareFeedImagesForUpload(images: FeedUploadImage[]): Promise<FeedUploadImage[]> {
  const resizedImages = await Promise.all(images.map(resizeImageToUploadLimit));
  const oversizedImage = resizedImages.find(
    asset => typeof asset.fileSize === 'number' && asset.fileSize > MAX_FEED_IMAGE_FILE_SIZE,
  );

  if (oversizedImage) {
    throw new Error('사진 용량을 10MB 이하로 줄이지 못했습니다. 더 작은 사진을 선택해주세요.');
  }

  return resizedImages;
}

export function FeedProvider({children}: {children: React.ReactNode}): JSX.Element {
  const {auth} = useAuth();
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [highlightGroups, setHighlightGroups] = useState<HighlightGroup[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMorePosts, setIsLoadingMorePosts] = useState(false);
  const [hasMorePosts, setHasMorePosts] = useState(true);
  const [nextPostPage, setNextPostPage] = useState(FEED_POST_PAGE);
  const [lastError, setLastError] = useState<string | null>(null);
  const [lastResponseBody, setLastResponseBody] = useState<unknown>(null);
  const isLoadingMorePostsRef = useRef(false);

  const refreshHighlights = useCallback(async () => {
    if (!auth?.accessToken) {
      return;
    }

    try {
      const response = await withMinimumLoadingTime(
        fetch(`${API_BASE}/api/boards/${FEED_BOARD_ID}/tags/highlights`, {
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${auth.accessToken}`,
          },
        }),
      );
      const responseText = await response.text();
      let responseBody: FeedHighlightApiResponse | null = null;

      try {
        responseBody = JSON.parse(responseText) as FeedHighlightApiResponse;
      } catch {
        throw new Error('하이라이트 응답을 해석하지 못했습니다.');
      }

      if (!response.ok || responseBody.success === false) {
        throw new Error(responseBody.message || '하이라이트 조회에 실패했습니다.');
      }

      const mappedGroups = (responseBody.data ?? [])
        .map(toHighlightGroup)
        .filter((group): group is HighlightGroup => Boolean(group));

      setHighlightGroups(prevGroups => {
        const previousGroupById = new Map(prevGroups.map(group => [group.id, group]));

        return mappedGroups.map(group => ({
          ...group,
          items: previousGroupById.get(group.id)?.items ?? group.items,
        }));
      });
    } catch (error) {
      console.log('[FeedProvider] highlights request failed', error);
    }
  }, [auth?.accessToken]);

  const refreshHighlightPosts = useCallback(
    async (highlightId: string) => {
      if (!auth?.accessToken) {
        return;
      }

      const targetGroup = highlightGroups.find(group => group.id === highlightId);
      const fallbackImage = targetGroup?.cover ?? image.profile;

      if (targetGroup?.items.length) {
        return;
      }

      try {
        const response = await withMinimumLoadingTime(
          fetch(`${API_BASE}/api/boards/${FEED_BOARD_ID}/tags/${highlightId}/posts`, {
            headers: {
              Accept: 'application/json',
              Authorization: `Bearer ${auth.accessToken}`,
            },
          }),
        );
        const responseText = await response.text();
        let responseBody: FeedHighlightPostApiResponse | null = null;

        try {
          responseBody = JSON.parse(responseText) as FeedHighlightPostApiResponse;
        } catch {
          throw new Error('하이라이트 게시글 응답을 해석하지 못했습니다.');
        }

        if (!response.ok || responseBody.success === false) {
          throw new Error(responseBody.message || '하이라이트 게시글 조회에 실패했습니다.');
        }

        const items = (responseBody.data ?? [])
          .map(post => toHighlightItem(post, fallbackImage))
          .filter((item): item is HighlightItem => Boolean(item));

        setHighlightGroups(prevGroups =>
          prevGroups.map(group =>
            group.id === highlightId
              ? {
                  ...group,
                  items,
                  postCount: group.postCount ?? items.length,
                }
              : group,
          ),
        );
      } catch (error) {
        console.log('[FeedProvider] highlight posts request failed', {error, highlightId});
      }
    },
    [auth?.accessToken, highlightGroups],
  );

  const requestPostsPage = useCallback(async (page: number) => {
    if (!auth?.accessToken) {
      return null;
    }

    const queryString = new URLSearchParams({
      page: String(page),
      size: String(FEED_POST_SIZE),
    }).toString();

    const response = await withMinimumLoadingTime(
      fetch(`${API_BASE}/api/boards/${FEED_BOARD_ID}/posts?${queryString}`, {
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${auth.accessToken}`,
        },
      }),
    );
    const responseText = await response.text();
    let responseBody: FeedPostApiResponse | null = null;

    try {
      responseBody = JSON.parse(responseText) as FeedPostApiResponse;
    } catch {
      throw new Error('피드 응답을 해석하지 못했습니다.');
    }

    setLastResponseBody(responseBody);

    if (!response.ok || responseBody.success === false) {
      throw new Error(responseBody.message || '피드 조회에 실패했습니다.');
    }

    const mappedPosts = (responseBody.data?.content ?? [])
      .map(toFeedPost)
      .filter((post): post is FeedPost => Boolean(post));

    return {
      hasMore: getHasMorePosts(responseBody, page, mappedPosts.length),
      posts: mappedPosts,
    };
  }, [auth?.accessToken]);

  const refreshPosts = useCallback(async () => {
    if (!auth?.accessToken) {
      setPosts([]);
      setHasMorePosts(false);
      setNextPostPage(FEED_POST_PAGE);
      return;
    }

    setIsLoading(true);
    setLastError(null);

    try {
      const result = await requestPostsPage(FEED_POST_PAGE);

      if (!result) {
        return;
      }

      setPosts(result.posts);
      setHasMorePosts(result.hasMore);
      setNextPostPage(FEED_POST_PAGE + 1);
    } catch (error) {
      const message = getErrorMessage(error);
      setLastError(message);
      setPosts([]);
      setHasMorePosts(false);
      setNextPostPage(FEED_POST_PAGE);
      console.log('[FeedProvider] posts request failed', {error});
    } finally {
      setIsLoading(false);
    }
  }, [auth?.accessToken, requestPostsPage]);

  const loadMorePosts = useCallback(async () => {
    if (!auth?.accessToken || !hasMorePosts || isLoading || isLoadingMorePostsRef.current) {
      return;
    }

    isLoadingMorePostsRef.current = true;
    setIsLoadingMorePosts(true);
    setLastError(null);

    try {
      const pageToRequest = nextPostPage;
      const result = await requestPostsPage(pageToRequest);

      if (!result) {
        return;
      }

      setPosts(previousPosts => appendUniquePosts(previousPosts, result.posts));
      setHasMorePosts(result.hasMore);
      setNextPostPage(pageToRequest + 1);
    } catch (error) {
      const message = getErrorMessage(error);
      setLastError(message);
      console.log('[FeedProvider] more posts request failed', {error, page: nextPostPage});
    } finally {
      isLoadingMorePostsRef.current = false;
      setIsLoadingMorePosts(false);
    }
  }, [auth?.accessToken, hasMorePosts, isLoading, nextPostPage, requestPostsPage]);

  const fetchPostDetail = useCallback(
    async (postId: string): Promise<FeedCommentApiResponse> => {
      if (!auth?.accessToken) {
        throw new Error('로그인 정보가 필요합니다.');
      }

      const response = await withMinimumLoadingTime(
        fetch(`${API_BASE}/api/boards/${FEED_BOARD_ID}/posts/${postId}`, {
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${auth.accessToken}`,
          },
        }),
      );
      const responseText = await response.text();
      let responseBody: FeedCommentApiResponse | null = null;

      try {
        responseBody = JSON.parse(responseText) as FeedCommentApiResponse;
      } catch {
        throw new Error('게시글 상세 응답을 해석하지 못했습니다.');
      }

      if (!response.ok || responseBody.success === false) {
        throw new Error(responseBody.message || responseText || '게시글 상세 조회에 실패했습니다.');
      }

      const detailPatch = getPostPatchFromDetail(responseBody.data);
      const hasDetailPatch = Object.keys(detailPatch).length > 0;

      if (hasDetailPatch) {
        setPosts(prevPosts =>
          prevPosts.map(post => (post.id === postId ? {...post, ...detailPatch} : post)),
        );
      }

      return responseBody;
    },
    [auth?.accessToken],
  );

  const togglePostLike = useCallback(
    async (postId: string) => {
      if (!auth?.accessToken) {
        return;
      }

      let previousPost: FeedPost | null = null;

      setPosts(prevPosts =>
        prevPosts.map(post => {
          if (post.id !== postId) {
            return post;
          }

          previousPost = post;
          const nextIsLiked = !post.isLiked;

          return {
            ...post,
            isLiked: nextIsLiked,
            likes: Math.max(0, post.likes + (nextIsLiked ? 1 : -1)),
          };
        }),
      );

      try {
        const response = await withMinimumLoadingTime(
          fetch(`${API_BASE}/api/boards/${FEED_BOARD_ID}/posts/${postId}/likes/toggle`, {
            method: 'POST',
            headers: {
              Accept: 'application/json',
              Authorization: `Bearer ${auth.accessToken}`,
            },
          }),
        );

        const responseText = await response.text();
        let responseBody: {message?: string; success?: boolean} | null = null;

        try {
          responseBody = JSON.parse(responseText) as {message?: string; success?: boolean};
        } catch {
          responseBody = null;
        }

        if (!response.ok || responseBody?.success === false) {
          throw new Error(responseBody?.message || '좋아요 처리에 실패했습니다.');
        }

        await fetchPostDetail(postId);
      } catch (error) {
        if (previousPost) {
          setPosts(prevPosts => prevPosts.map(post => (post.id === postId ? previousPost! : post)));
        }
        console.log('[FeedProvider] like toggle failed', {error, postId});
      }
    },
    [auth?.accessToken, fetchPostDetail],
  );

  const createComment = useCallback(
    async (postId: string, content: string) => {
      if (!auth?.accessToken) {
        throw new Error('로그인 정보가 필요합니다.');
      }

      const response = await withMinimumLoadingTime(
        fetch(`${API_BASE}/api/boards/${FEED_BOARD_ID}/posts/${postId}/comments`, {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${auth.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({content}),
        }),
      );

      const responseText = await response.text();
      let responseBody: CommentMutationResponse | null = null;

      try {
        responseBody = JSON.parse(responseText) as CommentMutationResponse;
      } catch {
        responseBody = null;
      }

      if (!response.ok || responseBody?.success === false) {
        throw new Error(responseBody?.message || responseText || '댓글 등록에 실패했습니다.');
      }

      return getCommentIdFromResponse(responseBody);
    },
    [auth?.accessToken],
  );

  const fetchComments = useCallback(
    async (postId: string) => {
      if (!auth?.accessToken) {
        return [];
      }

      const responseBody = await fetchPostDetail(postId);

      return getCommentsFromResponseData(responseBody.data)
        .map((comment, index) => toFeedComment(comment, index, auth.name, auth.employeeId))
        .filter((comment): comment is FeedComment => Boolean(comment));
    },
    [auth?.accessToken, auth?.employeeId, auth?.name, fetchPostDetail],
  );

  const updateComment = useCallback(
    async (postId: string, commentId: string, content: string) => {
      if (!auth?.accessToken) {
        throw new Error('로그인 정보가 필요합니다.');
      }

      const response = await withMinimumLoadingTime(
        fetch(`${API_BASE}/api/boards/${FEED_BOARD_ID}/posts/${postId}/comments/${commentId}`, {
          method: 'PUT',
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${auth.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({content}),
        }),
      );

      const responseText = await response.text();
      let responseBody: CommentMutationResponse | null = null;

      try {
        responseBody = JSON.parse(responseText) as CommentMutationResponse;
      } catch {
        responseBody = null;
      }

      if (!response.ok || responseBody?.success === false) {
        throw new Error(responseBody?.message || responseText || '댓글 수정에 실패했습니다.');
      }
    },
    [auth?.accessToken],
  );

  const deleteComment = useCallback(
    async (postId: string, commentId: string) => {
      if (!auth?.accessToken) {
        throw new Error('로그인 정보가 필요합니다.');
      }

      const response = await withMinimumLoadingTime(
        fetch(`${API_BASE}/api/boards/${FEED_BOARD_ID}/posts/${postId}/comments/${commentId}`, {
          method: 'DELETE',
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${auth.accessToken}`,
          },
        }),
      );

      const responseText = await response.text();
      let responseBody: CommentMutationResponse | null = null;

      try {
        responseBody = JSON.parse(responseText) as CommentMutationResponse;
      } catch {
        responseBody = null;
      }

      if (!response.ok || responseBody?.success === false) {
        throw new Error(responseBody?.message || responseText || '댓글 삭제에 실패했습니다.');
      }

    },
    [auth?.accessToken],
  );

  const createPost = useCallback(
    async (payload: {
      content: string;
      hashTags: string[];
      images: FeedUploadImage[];
      title: string;
    }) => {
      if (!auth?.accessToken) {
        throw new Error('로그인 정보가 필요합니다.');
      }

      if (payload.images.length > MAX_FEED_IMAGE_COUNT) {
        throw new Error(`사진은 최대 ${MAX_FEED_IMAGE_COUNT}장까지 업로드할 수 있습니다.`);
      }

      const uploadImages = await prepareFeedImagesForUpload(payload.images);

      const imageDebugInfo = uploadImages.map((asset, index) => ({
        fileName: asset.fileName,
        fileSize: asset.fileSize,
        index,
        type: asset.type,
        uri: asset.uri,
      }));

      console.log('[FeedProvider] createPost request', {
        boardId: FEED_BOARD_ID,
        contentLength: payload.content.length,
        imageCount: payload.images.length,
        images: imageDebugInfo,
        hashTagCount: payload.hashTags.length,
        title: payload.title,
      });

      const formData = new FormData();
      formData.append('content', payload.content);
      formData.append('title', payload.title);

      payload.hashTags.forEach(tag => {
        formData.append('hashTags', tag);
      });

      uploadImages.forEach((asset, index) => {
        const {name, type} = getImageFileInfo(asset.uri, index, asset.fileName, asset.type);
        const normalizedUri = normalizeUploadUri(asset.uri);
        formData.append('images[]', {
          name,
          type,
          uri: normalizedUri,
        } as any);
      });

      const formDataParts = ((formData as any)?._parts ?? []).map((part: any) => part?.[0]);
      console.log('[FeedProvider] createPost formData parts', formDataParts);

      const response = await withMinimumLoadingTime(
        fetch(`${API_BASE}/api/boards/${FEED_BOARD_ID}/post`, {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${auth.accessToken}`,
          },
          body: formData,
        }),
      );

      const responseText = await response.text();
      let responseBody: {message?: string; success?: boolean} | null = null;

      try {
        responseBody = JSON.parse(responseText) as {message?: string; success?: boolean};
      } catch {
        responseBody = null;
      }

      setLastResponseBody(responseBody ?? responseText);
      console.log('[FeedProvider] createPost response', {
        body: responseBody ?? responseText,
        status: response.status,
      });

      if (!response.ok || responseBody?.success === false) {
        const serverMessage = responseBody?.message || responseText || '게시글 등록에 실패했습니다.';
        console.log('[FeedProvider] createPost failed', {
          serverMessage,
          status: response.status,
        });
        throw new Error(`[${response.status}] ${serverMessage}`);
      }

      await refreshPosts();
    },
    [auth?.accessToken, refreshPosts],
  );

  useEffect(() => {
    refreshPosts();
    refreshHighlights();
  }, [refreshHighlights, refreshPosts]);

  const value = useMemo(
    () => ({
      createComment,
      createPost,
      deleteComment,
      fetchComments,
      hasMorePosts,
      highlightGroups,
      isLoading,
      isLoadingMorePosts,
      lastError,
      lastResponseBody,
      loadMorePosts,
      posts,
      refreshHighlights,
      refreshHighlightPosts,
      refreshPosts,
      setPosts,
      togglePostLike,
      updateComment,
    }),
    [
      createComment,
      createPost,
      deleteComment,
      fetchComments,
      hasMorePosts,
      highlightGroups,
      isLoading,
      isLoadingMorePosts,
      lastError,
      lastResponseBody,
      loadMorePosts,
      posts,
      refreshHighlights,
      refreshHighlightPosts,
      refreshPosts,
      togglePostLike,
      updateComment,
    ],
  );

  return <FeedContext.Provider value={value}>{children}</FeedContext.Provider>;
}

export function useFeed(): FeedContextValue {
  const context = useContext(FeedContext);

  if (!context) {
    throw new Error('useFeed must be used within FeedProvider');
  }

  return context;
}
