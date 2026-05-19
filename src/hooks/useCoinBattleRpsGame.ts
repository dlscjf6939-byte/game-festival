import {useCallback, useEffect, useState} from 'react';

export type RpsChoice = 'PAPER' | 'ROCK' | 'SCISSORS';
export type RpsResult = 'DRAW' | 'LOSE' | 'WIN';

export type RpsPlayer = {
  choice?: unknown;
  employeeId?: number;
  employeeName?: string;
  judgedAt?: string;
  result?: unknown;
  submittedAt?: string;
};

export type RpsRoundResult = {
  judgedAt?: string;
  roundNumber?: number;
  rpsPlayers?: RpsPlayer[];
};

type UseCoinBattleRpsGameParams = {
  chooseRps: (roomId: string, choice: RpsChoice) => boolean;
  isActive: boolean;
  myUserId?: null | number | string;
  myUserName?: string;
  requestRpsState: (roomId: string) => boolean;
  roomId: string;
  subscribeRps: (
    roomId: string,
    callback: (body: string) => void,
  ) => null | (() => void);
};

type RpsStatePayload = {
  data?: {
    rounds?: unknown;
    roundResults?: unknown;
  };
  rounds?: unknown;
  roundResults?: unknown;
};

const LOG_PREFIX = '[CoinBattleRps]';

function logRpsEvent(message: string, payload?: unknown): void {
  if (!__DEV__) {
    return;
  }

  if (payload === undefined) {
    console.log(`${LOG_PREFIX} ${message}`);
    return;
  }

  console.log(`${LOG_PREFIX} ${message}`, payload);
}

export function normalizeRpsChoice(value: unknown): RpsChoice | null {
  if (value === 'ROCK' || value === 'PAPER' || value === 'SCISSORS') {
    return value;
  }

  return null;
}

export function normalizeRpsResult(value: unknown): RpsResult | null {
  if (value === 'WIN' || value === 'DRAW' || value === 'LOSE') {
    return value;
  }

  return null;
}

function extractRpsRoundResults(payload: unknown): RpsRoundResult[] {
  if (!payload || typeof payload !== 'object') {
    return [];
  }

  const candidate = payload as RpsStatePayload;
  const dataRounds = candidate.data?.rounds;
  const dataRoundResults = candidate.data?.roundResults;

  if (Array.isArray(candidate.rounds)) {
    return candidate.rounds as RpsRoundResult[];
  }

  if (Array.isArray(dataRounds)) {
    return dataRounds as RpsRoundResult[];
  }

  if (Array.isArray(candidate.roundResults)) {
    return candidate.roundResults as RpsRoundResult[];
  }

  if (Array.isArray(dataRoundResults)) {
    return dataRoundResults as RpsRoundResult[];
  }

  return [];
}

function extractLatestRoundChoices(payload: unknown): RpsPlayer[] {
  const rounds = extractRpsRoundResults(payload);

  if (!rounds.length) {
    return [];
  }

  const sortedRounds = [...rounds].sort((left, right) => {
    return (left.roundNumber ?? 0) - (right.roundNumber ?? 0);
  });
  const latestRound = sortedRounds[sortedRounds.length - 1];

  return Array.isArray(latestRound.rpsPlayers) ? latestRound.rpsPlayers : [];
}

function isMyChoice(
  choice: RpsPlayer,
  myUserId?: null | number | string,
  myUserName?: string,
): boolean {
  if (
    myUserId !== null &&
    myUserId !== undefined &&
    choice.employeeId !== undefined &&
    String(choice.employeeId) === String(myUserId)
  ) {
    return true;
  }

  return Boolean(
    myUserName &&
      choice.employeeName &&
      choice.employeeName === myUserName,
  );
}

function extractMyRpsChoice(
  payload: unknown,
  myUserId?: null | number | string,
  myUserName?: string,
): RpsChoice | null {
  const latestChoices = extractLatestRoundChoices(payload);
  const mine = latestChoices.find(choice => {
    return isMyChoice(choice, myUserId, myUserName);
  });

  return normalizeRpsChoice(mine?.choice);
}

