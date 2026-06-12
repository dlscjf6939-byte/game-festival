type StompHeaders = Record<string, string>;

export type CoinBattleSocketClient = {
  connect: () => Promise<void>;
  disconnect: () => void;
  isConnected: () => boolean;
  publish: (destination: string, payload?: unknown) => void;
  subscribe: (
    destination: string,
    callback: (body: string) => void,
  ) => () => void;
};

type CreateCoinBattleSocketClientParams = {
  accessToken?: string;
  baseUrl: string;
  onClose?: () => void;
  onError?: (message: string) => void;
};

const STOMP_NULL = '\u0000';
const LOG_PREFIX = '[CoinBattleSocket]';

function sanitizeHeaders(headers: StompHeaders): StompHeaders {
  return Object.fromEntries(
    Object.entries(headers).map(([key, value]) => {
      if (key.toLowerCase() === 'authorization') {
        return [key, value ? 'Bearer ***' : value];
      }

      return [key, value];
    }),
  );
}

function logSocketEvent(message: string, payload?: unknown): void {
  if (!__DEV__) {
    return;
  }

  if (payload === undefined) {
    console.log(`${LOG_PREFIX} ${message}`);
    return;
  }

  console.log(`${LOG_PREFIX} ${message}`, payload);
}

function createSockJsWebSocketUrl(baseUrl: string): string {
  const trimmedBase = baseUrl.replace(/\/$/, '');
  const wsBase = trimmedBase.replace(/^http/, 'ws');
  const serverId = String(Math.floor(Math.random() * 1000)).padStart(3, '0');
  const sessionId = Math.random().toString(36).slice(2, 14);

  return `${wsBase}/ws/${serverId}/${sessionId}/websocket`;
}

function encodeFrame(
  command: string,
  headers: StompHeaders = {},
  body?: string,
): string {
  const headerLines = Object.entries(headers).map(([key, value]) => {
    return `${key}:${value}`;
  });
  const headerBlock =
    headerLines.length > 0 ? `${headerLines.join('\n')}\n` : '';

  return `${command}\n${headerBlock}\n${body ?? ''}${STOMP_NULL}`;
}

function decodeFrame(rawFrame: string): {
  body: string;
  command: string;
  headers: StompHeaders;
} {
  const frame = rawFrame.replace(/\u0000$/, '');
  const [head = '', body = ''] = frame.split('\n\n');
  const [command = '', ...headerLines] = head.split('\n');
  const headers = headerLines.reduce<StompHeaders>((nextHeaders, line) => {
    const separatorIndex = line.indexOf(':');

    if (separatorIndex < 0) {
      return nextHeaders;
    }

    nextHeaders[line.slice(0, separatorIndex)] = line.slice(separatorIndex + 1);
    return nextHeaders;
  }, {});

  return {body, command, headers};
}

function sendSockJsMessage(socket: WebSocket, frame: string): void {
  socket.send(JSON.stringify([frame]));
}

