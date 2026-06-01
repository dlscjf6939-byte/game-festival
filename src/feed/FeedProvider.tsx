import React, {createContext, useCallback, useContext, useEffect, useMemo, useState} from 'react';
import {Platform} from 'react-native';
import {useAuth} from '../auth/AuthProvider';
import {image} from '../assets/images';
import {feedPosts, type FeedPost} from '../dummyData/feedDummyData';

const API_BASE = 'http://121.254.240.93:8090';
const FEED_BOARD_ID = 21;
const FEED_POST_PAGE = 1;
const FEED_POST_SIZE = 5;

type FeedContextValue = {
  createPost: (payload: {
    content: string;
    hashTags: string[];
    images: Array<{fileName?: string; type?: string; uri: string}>;
    title: string;
  }) => Promise<void>;
  isLoading: boolean;
  lastError: string | null;
  lastResponseBody: unknown;
  posts: FeedPost[];
  refreshPosts: () => Promise<void>;
  setPosts: React.Dispatch<React.SetStateAction<FeedPost[]>>;
  togglePostLike: (postId: string) => Promise<void>;
};

const FeedContext = createContext<FeedContextValue | undefined>(undefined);

type FeedPostApiResponse = {
  code?: string;
  data?: {
    content?: FeedPostItemApi[];
  };
  message?: string;
  success?: boolean;
};

type FeedPostItemApi = {
  commentCount?: number;
  content?: string;
  hashTags?: string[];
  isLiked?: boolean;
  likeCount?: number;
  postId?: number;
  title?: string;
  uploadImages?: Array<{
    imageUrl?: string;
  }>;
  writer?: {
    department?: string;
    employeeName?: string;
  };
};

function toFeedPost(post: FeedPostItemApi): FeedPost | null {
  if (typeof post.postId !== 'number') {
    return null;
  }

  const images = (post.uploadImages ?? [])
    .map(item => item.imageUrl?.trim())
    .filter((imageUrl): imageUrl is string => Boolean(imageUrl))
    .map(imageUrl => ({uri: imageUrl}));

  const hashtags = (post.hashTags ?? []).map(tag => `#${tag.replace(/^#+/, '').trim()}`).filter(Boolean);

  return {
    avatar: image.profile,
    caption: (post.content ?? '').trim(),
    commentCount: typeof post.commentCount === 'number' ? post.commentCount : 0,
    comments: [],
    hashtags,
    id: String(post.postId),
    image: images[0],
    images,
    isLiked: Boolean(post.isLiked),
    likes: typeof post.likeCount === 'number' ? post.likeCount : 0,
    role: post.writer?.department?.trim() || '부서 미지정',
    time: '방금 전',
    title: (post.title ?? '제목 없음').trim() || '제목 없음',
    user: post.writer?.employeeName?.trim() || '이름 없음',
  };
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return '피드 조회 중 오류가 발생했습니다.';
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

export function FeedProvider({children}: {children: React.ReactNode}): JSX.Element {
  const {auth} = useAuth();
  const [posts, setPosts] = useState<FeedPost[]>(feedPosts);
  const [isLoading, setIsLoading] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [lastResponseBody, setLastResponseBody] = useState<unknown>(null);

  const refreshPosts = useCallback(async () => {
    if (!auth?.accessToken) {
      return;
    }

    setIsLoading(true);
    setLastError(null);
    const queryString = new URLSearchParams({
      page: String(FEED_POST_PAGE),
      size: String(FEED_POST_SIZE),
    }).toString();

    try {
      const response = await fetch(`${API_BASE}/api/boards/${FEED_BOARD_ID}/posts?${queryString}`, {
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${auth.accessToken}`,
        },
      });
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

      const mappedPosts = (responseBody.data?.content ?? []).map(toFeedPost).filter((post): post is FeedPost => Boolean(post));
      setPosts(mappedPosts.length ? mappedPosts : feedPosts);
    } catch (error) {
      const message = getErrorMessage(error);
      setLastError(message);
      setPosts(feedPosts);
      console.log('[FeedProvider] posts request failed', {error, queryString});
    } finally {
      setIsLoading(false);
    }
  }, [auth?.accessToken]);

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
          const nextIsLiked = !Boolean(post.isLiked);
          const nextLikes = Math.max(0, post.likes + (nextIsLiked ? 1 : -1));

          return {
            ...post,
            isLiked: nextIsLiked,
            likes: nextLikes,
          };
        }),
      );

      try {
        const response = await fetch(`${API_BASE}/api/boards/${FEED_BOARD_ID}/posts/${postId}/likes/toggle`, {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${auth.accessToken}`,
          },
        });

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
      } catch (error) {
        if (previousPost) {
          setPosts(prevPosts => prevPosts.map(post => (post.id === postId ? previousPost! : post)));
        }
        console.log('[FeedProvider] like toggle failed', {error, postId});
      }
    },
    [auth?.accessToken],
  );

  const createPost = useCallback(
    async (payload: {
      content: string;
      hashTags: string[];
      images: Array<{fileName?: string; type?: string; uri: string}>;
      title: string;
    }) => {
      if (!auth?.accessToken) {
        throw new Error('로그인 정보가 필요합니다.');
      }

      const imageDebugInfo = payload.images.map((asset, index) => ({
        fileName: asset.fileName,
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

      payload.images.forEach((asset, index) => {
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

      const response = await fetch(`${API_BASE}/api/boards/${FEED_BOARD_ID}/post`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${auth.accessToken}`,
        },
        body: formData,
      });

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
    void refreshPosts();
  }, [refreshPosts]);

  const value = useMemo(
    () => ({
      isLoading,
      lastError,
      lastResponseBody,
      posts,
      refreshPosts,
      setPosts,
      togglePostLike,
      createPost,
    }),
    [createPost, isLoading, lastError, lastResponseBody, posts, refreshPosts, togglePostLike],
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
