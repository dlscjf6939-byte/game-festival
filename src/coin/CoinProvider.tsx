import React, {createContext, useCallback, useContext, useEffect, useMemo, useState} from 'react';
import {useAuth} from '../auth/AuthProvider';
import {type CoinRanking} from '../dummyData/coinDummyData';
import {withMinimumLoadingTime} from '../utils/loading';

const API_BASE = 'http://121.254.240.93:8090';

type RankingResponse = {
  code?: string;
  data?: unknown;
  message?: string;
  success?: boolean;
};

type CoinContextValue = {
  isRankingLoading: boolean;
  rankingError: string | null;
  rankingItems: CoinRanking[];
  refreshRanking: () => Promise<void>;
};

const CoinContext = createContext<CoinContextValue | undefined>(undefined);

function toNonEmptyString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim();
  return normalized ? normalized : null;
}

function toNumberValue(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function getRankingRows(payload: unknown): unknown[] {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (payload && typeof payload === 'object') {
    const record = payload as Record<string, unknown>;

    if (Array.isArray(record.content)) {
      return record.content;
    }

    if (Array.isArray(record.items)) {
      return record.items;
    }

    if (Array.isArray(record.rankings)) {
      return record.rankings;
    }

    if (Array.isArray(record.list)) {
      return record.list;
    }
  }

  return [];
}

function normalizeRanking(
  item: unknown,
  index: number,
  myName: string | undefined,
  myEmployeeId: number | string | undefined,
): CoinRanking | null {
  if (!item || typeof item !== 'object') {
    return null;
  }

  const record = item as Record<string, unknown>;
  const name =
    toNonEmptyString(record.name) ??
    toNonEmptyString(record.employeeName) ??
    toNonEmptyString(record.userName) ??
    toNonEmptyString(record.nickname);
  const team =
    toNonEmptyString(record.teamName) ??
    toNonEmptyString(record.team) ??
    toNonEmptyString(record.departmentName) ??
    toNonEmptyString(record.department) ??
    '-';
  const rank =
    toNumberValue(record.rank) ??
    toNumberValue(record.ranking) ??
    toNumberValue(record.position) ??
    index + 1;
  const coins =
    toNumberValue(record.coins) ??
    toNumberValue(record.balance) ??
    toNumberValue(record.coinCount) ??
    toNumberValue(record.totalCoin) ??
    0;
  const employeeId =
    toNonEmptyString(record.employeeId) ??
    (typeof record.employeeId === 'number' ? String(record.employeeId) : null) ??
    toNonEmptyString(record.userId);
  const myEmployeeIdText = myEmployeeId === undefined ? null : String(myEmployeeId);
  const isMeById = Boolean(employeeId && myEmployeeIdText && employeeId === myEmployeeIdText);
  const isMeByName = Boolean(name && myName && name === myName);

  if (!name) {
    return null;
  }

  return {
    coins,
    id: employeeId ?? `${name}-${rank}-${index}`,
    isMe: isMeById || isMeByName,
    name,
    rank,
    team,
  };
}

export function CoinProvider({children}: {children: React.ReactNode}): JSX.Element {
  const {auth} = useAuth();
  const [rankingItems, setRankingItems] = useState<CoinRanking[]>([]);
  const [isRankingLoading, setIsRankingLoading] = useState(true);
  const [rankingError, setRankingError] = useState<string | null>(null);

  const refreshRanking = useCallback(async () => {
    if (!auth?.accessToken) {
      setIsRankingLoading(false);
      return;
    }

    setIsRankingLoading(true);
    setRankingError(null);

    try {
      const response = await withMinimumLoadingTime(
        fetch(`${API_BASE}/api/coin/ranking?size=30`, {
          headers: {
            Authorization: `Bearer ${auth.accessToken}`,
          },
        }),
      );
      const responseText = await response.text();
      let responseBody: unknown = responseText;

      try {
        responseBody = JSON.parse(responseText);
      } catch {
        // Keep non-JSON response for debugging.
      }

      console.log('[CoinProvider] ranking response', {
        body: responseBody,
        status: response.status,
        url: '/api/coin/ranking?size=30',
      });

      const payload =
        responseBody && typeof responseBody === 'object' && !Array.isArray(responseBody)
          ? (responseBody as RankingResponse).data
          : responseBody;
      const rows = getRankingRows(payload);
      const mapped = rows
        .map((item, index) => normalizeRanking(item, index, auth.name, auth.employeeId))
        .filter((item): item is CoinRanking => item !== null);

      setRankingItems(mapped);

      if (!response.ok) {
        setRankingError('코인 랭킹 조회에 실패했습니다.');
      }
    } catch (error) {
      setRankingError(error instanceof Error ? error.message : '코인 랭킹 조회 중 오류가 발생했습니다.');
      console.log('[CoinProvider] ranking request failed', error);
    } finally {
      setIsRankingLoading(false);
    }
  }, [auth?.accessToken, auth?.employeeId, auth?.name]);

  useEffect(() => {
    void refreshRanking();
  }, [refreshRanking]);

  const value = useMemo(
    () => ({
      isRankingLoading,
      rankingError,
      rankingItems,
      refreshRanking,
    }),
    [isRankingLoading, rankingError, rankingItems, refreshRanking],
  );

  return <CoinContext.Provider value={value}>{children}</CoinContext.Provider>;
}

export function useCoin(): CoinContextValue {
  const context = useContext(CoinContext);

  if (!context) {
    throw new Error('useCoin must be used within CoinProvider');
  }

  return context;
}
