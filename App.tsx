import React, {useEffect, useRef, useState} from 'react';
import {HotUpdater, type HotUpdaterFallbackComponentProps} from '@hot-updater/react-native';
import {DefaultTheme, NavigationContainer} from '@react-navigation/native';
import {Animated, Easing, StyleSheet, Text, TextInput, UIManager, View} from 'react-native';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import LottieView from 'lottie-react-native';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {AttendanceProvider} from './src/attendance/AttendanceProvider';
import {AuthProvider} from './src/auth/AuthProvider';
import {FONT_FAMILY} from './src/constants/theme';
import {RootNavigator} from './src/navigation/RootNavigator';
import {requestCoinNotificationPermission} from './src/utils/localCoinNotification';

const navigationTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: '#000000',
  },
};

const HOT_UPDATER_BASE_URL = 'https://gkoofsjvyukiznogrmde.supabase.co/functions/v1/update-server';
const SHOULD_PREVIEW_HOT_UPDATER_SCREEN = false;
const PREVIEW_TOTAL_UPDATE_BYTES = 8_200_000;
const downloadingLottie = require('./src/assets/lotties/Downloading.json');
const isLottieNativeAvailable = Boolean(UIManager.getViewManagerConfig?.('LottieAnimationView'));
let didScheduleHotUpdaterReload = false;

type HotUpdaterOverlayStatus = 'CHECK_FOR_UPDATE' | 'UPDATING';

type HotUpdaterOverlaySnapshot = {
  progress: number;
  status: HotUpdaterOverlayStatus;
  visible: boolean;
};

const hotUpdaterOverlayListeners = new Set<() => void>();
let hotUpdaterOverlaySnapshot: HotUpdaterOverlaySnapshot = {
  progress: 0,
  status: 'UPDATING',
  visible: false,
};

type ComponentWithDefaultProps = {
  defaultProps?: {
    allowFontScaling?: boolean;
    style?: unknown;
  };
};

function applyDefaultFont(Component: typeof Text | typeof TextInput) {
  const target = Component as ComponentWithDefaultProps;

  target.defaultProps = target.defaultProps ?? {};
  target.defaultProps.allowFontScaling = false;
  target.defaultProps.style = [
    {fontFamily: FONT_FAMILY.regular},
    target.defaultProps.style,
  ];
}

applyDefaultFont(Text);
applyDefaultFont(TextInput);

function setHotUpdaterOverlay(nextSnapshot: HotUpdaterOverlaySnapshot) {
  hotUpdaterOverlaySnapshot = nextSnapshot;
  hotUpdaterOverlayListeners.forEach(listener => listener());
}

function showHotUpdaterOverlay(progress: number, status: HotUpdaterOverlayStatus = 'UPDATING') {
  setHotUpdaterOverlay({
    progress: Math.max(0, Math.min(1, progress || 0)),
    status,
    visible: true,
  });
}

function hideHotUpdaterOverlay() {
  setHotUpdaterOverlay({
    progress: 0,
    status: 'UPDATING',
    visible: false,
  });
}

function useHotUpdaterOverlaySnapshot(): HotUpdaterOverlaySnapshot {
  const [snapshot, setSnapshot] = useState(hotUpdaterOverlaySnapshot);

  useEffect(() => {
    const listener = () => setSnapshot(hotUpdaterOverlaySnapshot);
    hotUpdaterOverlayListeners.add(listener);

    return () => {
      hotUpdaterOverlayListeners.delete(listener);
    };
  }, []);

  return snapshot;
}

function scheduleHotUpdaterReload() {
  if (didScheduleHotUpdaterReload) {
    return;
  }

  didScheduleHotUpdaterReload = true;

  setTimeout(() => {
    HotUpdater.reload().catch(error => {
      didScheduleHotUpdaterReload = false;
      console.warn('[HotUpdater] reload failed', error);
    });
  }, 650);
}

function HotUpdaterFallback({
  progress,
  status,
}: HotUpdaterFallbackComponentProps): JSX.Element {
  const animatedProgress = useRef(new Animated.Value(0)).current;
  const safeProgress = Math.max(0, Math.min(1, progress || 0));
  const progressPercent = Math.round(safeProgress * 100);
  const isUpdating = status === 'UPDATING';
  const progressWidth = animatedProgress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  useEffect(() => {
    Animated.timing(animatedProgress, {
      duration: 460,
      easing: Easing.out(Easing.cubic),
      toValue: safeProgress,
      useNativeDriver: false,
    }).start();
  }, [animatedProgress, safeProgress]);

  return (
    <View style={styles.updateFallback}>
      <View style={styles.updateFallbackContent}>
        <Text style={styles.updateFallbackTitle}>
          {isUpdating ? '새 버전 적용 중' : '업데이트 확인 중'}
        </Text>
        <Text style={styles.updateFallbackDescription}>
          {isUpdating ? '최신 게임대회 화면을 준비하고 있어요.' : '잠시만 기다려주세요.'}
        </Text>

        {isLottieNativeAvailable ? (
          <LottieView autoPlay loop source={downloadingLottie} speed={0.8} style={styles.updateLottie} />
        ) : null}

        <View style={styles.updateProgressTrack}>
          <Animated.View style={[styles.updateProgressFill, {width: progressWidth}]} />
          <View style={styles.updateProgressShine} />
        </View>

        <Text style={styles.updateRestartHint}>
          {progressPercent >= 100 ? '업데이트 완료. 앱을 다시 여는 중...' : '완료되면 자동으로 다시 시작됩니다.'}
        </Text>
      </View>
    </View>
  );
}

