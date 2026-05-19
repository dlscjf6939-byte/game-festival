import {useCallback, useEffect, useRef, useState} from 'react';

export type PictureMatchPicture = {
  employeeId?: number;
  employeeName?: string;
  imgUrl?: string;
  isFlipped?: boolean;
  isMatched?: boolean;
  matchedEmployeeId?: number;
};

export type PictureMatchPlayer = {
  employeeId?: number;
  employeeName?: string;
  isMyTurn?: boolean;
  result?: unknown;
  submittedAt?: string;
};

export type PictureMatchState = {
  finalResults?: PictureMatchPlayer[];
  height?: number;
  matchPictureCount?: number;
  pictures?: PictureMatchPicture[];
  player?: PictureMatchPlayer[];
  players?: PictureMatchPlayer[];
  roomId?: string;
  width?: number;
};

type UseCoinBattlePictureMatchGameParams = {
  checkPictureMatch: (roomId: string) => boolean;
  flipPictureMatch: (roomId: string, pictureIndex: number) => boolean;
  isActive: boolean;
  myUserId?: null | number | string;
  myUserName?: string;
  requestPictureMatchState: (roomId: string) => boolean;
  roomId: string;
  subscribePictureMatch: (
    roomId: string,
    callback: (body: string) => void,
  ) => null | (() => void);
};

const LOG_PREFIX = '[CoinBattlePictureMatch]';

function logPictureMatchEvent(message: string, payload?: unknown): void {
  if (!__DEV__) {
    return;
  }

  if (payload === undefined) {
    console.log(`${LOG_PREFIX} ${message}`);
    return;
  }

  console.log(`${LOG_PREFIX} ${message}`, payload);
}

function normalizePlayers(state: PictureMatchState): PictureMatchState {
  if (Array.isArray(state.players)) {
    return state;
  }

  if (Array.isArray(state.player)) {
    return {
      ...state,
      players: state.player,
    };
  }

  return state;
}

function asPictureMatchState(value: unknown): PictureMatchState | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidate = normalizePlayers(value as PictureMatchState);

  if (
    typeof candidate.width === 'number' &&
    typeof candidate.height === 'number' &&
    Array.isArray(candidate.players) &&
    Array.isArray(candidate.pictures)
  ) {
    return candidate;
  }

  return null;
}

function extractPictureMatchState(payload: unknown): PictureMatchState | null {
  const direct = asPictureMatchState(payload);

  if (direct) {
    return direct;
  }

  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const wrapped = payload as {data?: unknown};

  return asPictureMatchState(wrapped.data);
}

function getPictureIdentity(picture: PictureMatchPicture): string | null {
  if (typeof picture.employeeId === 'number') {
    return `employee:${picture.employeeId}`;
  }

  if (typeof picture.imgUrl === 'string' && picture.imgUrl.trim().length > 0) {
    return `img:${picture.imgUrl}`;
  }

  return null;
}

function isSamePlayer(
  player: PictureMatchPlayer,
  myUserId?: null | number | string,
  myUserName?: string,
): boolean {
  if (
    myUserId !== null &&
    myUserId !== undefined &&
    player.employeeId !== undefined &&
    String(player.employeeId) === String(myUserId)
  ) {
    return true;
  }

  return Boolean(
    myUserName &&
      player.employeeName &&
      player.employeeName === myUserName,
  );
}

