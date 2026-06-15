import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {createContext, useCallback, useContext, useMemo, useRef, useState} from 'react';
import {useAuth} from '../auth/AuthProvider';
import {withMinimumLoadingTime} from '../utils/loading';

const ATTENDANCE_STORAGE_PREFIX = 'game_app_attendance_weekly_v1';
const API_BASE = 'http://121.254.240.93:8090';
const ATTENDANCE_FESTIVAL_ID = 3;
const ATTENDANCE_EVENT_ID = 1;

type AttendanceSnapshot = {
  checkedDates: string[];
  checkedThisWeekCount: number;
  lastCheckedDate: string | null;
  totalCheckedCount: number;
  weekStartDate: string;
};

type CheckInNotice = {
  checkedThisWeekCount: number;
  rewardCoins: number;
  totalCheckedCount: number;
  weeklyRewardCoins: number;
};

type AttendanceContextValue = {
  attendance: AttendanceSnapshot | null;
  checkInNotice: CheckInNotice | null;
  dismissCheckInNotice: () => void;
  didCheckInToday: boolean;
  isChecking: boolean;
  refreshAttendance: () => Promise<void>;
};

type AttendanceStore = {
  checkedDates: string[];
  lastCheckedDate: string | null;
  totalCheckedCount?: number;
  weekStartDate: string;
};

const AttendanceContext = createContext<AttendanceContextValue | undefined>(undefined);

type AttendanceApiResponse = {
  code?: string;
  data?: {
    attendDate?: string;
    receivedReward?: AttendanceReward;
    receivedRewards?: Array<{
      rewardCycle?: string;
      rewardType?: string;
      rewardValue?: number | string;
    }>;
    reward?: AttendanceReward;
    rewards?: AttendanceReward[];
  };
  message?: string;
  success?: boolean;
};

type AttendanceReward = {
  rewardCycle?: string;
  rewardType?: string;
  rewardValue?: number | string;
};

type WeeklyAttendanceApiResponse = {
  code?: string;
  data?: unknown;
  message?: string;
  success?: boolean;
};

function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getWeekStartDateKey(baseDate: Date): string {
  const cloned = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate());
  const day = cloned.getDay(); // 0: Sun, 1: Mon
  const daysFromMonday = day === 0 ? 6 : day - 1;
  cloned.setDate(cloned.getDate() - daysFromMonday);
  return toDateKey(cloned);
}

function toDateKeyFromValue(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const matched = value.match(/\d{4}-\d{2}-\d{2}/);
  return matched?.[0] ?? null;
}

function getAttendanceFlag(record: Record<string, unknown>): boolean | null {
  const booleanKeys = ['attended', 'checked', 'isAttend', 'isAttended', 'hasAttended', 'isChecked'];

  for (const key of booleanKeys) {
    const value = record[key];

    if (typeof value === 'boolean') {
      return value;
    }
  }

  const ynValue = record.attendYn ?? record.attendanceYn ?? record.checkedYn;
  if (typeof ynValue === 'string') {
    const normalized = ynValue.trim().toUpperCase();

    if (normalized === 'Y') {
      return true;
    }

    if (normalized === 'N') {
      return false;
    }
  }

  const statusValue = record.status ?? record.attendanceStatus;
  if (typeof statusValue === 'string') {
    const normalized = statusValue.trim().toUpperCase();

    if (['ATTENDED', 'CHECKED', 'COMPLETE', 'COMPLETED'].includes(normalized)) {
      return true;
    }

    if (['ABSENT', 'MISSED', 'NONE', 'NOT_ATTENDED', 'UNCHECKED', 'UPCOMING'].includes(normalized)) {
      return false;
    }
  }

  return null;
}

function getDateFromRecord(record: Record<string, unknown>): string | null {
  const dateKeys = ['attendDate', 'attendanceDate', 'checkedDate', 'date', 'day'];

  for (const key of dateKeys) {
    const dateKey = toDateKeyFromValue(record[key]);

    if (dateKey) {
      return dateKey;
    }
  }

  return null;
}

