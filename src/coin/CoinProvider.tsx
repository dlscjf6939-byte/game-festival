import React, {createContext, useCallback, useContext, useEffect, useMemo, useState} from 'react';
import {useAuth} from '../auth/AuthProvider';
import {type CoinRanking} from '../dummyData/coinDummyData';
import {withMinimumLoadingTime} from '../utils/loading';
import {getProfileImageUriFromRecord} from '../utils/profileImage';

const API_BASE = 'http://121.254.240.93:8090';

type RankingResponse = {
  code?: string;
  data?: unknown;
  message?: string;
  success?: boolean;
};

export type CoinHistory = {
  amount: number;
  description: string;
  id: string;
  title: string;
};

type CoinHistorySummary = {
  accumulatedCoin?: number;
  holdingCoin?: number;
};

type CoinHistoryResponse = {
  code?: string;
  data?: unknown;
  message?: string;
  success?: boolean;
};

type CoinHistoryApiData = {
  accumulatedCoin?: number | string;
  historyList?: unknown;
  holdingCoin?: number | string;
};

type CoinHistoryApiItem = {
  amount?: number | string;
  createdAt?: string;
  description?: string;
  transactionId?: number | string;
  transactionType?: string;
};

type CoinContextValue = {
  accumulatedCoin: number | null;
  coinHistories: CoinHistory[];
  coinHistoriesError: string | null;
  holdingCoin: number | null;
  isCoinHistoriesLoading: boolean;
  isRankingLoading: boolean;
  rankingError: string | null;
  rankingItems: CoinRanking[];
  refreshAllCoins: () => Promise<void>;
  refreshCoinHistory: (showLoading?: boolean) => Promise<CoinHistorySummary | null>;
  refreshCoinSummary: (showLoading?: boolean) => Promise<CoinHistorySummary | null>;
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

function formatCoinHistoryCreatedAt(value: unknown): string {
  if (typeof value !== 'string') {
    return '일시 정보 없음';
  }

  const matched = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);

  if (!matched) {
    return value.trim() || '일시 정보 없음';
  }

  return `${matched[1]}.${matched[2]}.${matched[3]} ${matched[4]}:${matched[5]}`;
}

function getCoinHistoryData(responseBody: CoinHistoryResponse): CoinHistoryApiData | null {
  if (!responseBody.data || typeof responseBody.data !== 'object') {
    return null;
  }

  return responseBody.data as CoinHistoryApiData;
}

function getCoinHistoryItemsFromData(data: CoinHistoryApiData | null): unknown[] {
  if (!data || !Array.isArray(data.historyList)) {
    return [];
  }

  return data.historyList;
}