export function createCoinBattleSocketClient({
  accessToken,
  baseUrl,
  onClose,
  onError,
}: CreateCoinBattleSocketClientParams): CoinBattleSocketClient {
  let socket: WebSocket | null = null;
  let connected = false;
  let connectingPromise: Promise<void> | null = null;
  let subscriptionId = 0;
  const subscriptions = new Map<string, (body: string) => void>();

  const authorizationHeader = accessToken ? `Bearer ${accessToken}` : '';

  const handleStompFrame = (rawFrame: string) => {
    const frame = decodeFrame(rawFrame);
    logSocketEvent(`RECV ${frame.command}`, {
      body: frame.body,
      headers: sanitizeHeaders(frame.headers),
    });

    if (frame.command === 'CONNECTED') {
      connected = true;
      return;
    }

    if (frame.command === 'MESSAGE') {
      const subscription = frame.headers.subscription;
      const callback = subscription
        ? subscriptions.get(subscription)
        : undefined;
      callback?.(frame.body);
      return;
    }

    if (frame.command === 'ERROR') {
      onError?.(frame.body || frame.headers.message || 'STOMP error');
    }
  };

  const handleSockJsMessage = (data: unknown) => {
    if (typeof data !== 'string') {
      return;
    }

    if (data === 'h' || data.length === 0) {
      return;
    }

    if (data === 'o') {
      logSocketEvent('SockJS open frame received');
      const headers: StompHeaders = {
        'accept-version': '1.2',
        'heart-beat': '0,0',
      };

      if (authorizationHeader) {
        headers.Authorization = authorizationHeader;
      }

      if (socket) {
        logSocketEvent('SEND CONNECT', {
          headers: sanitizeHeaders(headers),
        });
        sendSockJsMessage(socket, encodeFrame('CONNECT', headers));
      }
      return;
    }

    if (data.startsWith('a')) {
      const messages = JSON.parse(data.slice(1)) as string[];
      messages.forEach(handleStompFrame);
      return;
    }

    if (data.startsWith('c')) {
      logSocketEvent('SockJS close frame received', data);
      connected = false;
      onClose?.();
    }
  };

  return {
    connect: async () => {
      if (connected) {
        return;
      }

      if (connectingPromise) {
        return connectingPromise;
      }

      connectingPromise = new Promise<void>((resolve, reject) => {
        if (socket) {
          logSocketEvent('Closing stale WebSocket before reconnect');
          socket.close();
          socket = null;
          subscriptions.clear();
        }

        const socketUrl = createSockJsWebSocketUrl(baseUrl);
        logSocketEvent('Opening WebSocket', {
          hasAccessToken: Boolean(accessToken),
          socketUrl,
        });

        const nextSocket = new WebSocket(socketUrl);
        socket = nextSocket;

        const clearConnectHandlers = () => {
          connectingPromise = null;
        };

        nextSocket.onmessage = event => {
          try {
            handleSockJsMessage(event.data);

            if (connected) {
              clearConnectHandlers();
              resolve();
            }
          } catch (error) {
            clearConnectHandlers();
            reject(error);
          }
        };

        nextSocket.onerror = () => {
          logSocketEvent('WebSocket error');
          connected = false;
          clearConnectHandlers();
          onError?.('WebSocket connection error');
          reject(new Error('WebSocket connection error'));
        };

        nextSocket.onclose = () => {
          logSocketEvent('WebSocket closed');
          connected = false;
          clearConnectHandlers();
          onClose?.();
        };
      });

      return connectingPromise;
    },

    disconnect: () => {
      if (socket && connected) {
        logSocketEvent('SEND DISCONNECT');
        sendSockJsMessage(socket, encodeFrame('DISCONNECT'));
      }

      connected = false;
      socket?.close();
      socket = null;
      subscriptions.clear();
    },

    isConnected: () => connected,

    publish: (destination, payload) => {
      if (!socket || !connected) {
        throw new Error('WebSocket is not connected');
      }

      const headers: StompHeaders = {destination};

      if (payload !== undefined) {
        headers['content-type'] = 'application/json';
      }

      if (authorizationHeader) {
        headers.Authorization = authorizationHeader;
      }

      logSocketEvent(`SEND ${destination}`, {
        headers: sanitizeHeaders(headers),
        payload,
      });

      sendSockJsMessage(
        socket,
        encodeFrame(
          'SEND',
          headers,
          payload === undefined ? undefined : JSON.stringify(payload),
        ),
      );
    },

    subscribe: (destination, callback) => {
      if (!socket || !connected) {
        throw new Error('WebSocket is not connected');
      }

      const id = `sub-${subscriptionId}`;
      subscriptionId += 1;
      subscriptions.set(id, callback);

      const headers: StompHeaders = {
        ack: 'auto',
        destination,
        id,
      };

      if (authorizationHeader) {
        headers.Authorization = authorizationHeader;
      }

      logSocketEvent(`SUBSCRIBE ${destination}`, {
        headers: sanitizeHeaders(headers),
      });
      sendSockJsMessage(socket, encodeFrame('SUBSCRIBE', headers));

      return () => {
        subscriptions.delete(id);

        if (socket && connected) {
          logSocketEvent(`UNSUBSCRIBE ${destination}`, {id});
          sendSockJsMessage(socket, encodeFrame('UNSUBSCRIBE', {id}));
        }
      };
    },
  };
}