function extractOpponentRpsChoice(
  payload: unknown,
  myUserId?: null | number | string,
  myUserName?: string,
): RpsChoice | null {
  const latestChoices = extractLatestRoundChoices(payload);
  const mine = latestChoices.find(choice => {
    return isMyChoice(choice, myUserId, myUserName);
  });
  const opponent = latestChoices.find(choice => {
    return !isMyChoice(choice, myUserId, myUserName);
  });
  const myChoice = normalizeRpsChoice(mine?.choice);
  const opponentChoice = normalizeRpsChoice(opponent?.choice);

  if (!myChoice || !opponentChoice) {
    return null;
  }

  return opponentChoice;
}

function extractOpponentSubmitted(
  payload: unknown,
  myUserId?: null | number | string,
  myUserName?: string,
): boolean {
  const latestChoices = extractLatestRoundChoices(payload);
  const opponent = latestChoices.find(choice => {
    return !isMyChoice(choice, myUserId, myUserName);
  });

  return Boolean(
    opponent?.submittedAt || normalizeRpsChoice(opponent?.choice),
  );
}

export function useCoinBattleRpsGame({
  chooseRps,
  isActive,
  myUserId,
  myUserName,
  requestRpsState,
  roomId,
  subscribeRps,
}: UseCoinBattleRpsGameParams) {
  const [selectedRpsChoice, setSelectedRpsChoice] =
    useState<RpsChoice | null>(null);
  const [opponentRpsChoice, setOpponentRpsChoice] =
    useState<RpsChoice | null>(null);
  const [hasOpponentSubmitted, setHasOpponentSubmitted] = useState(false);
  const [rpsRoundResults, setRpsRoundResults] = useState<RpsRoundResult[]>([]);

  const applyPayload = useCallback(
    (payload: unknown): boolean => {
      const nextRounds = extractRpsRoundResults(payload);
      const nextMyChoice = extractMyRpsChoice(
        payload,
        myUserId,
        myUserName,
      );
      const nextOpponentChoice = extractOpponentRpsChoice(
        payload,
        myUserId,
        myUserName,
      );
      const nextOpponentSubmitted = extractOpponentSubmitted(
        payload,
        myUserId,
        myUserName,
      );

      if (nextRounds.length > 0) {
        setRpsRoundResults(nextRounds);
      }

      const latestRound = nextRounds
        .slice()
        .sort((left, right) => {
          return (left.roundNumber ?? 0) - (right.roundNumber ?? 0);
        })
        .at(-1);
      const latestRoundFinished =
        typeof latestRound?.judgedAt === 'string' &&
        latestRound.judgedAt.trim().length > 0;

      setSelectedRpsChoice(latestRoundFinished ? null : nextMyChoice);
      setOpponentRpsChoice(latestRoundFinished ? null : nextOpponentChoice);
      setHasOpponentSubmitted(
        latestRoundFinished ? false : nextOpponentSubmitted,
      );

      return (
        nextRounds.length > 0 ||
        nextMyChoice !== null ||
        nextOpponentChoice !== null ||
        nextOpponentSubmitted
      );
    },
    [myUserId, myUserName],
  );

  useEffect(() => {
    if (!isActive) {
      return;
    }

    const unsubscribe = subscribeRps(roomId, messageBody => {
      try {
        const parsed = JSON.parse(messageBody) as unknown;
        logRpsEvent('Received rps payload', parsed);
        applyPayload(parsed);
      } catch (error) {
        logRpsEvent('Failed to parse rps payload', {
          error,
          messageBody,
        });
      }
    });

    if (!unsubscribe) {
      return;
    }

    requestRpsState(roomId);
    logRpsEvent('Requested initial rps state', {roomId});

    return unsubscribe;
  }, [applyPayload, isActive, requestRpsState, roomId, subscribeRps]);

  const handleRpsChoice = (choice: RpsChoice) => {
    if (selectedRpsChoice) {
      return;
    }

    setSelectedRpsChoice(choice);
    chooseRps(roomId, choice);
  };

  const resetRpsGame = () => {
    setSelectedRpsChoice(null);
    setOpponentRpsChoice(null);
    setHasOpponentSubmitted(false);
    setRpsRoundResults([]);
  };

  return {
    handleRpsChoice,
    hasOpponentSubmitted,
    opponentRpsChoice,
    resetRpsGame,
    rpsRoundResults,
    selectedRpsChoice,
  };
}
