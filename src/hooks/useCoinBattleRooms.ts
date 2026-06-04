import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  createCoinBattleSocketClient,
  type CoinBattleSocketClient,
} from '../services/coinBattleSocket';
import type {RpsChoice} from './useCoinBattleRpsGame';

const COIN_BATTLE_API_BASE_URL = 'http://121.254.240.93:8090';
const LOG_PREFIX = '[CoinBattleRooms]';

export type CoinBattleConnectionStatus =
  | 'connected'
  | 'connecting'
  | 'disconnected'
  | 'error';

export type CoinBattleRoomStatus = 'EXIT' | 'FULL' | 'IN_PROGRESS' | 'WAITING';

export type CoinBattleRoomMember = {
  coinBalance?: number;
  employeeId: number;
  employeeName: string;
  isReady: boolean;
  record?: {
    drawCount: number;
    loseCount: number;
    winCount: number;
  };
};

export type CoinBattleRoom = {
  betAmount?: number;
  createdAt?: string;
  currentMemberCount: number;
  maxMembers: number;
  ownerEmployeeId?: number;
  realtimeGameId?: number;
  realtimeGameTitle?: string;
  roomId: string;
  roomMembers: CoinBattleRoomMember[];
  roomName: string;
  roomStatus?: CoinBattleRoomStatus;
  totalRoundCount?: number;
};

type RoomListResponse = {
  data?: CoinBattleRoom[];
};

type UseCoinBattleRoomsParams = {
  accessToken?: string;
  baseUrl?: string;
};

type CreateCoinBattleRoomPayload = {
  betAmount: number;
  realtimeGameId: number;
  roomName: string;
  totalRoundCount: number;
};

type StartCoinBattleRoomParams = {
  realtimeGameId?: number;
  roomId: string;
  userId?: null | number | string;
};

function toCoinBattleRoom(value: unknown): CoinBattleRoom | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const room = value as Partial<CoinBattleRoom>;

  if (typeof room.roomId !== 'string' || typeof room.roomName !== 'string' || !Array.isArray(room.roomMembers)) {
    return null;
  }

  const roomMembers = room.roomMembers.filter(member => {
    return (
      member &&
      typeof member === 'object' &&
      typeof member.employeeId === 'number' &&
      typeof member.employeeName === 'string'
    );
  });

  return {
    ...room,
    currentMemberCount:
      typeof room.currentMemberCount === 'number' ? room.currentMemberCount : roomMembers.length,
    maxMembers: typeof room.maxMembers === 'number' ? room.maxMembers : Math.max(roomMembers.length, 2),
    roomId: room.roomId,
    roomMembers,
    roomName: room.roomName,
  } as CoinBattleRoom;
}

function normalizeRooms(payload: unknown): CoinBattleRoom[] {
  if (Array.isArray(payload)) {
    return payload.map(toCoinBattleRoom).filter((room): room is CoinBattleRoom => Boolean(room));
  }

  if (payload && typeof payload === 'object') {
    const response = payload as RoomListResponse;

    if (Array.isArray(response.data)) {
      return response.data.map(toCoinBattleRoom).filter((room): room is CoinBattleRoom => Boolean(room));
    }
  }

  return [];
}

function logRoomEvent(message: string, payload?: unknown): void {
  if (!__DEV__) {
    return;
  }

  if (payload === undefined) {
    console.log(`${LOG_PREFIX} ${message}`);
    return;
  }

  console.log(`${LOG_PREFIX} ${message}`, payload);
}