export function useCoinBattlePictureMatchGame({
  checkPictureMatch,
  flipPictureMatch,
  isActive,
  myUserId,
  myUserName,
  requestPictureMatchState,
  roomId,
  subscribePictureMatch,
}: UseCoinBattlePictureMatchGameParams) {
  const [pictureMatchState, setPictureMatchState] =
    useState<PictureMatchState | null>(null);
  const lastCheckedKeyRef = useRef<string | null>(null);
  const checkTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const applyPayload = useCallback((payload: unknown): boolean => {
    const nextState = extractPictureMatchState(payload);

    if (!nextState) {
      return false;
    }

    setPictureMatchState(nextState);
    return true;
  }, []);

  useEffect(() => {
    if (!isActive) {
      return;
    }

    const unsubscribe = subscribePictureMatch(roomId, messageBody => {
      try {
        const parsed = JSON.parse(messageBody) as unknown;
        logPictureMatchEvent('Received picture-match payload', parsed);

        if (!applyPayload(parsed)) {
          throw new Error('Invalid picture-match payload');
        }
      } catch (error) {
        logPictureMatchEvent('Failed to parse picture-match payload', {
          error,
          messageBody,
        });
      }
    });

    if (!unsubscribe) {
      return;
    }

    requestPictureMatchState(roomId);
    logPictureMatchEvent('Requested initial picture-match state', {roomId});

    return unsubscribe;
  }, [
    applyPayload,
    isActive,
    requestPictureMatchState,
    roomId,
    subscribePictureMatch,
  ]);

  useEffect(() => {
    if (checkTimerRef.current) {
      clearTimeout(checkTimerRef.current);
      checkTimerRef.current = null;
    }

    if (!isActive || !pictureMatchState) {
      lastCheckedKeyRef.current = null;
      return;
    }

    const players = Array.isArray(pictureMatchState.players)
      ? pictureMatchState.players
      : [];
    const isMyTurn = players.some(player => {
      return Boolean(player.isMyTurn) && isSamePlayer(player, myUserId, myUserName);
    });

    if (!isMyTurn) {
      lastCheckedKeyRef.current = null;
      return;
    }

    const matchPictureCount =
      typeof pictureMatchState.matchPictureCount === 'number'
        ? pictureMatchState.matchPictureCount
        : 0;

    if (matchPictureCount <= 0) {
      return;
    }

    const pictures = Array.isArray(pictureMatchState.pictures)
      ? pictureMatchState.pictures
      : [];
    const flippedIndexes = pictures.reduce<number[]>((indexes, picture, index) => {
      if (picture.isFlipped && !picture.isMatched) {
        indexes.push(index);
      }

      return indexes;
    }, []);

    if (flippedIndexes.length !== matchPictureCount) {
      lastCheckedKeyRef.current = null;
      return;
    }

    const checkKey = `${roomId}:${flippedIndexes.join(',')}:${matchPictureCount}`;

    if (lastCheckedKeyRef.current === checkKey) {
      return;
    }

    lastCheckedKeyRef.current = checkKey;

    const flippedPictures = flippedIndexes
      .map(index => pictures[index])
      .filter(Boolean);
    const flippedIdentities = flippedPictures.map(getPictureIdentity);
    const hasUnknownIdentity = flippedIdentities.some(identity => {
      return identity === null;
    });
    const canCheckImmediately =
      matchPictureCount === 2 &&
      !hasUnknownIdentity &&
      flippedIdentities.length === 2 &&
      flippedIdentities[0] === flippedIdentities[1];

    if (canCheckImmediately) {
      checkPictureMatch(roomId);
      return;
    }

    checkTimerRef.current = setTimeout(() => {
      checkPictureMatch(roomId);
      checkTimerRef.current = null;
    }, 1000);

    return () => {
      if (checkTimerRef.current) {
        clearTimeout(checkTimerRef.current);
        checkTimerRef.current = null;
      }
    };
  }, [
    checkPictureMatch,
    isActive,
    myUserId,
    myUserName,
    pictureMatchState,
    roomId,
  ]);

  const handleFlipPicture = (pictureIndex: number) => {
    flipPictureMatch(roomId, pictureIndex);
  };

  const resetPictureMatchGame = () => {
    setPictureMatchState(null);
    lastCheckedKeyRef.current = null;

    if (checkTimerRef.current) {
      clearTimeout(checkTimerRef.current);
      checkTimerRef.current = null;
    }
  };

  return {
    handleFlipPicture,
    pictureMatchState,
    resetPictureMatchGame,
  };
}
