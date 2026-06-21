import {NativeModules, Platform} from 'react-native';

type LocalCoinNotificationNativeModule = {
  requestPermission?: () => Promise<boolean>;
  showCoinReward?: (options: {amount: number; body: string; title: string}) => Promise<boolean>;
};

const nativeModule = NativeModules.LocalCoinNotification as LocalCoinNotificationNativeModule | undefined;

function formatCoinRewardBody(amount: number): string {
  return `${amount}코인을 획득했어요. 보유코인을 확인해보세요.`;
}

function formatCoinPaymentBody(amount: number): string {
  return `${amount}코인이 차감되었습니다.`;
}

export async function requestCoinNotificationPermission(): Promise<boolean> {
  if (Platform.OS !== 'android' && Platform.OS !== 'ios') {
    return false;
  }

  if (!nativeModule?.requestPermission) {
    return false;
  }

  try {
    return await nativeModule.requestPermission();
  } catch (error) {
    console.log('[LocalCoinNotification] request notification permission failed', error);
    return false;
  }
}

export async function showCoinRewardNotification(amount: number): Promise<void> {
  const normalizedAmount = Math.floor(amount);

  await showCoinNotification({
    amount: normalizedAmount,
    body: formatCoinRewardBody(normalizedAmount),
    logLabel: 'show coin reward notification',
    title: '코인 획득',
  });
}

export async function showCoinPaymentNotification(amount: number): Promise<void> {
  const normalizedAmount = Math.floor(amount);

  await showCoinNotification({
    amount: normalizedAmount,
    body: formatCoinPaymentBody(normalizedAmount),
    logLabel: 'show coin payment notification',
    title: '코인 결제 완료',
  });
}

async function showCoinNotification({
  amount,
  body,
  logLabel,
  title,
}: {
  amount: number;
  body: string;
  logLabel: string;
  title: string;
}): Promise<void> {
  if (Platform.OS !== 'android' && Platform.OS !== 'ios') {
    return;
  }

  if (!nativeModule?.showCoinReward) {
    return;
  }

  const normalizedAmount = Math.floor(amount);

  if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
    return;
  }

  try {
    const hasPermission = await requestCoinNotificationPermission();

    if (!hasPermission) {
      return;
    }

    await nativeModule.showCoinReward({
      amount: normalizedAmount,
      body,
      title,
    });
  } catch (error) {
    console.log(`[LocalCoinNotification] ${logLabel} failed`, error);
  }
}