function normalizeCoinHistory(item: unknown): CoinHistory | null {
  if (!item || typeof item !== 'object') {
    return null;
  }

  const record = item as CoinHistoryApiItem;
  const transactionId = toNumberValue(record.transactionId);
  const rawAmount = toNumberValue(record.amount);
  const description = toNonEmptyString(record.description);
  const transactionType = toNonEmptyString(record.transactionType)?.toUpperCase() ?? '';

  if (transactionId === null || rawAmount === null) {
    return null;
  }

  const absoluteAmount = Math.abs(rawAmount);
  const signedAmount = transactionType === 'DECREASE' ? -absoluteAmount : absoluteAmount;

  return {
    amount: signedAmount,
    description: formatCoinHistoryCreatedAt(record.createdAt),
    id: String(transactionId),
    title: description ?? (signedAmount < 0 ? '코인 사용' : '코인 적립'),
  };
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

function getRecordValue(record: Record<string, unknown>, key: string): Record<string, unknown> | null {
  const value = record[key];

  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function getNestedRankingRecord(record: Record<string, unknown>): Record<string, unknown> | null {
  return (
    getRecordValue(record, 'employee') ??
    getRecordValue(record, 'member') ??
    getRecordValue(record, 'user') ??
    getRecordValue(record, 'writer')
  );
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
  const nestedRecord = getNestedRankingRecord(record);
  const name =
    toNonEmptyString(record.name) ??
    toNonEmptyString(record.employeeName) ??
    toNonEmptyString(record.userName) ??
    toNonEmptyString(record.nickname) ??
    (nestedRecord
      ? toNonEmptyString(nestedRecord.name) ??
        toNonEmptyString(nestedRecord.employeeName) ??
        toNonEmptyString(nestedRecord.userName) ??
        toNonEmptyString(nestedRecord.nickname)
      : null);
  const team =
    toNonEmptyString(record.teamName) ??
    toNonEmptyString(record.team) ??
    toNonEmptyString(record.departmentName) ??
    toNonEmptyString(record.department) ??
    (nestedRecord
      ? toNonEmptyString(nestedRecord.teamName) ??
        toNonEmptyString(nestedRecord.team) ??
        toNonEmptyString(nestedRecord.departmentName) ??
        toNonEmptyString(nestedRecord.department)
      : null) ??
    '-';
  const rank =
    toNumberValue(record.rank) ??
    toNumberValue(record.ranking) ??
    toNumberValue(record.position) ??
    index + 1;
  const coins =
    toNumberValue(record.accumulatedCoin) ??
    toNumberValue(record.coins) ??
    toNumberValue(record.balance) ??
    toNumberValue(record.coinCount) ??
    toNumberValue(record.totalCoin) ??
    0;
  const employeeId =
    toNonEmptyString(record.employeeId) ??
    (typeof record.employeeId === 'number' ? String(record.employeeId) : null) ??
    toNonEmptyString(record.memberId) ??
    (typeof record.memberId === 'number' ? String(record.memberId) : null) ??
    toNonEmptyString(record.userId) ??
    (typeof record.userId === 'number' ? String(record.userId) : null) ??
    toNonEmptyString(record.writerEmployeeId) ??
    (typeof record.writerEmployeeId === 'number' ? String(record.writerEmployeeId) : null) ??
    (nestedRecord
      ? toNonEmptyString(nestedRecord.employeeId) ??
        (typeof nestedRecord.employeeId === 'number' ? String(nestedRecord.employeeId) : null) ??
        toNonEmptyString(nestedRecord.memberId) ??
        (typeof nestedRecord.memberId === 'number' ? String(nestedRecord.memberId) : null) ??
        toNonEmptyString(nestedRecord.userId) ??
        (typeof nestedRecord.userId === 'number' ? String(nestedRecord.userId) : null)
      : null);
  const profileImageUri = getProfileImageUriFromRecord(record) ?? getProfileImageUriFromRecord(nestedRecord);
  const myEmployeeIdText = myEmployeeId === undefined ? null : String(myEmployeeId);
  const isMeById = Boolean(employeeId && myEmployeeIdText && employeeId === myEmployeeIdText);
  const isMeByName = Boolean(name && myName && name === myName);

  if (!name) {
    return null;
  }

  return {
    coins,
    employeeId: employeeId ?? undefined,
    id: employeeId ?? `${name}-${rank}-${index}`,
    isMe: isMeById || isMeByName,
    name,
    profileImageUri,
    rank,
    team,
  };
}

export function CoinProvider({children}: {children: React.ReactNode}): JSX.Element {
  const {auth} = useAuth();
  const [coinHistories, setCoinHistories] = useState<CoinHistory[]>([]);
  const [coinHistorySummary, setCoinHistorySummary] = useState<CoinHistorySummary | null>(null);
  const [isCoinHistoriesLoading, setIsCoinHistoriesLoading] = useState(false);
  const [coinHistoriesError, setCoinHistoriesError] = useState<string | null>(null);
  const [rankingItems, setRankingItems] = useState<CoinRanking[]>([]);
  const [isRankingLoading, setIsRankingLoading] = useState(true);
  const [rankingError, setRankingError] = useState<string | null>(null);

  const refreshCoinHistory = useCallback(
    async (showLoading = true) => {
      if (!auth?.accessToken) {
        setCoinHistories([]);
        setCoinHistorySummary(null);
        setIsCoinHistoriesLoading(false);
        return null;
      }

      if (showLoading) {
        setIsCoinHistoriesLoading(true);
      }

      setCoinHistoriesError(null);

      try {
        const response = await fetch(`${API_BASE}/api/coin/history`, {
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${auth.accessToken}`,
          },
        });
        const responseText = await response.text();
        let responseBody: CoinHistoryResponse | null = null;

        try {
          responseBody = JSON.parse(responseText) as CoinHistoryResponse;
        } catch {
          throw new Error('코인 내역 응답을 해석하지 못했습니다.');
        }

        if (!response.ok || responseBody.success === false) {
          throw new Error(responseBody.message || '코인 내역 조회에 실패했습니다.');
        }

        const data = getCoinHistoryData(responseBody);
        const histories = getCoinHistoryItemsFromData(data)
          .map(normalizeCoinHistory)
          .filter((history): history is CoinHistory => Boolean(history));

        setCoinHistories(histories);
        const nextSummary = {
          accumulatedCoin: toNumberValue(data?.accumulatedCoin) ?? undefined,
          holdingCoin: toNumberValue(data?.holdingCoin) ?? undefined,
        };

        setCoinHistorySummary(nextSummary);
        return nextSummary;
      } catch (error) {
        setCoinHistories([]);
        setCoinHistorySummary(null);
        setCoinHistoriesError(error instanceof Error ? error.message : '코인 내역 조회 중 오류가 발생했습니다.');
        console.log('[CoinProvider] coin history request failed', error);
        return null;
      } finally {
        if (showLoading) {
          setIsCoinHistoriesLoading(false);
        }
      }
    },
    [auth?.accessToken],
  );

  const refreshCoinSummary = useCallback(
    async (showLoading = false) => {
      return refreshCoinHistory(showLoading);
    },
    [refreshCoinHistory],
  );

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
    refreshRanking().catch(error => {
      console.log('[CoinProvider] ranking effect failed', error);
    });
  }, [refreshRanking]);

  useEffect(() => {
    refreshCoinHistory().catch(error => {
      console.log('[CoinProvider] coin history effect failed', error);
    });
  }, [refreshCoinHistory]);

  const refreshAllCoins = useCallback(async () => {
    await Promise.all([refreshCoinHistory(false), refreshRanking()]);
  }, [refreshCoinHistory, refreshRanking]);

  const value = useMemo(
    () => ({
      accumulatedCoin: coinHistorySummary?.accumulatedCoin ?? null,
      coinHistories,
      coinHistoriesError,
      holdingCoin: coinHistorySummary?.holdingCoin ?? null,
      isCoinHistoriesLoading,
      isRankingLoading,
      rankingError,
      rankingItems,
      refreshAllCoins,
      refreshCoinHistory,
      refreshCoinSummary,
      refreshRanking,
    }),
    [
      coinHistories,
      coinHistoriesError,
      coinHistorySummary?.accumulatedCoin,
      coinHistorySummary?.holdingCoin,
      isCoinHistoriesLoading,
      isRankingLoading,
      rankingError,
      rankingItems,
      refreshAllCoins,
      refreshCoinHistory,
      refreshCoinSummary,
      refreshRanking,
    ],
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
