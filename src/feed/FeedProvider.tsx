import React, {createContext, useCallback, useContext, useEffect, useMemo, useState} from 'react';
import {useAuth} from '../auth/AuthProvider';
import {feedPosts, type FeedPost} from '../dummyData/feedDummyData';

const API_BASE = 'http://121.254.240.93:8090';
const FEED_BOARD_ID = 21;
const FEED_POST_PAGE = 6;
const FEED_POST_SIZE = 5;
const FEED_POST_HASHTAGS = ['철권', '크아'];

type FeedTagQueryFormat = 'repeat' | 'json' | 'quotedJson';

type FeedContextValue = {
  isLoading: boolean;
  lastError: string | null;
  lastResponseBody: unknown;
  posts: FeedPost[];
  refreshPosts: () => Promise<void>;
  setPosts: React.Dispatch<React.SetStateAction<FeedPost[]>>;
};

const FeedContext = createContext<FeedContextValue | undefined>(undefined);

function buildFeedQueryString(format: FeedTagQueryFormat): string {
  const params = new URLSearchParams({
    page: String(FEED_POST_PAGE),
    size: String(FEED_POST_SIZE),
  });

  if (format === 'repeat') {
    FEED_POST_HASHTAGS.forEach(tag => {
      params.append('hashTags', tag);
    });
    return params.toString();
  }

  const jsonTags = JSON.stringify(FEED_POST_HASHTAGS);
  params.append('hashTags', format === 'quotedJson' ? `"${jsonTags}"` : jsonTags);
  return params.toString();
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return '피드 조회 중 오류가 발생했습니다.';
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

    console.log('[FeedProvider] access token', auth.accessToken);

    const attempts: FeedTagQueryFormat[] = ['repeat', 'json', 'quotedJson'];

    try {
      for (const attempt of attempts) {
        const queryString = buildFeedQueryString(attempt);
        const response = await fetch(`${API_BASE}/api/boards/${FEED_BOARD_ID}/posts?${queryString}`, {
          headers: {
            Authorization: `Bearer ${auth.accessToken}`,
          },
        });
        const responseText = await response.text();
        let responseBody: unknown = responseText;

        try {
          responseBody = JSON.parse(responseText);
        } catch {
          // Keep non-JSON responses visible in logs.
        }

        setLastResponseBody(responseBody);
        console.log('[FeedProvider] posts response', {
          body: responseBody,
          format: attempt,
          status: response.status,
          url: `/api/boards/${FEED_BOARD_ID}/posts?${queryString}`,
        });

        if (response.ok) {
          break;
        }
      }
    } catch (error) {
      const message = getErrorMessage(error);
      setLastError(message);
      console.log('[FeedProvider] posts request failed', error);
    } finally {
      setIsLoading(false);
    }
  }, [auth?.accessToken]);

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
    }),
    [isLoading, lastError, lastResponseBody, posts, refreshPosts],
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