function collectWeeklyCheckedDates(value: unknown, allowPrimitiveDate = false): string[] {
  if (Array.isArray(value)) {
    return value.flatMap(item => collectWeeklyCheckedDates(item, true));
  }

  const primitiveDateKey = allowPrimitiveDate ? toDateKeyFromValue(value) : null;
  if (primitiveDateKey) {
    return [primitiveDateKey];
  }

  if (!value || typeof value !== 'object') {
    return [];
  }

  const record = value as Record<string, unknown>;
  const dateKey = getDateFromRecord(record);
  const attendanceFlag = getAttendanceFlag(record);

  if (dateKey) {
    return attendanceFlag === false ? [] : [dateKey];
  }

  return Object.values(record).flatMap(item => collectWeeklyCheckedDates(item));
}

function toUniqueSortedDates(dates: string[]): string[] {
  return Array.from(new Set(dates)).sort();
}

function getNormalizedAttendDate(value: string, fallbackDateKey: string): string {
  return toDateKeyFromValue(value) ?? fallbackDateKey;
}

function getAttendanceStorageKey(employeeKey: string): string {
  return `${ATTENDANCE_STORAGE_PREFIX}:${employeeKey}`;
}

function isAttendanceReward(value: unknown): value is AttendanceReward {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const record = value as Record<string, unknown>;
  return 'rewardType' in record || 'rewardValue' in record || 'rewardCycle' in record;
}

function collectAttendanceRewards(value: unknown): AttendanceReward[] {
  if (Array.isArray(value)) {
    return value.flatMap(item => collectAttendanceRewards(item));
  }

  if (!value || typeof value !== 'object') {
    return [];
  }

  if (isAttendanceReward(value)) {
    return [value];
  }

  return Object.values(value as Record<string, unknown>).flatMap(item => collectAttendanceRewards(item));
}

function getCoinRewardValue(reward: AttendanceReward): number {
  const rewardType = reward.rewardType?.trim().toUpperCase();

  if (rewardType !== 'COIN') {
    return 0;
  }

  const rewardValue =
    typeof reward.rewardValue === 'string' ? Number(reward.rewardValue) : reward.rewardValue;

  return typeof rewardValue === 'number' && Number.isFinite(rewardValue) ? rewardValue : 0;
}

function getEmployeeKeyFromAuth(auth: ReturnType<typeof useAuth>['auth']): string | null {
  if (!auth) {
    return null;
  }

  if (auth.employeeId !== undefined && auth.employeeId !== null) {
    return String(auth.employeeId);
  }

  const profileEmployeeId = auth.profile?.employeeId;
  if (typeof profileEmployeeId === 'number' || typeof profileEmployeeId === 'string') {
    return String(profileEmployeeId);
  }

  return auth.id || null;
}

async function requestAttendanceCheckIn(
  accessToken: string,
  fallbackDateKey: string,
): Promise<{alreadyChecked: boolean; attendDate: string; rewardCoins: number; weeklyRewardCoins: number}> {
  const response = await withMinimumLoadingTime(
    fetch(
      `${API_BASE}/api/attendance/festivals/${ATTENDANCE_FESTIVAL_ID}/events/${ATTENDANCE_EVENT_ID}/attend`,
      {
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        method: 'POST',
      },
    ),
  );

  const responseText = await response.text();
  let json: AttendanceApiResponse = {};

  try {
    json = JSON.parse(responseText) as AttendanceApiResponse;
  } catch {
    throw new Error('출석체크 응답을 해석하지 못했습니다.');
  }

  console.log('[Attendance] raw response', {
    code: json.code,
    message: json.message,
    status: response.status,
    success: json.success,
  });

  if (json.code === 'A008') {
    return {
      alreadyChecked: true,
      attendDate: fallbackDateKey,
      rewardCoins: 0,
      weeklyRewardCoins: 0,
    };
  }

  if (!response.ok || json.success === false || !json.data) {
    throw new Error(json.message || '출석체크에 실패했습니다.');
  }

  const attendanceRewards = collectAttendanceRewards(json.data);
  const rewardCoins = attendanceRewards.reduce((sum, reward) => sum + getCoinRewardValue(reward), 0);
  const weeklyRewardCoins = attendanceRewards.reduce((sum, reward) => {
    const rewardCycle = reward.rewardCycle?.trim().toUpperCase();
    return rewardCycle === 'WEEKLY' ? sum + getCoinRewardValue(reward) : sum;
  }, 0);

  return {
    alreadyChecked: false,
    attendDate: json.data.attendDate ?? fallbackDateKey,
    rewardCoins,
    weeklyRewardCoins,
  };
}

