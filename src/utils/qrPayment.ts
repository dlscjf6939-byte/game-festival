import AsyncStorage from '@react-native-async-storage/async-storage';

export const QR_PAYMENT_API_BASE = 'http://121.254.240.93:8090';

const AUTH_STORAGE_KEY = 'game_app_auth';
const PAYMENT_QR_PATTERN =
  /(?:https?:\/\/[^/\s]+)?\/api\/(?:festivals\/\d+\/)?products\/(\d+)\/purchase(?:\?([^#\s]+))?/;

export type PaymentQr = {
  purchasePath: string;
  price: number;
  productId: number;
  value: string;
};

export type PaymentQrDebugInfo = {
  matchedText: string | null;
  normalizedHost: string | null;
  normalizedPath: string | null;
  normalizedProtocol: string | null;
  productId: number | null;
  productIdText: string | null;
  purchaseUrl: string | null;
  queryText: string | null;
  rawLength: number;
  trimmedLength: number;
};

type StoredAuth = {
  accessToken?: unknown;
};

type UrlParts = {
  host: string | null;
  pathWithQuery: string;
  pathname: string;
  protocol: string | null;
  queryText: string | null;
};

function extractUrlParts(value: string): UrlParts {
  const trimmedValue = value.trim();
  const absoluteMatch = trimmedValue.match(/^(https?):\/\/([^/\s]+)(\/[^\s]*)?/i);
  const pathWithQuery = absoluteMatch
    ? absoluteMatch[3] || '/'
    : trimmedValue.startsWith('/')
    ? trimmedValue
    : `/${trimmedValue}`;
  const queryStartIndex = pathWithQuery.indexOf('?');
  const pathname = queryStartIndex >= 0 ? pathWithQuery.slice(0, queryStartIndex) : pathWithQuery;
  const queryText = queryStartIndex >= 0 ? pathWithQuery.slice(queryStartIndex + 1) : null;

  return {
    host: absoluteMatch?.[2] ?? null,
    pathWithQuery,
    pathname,
    protocol: absoluteMatch?.[1] ? `${absoluteMatch[1].toLowerCase()}:` : null,
    queryText,
  };
}

function getQueryParam(queryText: string | null | undefined, key: string): string | null {
  if (!queryText) {
    return null;
  }

  const pairs = queryText.split('&');

  for (const pair of pairs) {
    const [rawKey, ...rawValueParts] = pair.split('=');

    if (!rawKey) {
      continue;
    }

    let decodedKey = rawKey;

    try {
      decodedKey = decodeURIComponent(rawKey.replace(/\+/g, ' '));
    } catch {
      decodedKey = rawKey;
    }

    if (decodedKey !== key) {
      continue;
    }

    const rawValue = rawValueParts.join('=');

    try {
      return decodeURIComponent(rawValue.replace(/\+/g, ' '));
    } catch {
      return rawValue;
    }
  }

  return null;
}

function getCoinValueFromQuery(queryText: string | null | undefined): number | null {
  return (
    toCoinNumber(getQueryParam(queryText, 'price')) ??
    toCoinNumber(getQueryParam(queryText, 'coin')) ??
    toCoinNumber(getQueryParam(queryText, 'amount'))
  );
}

export function toCoinNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

export function getPaymentQr(value: string): PaymentQr | null {
  const matched = value.match(PAYMENT_QR_PATTERN);
  const productId = matched ? Number(matched[1]) : NaN;

  if (!Number.isFinite(productId) || productId < 1) {
    return null;
  }

  const urlParts = extractUrlParts(matched?.[0] ?? value);
  const priceFromQuery = getCoinValueFromQuery(urlParts.queryText) ?? getCoinValueFromQuery(matched?.[2]);

  return {
    purchasePath: matched?.[0] ?? `/api/products/${productId}/purchase`,
    price: priceFromQuery ?? productId,
    productId,
    value,
  };
}

export function getPaymentQrDebugInfo(value: string): PaymentQrDebugInfo {
  const trimmedValue = value.trim();
  const matched = trimmedValue.match(PAYMENT_QR_PATTERN);
  const productId = matched ? Number(matched[1]) : NaN;
  const urlParts = extractUrlParts(matched?.[0] ?? trimmedValue);
  const paymentQr = getPaymentQr(trimmedValue);

  return {
    matchedText: matched?.[0] ?? null,
    normalizedHost: urlParts.host,
    normalizedPath: urlParts.pathname,
    normalizedProtocol: urlParts.protocol,
    productId: Number.isFinite(productId) ? productId : null,
    productIdText: matched?.[1] ?? null,
    purchaseUrl: paymentQr ? getPurchaseUrl(paymentQr) : null,
    queryText: matched?.[2] ?? urlParts.queryText,
    rawLength: value.length,
    trimmedLength: trimmedValue.length,
  };
}

export function getPurchaseUrl(paymentQr: PaymentQr): string {
  const urlParts = extractUrlParts(paymentQr.purchasePath);

  return `${QR_PAYMENT_API_BASE}${urlParts.pathWithQuery}`;
}

export function formatPaymentQrDebugInfo(debugInfo: PaymentQrDebugInfo): string {
  return [
    `rawLength=${debugInfo.rawLength}`,
    `trimmedLength=${debugInfo.trimmedLength}`,
    `matched=${debugInfo.matchedText ? 'yes' : 'no'}`,
    `matchedText=${debugInfo.matchedText ?? 'null'}`,
    `productIdText=${debugInfo.productIdText ?? 'null'}`,
    `productId=${debugInfo.productId ?? 'null'}`,
    `protocol=${debugInfo.normalizedProtocol ?? 'null'}`,
    `host=${debugInfo.normalizedHost ?? 'null'}`,
    `path=${debugInfo.normalizedPath ?? 'null'}`,
    `query=${debugInfo.queryText ?? 'null'}`,
    `requestUrl=${debugInfo.purchaseUrl ?? 'null'}`,
  ].join('\n');
}

export function formatUnknownError(error: unknown): string {
  if (error instanceof Error) {
    return [
      `name=${error.name}`,
      `message=${error.message}`,
      error.stack ? `stack=${error.stack}` : null,
    ]
      .filter(Boolean)
      .join('\n');
  }

  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

export async function getStoredAccessToken(): Promise<string | null> {
  try {
    const storedAuth = await AsyncStorage.getItem(AUTH_STORAGE_KEY);

    if (!storedAuth) {
      return null;
    }

    const parsedAuth = JSON.parse(storedAuth) as StoredAuth;

    return typeof parsedAuth.accessToken === 'string' && parsedAuth.accessToken.trim()
      ? parsedAuth.accessToken
      : null;
  } catch {
    return null;
  }
}
