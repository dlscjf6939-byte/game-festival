import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {createContext, useCallback, useContext, useMemo, useRef, useState} from 'react';
import {useAuth} from '../auth/AuthProvider';

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
    receivedRewards?: Array<{
      rewardCycle?: string;
      rewardType?: string;
      rewardValue?: number;
    }>;
  };
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

function toUniqueSortedDates(dates: string[]): string[] {
  return Array.from(new Set(dates)).sort();
}

function getAttendanceStorageKey(employeeKey: string): string {
  return `${ATTENDANCE_STORAGE_PREFIX}:${employeeKey}`;
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
): Promise<{alreadyChecked: boolean; attendDate: string; rewardCoins: number}> {
  const response = await fetch(
    `${API_BASE}/api/attendance/festivals/${ATTENDANCE_FESTIVAL_ID}/events/${ATTENDANCE_EVENT_ID}/attend`,
    {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      method: 'POST',
    },
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
    };
  }

  if (!response.ok || json.success === false || !json.data?.attendDate) {
    throw new Error(json.message || '출석체크에 실패했습니다.');
  }

  const rewardCoins = (json.data.receivedRewards ?? []).reduce((sum, reward) => {
    const isCoinReward = reward.rewardType === 'COIN';
    const rewardValue = typeof reward.rewardValue === 'number' ? reward.rewardValue : 0;
    return isCoinReward ? sum + rewardValue : sum;
  }, 0);

  return {
    alreadyChecked: false,
    attendDate: json.data.attendDate,
    rewardCoins,
  };
}

export function AttendanceProvider({children}: {children: React.ReactNode}): JSX.Element {
  const {auth, isRestoring} = useAuth();
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
      const attendanceResult = await requestAttendanceCheckIn(auth.accessToken, todayKey);
      console.log('[Attendance] attend response', attendanceResult);
      const checkedDate = attendanceResult.attendDate || todayKey;
      const alreadyCheckedInStore = normalizedDates.includes(checkedDate);
      const nextCheckedDates = alreadyCheckedInStore ? normalizedDates : [...normalizedDates, checkedDate];
      const previousTotalCheckedCount = stored?.totalCheckedCount ?? normalizedDates.length;
      const totalCheckedCount = alreadyCheckedInStore ? previousTotalCheckedCount : previousTotalCheckedCount + 1;

      const nextStore: AttendanceStore = {
        checkedDates: toUniqueSortedDates(nextCheckedDates),
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
        });
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
  }, [auth, isRestoring]);

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