async function requestWeeklyAttendance(accessToken: string): Promise<string[]> {
  const response = await withMinimumLoadingTime(
    fetch(
      `${API_BASE}/api/attendance/festivals/${ATTENDANCE_FESTIVAL_ID}/events/${ATTENDANCE_EVENT_ID}/weekly`,
      {
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
      },
    ),
  );

  const responseText = await response.text();
  let json: WeeklyAttendanceApiResponse = {};

  try {
    json = JSON.parse(responseText) as WeeklyAttendanceApiResponse;
  } catch {
    throw new Error('주간 출석체크 응답을 해석하지 못했습니다.');
  }

  if (!response.ok || json.success === false) {
    throw new Error(json.message || '주간 출석체크 조회에 실패했습니다.');
  }

  return toUniqueSortedDates(collectWeeklyCheckedDates(json.data));
}

export function AttendanceProvider({children}: {children: React.ReactNode}): JSX.Element {
  const {auth, isRestoring, refreshProfile} = useAuth();
  const [attendance, setAttendance] = useState<AttendanceSnapshot | null>(null);
  const [checkInNotice, setCheckInNotice] = useState<CheckInNotice | null>(null);
  const [didCheckInToday, setDidCheckInToday] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const sessionCheckinDateRef = useRef<string | null>(null);
  const dismissCheckInNotice = useCallback(() => {
    setCheckInNotice(null);
  }, []);

  const refreshAttendance = useCallback(async () => {
    if (isRestoring || !auth?.accessToken) {
      return;
    }

    const employeeKey = getEmployeeKeyFromAuth(auth);
    if (!employeeKey) {
      return;
    }

    const today = new Date();
    const todayKey = toDateKey(today);
    const weekStartDate = getWeekStartDateKey(today);
    const storageKey = getAttendanceStorageKey(employeeKey);

    setIsChecking(true);
    setDidCheckInToday(false);

    try {
      const raw = await AsyncStorage.getItem(storageKey);
      let stored: AttendanceStore | null = null;

      if (raw) {
        try {
          stored = JSON.parse(raw) as AttendanceStore;
        } catch {
          stored = null;
        }
      }

      const isSameWeek = stored?.weekStartDate === weekStartDate;
      const baseDates = isSameWeek ? stored?.checkedDates ?? [] : [];
      const normalizedDates = toUniqueSortedDates(baseDates);
      const hasTodayInStore =
        normalizedDates.includes(todayKey) || stored?.lastCheckedDate === todayKey;

      if (hasTodayInStore) {
        const nextCheckedDates = normalizedDates.includes(todayKey)
          ? normalizedDates
          : toUniqueSortedDates([...normalizedDates, todayKey]);
        const totalCheckedCount = stored?.totalCheckedCount ?? nextCheckedDates.length;
        const nextStore: AttendanceStore = {
          checkedDates: nextCheckedDates,
          lastCheckedDate: todayKey,
          totalCheckedCount,
          weekStartDate,
        };

        await AsyncStorage.setItem(storageKey, JSON.stringify(nextStore));
        setAttendance({
          checkedDates: nextStore.checkedDates,
          checkedThisWeekCount: nextStore.checkedDates.length,
          lastCheckedDate: nextStore.lastCheckedDate,
          totalCheckedCount,
          weekStartDate: nextStore.weekStartDate,
        });
        setDidCheckInToday(false);
        return;
      }

      const attendanceResult = await requestAttendanceCheckIn(auth.accessToken, todayKey);
      console.log('[Attendance] attend response', attendanceResult);
      const checkedDate = getNormalizedAttendDate(attendanceResult.attendDate, todayKey);
      const alreadyCheckedInStore = normalizedDates.includes(checkedDate);
      const nextCheckedDates = alreadyCheckedInStore ? normalizedDates : [...normalizedDates, checkedDate];
      const previousTotalCheckedCount = stored?.totalCheckedCount ?? normalizedDates.length;
      const totalCheckedCount = alreadyCheckedInStore ? previousTotalCheckedCount : previousTotalCheckedCount + 1;
      let weeklyCheckedDates = toUniqueSortedDates(nextCheckedDates);

      try {
        weeklyCheckedDates = await requestWeeklyAttendance(auth.accessToken);
        console.log('[Attendance] weekly response', weeklyCheckedDates);
      } catch (weeklyError) {
        console.log('[Attendance] weekly request failed', weeklyError);
      }

      const nextStore: AttendanceStore = {
        checkedDates: weeklyCheckedDates,
        lastCheckedDate: todayKey,
        totalCheckedCount,
        weekStartDate,
      };

      await AsyncStorage.setItem(storageKey, JSON.stringify(nextStore));

      const checkedTodayNow = !attendanceResult.alreadyChecked;
      setDidCheckInToday(checkedTodayNow);
      setAttendance({
        checkedDates: nextStore.checkedDates,
        checkedThisWeekCount: nextStore.checkedDates.length,
        lastCheckedDate: nextStore.lastCheckedDate,
        totalCheckedCount,
        weekStartDate: nextStore.weekStartDate,
      });

      const shouldShowNotice = sessionCheckinDateRef.current !== checkedDate && checkedTodayNow;

      if (shouldShowNotice) {
        sessionCheckinDateRef.current = checkedDate;
        setCheckInNotice({
          checkedThisWeekCount: nextStore.checkedDates.length,
          rewardCoins: attendanceResult.rewardCoins,
          totalCheckedCount,
          weeklyRewardCoins: attendanceResult.weeklyRewardCoins,
        });
      }

      if (attendanceResult.rewardCoins > 0) {
        await refreshProfile();
      }
    } catch (error) {
      console.log('[Attendance] attend request failed', error);
      const raw = await AsyncStorage.getItem(storageKey);
      if (raw) {
        try {
          const stored = JSON.parse(raw) as AttendanceStore;
          const isSameWeek = stored.weekStartDate === weekStartDate;
          const fallbackDates = toUniqueSortedDates(isSameWeek ? stored.checkedDates ?? [] : []);
          const fallbackTotal = stored.totalCheckedCount ?? fallbackDates.length;

          setAttendance({
            checkedDates: fallbackDates,
            checkedThisWeekCount: fallbackDates.length,
            lastCheckedDate: stored.lastCheckedDate ?? null,
            totalCheckedCount: fallbackTotal,
            weekStartDate,
          });
        } catch {
          // Ignore fallback parse errors.
        }
      }
    } finally {
      setIsChecking(false);
    }
  }, [auth, isRestoring, refreshProfile]);

  const value = useMemo(
    () => ({
      attendance,
      checkInNotice,
      dismissCheckInNotice,
      didCheckInToday,
      isChecking,
      refreshAttendance,
    }),
    [attendance, checkInNotice, didCheckInToday, dismissCheckInNotice, isChecking, refreshAttendance],
  );

  return <AttendanceContext.Provider value={value}>{children}</AttendanceContext.Provider>;
}

export function useAttendance(): AttendanceContextValue {
  const context = useContext(AttendanceContext);

  if (!context) {
    throw new Error('useAttendance must be used within AttendanceProvider');
  }

  return context;
}