function HotUpdaterPreview(): JSX.Element {
  const [progress, setProgress] = useState(0.18);

  useEffect(() => {
    const timer = setInterval(() => {
      setProgress(currentProgress => (currentProgress >= 0.96 ? 0.18 : currentProgress + 0.07));
    }, 520);

    return () => clearInterval(timer);
  }, []);

  return (
    <HotUpdaterFallback
      artifactType="archive"
      details={null}
      downloadedBytes={Math.round(PREVIEW_TOTAL_UPDATE_BYTES * progress)}
      message={null}
      progress={progress}
      status="UPDATING"
      totalBytes={PREVIEW_TOTAL_UPDATE_BYTES}
    />
  );
}

function App(): JSX.Element {
  const updateOverlay = useHotUpdaterOverlaySnapshot();

  useEffect(() => {
    requestCoinNotificationPermission().catch(error => {
      console.log('[App] notification permission request failed', error);
    });
  }, []);

  if (SHOULD_PREVIEW_HOT_UPDATER_SCREEN) {
    return <HotUpdaterPreview />;
  }

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <AuthProvider>
          <AttendanceProvider>
            <NavigationContainer theme={navigationTheme}>
              <RootNavigator />
            </NavigationContainer>
          </AttendanceProvider>
        </AuthProvider>
      </SafeAreaProvider>
      {updateOverlay.visible ? (
        <View style={styles.updateOverlay}>
          <HotUpdaterFallback
            artifactType="archive"
            details={null}
            downloadedBytes={undefined}
            message={null}
            progress={updateOverlay.progress}
            status={updateOverlay.status}
            totalBytes={undefined}
          />
        </View>
      ) : null}
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  updateOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 999,
  },
  updateFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000000',
    paddingHorizontal: 28,
  },
  updateFallbackContent: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  updateLottie: {
    width: 140,
    height: 140,
    marginTop: 20,
  },
  updateFallbackTitle: {
    color: '#FFFFFF',
    fontFamily: FONT_FAMILY.bold,
    fontSize: 26,
    includeFontPadding: false,
    lineHeight: 34,
    textAlign: 'center',
  },
  updateFallbackDescription: {
    marginTop: 8,
    color: '#B3B4B9',
    fontFamily: FONT_FAMILY.regular,
    fontSize: 14,
    includeFontPadding: false,
    lineHeight: 20,
    textAlign: 'center',
  },
  updateProgressTrack: {
    position: 'relative',
    width: '100%',
    maxWidth: 360,
    height: 8,
    marginTop: 24,
    overflow: 'hidden',
    borderRadius: 999,
    backgroundColor: 'rgba(229, 9, 20, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(229, 9, 20, 0.24)',
  },
  updateProgressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#E50914',
  },
  updateProgressShine: {
    position: 'absolute',
    top: 1,
    bottom: 1,
    left: 2,
    right: 2,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  updateRestartHint: {
    marginTop: 28,
    color: '#FFFFFF',
    fontFamily: FONT_FAMILY.regular,
    fontSize: 13,
    includeFontPadding: false,
    lineHeight: 18,
    opacity: 0.78,
    textAlign: 'center',
  },
});

export default HotUpdater.wrap({
  baseURL: HOT_UPDATER_BASE_URL,
  updateStrategy: 'appVersion',
  fallbackComponent: HotUpdaterFallback,
  reloadOnForceUpdate: false,
  onProgress: progress => {
    if (progress > 0) {
      showHotUpdaterOverlay(progress);
    }

    if (progress >= 1 && HotUpdater.isUpdateDownloaded()) {
      scheduleHotUpdaterReload();
    }
  },
  onUpdateProcessCompleted: response => {
    if (response.status === 'UPDATE') {
      showHotUpdaterOverlay(HotUpdater.isUpdateDownloaded() ? 1 : 0);

      if (HotUpdater.isUpdateDownloaded()) {
        scheduleHotUpdaterReload();
      }
      return;
    }

    hideHotUpdaterOverlay();
  },
  onError: error => {
    hideHotUpdaterOverlay();
    console.warn('[HotUpdater]', error);
  },
})(App);
