import {useCallback, useEffect, useRef, useState} from 'react';

export type TypingPlayer = {
  elapsedSeconds?: number;
  employeeId?: number;
  employeeName?: string;
  result?: string;
  submittedAt?: string;
};

export type TypingFinalResult = {
  elapsedSeconds?: number;
  employeeId?: number;
  employeeName?: string;
  submittedAt?: string;
};

export type TypingRound = {
  answerSentence?: string;
  judgedAt?: string;
  roundNumber?: number;
  typingPlayers?: TypingPlayer[];
};

export type TypingGameState = {
  createdAt?: string;
  finalResults?: TypingFinalResult[];
  roomId?: string;
  roundSentences?: string[];
  rounds: TypingRound[];
};

type UseCoinBattleTypingGameParams = {
  isActive: boolean;
  requestTypingState: (roomId: string) => boolean;
  roomId: string;
  submitTypingSentence: (roomId: string, sentence: string) => boolean;
  subscribeTyping: (
    roomId: string,
    callback: (body: string) => void,
  ) => null | (() => void);
};

const LOG_PREFIX = '[CoinBattleTyping]';

function logTypingEvent(message: string, payload?: unknown): void {
  if (!__DEV__) {
    return;
  }

  if (payload === undefined) {
    console.log(`${LOG_PREFIX} ${message}`);
    return;
  }

  console.log(`${LOG_PREFIX} ${message}`, payload);
}

function asTypingGameState(value: unknown): TypingGameState | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidate = value as Partial<TypingGameState>;

  if (!Array.isArray(candidate.rounds)) {
    return null;
  }

  return {
    createdAt:
      typeof candidate.createdAt === 'string' ? candidate.createdAt : undefined,
    finalResults: Array.isArray(candidate.finalResults)
      ? candidate.finalResults
      : undefined,
    roomId: typeof candidate.roomId === 'string' ? candidate.roomId : undefined,
    roundSentences: Array.isArray(candidate.roundSentences)
      ? candidate.roundSentences
      : undefined,
    rounds: candidate.rounds,
  };
}

function extractTypingGameState(payload: unknown): TypingGameState | null {
  const direct = asTypingGameState(payload);

  if (direct) {
    return direct;
  }

  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const wrapped = payload as {data?: unknown};

  return asTypingGameState(wrapped.data);
}

function isTypingRoundCompleted(round: TypingRound): boolean {
  if (typeof round.judgedAt === 'string' && round.judgedAt.trim().length > 0) {
    return true;
  }

  return Boolean(
    round.typingPlayers?.some(player => {
      return (
        typeof player.submittedAt === 'string' &&
          player.submittedAt.trim().length > 0
      ) || typeof player.elapsedSeconds === 'number' || typeof player.result === 'string';
    }),
  );
}

function getTypingRoundKey(round: TypingRound, index: number): string {
  const roundIdentity =
    round.roundNumber !== undefined ? `round:${round.roundNumber}` : `index:${index}`;
  const sentenceIdentity =
    typeof round.answerSentence === 'string' && round.answerSentence.length > 0
      ? `sentence:${round.answerSentence}`
      : '';

  return `${roundIdentity}:${sentenceIdentity}`;
}

export function useCoinBattleTypingGame({
  isActive,
  requestTypingState,
  roomId,
  submitTypingSentence,
  subscribeTyping,
}: UseCoinBattleTypingGameParams) {
  const [typingGameState, setTypingGameState] =
    useState<TypingGameState | null>(null);
  const [completedTypingRoundCount, setCompletedTypingRoundCount] =
    useState(0);
  const completedRoundKeySetRef = useRef<Set<string>>(new Set());
  const syncTimerRefs = useRef<Array<ReturnType<typeof setTimeout>>>([]);

  const clearSyncTimers = useCallback(() => {
    syncTimerRefs.current.forEach(timer => clearTimeout(timer));
    syncTimerRefs.current = [];
  }, []);

  const applyPayload = useCallback((payload: unknown): boolean => {
    const nextState = extractTypingGameState(payload);

    if (!nextState) {
      return false;
    }

    nextState.rounds.forEach((round, index) => {
      if (isTypingRoundCompleted(round)) {
        completedRoundKeySetRef.current.add(getTypingRoundKey(round, index));
      }
    });

    setCompletedTypingRoundCount(completedRoundKeySetRef.current.size);
    setTypingGameState(nextState);
    return true;
  }, []);

  useEffect(() => {
    if (!isActive) {
      return;
    }

    const unsubscribe = subscribeTyping(roomId, messageBody => {
      try {
        const parsed = JSON.parse(messageBody) as unknown;
        logTypingEvent('Received typing payload', parsed);

        if (!applyPayload(parsed)) {
          throw new Error('Invalid typing payload');
        }
      } catch (error) {
        logTypingEvent('Failed to parse typing payload', {
          error,
          messageBody,
        });
      }
    });

    if (!unsubscribe) {
      return;
    }

    requestTypingState(roomId);
    logTypingEvent('Requested initial typing state', {roomId});

    return () => {
      unsubscribe();
      clearSyncTimers();
    };
  }, [
    applyPayload,
    clearSyncTimers,
    isActive,
    requestTypingState,
    roomId,
    subscribeTyping,
  ]);

  const handleSubmitTyping = (sentence: string): boolean => {
    const submitted = submitTypingSentence(roomId, sentence);

    if (submitted) {
      clearSyncTimers();
      syncTimerRefs.current = [300, 900, 1800].map(delay => {
        return setTimeout(() => {
          requestTypingState(roomId);
        }, delay);
      });
    }

    return submitted;
  };

  const resetTypingGame = () => {
    clearSyncTimers();
    completedRoundKeySetRef.current.clear();
    setCompletedTypingRoundCount(0);
    setTypingGameState(null);
  };

  return {
    completedTypingRoundCount,
    handleSubmitTyping,
    resetTypingGame,
    typingGameState,
  };
}