export function useCoinBattleRooms({
  accessToken,
  baseUrl = COIN_BATTLE_API_BASE_URL,
}: UseCoinBattleRoomsParams = {}) {
  const [rooms, setRooms] = useState<CoinBattleRoom[]>([]);
  const [connectionStatus, setConnectionStatus] =
    useState<CoinBattleConnectionStatus>('disconnected');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const unsubscribeRef = useRef<null | (() => void)>(null);
  const pendingCreateRoomNameRef = useRef<string | null>(null);

  const client = useMemo(
    () =>
      createCoinBattleSocketClient({
        accessToken,
        baseUrl,
        onClose: () => setConnectionStatus('disconnected'),
        onError: message => {
          setConnectionStatus('error');
          setErrorMessage(message);
        },
      }),
    [accessToken, baseUrl],
  );

  const clientRef = useRef<CoinBattleSocketClient>(client);
  clientRef.current = client;

  useEffect(() => {
    let cancelled = false;
    const activeClient = clientRef.current;

    async function connect() {
      try {
        setConnectionStatus('connecting');
        setErrorMessage(null);
        logRoomEvent('Connecting room socket');
        await activeClient.connect();

        if (cancelled) {
          return;
        }

        unsubscribeRef.current = activeClient.subscribe(
          '/sub/rooms',
          messageBody => {
            try {
              const parsed = JSON.parse(messageBody) as unknown;
              const nextRooms = normalizeRooms(parsed);
              logRoomEvent('Received room list', {
                count: nextRooms.length,
                rooms: nextRooms,
              });

              if (pendingCreateRoomNameRef.current) {
                const createdRoom = nextRooms.find(room => {
                  return room.roomName === pendingCreateRoomNameRef.current;
                });

                logRoomEvent(
                  createdRoom
                    ? 'Created room found in refreshed list'
                    : 'Created room missing from refreshed list',
                  {
                    expectedRoomName: pendingCreateRoomNameRef.current,
                    rooms: nextRooms,
                  },
                );
                pendingCreateRoomNameRef.current = null;
              }

              setRooms(nextRooms);
              setConnectionStatus('connected');
            } catch {
              logRoomEvent('Failed to parse room list', messageBody);
              setConnectionStatus('error');
              setErrorMessage('실시간 목록 메시지 파싱에 실패했습니다.');
            }
          },
        );

        activeClient.publish('/pub/rooms', {});
        logRoomEvent('Requested initial room list');
        setConnectionStatus('connected');
      } catch (error) {
        logRoomEvent('Room socket connection failed', error);
        if (!cancelled) {
          setConnectionStatus('error');
          setErrorMessage(
            error instanceof Error
              ? error.message
              : '실시간 목록 연결에 실패했습니다.',
          );
        }
      }
    }

    connect();

    return () => {
      cancelled = true;
      unsubscribeRef.current?.();
      unsubscribeRef.current = null;
      activeClient.disconnect();
    };
  }, [client]);

  const enterRoom = useCallback((roomId: string) => {
    if (!clientRef.current.isConnected()) {
      setErrorMessage('소켓이 연결되지 않아 방에 입장할 수 없습니다.');
      return;
    }

    try {
      logRoomEvent('Entering room', {roomId});
      clientRef.current.publish(`/pub/rooms/${roomId}/enter`, {});
      clientRef.current.publish('/pub/rooms', {});
      logRoomEvent('Requested room list after enter', {roomId});
    } catch (error) {
      logRoomEvent('Enter room failed before send completed', error);
      setConnectionStatus('error');
      setErrorMessage(
        error instanceof Error ? error.message : '대기방 입장 요청 실패',
      );
    }
  }, []);

  const leaveRoom = useCallback(
    (roomId: string, userId?: null | number | string): boolean => {
      if (!clientRef.current.isConnected()) {
        setErrorMessage('소켓이 연결되지 않아 방에서 나갈 수 없습니다.');
        return false;
      }

      if (userId === null || userId === undefined || userId === '') {
        setErrorMessage('사용자 정보를 찾을 수 없어 방에서 나갈 수 없습니다.');
        return false;
      }

      try {
        clientRef.current.publish(`/pub/rooms/${roomId}/leave`, {
          userId: String(userId),
        });
        clientRef.current.publish('/pub/rooms', {});
        return true;
      } catch (error) {
        setConnectionStatus('error');
        setErrorMessage(
          error instanceof Error ? error.message : '대기방 나가기 요청 실패',
        );
        return false;
      }
    },
    [],
  );

  const readyRoom = useCallback(
    (
      roomId: string,
      userId: null | number | string | undefined,
      ready: boolean,
    ): boolean => {
      if (!clientRef.current.isConnected()) {
        setErrorMessage('소켓이 연결되지 않아 준비 상태를 변경할 수 없습니다.');
        return false;
      }

      if (userId === null || userId === undefined || userId === '') {
        setErrorMessage(
          '사용자 정보를 찾을 수 없어 준비 상태를 변경할 수 없습니다.',
        );
        return false;
      }

      try {
        clientRef.current.publish(`/pub/rooms/${roomId}/ready`, {
          ready,
          userId: String(userId),
        });
        clientRef.current.publish('/pub/rooms', {});
        return true;
      } catch (error) {
        setConnectionStatus('error');
        setErrorMessage(
          error instanceof Error ? error.message : '준비 상태 변경 요청 실패',
        );
        return false;
      }
    },
    [],
  );

  const startRoom = useCallback(
    ({realtimeGameId, roomId, userId}: StartCoinBattleRoomParams): boolean => {
      if (!clientRef.current.isConnected()) {
        setErrorMessage('소켓이 연결되지 않아 게임을 시작할 수 없습니다.');
        return false;
      }

      try {
        if (realtimeGameId === 2) {
          const payload = {
            height: 4,
            initialRevealSeconds: 3,
            matchPictureCount: 2,
            width: 4,
          };

          logRoomEvent('Starting picture-match room', {payload, roomId});
          clientRef.current.publish(
            `/pub/rooms/${roomId}/picture-match/start`,
            payload,
          );
          return true;
        }

        if (realtimeGameId === 21) {
          logRoomEvent('Starting typing room', {roomId});
          clientRef.current.publish(`/pub/rooms/${roomId}/typing/start`, {});
          return true;
        }

        if (userId === null || userId === undefined || userId === '') {
          setErrorMessage('사용자 정보를 찾을 수 없어 게임을 시작할 수 없습니다.');
          return false;
        }

        const payload = {
          userId: String(userId),
        };

        logRoomEvent('Starting rps room', {payload, roomId});
        clientRef.current.publish(`/pub/rooms/${roomId}/rps/start`, payload);
        return true;
      } catch (error) {
        logRoomEvent('Start room failed before send completed', error);
        setConnectionStatus('error');
        setErrorMessage(
          error instanceof Error ? error.message : '게임 시작 요청 실패',
        );
        return false;
      }
    },
    [],
  );

  const subscribeRps = useCallback(
    (
      roomId: string,
      callback: (body: string) => void,
    ): null | (() => void) => {
      if (!clientRef.current.isConnected()) {
        setErrorMessage('소켓이 연결되지 않아 게임을 구독할 수 없습니다.');
        return null;
      }

      try {
        logRoomEvent('Subscribing rps room', {roomId});
        return clientRef.current.subscribe(
          `/sub/rooms/${roomId}/rps`,
          callback,
        );
      } catch (error) {
        logRoomEvent('Subscribe rps room failed', error);
        setConnectionStatus('error');
        setErrorMessage(
          error instanceof Error ? error.message : '가위바위보 구독 실패',
        );
        return null;
      }
    },
    [],
  );

  const subscribeRoom = useCallback(
    (
      roomId: string,
      callback: (body: string) => void,
    ): null | (() => void) => {
      if (!clientRef.current.isConnected()) {
        setErrorMessage('소켓이 연결되지 않아 방 상세를 구독할 수 없습니다.');
        return null;
      }

      try {
        logRoomEvent('Subscribing room detail', {roomId});
        return clientRef.current.subscribe(`/sub/rooms/${roomId}`, callback);
      } catch (error) {
        logRoomEvent('Subscribe room detail failed', error);
        setConnectionStatus('error');
        setErrorMessage(
          error instanceof Error ? error.message : '방 상세 구독 실패',
        );
        return null;
      }
    },
    [],
  );

  const requestRoomState = useCallback((roomId: string): boolean => {
    if (!clientRef.current.isConnected()) {
      setErrorMessage('소켓이 연결되지 않아 방 상태를 불러올 수 없습니다.');
      return false;
    }

    try {
      logRoomEvent('Requesting room detail', {roomId});
      clientRef.current.publish(`/pub/rooms/${roomId}`, {});
      return true;
    } catch (error) {
      logRoomEvent('Request room detail failed', error);
      setConnectionStatus('error');
      setErrorMessage(
        error instanceof Error ? error.message : '방 상세 동기화 실패',
      );
      return false;
    }
  }, []);

  const requestRpsState = useCallback((roomId: string): boolean => {
    if (!clientRef.current.isConnected()) {
      setErrorMessage('소켓이 연결되지 않아 게임 상태를 불러올 수 없습니다.');
      return false;
    }

    try {
      logRoomEvent('Requesting rps state', {roomId});
      clientRef.current.publish(`/pub/rooms/${roomId}/rps`, {});
      return true;
    } catch (error) {
      logRoomEvent('Request rps state failed', error);
      setConnectionStatus('error');
      setErrorMessage(
        error instanceof Error ? error.message : '가위바위보 동기화 실패',
      );
      return false;
    }
  }, []);

  const subscribePictureMatch = useCallback(
    (
      roomId: string,
      callback: (body: string) => void,
    ): null | (() => void) => {
      if (!clientRef.current.isConnected()) {
        setErrorMessage('소켓이 연결되지 않아 같은그림 맞추기를 구독할 수 없습니다.');
        return null;
      }

      try {
        logRoomEvent('Subscribing picture-match room', {roomId});
        return clientRef.current.subscribe(
          `/sub/rooms/${roomId}/picture-match`,
          callback,
        );
      } catch (error) {
        logRoomEvent('Subscribe picture-match room failed', error);
        setConnectionStatus('error');
        setErrorMessage(
          error instanceof Error
            ? error.message
            : '같은그림 맞추기 구독 실패',
        );
        return null;
      }
    },
    [],
  );

  const requestPictureMatchState = useCallback((roomId: string): boolean => {
    if (!clientRef.current.isConnected()) {
      setErrorMessage('소켓이 연결되지 않아 게임 상태를 불러올 수 없습니다.');
      return false;
    }

    try {
      logRoomEvent('Requesting picture-match state', {roomId});
      clientRef.current.publish(`/pub/rooms/${roomId}/picture-match`, {});
      return true;
    } catch (error) {
      logRoomEvent('Request picture-match state failed', error);
      setConnectionStatus('error');
      setErrorMessage(
        error instanceof Error
          ? error.message
          : '같은그림 맞추기 동기화 실패',
      );
      return false;
    }
  }, []);

  const subscribeTyping = useCallback(
    (
      roomId: string,
      callback: (body: string) => void,
    ): null | (() => void) => {
      if (!clientRef.current.isConnected()) {
        setErrorMessage('소켓이 연결되지 않아 타자게임을 구독할 수 없습니다.');
        return null;
      }

      try {
        logRoomEvent('Subscribing typing room', {roomId});
        return clientRef.current.subscribe(
          `/sub/rooms/${roomId}/typing`,
          callback,
        );
      } catch (error) {
        logRoomEvent('Subscribe typing room failed', error);
        setConnectionStatus('error');
        setErrorMessage(
          error instanceof Error ? error.message : '타자게임 구독 실패',
        );
        return null;
      }
    },
    [],
  );

  const requestTypingState = useCallback((roomId: string): boolean => {
    if (!clientRef.current.isConnected()) {
      setErrorMessage('소켓이 연결되지 않아 타자게임 상태를 불러올 수 없습니다.');
      return false;
    }

    try {
      logRoomEvent('Requesting typing state', {roomId});
      clientRef.current.publish(`/pub/rooms/${roomId}/typing`, {});
      return true;
    } catch (error) {
      logRoomEvent('Request typing state failed', error);
      setConnectionStatus('error');
      setErrorMessage(
        error instanceof Error ? error.message : '타자게임 동기화 실패',
      );
      return false;
    }
  }, []);

  const submitTypingSentence = useCallback(
    (roomId: string, sentence: string): boolean => {
      if (!clientRef.current.isConnected()) {
        setErrorMessage('소켓이 연결되지 않아 문장을 제출할 수 없습니다.');
        return false;
      }

      try {
        logRoomEvent('Submitting typing sentence', {roomId});
        clientRef.current.publish(`/pub/rooms/${roomId}/typing/submit`, {
          sentence,
        });
        return true;
      } catch (error) {
        logRoomEvent('Submit typing sentence failed', error);
        setConnectionStatus('error');
        setErrorMessage(
          error instanceof Error ? error.message : '타자게임 제출 실패',
        );
        return false;
      }
    },
    [],
  );

  const flipPictureMatch = useCallback(
    (roomId: string, pictureIndex: number): boolean => {
      if (!clientRef.current.isConnected()) {
        setErrorMessage('소켓이 연결되지 않아 카드를 뒤집을 수 없습니다.');
        return false;
      }

      try {
        logRoomEvent('Flipping picture-match card', {pictureIndex, roomId});
        clientRef.current.publish(`/pub/rooms/${roomId}/picture-match/flip`, {
          pictureIndex,
        });
        return true;
      } catch (error) {
        logRoomEvent('Flip picture-match card failed', error);
        setConnectionStatus('error');
        setErrorMessage(
          error instanceof Error ? error.message : '카드 뒤집기 요청 실패',
        );
        return false;
      }
    },
    [],
  );

  const checkPictureMatch = useCallback((roomId: string): boolean => {
    if (!clientRef.current.isConnected()) {
      setErrorMessage('소켓이 연결되지 않아 선택을 판정할 수 없습니다.');
      return false;
    }

    try {
      logRoomEvent('Checking picture-match cards', {roomId});
      clientRef.current.publish(`/pub/rooms/${roomId}/picture-match/check`, {});
      return true;
    } catch (error) {
      logRoomEvent('Check picture-match cards failed', error);
      setConnectionStatus('error');
      setErrorMessage(
        error instanceof Error ? error.message : '카드 판정 요청 실패',
      );
      return false;
    }
  }, []);

  const chooseRps = useCallback(
    (roomId: string, choice: RpsChoice): boolean => {
      if (!clientRef.current.isConnected()) {
        setErrorMessage('소켓이 연결되지 않아 선택을 전송할 수 없습니다.');
        return false;
      }

      try {
        logRoomEvent('Choosing rps', {choice, roomId});
        clientRef.current.publish(`/pub/rooms/${roomId}/rps/choice`, {
          choice,
        });
        return true;
      } catch (error) {
        logRoomEvent('Choose rps failed', error);
        setConnectionStatus('error');
        setErrorMessage(
          error instanceof Error
            ? error.message
            : '가위바위보 선택 전송 실패',
        );
        return false;
      }
    },
    [],
  );

  const createRoom = useCallback(
    (payload: CreateCoinBattleRoomPayload): boolean => {
      if (!clientRef.current.isConnected()) {
        logRoomEvent('Create room blocked: socket disconnected', payload);
        setErrorMessage('소켓이 연결되지 않아 방을 생성할 수 없습니다.');
        return false;
      }

      try {
        logRoomEvent('Creating room', payload);
        pendingCreateRoomNameRef.current = payload.roomName;
        clientRef.current.publish('/pub/room', payload);
        clientRef.current.publish('/pub/rooms', {});
        logRoomEvent('Requested room list after create');
        return true;
      } catch (error) {
        logRoomEvent('Create room failed before send completed', error);
        setConnectionStatus('error');
        setErrorMessage(
          error instanceof Error ? error.message : '대기방 생성 요청 실패',
        );
        return false;
      }
    },
    [],
  );

  const requestRooms = useCallback(() => {
    if (!clientRef.current.isConnected()) {
      return;
    }

    try {
      clientRef.current.publish('/pub/rooms', {});
    } catch (error) {
      setConnectionStatus('error');
      setErrorMessage(
        error instanceof Error ? error.message : '방 목록 동기화 실패',
      );
    }
  }, []);

  return {
    checkPictureMatch,
    connectionStatus,
    chooseRps,
    createRoom,
    enterRoom,
    errorMessage,
    flipPictureMatch,
    leaveRoom,
    readyRoom,
    requestPictureMatchState,
    requestRoomState,
    requestRpsState,
    requestRooms,
    requestTypingState,
    rooms,
    startRoom,
    subscribePictureMatch,
    subscribeRoom,
    subscribeRps,
    subscribeTyping,
    submitTypingSentence,
  };
}
