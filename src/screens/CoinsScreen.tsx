import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  Animated,
  Easing,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type ImageSourcePropType,
} from 'react-native';
import LottieView from 'lottie-react-native';
import {AnimatedPressable} from '../components/AnimatedPressable';
import {AppLoading} from '../components/AppLoading';
import {useAuth} from '../auth/AuthProvider';
import {type CoinHistory, useCoin} from '../coin/CoinProvider';
import {MainScaffold} from '../components/MainScaffold';
import {FONTS} from '../constants/theme';
import {type CoinRanking} from '../dummyData/coinDummyData';
import {icon} from '../assets/icons';
import {image} from '../assets/images';
import {withMinimumLoadingTime} from '../utils/loading';
import {showCoinPaymentNotification} from '../utils/localCoinNotification';
import {SlidingSegmentedTabs, SwipeableTabView} from '../components/SlidingSegmentedTabs';

const giftLottie = require('../assets/lotties/Gift.json');
const infoLottie = require('../assets/lotties/Info.json');
const coinLottie = require('../assets/lotties/Coin.json');
const API_BASE = 'http://121.254.240.93:8090';

const coinTabs = [
  {id: 'coinHistory', label: '코인내역'},
  {id: 'ranking', label: '코인랭킹'},
] as const;

const raffleTabs = [
  {id: 'apply', label: '경품 응모'},
  {id: 'kboApply', label: 'KBO 응모'},
  {id: 'history', label: '응모이력'},
] as const;

const coinEarningGuideItems = [
  {badge: '1', description: '+10코인', title: '사전 설문 참여'},
  {badge: '2', description: '일일 3~6코인 랜덤 지급 ( 연속출석시 +n코인 )', title: '매일 출석체크'},
  {badge: '3', description: '게시글당 +2코인, 일 최대 5회', title: '피드 게시글 작성'},
  {badge: '4', description: '미니게임으로 코인 쟁탈 ( 누적 코인 증감 없음 )', title: '코인대전'},
  {badge: '5', description: '게임별 +5코인', title: '승부예측 적중'},
  {badge: '6', description: '추가 코인 획득 ❤️', title: '다양한 현장 이벤트 참여'},
] as const;

const coinBenefitGuideItems = [
  {badge: '1', description: '누적 코인 차감 없음', title: '상품 응모🍀', reward: false},
  {badge: '2', description: '참가하고 추가 코인 획득', title: '코인대전', reward: false},
  {badge: '3', description: '누적 코인 기준으로 반영', title: '랭킹 반영', reward: false},
  {badge: '4', description: '랭킹 TOP30 특별 상품 증정', title: '랭킹 보상', reward: true},
  {badge: '5', description: '100만원 ~ 30만원 상당 상품', title: 'TOP 3', reward: true},
  {badge: '6', description: '10만원 이하의 다양한 특별 상품', title: 'TOP 30', reward: true},
] as const;

type CoinTabId = (typeof coinTabs)[number]['id'];
type CoinViewMode = 'overview' | 'raffle';
type RaffleTabId = (typeof raffleTabs)[number]['id'];
type RaffleProductType = 'NORMAL' | 'KBO';

type RaffleHistory = {
  applyPrice: number;
  id: string;
  productName: string;
  appliedAt: string;
};

type RaffleProduct = {
  applyCount: number;
  applyPrice: number;
  applyWinnerCount: number;
  id: number;
  image: ImageSourcePropType;
  productName: string;
};

function getRaffleProductType(tabId: RaffleTabId): RaffleProductType {
  return tabId === 'kboApply' ? 'KBO' : 'NORMAL';
}

type RaffleProductsResponse = {
  code?: string;
  data?: unknown;
  message?: string;
  success?: boolean;
};

type RaffleApplyResponse = {
  code?: string;
  data?: unknown;
  message?: string;
  success?: boolean;
};

type RaffleHistoryResponse = {
  code?: string;
  data?: unknown;
  message?: string;
  success?: boolean;
};

type EmployeeProfilePost = {
  postId: number;
  title: string;
  content: string;
  createdAt: string;
  thumbnailUrl: string | null;
};

type EmployeeProfile = {
  employeeId: number;
  employeeName: string;
  division: string | null;
  department: string | null;
  introduction: string | null;
  profileImageUri: string | null;
  posts: EmployeeProfilePost[];
};

type EmployeeProfileResponse = {
  code?: string;
  data?: {
    department?: string | null;
    division?: string | null;
    employeeId?: number;
    employeeName?: string;
    introduction?: string | null;
    posts?: Array<{
      content?: string | null;
      createdAt?: string | null;
      postId?: number;
      thumbnailUrl?: string | null;
      title?: string | null;
    }>;
    profileImageUri?: string | null;
    profileImageUrl?: string | null;
  };
  message?: string;
  success?: boolean;
};

type RankingProfileFeedWriter = {
  department?: string | null;
  employeeId?: number | string;
  employeeName?: string | null;
  profileImageUri?: string | null;
  profileImageUrl?: string | null;
};

type RankingProfileFeedPost = {
  writer?: RankingProfileFeedWriter | null;
};

type RankingProfileFeedResponse = {
  code?: string;
  data?: {
    content?: RankingProfileFeedPost[];
  };
  message?: string;
  success?: boolean;
};

type RaffleProductApiItem = {
  applyCount?: number | string;
  applyPrice?: number | string;
  applyWinnerCount?: number | string;
  imageUrl?: string;
  productId?: number | string;
  productName?: string;
};

type RaffleHistoryApiItem = {
  appliedAt?: string;
  applyPrice?: number | string;
  productApplicationId?: number | string;
  productId?: number | string;
  productName?: string;
};

function formatRaffleHistoryAppliedAt(value: unknown): string {
  if (typeof value !== 'string') {
    return '';
  }

  const matched = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);

  if (!matched) {
    return value.trim();
  }

  return `${matched[1]}.${matched[2]}.${matched[3]} ${matched[4]}:${matched[5]}`;
}

function getRaffleProductImage(imageUrl: unknown): ImageSourcePropType {
  if (typeof imageUrl === 'string' && imageUrl.trim()) {
    const trimmedImageUrl = imageUrl.trim();
    const markdownUrlMatch = trimmedImageUrl.match(/\((https?:\/\/[^)]+)\)/i);
    const normalizedImageUrl = markdownUrlMatch?.[1] ?? trimmedImageUrl;

    if (/^(https?:|file:|data:)/i.test(normalizedImageUrl)) {
      return {uri: normalizedImageUrl};
    }

    if (normalizedImageUrl.startsWith('/')) {
      return {uri: `${API_BASE}${normalizedImageUrl}`};
    }

    return {uri: `${API_BASE}/${normalizedImageUrl.replace(/^\/+/, '')}`};
  }

  return image.product1;
}

function getRankIcon(rank: number) {
  if (rank === 1) {
    return icon.rank1;
  }

  if (rank === 2) {
    return icon.rank2;
  }

  if (rank === 3) {
    return icon.rank3;
  }

  return null;
}

function toCoinNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function toRaffleProduct(item: unknown): RaffleProduct | null {
  if (!item || typeof item !== 'object') {
    return null;
  }

  const record = item as RaffleProductApiItem;
  const productId = toCoinNumber(record.productId);
  const productName = typeof record.productName === 'string' ? record.productName.trim() : '';
  const applyPrice = toCoinNumber(record.applyPrice);
  const applyCount = toCoinNumber(record.applyCount);
  const applyWinnerCount = toCoinNumber(record.applyWinnerCount);

  if (productId === null || !productName || applyPrice === null) {
    return null;
  }

  return {
    applyCount: applyCount ?? 0,
    applyPrice,
    applyWinnerCount: applyWinnerCount ?? 0,
    id: productId,
    image: getRaffleProductImage(record.imageUrl),
    productName,
  };
}

function getRaffleProductsFromResponse(responseBody: RaffleProductsResponse): unknown[] {
  return Array.isArray(responseBody.data) ? responseBody.data : [];
}

function toRaffleHistory(item: unknown): RaffleHistory | null {
  if (!item || typeof item !== 'object') {
    return null;
  }

  const record = item as RaffleHistoryApiItem;
  const applicationId = toCoinNumber(record.productApplicationId);
  const productName = typeof record.productName === 'string' ? record.productName.trim() : '';
  const applyPrice = toCoinNumber(record.applyPrice);
  const appliedAt = formatRaffleHistoryAppliedAt(record.appliedAt);

  if (applicationId === null || !productName) {
    return null;
  }

  return {
    applyPrice: applyPrice ?? 0,
    id: String(applicationId),
    productName,
    appliedAt,
  };
}

function getRaffleHistoriesFromResponse(responseBody: RaffleHistoryResponse): unknown[] {
  return Array.isArray(responseBody.data) ? responseBody.data : [];
}

function normalizeProfileImageUri(value: string | null | undefined): string | null {
  const trimmedValue = value?.trim();

  if (!trimmedValue) {
    return null;
  }

  if (/^(https?:|file:|data:)/i.test(trimmedValue)) {
    return trimmedValue;
  }

  if (trimmedValue.startsWith('/')) {
    return `${API_BASE}${trimmedValue}`;
  }

  return trimmedValue;
}

function normalizeEmployeeProfile(data: EmployeeProfileResponse['data']): EmployeeProfile | null {
  if (!data || typeof data.employeeId !== 'number') {
    return null;
  }

  return {
    department: data.department?.trim() || null,
    division: data.division?.trim() || null,
    employeeId: data.employeeId,
    employeeName: data.employeeName?.trim() || '이름 없음',
    introduction: data.introduction?.trim() || null,
    posts: (data.posts ?? [])
      .map(post => {
        if (typeof post.postId !== 'number') {
          return null;
        }

        return {
          content: post.content?.trim() || '',
          createdAt: post.createdAt?.trim() || '',
          postId: post.postId,
          thumbnailUrl: normalizeProfileImageUri(post.thumbnailUrl),
          title: post.title?.trim() || '제목 없음',
        };
      })
      .filter((post): post is EmployeeProfilePost => post !== null),
    profileImageUri: normalizeProfileImageUri(data.profileImageUri ?? data.profileImageUrl),
  };
}

function getRankingEmployeeId(item: CoinRanking): number | null {
  const parsedId = Number(item.employeeId ?? item.id);

  return Number.isInteger(parsedId) && parsedId > 0 ? parsedId : null;
}

function getFallbackProfileFromRanking(item: CoinRanking): EmployeeProfile {
  return {
    department: item.team,
    division: null,
    employeeId: getRankingEmployeeId(item) ?? 0,
    employeeName: item.name,
    introduction: `${item.rank}위 · 누적 ${item.coins}개`,
    posts: [],
    profileImageUri: item.profileImageUri ?? null,
  };
}

function getEmployeeIdFromFeedWriter(writer?: RankingProfileFeedWriter | null): number | null {
  const parsedId = Number(writer?.employeeId);

  return Number.isInteger(parsedId) && parsedId > 0 ? parsedId : null;
}

function getProfileImageUriFromFeedWriter(writer?: RankingProfileFeedWriter | null): string | null {
  return normalizeProfileImageUri(writer?.profileImageUri ?? writer?.profileImageUrl);
}

async function fetchRankingProfileFeedWriter(
  accessToken: string,
  rankingName: string,
): Promise<RankingProfileFeedWriter | null> {
  const response = await fetch(`${API_BASE}/api/boards/21/posts?page=0&size=100`, {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
  });
  const responseText = await response.text();
  let responseBody: RankingProfileFeedResponse | null = null;

  try {
    responseBody = JSON.parse(responseText) as RankingProfileFeedResponse;
  } catch {
    throw new Error('피드 응답을 해석하지 못했습니다.');
  }

  if (!response.ok || responseBody.success === false) {
    throw new Error(responseBody.message || responseText || '피드 조회에 실패했습니다.');
  }

  const normalizedRankingName = rankingName.trim();
  const matchedPost = (responseBody.data?.content ?? []).find(post => {
    return post.writer?.employeeName?.trim() === normalizedRankingName;
  });

  return matchedPost?.writer ?? null;
}

function HistoryItem({index, item}: {index: number; item: CoinHistory}): JSX.Element {
  const entranceProgress = useRef(new Animated.Value(0)).current;
  const translateY = entranceProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [16, 0],
  });
  const isPlus = item.amount > 0;

  useEffect(() => {
    entranceProgress.setValue(0);

    Animated.timing(entranceProgress, {
      toValue: 1,
      delay: Math.min(index, 8) * 54,
      duration: 250,
      useNativeDriver: true,
    }).start();
  }, [entranceProgress, index]);

  return (
    <Animated.View
      style={{
        opacity: entranceProgress,
        transform: [{translateY}],
      }}>
      <AnimatedPressable style={styles.item}>
        <View style={styles.itemTextWrap}>
          <Text style={styles.itemTitle}>{item.title}</Text>
          <Text style={styles.itemDescription}>{item.description}</Text>
        </View>
        <Text style={isPlus ? styles.plus : styles.minus}>
          {isPlus ? '+' : ''}
          {item.amount}
        </Text>
      </AnimatedPressable>
    </Animated.View>
  );
}

function RankingItem({
  item,
  index,
  onPress,
}: {
  item: CoinRanking;
  index: number;
  onPress?: (item: CoinRanking) => void;
}): JSX.Element {
  const entranceProgress = useRef(new Animated.Value(0)).current;
  const translateY = entranceProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [18, 0],
  });
  const rankIcon = getRankIcon(item.rank);
  const isPressable = Boolean(onPress);

  useEffect(() => {
    entranceProgress.setValue(0);

    Animated.timing(entranceProgress, {
      toValue: 1,
      delay: Math.min(index, 8) * 58,
      duration: 260,
      useNativeDriver: true,
    }).start();
  }, [entranceProgress, index]);

  return (
    <Animated.View
      style={{
        opacity: entranceProgress,
        transform: [{translateY}],
      }}>
      <AnimatedPressable
        accessibilityLabel={isPressable ? `${item.rank}위 ${item.name} 프로필 보기` : undefined}
        accessibilityRole={isPressable ? 'button' : undefined}
        disabled={!isPressable}
        onPress={isPressable ? () => onPress?.(item) : undefined}
        style={[styles.rankingItem, item.isMe && styles.rankingItemMe]}>
        <View style={[styles.rankBadge, rankIcon ? styles.rankBadgeIcon : null]}>
          {rankIcon ? (
            <Image source={rankIcon} style={styles.rankIcon} />
          ) : (
            <Text style={styles.rankText}>{item.rank}</Text>
          )}
        </View>
        <View style={styles.rankingUser}>
          <Text style={styles.rankingName}>
            {item.name}
            {item.isMe ? ' 나' : ''}
          </Text>
          <Text style={styles.rankingTeam}>{item.team}</Text>
        </View>
        <Text style={styles.rankingCoins}>누적 {item.coins}개</Text>
      </AnimatedPressable>
    </Animated.View>
  );
}

function RaffleHistoryItem({index, item}: {index: number; item: RaffleHistory}): JSX.Element {
  const entranceProgress = useRef(new Animated.Value(0)).current;
  const translateY = entranceProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [16, 0],
  });

  useEffect(() => {
    entranceProgress.setValue(0);

    Animated.timing(entranceProgress, {
      toValue: 1,
      delay: Math.min(index, 8) * 54,
      duration: 250,
      useNativeDriver: true,
    }).start();
  }, [entranceProgress, index]);

  return (
    <Animated.View
      style={{
        opacity: entranceProgress,
        transform: [{translateY}],
      }}>
      <View style={styles.raffleHistoryItem}>
        <View style={styles.raffleHistoryTextWrap}>
          <Text numberOfLines={1} adjustsFontSizeToFit={true} style={styles.raffleHistoryTitle}>
            {item.productName}
          </Text>
          <Text style={styles.raffleHistoryLabel}>응모가격 {item.applyPrice}코인</Text>
        </View>
        <Text style={styles.raffleHistoryTime}>{item.appliedAt}</Text>
      </View>
    </Animated.View>
  );
}

function RaffleItemCard({
  index,
  isAffordable,
  isSelected,
  item,
  productNameLineLimit = 2,
  onPress,
}: {
  index: number;
  isAffordable: boolean;
  isSelected: boolean;
  item: RaffleProduct;
  productNameLineLimit?: 2 | 4;
  onPress: () => void;
}): JSX.Element {
  const entranceProgress = useRef(new Animated.Value(0)).current;
  const translateY = entranceProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [22, 0],
  });

  useEffect(() => {
    entranceProgress.setValue(0);

    Animated.timing(entranceProgress, {
      toValue: 1,
      delay: 140 + index * 58,
      duration: 320,
      useNativeDriver: true,
    }).start();
  }, [entranceProgress, index]);

  return (
    <Animated.View
      style={[
        styles.raffleItemSlot,
        {
          opacity: entranceProgress,
          transform: [{translateY}],
        },
      ]}>
      <AnimatedPressable
        accessibilityRole="button"
        onPress={onPress}
        style={[
          styles.raffleItemCard,
          isSelected && styles.raffleItemCardSelected,
          !isAffordable && styles.raffleItemCardDisabled,
        ]}>
        <View style={styles.raffleCheckWrap}>
          <View style={[styles.raffleCheck, isSelected && styles.raffleCheckSelected]}>
            {isSelected ? <Image source={icon.check} style={styles.raffleCheckIcon} /> : null}
          </View>
          <View style={styles.raffleCheckLabelWrap}>
            <Text style={styles.raffleCheckLabel}>{item.applyWinnerCount}명</Text>
          </View>
        </View>
        <View style={styles.rafflePrizeVisual}>
          <Image source={item.image} style={styles.rafflePrizeIcon} />
        </View>
        <Text
          numberOfLines={productNameLineLimit}
          style={[styles.raffleItemLabel, productNameLineLimit === 4 && styles.raffleItemLabelExpanded]}>
          {item.productName}
        </Text>
        <View style={styles.raffleItemMeta}>
          <Text numberOfLines={1} style={styles.raffleItemCost}>
            응모가격 {item.applyPrice}코인
          </Text>
          <Text numberOfLines={1} style={styles.raffleItemCount}>
            응모인원 {item.applyCount}명
          </Text>
        </View>
      </AnimatedPressable>
    </Animated.View>
  );
}

export function CoinsScreen(): JSX.Element {
  const {auth, refreshProfile} = useAuth();
  const {height: windowHeight} = useWindowDimensions();
  const {
    accumulatedCoin,
    coinHistories,
    coinHistoriesError,
    holdingCoin,
    isCoinHistoriesLoading,
    isRankingLoading,
    rankingError,
    rankingItems,
    refreshAllCoins,
    refreshCoinHistory,
  } = useCoin();
  const [activeTab, setActiveTab] = useState<CoinTabId>('coinHistory');
  const [viewMode, setViewMode] = useState<CoinViewMode>('overview');
  const [activeRaffleTab, setActiveRaffleTab] = useState<RaffleTabId>('apply');
  const [isRaffleModalVisible, setIsRaffleModalVisible] = useState(false);
  const [selectedRaffleProductId, setSelectedRaffleProductId] = useState<number | null>(null);
  const [raffleProducts, setRaffleProducts] = useState<RaffleProduct[]>([]);
  const [isRaffleProductsLoading, setIsRaffleProductsLoading] = useState(true);
  const [raffleProductsError, setRaffleProductsError] = useState<string | null>(null);
  const [isRaffleApplying, setIsRaffleApplying] = useState(false);
  const [raffleApplyError, setRaffleApplyError] = useState<string | null>(null);
  const [raffleHistories, setRaffleHistories] = useState<RaffleHistory[]>([]);
  const [isRaffleHistoriesLoading, setIsRaffleHistoriesLoading] = useState(false);
  const [raffleHistoriesError, setRaffleHistoriesError] = useState<string | null>(null);
  const [isRefreshingCoins, setIsRefreshingCoins] = useState(false);
  const [isCoinInfoVisible, setIsCoinInfoVisible] = useState(false);
  const [isRankingProfileVisible, setIsRankingProfileVisible] = useState(false);
  const [isRankingProfileLoading, setIsRankingProfileLoading] = useState(false);
  const [rankingProfileError, setRankingProfileError] = useState<string | null>(null);
  const [selectedRankingProfile, setSelectedRankingProfile] = useState<EmployeeProfile | null>(null);
  const rankingProfileProgress = useRef(new Animated.Value(0)).current;
  const isRaffleProductTab = activeRaffleTab === 'apply' || activeRaffleTab === 'kboApply';
  const activeRaffleProductType = getRaffleProductType(activeRaffleTab);
  const rankingProfileOpacity = useRef(new Animated.Value(0)).current;
  const viewTransitionProgress = useRef(new Animated.Value(1)).current;
  const tabContentProgress = useRef(new Animated.Value(1)).current;
  const tabContentTranslateY = tabContentProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [14, 0],
  });
  const rankingProfileCardHeight = Math.max(460, Math.min(windowHeight - 90, 660));
  const rankingProfileImageSource = selectedRankingProfile?.profileImageUri
    ? {uri: selectedRankingProfile.profileImageUri}
    : image.profile;
  const rankingProfileCardAnimatedStyle = {
    transform: [
      {perspective: 900},
      {
        translateY: rankingProfileProgress.interpolate({
          inputRange: [0, 1],
          outputRange: [32, 0],
        }),
      },
      {
        rotateY: rankingProfileProgress.interpolate({
          inputRange: [0, 1],
          outputRange: ['-78deg', '0deg'],
        }),
      },
      {
        scale: rankingProfileProgress.interpolate({
          inputRange: [0, 1],
          outputRange: [0.92, 1],
        }),
      },
    ],
  };

  const closeRankingProfile = useCallback(() => {
    Animated.parallel([
      Animated.timing(rankingProfileOpacity, {
        toValue: 0,
        duration: 140,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(rankingProfileProgress, {
        toValue: 0,
        duration: 160,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(() => {
      setIsRankingProfileVisible(false);
      setIsRankingProfileLoading(false);
      setRankingProfileError(null);
      setSelectedRankingProfile(null);
    });
  }, [rankingProfileOpacity, rankingProfileProgress]);

  const openRankingProfile = useCallback(
    async (item: CoinRanking) => {
      let employeeId = getRankingEmployeeId(item);

      setSelectedRankingProfile(getFallbackProfileFromRanking(item));
      setRankingProfileError(null);
      setIsRankingProfileVisible(true);
      setIsRankingProfileLoading(true);
      rankingProfileProgress.setValue(0);
      rankingProfileOpacity.setValue(0);
      Animated.parallel([
        Animated.timing(rankingProfileOpacity, {
          toValue: 1,
          duration: 180,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(rankingProfileProgress, {
          toValue: 1,
          duration: 430,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();

      if (!auth?.accessToken) {
        setRankingProfileError('로그인 정보가 필요합니다.');
        setIsRankingProfileLoading(false);
        return;
      }

      if (!employeeId) {
        try {
          const feedWriter = await fetchRankingProfileFeedWriter(auth.accessToken, item.name);
          const feedEmployeeId = getEmployeeIdFromFeedWriter(feedWriter);
          const feedProfileImageUri = getProfileImageUriFromFeedWriter(feedWriter);

          if (feedProfileImageUri) {
            setSelectedRankingProfile(previousProfile =>
              previousProfile ? {...previousProfile, profileImageUri: feedProfileImageUri} : previousProfile,
            );
          }

          employeeId = feedEmployeeId;
        } catch (error) {
          console.log('[CoinsScreen] ranking feed writer lookup failed', {name: item.name, error});
        }

        if (!employeeId) {
          setIsRankingProfileLoading(false);
          return;
        }
      }

      try {
        const response = await fetch(`${API_BASE}/api/boards/21/profile/employees/${employeeId}`, {
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${auth.accessToken}`,
          },
        });
        const responseText = await response.text();
        let responseBody: EmployeeProfileResponse | null = null;

        try {
          responseBody = JSON.parse(responseText) as EmployeeProfileResponse;
        } catch {
          throw new Error('회원 프로필 응답을 해석하지 못했습니다.');
        }

        if (!response.ok || responseBody.success === false) {
          throw new Error(responseBody.message || responseText || '회원 프로필 조회에 실패했습니다.');
        }

        const normalizedProfile = normalizeEmployeeProfile(responseBody.data);

        if (!normalizedProfile) {
          throw new Error('회원 프로필 정보가 비어 있습니다.');
        }

        setSelectedRankingProfile(normalizedProfile);
      } catch (error) {
        console.log('[CoinsScreen] ranking profile request failed', {employeeId, error});
        setRankingProfileError(
          error instanceof Error && error.message ? error.message : '회원 프로필 조회에 실패했습니다.',
        );
      } finally {
        setIsRankingProfileLoading(false);
      }
    },
    [auth?.accessToken, rankingProfileOpacity, rankingProfileProgress],
  );

  useEffect(() => {
    tabContentProgress.setValue(0);

    Animated.timing(tabContentProgress, {
      toValue: 1,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [activeRaffleTab, activeTab, tabContentProgress]);

  const switchViewMode = (nextViewMode: CoinViewMode) => {
    Animated.timing(viewTransitionProgress, {
      toValue: 0,
      duration: 110,
      useNativeDriver: true,
    }).start(() => {
      setViewMode(nextViewMode);
      viewTransitionProgress.setValue(0);

      Animated.spring(viewTransitionProgress, {
        toValue: 1,
        speed: 18,
        bounciness: 6,
        useNativeDriver: true,
      }).start();
    });
  };

  const viewTransitionStyle = {
    opacity: viewTransitionProgress,
    transform: [
      {
        translateY: viewTransitionProgress.interpolate({
          inputRange: [0, 1],
          outputRange: [18, 0],
        }),
      },
      {
        scale: viewTransitionProgress.interpolate({
          inputRange: [0, 1],
          outputRange: [0.985, 1],
        }),
      },
    ],
  };

  const fetchRaffleProducts = useCallback(
    async (showLoading = true, productType: RaffleProductType = activeRaffleProductType) => {
      if (!auth?.accessToken) {
        setRaffleProducts([]);
        setIsRaffleProductsLoading(false);
        return;
      }

      if (showLoading) {
        setIsRaffleProductsLoading(true);
      }

      setRaffleProductsError(null);

      try {
        const response = await withMinimumLoadingTime(
          fetch(`${API_BASE}/api/products?useApply=true&productType=${productType}`, {
            headers: {
              Accept: 'application/json',
              Authorization: `Bearer ${auth.accessToken}`,
            },
          }),
        );

        const responseText = await response.text();
        let responseBody: RaffleProductsResponse | null = null;

        try {
          responseBody = JSON.parse(responseText) as RaffleProductsResponse;
        } catch {
          throw new Error('경품 응답을 해석하지 못했습니다.');
        }

        if (!response.ok || responseBody.success === false) {
          throw new Error(responseBody.message || '경품 목록 조회에 실패했습니다.');
        }

        const products = getRaffleProductsFromResponse(responseBody)
          .map(toRaffleProduct)
          .filter((product): product is RaffleProduct => Boolean(product));

        setRaffleProducts(products);
        setSelectedRaffleProductId(currentProductId => {
          if (currentProductId !== null && products.some(product => product.id === currentProductId)) {
            return currentProductId;
          }

          return products[0]?.id ?? null;
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : '경품 목록 조회 중 오류가 발생했습니다.';

        if (showLoading) {
          setRaffleProducts([]);
          setSelectedRaffleProductId(null);
          setRaffleProductsError(errorMessage);
        }

        console.log('[CoinsScreen] raffle products request failed', error);
      } finally {
        if (showLoading) {
          setIsRaffleProductsLoading(false);
        }
      }
    },
    [activeRaffleProductType, auth?.accessToken],
  );

  useEffect(() => {
    if (!isRaffleProductTab) {
      return;
    }

    fetchRaffleProducts().catch(error => {
      console.log('[CoinsScreen] raffle products effect failed', error);
    });
  }, [fetchRaffleProducts, isRaffleProductTab]);

  const fetchRaffleHistories = useCallback(async () => {
    if (!auth?.accessToken) {
      setRaffleHistories([]);
      setIsRaffleHistoriesLoading(false);
      return;
    }

    setIsRaffleHistoriesLoading(true);
    setRaffleHistoriesError(null);

    try {
      const response = await fetch(`${API_BASE}/api/products/apply/history`, {
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${auth.accessToken}`,
        },
      });

      const responseText = await response.text();
      let responseBody: RaffleHistoryResponse | null = null;

      try {
        responseBody = JSON.parse(responseText) as RaffleHistoryResponse;
      } catch {
        throw new Error('응모내역 응답을 해석하지 못했습니다.');
      }

      if (!response.ok || responseBody.success === false) {
        throw new Error(responseBody.message || '응모내역 조회에 실패했습니다.');
      }

      const histories = getRaffleHistoriesFromResponse(responseBody)
        .map(toRaffleHistory)
        .filter((history): history is RaffleHistory => Boolean(history));

      setRaffleHistories(histories);
    } catch (error) {
      setRaffleHistories([]);
      setRaffleHistoriesError(error instanceof Error ? error.message : '응모내역 조회 중 오류가 발생했습니다.');
      console.log('[CoinsScreen] raffle history request failed', error);
    } finally {
      setIsRaffleHistoriesLoading(false);
    }
  }, [auth?.accessToken]);

  useEffect(() => {
    fetchRaffleHistories().catch(error => {
      console.log('[CoinsScreen] raffle history effect failed', error);
    });
  }, [fetchRaffleHistories]);

  const myProfile = auth?.profile;
  const coinBalance = holdingCoin ?? toCoinNumber(myProfile?.holdingCoin) ?? 0;
  const sortedRankingItems = useMemo(
    () => [...rankingItems].sort((left, right) => left.rank - right.rank).slice(0, 30),
    [rankingItems],
  );
  const displayAccumulatedCoin = accumulatedCoin ?? toCoinNumber(myProfile?.accumulatedCoin) ?? 0;
  const topRankingItems = sortedRankingItems.slice(0, 10);
  const restRankingItems = sortedRankingItems.slice(10);
  const coinStickyHeader = (
    <View style={styles.coinStickyHeader}>
      <Text style={styles.coinStickyLabel}>보유코인</Text>
      <View style={styles.coinStickyPill}>
        <LottieView autoPlay loop source={coinLottie} style={styles.coinStickyIcon} />
        <Text style={styles.coinStickyText}>{coinBalance}개</Text>
      </View>
    </View>
  );

  const openRaffleConfirm = () => {
    setRaffleApplyError(null);
    setIsRaffleModalVisible(true);
  };

  const closeRaffleModal = () => {
    if (isRaffleApplying) {
      return;
    }

    setRaffleApplyError(null);
    setIsRaffleModalVisible(false);
  };

  const confirmRaffleApply = async (item: RaffleProduct) => {
    if (!auth?.accessToken || isRaffleApplying) {
      return;
    }

    setIsRaffleApplying(true);
    setRaffleApplyError(null);

    try {
      const response = await withMinimumLoadingTime(
        fetch(`${API_BASE}/api/products/${item.id}/apply`, {
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${auth.accessToken}`,
          },
          method: 'POST',
        }),
      );

      const responseText = await response.text();
      let responseBody: RaffleApplyResponse | null = null;

      try {
        responseBody = JSON.parse(responseText) as RaffleApplyResponse;
      } catch {
        responseBody = null;
      }

      if (!response.ok || responseBody?.success === false) {
        throw new Error(responseBody?.message || responseText || '응모에 실패했습니다.');
      }

      await fetchRaffleHistories();
      await refreshAllCoins();
      showCoinPaymentNotification(item.applyPrice).catch(notificationError => {
        console.log('[CoinsScreen] raffle coin payment notification failed', notificationError);
      });

      setRaffleProducts(currentProducts =>
        currentProducts.map(product =>
          product.id === item.id
            ? {
                ...product,
                applyCount: product.applyCount + 1,
              }
            : product,
        ),
      );

      fetchRaffleProducts(false).catch(productError => {
        console.log('[CoinsScreen] refresh raffle products after apply failed', productError);
      });

      setIsRaffleModalVisible(false);
      setActiveRaffleTab('history');

      refreshProfile().catch(profileError => {
        console.log('[CoinsScreen] refresh profile after raffle failed', profileError);
      });
    } catch (error) {
      setRaffleApplyError(error instanceof Error ? error.message : '응모 중 오류가 발생했습니다.');
      console.log('[CoinsScreen] raffle apply failed', error);
    } finally {
      setIsRaffleApplying(false);
    }
  };

  const handleRaffleApplyPress = () => {
    if (selectedRaffleProductId === null) {
      return;
    }

    const selectedProduct = raffleProducts.find(item => item.id === selectedRaffleProductId);

    if (!selectedProduct) {
      return;
    }

    confirmRaffleApply(selectedProduct).catch(error => {
      console.log('[CoinsScreen] raffle apply handler failed', error);
    });
  };
  const selectedRaffleItem = raffleProducts.find(item => item.id === selectedRaffleProductId) ?? null;
  const canApply = selectedRaffleItem !== null && coinBalance >= selectedRaffleItem.applyPrice;

  const handleCoinsRefresh = useCallback(async () => {
    if (isRefreshingCoins) {
      return;
    }

    setIsRefreshingCoins(true);

    try {
      await Promise.allSettled([
        refreshAllCoins(),
        isRaffleProductTab ? fetchRaffleProducts(false) : Promise.resolve(),
        fetchRaffleHistories(),
        refreshProfile(),
      ]);
    } finally {
      setIsRefreshingCoins(false);
    }
  }, [
    fetchRaffleHistories,
    fetchRaffleProducts,
    isRaffleProductTab,
    isRefreshingCoins,
    refreshAllCoins,
    refreshProfile,
  ]);

  if (viewMode === 'raffle') {
    const raffleApplyFooter = isRaffleProductTab ? (
      <View style={styles.raffleFixedFooter}>
        <View style={styles.raffleSummary}>
          <View style={styles.raffleSummaryTextWrap}>
            <Text style={styles.raffleSummaryLabel}>선택 상품</Text>
            <Text adjustsFontSizeToFit minimumFontScale={0.78} numberOfLines={1} style={styles.raffleSummaryTitle}>
              {selectedRaffleItem?.productName ?? '상품을 선택하세요'}
            </Text>
          </View>
          <AnimatedPressable
            accessibilityRole="button"
            disabled={!canApply}
            onPress={openRaffleConfirm}
            style={[styles.raffleApplyButton, !canApply && styles.raffleApplyButtonDisabled]}>
            <Text style={[styles.raffleApplyText, !canApply && styles.raffleApplyTextDisabled]}>
              {selectedRaffleItem === null ? '상품 없음' : canApply ? '응모하기' : '코인 부족'}
            </Text>
          </AnimatedPressable>
        </View>
      </View>
    ) : undefined;

    return (
      <MainScaffold
        contentContainerStyle={isRaffleProductTab ? styles.raffleFixedFooterContent : null}
        fixedFooter={raffleApplyFooter}
        onRefresh={handleCoinsRefresh}
        refreshing={isRefreshingCoins}
        stickyHeader={coinStickyHeader}
        stickyHeaderThreshold={154}
        scrollToTopRouteName="Coins">
        <View style={styles.raffleHeader}>
          <AnimatedPressable
            accessibilityLabel="응모 페이지 뒤로가기"
            accessibilityRole="button"
            onPress={() => switchViewMode('overview')}
            style={styles.raffleBackButton}>
            <Image source={icon.backBtn} style={styles.raffleBackIcon} />
          </AnimatedPressable>
          <Text style={styles.headerTitle}>코인 응모</Text>
          <View style={styles.raffleBackButton} />
        </View>

        <SlidingSegmentedTabs
          activeTab={activeRaffleTab}
          onTabPress={setActiveRaffleTab}
          style={styles.raffleTabRow}
          tabs={raffleTabs}
        />

        <SwipeableTabView activeTab={activeRaffleTab} onTabPress={setActiveRaffleTab} tabs={raffleTabs}>
          <Animated.View
            style={[
              viewTransitionStyle,
              {
                opacity: Animated.multiply(viewTransitionProgress, tabContentProgress),
                transform: [...viewTransitionStyle.transform, {translateY: tabContentTranslateY}],
              },
            ]}>
            {isRaffleProductTab ? (
              <>
                <View style={styles.raffleHero}>
                  <Text numberOfLines={1} style={styles.raffleTitle}>
                    {activeRaffleTab === 'kboApply' ? 'KBO 경품에 응모해보세요' : '행운의 주인공이 되어보세요'}
                  </Text>
                  <View style={styles.raffleBalancePill}>
                    <LottieView autoPlay loop source={coinLottie} style={styles.raffleBalanceIcon} />
                    <Text style={styles.raffleBalanceText}>{coinBalance}개</Text>
                  </View>
                </View>

                {isRaffleProductsLoading ? (
                  <View style={styles.raffleLoadingState}>
                    <AppLoading label="경품을 불러오는 중..." />
                  </View>
                ) : raffleProductsError ? (
                  <View style={styles.raffleEmptyState}>
                    <Text style={styles.raffleEmptyTitle}>경품을 불러오지 못했습니다.</Text>
                    <Text style={styles.raffleEmptyText}>{raffleProductsError}</Text>
                  </View>
                ) : raffleProducts.length ? (
                  <View style={styles.raffleGrid}>
                    {raffleProducts.map((item, index) => {
                      const isSelected = selectedRaffleProductId === item.id;
                      const isAffordable = coinBalance >= item.applyPrice;

                      return (
                        <RaffleItemCard
                          key={item.id}
                          index={index}
                          isAffordable={isAffordable}
                          isSelected={isSelected}
                          item={item}
                          onPress={() => setSelectedRaffleProductId(item.id)}
                          productNameLineLimit={activeRaffleTab === 'kboApply' ? 4 : 2}
                        />
                      );
                    })}
                  </View>
                ) : (
                  <View style={styles.raffleEmptyState}>
                    <Text style={styles.raffleEmptyTitle}>응모 가능한 경품이 없습니다.</Text>
                    <Text style={styles.raffleEmptyText}>
                      {activeRaffleTab === 'kboApply'
                        ? 'KBO 경품이 등록되면 이곳에 표시됩니다.'
                        : '경품이 등록되면 이곳에 표시됩니다.'}
                    </Text>
                  </View>
                )}
              </>
            ) : (
              <View style={styles.raffleHistorySection}>
                <View style={styles.raffleHistorySectionHeader}>
                  <Text style={styles.raffleHistorySectionTitle}>응모이력</Text>
                  <Text style={styles.raffleHistorySectionMeta}>총 {raffleHistories.length}건</Text>
                </View>

                {isRaffleHistoriesLoading ? (
                  <View style={styles.raffleHistoryInlineState}>
                    <AppLoading label="응모이력을 불러오는 중..." />
                  </View>
                ) : raffleHistoriesError ? (
                  <View style={styles.raffleHistoryEmpty}>
                    <Text style={styles.raffleHistoryEmptyTitle}>응모이력을 불러오지 못했습니다.</Text>
                    <Text style={styles.raffleHistoryEmptyText}>{raffleHistoriesError}</Text>
                    <AnimatedPressable
                      accessibilityRole="button"
                      onPress={() => {
                        fetchRaffleHistories().catch(error => {
                          console.log('[CoinsScreen] raffle history retry failed', error);
                        });
                      }}
                      style={styles.raffleHistoryEmptyButton}>
                      <Text style={styles.raffleHistoryEmptyButtonText}>다시 불러오기</Text>
                    </AnimatedPressable>
                  </View>
                ) : raffleHistories.length ? (
                  raffleHistories.map((item, index) => <RaffleHistoryItem key={item.id} index={index} item={item} />)
                ) : (
                  <View style={styles.raffleHistoryEmpty}>
                    <Text style={styles.raffleHistoryEmptyTitle}>응모이력이 없습니다.</Text>
                    <Text style={styles.raffleHistoryEmptyText}>코인을 획득하여 상품에 응모해보세요</Text>
                  </View>
                )}
              </View>
            )}
          </Animated.View>
        </SwipeableTabView>

        <Modal animationType="fade" onRequestClose={closeRaffleModal} transparent visible={isRaffleModalVisible}>
          <View style={styles.raffleModalOverlay}>
            <AnimatedPressable
              accessibilityLabel="응모 확인 모달 닫기"
              accessibilityRole="button"
              onPress={closeRaffleModal}
              style={styles.raffleModalBackdrop}
            />
            <View style={styles.raffleModalCard}>
              <LottieView autoPlay loop={false} source={giftLottie} style={styles.raffleModalLottie} />
              <Text style={styles.raffleModalTitle}>응모하시겠어요?</Text>
              <Text style={styles.raffleModalDescription}>
                {selectedRaffleItem
                  ? `${selectedRaffleItem.productName}에 ${selectedRaffleItem.applyPrice}코인을 사용합니다.`
                  : '선택된 상품이 없습니다.'}
              </Text>
              {raffleApplyError ? <Text style={styles.raffleModalError}>{raffleApplyError}</Text> : null}
              <View style={styles.raffleModalActions}>
                <AnimatedPressable
                  accessibilityRole="button"
                  disabled={isRaffleApplying}
                  onPress={closeRaffleModal}
                  style={[styles.raffleModalButton, styles.raffleModalCancelButton]}>
                  <Text style={[styles.raffleModalButtonText, styles.raffleModalCancelButtonText]}>취소</Text>
                </AnimatedPressable>
                <AnimatedPressable
                  accessibilityRole="button"
                  disabled={selectedRaffleItem === null || isRaffleApplying}
                  onPress={handleRaffleApplyPress}
                  style={[
                    styles.raffleModalButton,
                    styles.raffleModalConfirmButton,
                    isRaffleApplying && styles.raffleModalButtonDisabled,
                  ]}>
                  <Text style={styles.raffleModalButtonText}>{isRaffleApplying ? '응모 중...' : '응모하기'}</Text>
                </AnimatedPressable>
              </View>
            </View>
          </View>
        </Modal>
      </MainScaffold>
    );
  }

  return (
    <MainScaffold
      onRefresh={handleCoinsRefresh}
      refreshing={isRefreshingCoins}
      stickyHeader={coinStickyHeader}
      stickyHeaderThreshold={154}
      scrollToTopRouteName="Coins">
      <View style={styles.header}>
        <Text style={styles.headerTitle}>코인</Text>
        <AnimatedPressable
          accessibilityLabel="코인 안내"
          accessibilityRole="button"
          onPress={() => setIsCoinInfoVisible(true)}
          style={styles.headerInfoButton}>
          <LottieView autoPlay loop source={infoLottie} speed={0.5} style={styles.headerInfoIcon} />
        </AnimatedPressable>
      </View>

      <SlidingSegmentedTabs activeTab={activeTab} onTabPress={setActiveTab} style={styles.tabRow} tabs={coinTabs} />

      <SwipeableTabView activeTab={activeTab} onTabPress={setActiveTab} tabs={coinTabs}>
        <Animated.View
          style={{
            opacity: tabContentProgress,
            transform: [{translateY: tabContentTranslateY}],
          }}>
          {activeTab === 'coinHistory' ? (
            <>
              <View style={styles.balanceCard}>
                <View style={styles.balanceHeaderRow}>
                  <Text style={styles.label}>나의 코인 현황</Text>
                  <AnimatedPressable
                    accessibilityRole="button"
                    onPress={() => {
                      setActiveRaffleTab('apply');
                      switchViewMode('raffle');
                    }}
                    style={styles.raffleEntryButton}>
                    <Text style={styles.raffleEntryText}>응모하기</Text>
                  </AnimatedPressable>
                </View>
                <View style={styles.balanceSummaryRow}>
                  <View style={styles.balanceSummaryBadge}>
                    <Text style={styles.balanceSummaryLabel}>보유코인</Text>
                    <Text style={styles.value}>{coinBalance}개</Text>
                  </View>
                  <View style={styles.balanceSummaryBadge}>
                    <Text style={styles.balanceSummaryLabel}>누적코인</Text>
                    <Text style={styles.value}>{displayAccumulatedCoin}개</Text>
                  </View>
                </View>
              </View>

              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>최근 내역</Text>
                  <Text style={styles.sectionMeta}>총 {coinHistories.length}건</Text>
                </View>

                {isCoinHistoriesLoading ? (
                  <View style={styles.loadingCenterState}>
                    <AppLoading label="코인 내역을 불러오는 중..." />
                  </View>
                ) : coinHistoriesError ? (
                  <View style={styles.coinHistoryState}>
                    <Text style={styles.raffleHistoryEmptyTitle}>코인 내역을 불러오지 못했습니다.</Text>
                    <Text style={styles.raffleHistoryEmptyText}>{coinHistoriesError}</Text>
                    <AnimatedPressable
                      accessibilityRole="button"
                      onPress={() => {
                        refreshCoinHistory().catch(error => {
                          console.log('[CoinsScreen] coin history retry failed', error);
                        });
                      }}
                      style={styles.raffleHistoryEmptyButton}>
                      <Text style={styles.raffleHistoryEmptyButtonText}>다시 불러오기</Text>
                    </AnimatedPressable>
                  </View>
                ) : coinHistories.length ? (
                  coinHistories.map((item, index) => <HistoryItem key={item.id} index={index} item={item} />)
                ) : (
                  <Text style={styles.emptyText}>표시할 코인 내역이 없습니다.</Text>
                )}
              </View>
            </>
          ) : (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>코인 랭킹</Text>
                <View style={styles.topRankingBadge}>
                  <Text style={styles.topRankingBadgeText}>TOP 10</Text>
                </View>
              </View>

              {isRankingLoading ? (
                <View style={styles.loadingCenterState}>
                  <AppLoading label="코인 랭킹을 불러오는 중..." />
                </View>
              ) : (
                <>
                  {rankingError ? <Text style={styles.errorText}>{rankingError}</Text> : null}

                  {sortedRankingItems.length ? (
                    <>
                      {topRankingItems.length ? (
                        <View style={[styles.rankingGroup, styles.topRankingGroup]}>
                          {topRankingItems.map((item, index) => (
                            <RankingItem
                              key={item.id}
                              index={index}
                              item={item}
                              onPress={item.rank <= 3 ? openRankingProfile : undefined}
                            />
                          ))}
                        </View>
                      ) : null}
                      {restRankingItems.length ? (
                        <View style={styles.rankingGroup}>
                          <View style={styles.rankingGroupHeader}>
                            <Text style={styles.rankingGroupTitle}>11~30위</Text>
                            <Text style={styles.rankingGroupMeta}>전체 랭킹</Text>
                          </View>
                          {restRankingItems.map((item, index) => (
                            <RankingItem key={item.id} index={index + topRankingItems.length} item={item} />
                          ))}
                        </View>
                      ) : null}
                    </>
                  ) : (
                    <Text style={styles.emptyText}>표시할 랭킹이 없습니다.</Text>
                  )}
                </>
              )}
            </View>
          )}
        </Animated.View>
      </SwipeableTabView>

      <Modal
        animationType="fade"
        onRequestClose={() => setIsCoinInfoVisible(false)}
        transparent
        visible={isCoinInfoVisible}>
        <View style={styles.coinInfoOverlay}>
          <AnimatedPressable
            accessibilityLabel="코인 안내 닫기"
            accessibilityRole="button"
            onPress={() => setIsCoinInfoVisible(false)}
            style={styles.coinInfoBackdrop}
          />
          <View style={styles.coinInfoCard}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.coinInfoHeader}>
                <View>
                  <Text style={styles.coinInfoEyebrow}>COIN GUIDE</Text>
                  <View style={styles.coinInfoTitleRow}>
                    <Text style={styles.coinInfoTitle}>코인 안내</Text>
                    <LottieView autoPlay loop source={coinLottie} style={styles.coinInfoCoinLottie} />
                  </View>
                </View>
                <AnimatedPressable
                  accessibilityLabel="코인 안내 닫기"
                  accessibilityRole="button"
                  onPress={() => setIsCoinInfoVisible(false)}
                  style={styles.coinInfoCloseButton}>
                  <Image source={icon.closeBtn} style={styles.coinInfoCloseIcon} resizeMode="contain" />
                </AnimatedPressable>
              </View>

              <View style={styles.coinInfoSection}>
                <Text style={styles.coinInfoSectionTitle}>코인 획득 방법</Text>
                <View style={styles.coinInfoList}>
                  {coinEarningGuideItems.map(item => (
                    <View key={item.title} style={styles.coinInfoItem}>
                      <View style={styles.coinInfoItemBadge}>
                        <Text style={styles.coinInfoItemBadgeText}>{item.badge}</Text>
                      </View>
                      <View style={styles.coinInfoItemText}>
                        <Text style={styles.coinInfoItemTitle}>{item.title}</Text>
                        <Text style={styles.coinInfoItemDescription}>{item.description}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              </View>

              <View style={styles.coinInfoSection}>
                <Text style={styles.coinInfoSectionTitle}>코인을 모으면 좋은 점</Text>
                <Text style={styles.coinInfoSectionLead}>모은 코인은 다양한 혜택으로 사용할 수 있어요!</Text>
                <View style={styles.coinInfoList}>
                  {coinBenefitGuideItems.map(item => (
                    <View key={item.title} style={[styles.coinInfoItem, item.reward && styles.coinInfoRewardItem]}>
                      <View
                        style={[
                          styles.coinInfoItemBadge,
                          styles.coinInfoBenefitBadge,
                          item.reward && styles.coinInfoRewardBadge,
                        ]}>
                        <Text style={styles.coinInfoItemBadgeText}>{item.badge}</Text>
                      </View>
                      <View style={styles.coinInfoItemText}>
                        <Text style={styles.coinInfoItemTitle}>{item.title}</Text>
                        <Text style={styles.coinInfoItemDescription}>{item.description}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              </View>

              <AnimatedPressable
                accessibilityRole="button"
                onPress={() => setIsCoinInfoVisible(false)}
                style={styles.coinInfoConfirmButton}>
                <Text style={styles.coinInfoConfirmText}>확인</Text>
              </AnimatedPressable>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal animationType="fade" onRequestClose={closeRankingProfile} transparent visible={isRankingProfileVisible}>
        <Animated.View style={[styles.profileModalOverlay, {opacity: rankingProfileOpacity}]}>
          {selectedRankingProfile ? (
            <Animated.View
              style={[styles.employeeProfileCard, {height: rankingProfileCardHeight}, rankingProfileCardAnimatedStyle]}>
              <View style={styles.employeeProfileHeader}>
                <View style={styles.employeeProfileHeaderButton} />
                <Text numberOfLines={1} style={styles.employeeProfileTitle}>
                  회원 정보
                </Text>
                <AnimatedPressable
                  accessibilityLabel="회원 정보 닫기"
                  accessibilityRole="button"
                  onPress={closeRankingProfile}
                  style={styles.employeeProfileHeaderButton}>
                  <Image source={icon.closeBtn} style={styles.closeIcon} />
                </AnimatedPressable>
              </View>

              <ScrollView
                contentContainerStyle={styles.employeeProfileScrollContent}
                showsVerticalScrollIndicator={false}
                style={styles.employeeProfileScroll}>
                <View style={styles.employeeProfileHero}>
                  <Image source={rankingProfileImageSource} style={styles.employeeProfileAvatar} resizeMode="cover" />
                  <Text numberOfLines={1} style={styles.employeeProfileName}>
                    {selectedRankingProfile.employeeName}
                  </Text>
                  <Text numberOfLines={1} style={styles.employeeProfileSubText}>
                    {[selectedRankingProfile.division, selectedRankingProfile.department].filter(Boolean).join(' · ') ||
                      '소속 정보 없음'}
                  </Text>
                </View>

                <View style={styles.employeeInfoList}>
                  <View style={styles.employeeInfoRow}>
                    <Text style={styles.employeeInfoLabel}>소개</Text>
                    <Text style={styles.employeeInfoValue}>
                      {selectedRankingProfile.introduction ?? '소개가 아직 없습니다.'}
                    </Text>
                  </View>
                </View>

                <View style={styles.employeePostSectionHeader}>
                  <Text style={styles.employeePostSectionTitle}>작성 게시글</Text>
                  <Text style={styles.employeePostCountText}>{selectedRankingProfile.posts.length}개</Text>
                </View>

                {isRankingProfileLoading ? (
                  <View style={styles.employeeProfileLoading}>
                    <AppLoading label="회원 정보를 불러오는 중..." />
                  </View>
                ) : rankingProfileError ? (
                  <Text style={styles.employeeProfileErrorText}>{rankingProfileError}</Text>
                ) : selectedRankingProfile.posts.length ? (
                  <View style={styles.employeePostGrid}>
                    {selectedRankingProfile.posts.map(post => (
                      <View key={post.postId} style={styles.employeePostTile}>
                        <View style={styles.employeePostTileInner}>
                          {post.thumbnailUrl ? (
                            <Image
                              source={{uri: post.thumbnailUrl}}
                              style={styles.employeePostThumbnail}
                              resizeMode="cover"
                            />
                          ) : (
                            <View style={styles.employeePostFallback}>
                              <Text numberOfLines={3} style={styles.employeePostFallbackTitle}>
                                {post.title}
                              </Text>
                            </View>
                          )}
                          <View style={styles.employeePostTileOverlay}>
                            <Text numberOfLines={2} style={styles.employeePostTileTitle}>
                              {post.title}
                            </Text>
                          </View>
                        </View>
                      </View>
                    ))}
                  </View>
                ) : (
                  <Text style={styles.employeeProfileEmptyText}>아직 작성한 게시글이 없습니다.</Text>
                )}
              </ScrollView>
            </Animated.View>
          ) : null}
        </Animated.View>
      </Modal>
    </MainScaffold>
  );
}

const styles = StyleSheet.create({
  header: {
    height: 56,
    marginTop: -16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    justifyContent: 'flex-start',
  },
  headerTitle: {
    color: '#FFFFFF',
    ...FONTS.font22B,
    lineHeight: 29,
  },
  headerInfoButton: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerInfoIcon: {
    width: 20,
    height: 20,
  },
  tabRow: {
    marginBottom: 22,
  },
  coinStickyHeader: {
    alignSelf: 'center',
    minHeight: 38,
    borderRadius: 19,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(23,23,23,0.96)',
    borderWidth: 1,
    borderColor: '#2D2D2D',
  },
  coinStickyLabel: {
    color: '#8A8D95',
    ...FONTS.font11B,
    lineHeight: 14,
    top: 1,
  },
  coinStickyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  coinStickyIcon: {
    width: 34,
    height: 34,
    paddingRight: 10,
  },
  coinStickyText: {
    color: '#FFFFFF',
    ...FONTS.font14B,
    lineHeight: 18,
  },
  balanceCard: {
    borderRadius: 12,
    padding: 24,
    backgroundColor: '#171717',
    borderWidth: 1,
    borderColor: '#252525',
    marginBottom: 20,
  },
  balanceHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  label: {
    color: '#A9ABB2',
    ...FONTS.font14M,
  },
  raffleEntryButton: {
    minWidth: 84,
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E50914',
    paddingHorizontal: 14,
  },
  raffleEntryText: {
    color: '#FFFFFF',
    ...FONTS.font13B,
    lineHeight: 17,
  },
  raffleFixedFooterContent: {
    paddingBottom: 150,
  },
  value: {
    marginTop: 10,
    color: '#FFFFFF',
    textAlign: 'center',
    ...FONTS.font30B,
  },
  balanceSummaryRow: {
    marginTop: 20,
    flexDirection: 'row',
    gap: 10,
  },
  balanceSummaryBadge: {
    flex: 1,
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: '#1C1C1C',
    borderWidth: 1,
    borderColor: '#2D2D2D',
  },
  balanceSummaryLabel: {
    color: '#A9ABB2',
    textAlign: 'center',
    ...FONTS.font13M,
    lineHeight: 17,
  },
  balanceMeta: {
    marginTop: 12,
    color: '#A9ABB2',
    ...FONTS.font13R,
    lineHeight: 18,
  },
  coinInfoOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.68)',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  coinInfoBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  coinInfoCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: '#171717',
    padding: 16,
    maxHeight: '82%',
    shadowColor: '#000000',
    shadowOffset: {width: 0, height: 8},
    shadowOpacity: 0.24,
    shadowRadius: 14,
    elevation: 8,
  },
  coinInfoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  coinInfoTitleRow: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  coinInfoCoinLottie: {
    width: 34,
    height: 34,
  },
  coinInfoEyebrow: {
    color: '#E50914',
    ...FONTS.font11B,
    lineHeight: 14,
  },
  coinInfoTitle: {
    color: '#FFFFFF',
    ...FONTS.font20B,
    lineHeight: 26,
  },
  coinInfoCloseButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coinInfoCloseIcon: {
    width: 18,
    height: 18,
    tintColor: '#A9ABB2',
  },
  coinInfoHero: {
    marginTop: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(229,9,20,0.22)',
    backgroundColor: 'rgba(229,9,20,0.08)',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  coinInfoHeroTitle: {
    color: '#E9E9EC',
    ...FONTS.font13B,
    lineHeight: 19,
  },
  coinInfoSection: {
    marginTop: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
    backgroundColor: '#131315',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  coinInfoSectionTitle: {
    color: '#FFFFFF',
    ...FONTS.font14B,
    lineHeight: 19,
  },
  coinInfoSectionLead: {
    marginTop: 6,
    color: '#D6D7DB',
    ...FONTS.font12M,
    lineHeight: 18,
  },
  coinInfoList: {
    marginTop: 10,
    gap: 2,
  },
  coinInfoItem: {
    minHeight: 38,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingVertical: 6,
  },
  coinInfoItemBadge: {
    width: 24,
    height: 24,
    borderRadius: 7,
    backgroundColor: '#E50914',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 9,
  },
  coinInfoBenefitBadge: {
    backgroundColor: '#2D2D2D',
  },
  coinInfoRewardItem: {
    backgroundColor: 'rgba(229,9,20,0.055)',
  },
  coinInfoRewardBadge: {
    backgroundColor: '#E50914',
  },
  coinInfoItemBadgeText: {
    color: '#FFFFFF',
    ...FONTS.font11B,
    lineHeight: 14,
  },
  coinInfoItemText: {
    flex: 1,
  },
  coinInfoItemTitle: {
    color: '#FFFFFF',
    ...FONTS.font12B,
    lineHeight: 16,
  },
  coinInfoItemDescription: {
    marginTop: 1,
    color: '#C7C8CC',
    ...FONTS.font11M,
    lineHeight: 15,
  },
  coinInfoConfirmButton: {
    height: 44,
    marginTop: 14,
    borderRadius: 10,
    backgroundColor: '#E50914',
    alignItems: 'center',
    justifyContent: 'center',
  },
  coinInfoConfirmText: {
    color: '#FFFFFF',
    ...FONTS.font14B,
    lineHeight: 18,
  },
  section: {
    borderRadius: 12,
    padding: 20,
    backgroundColor: '#171717',
    borderWidth: 1,
    borderColor: '#252525',
  },
  loadingCenterState: {
    minHeight: 360,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coinHistoryState: {
    minHeight: 220,
    alignItems: 'center',
    justifyContent: 'center',
    borderTopWidth: 1,
    borderTopColor: '#252525',
    paddingHorizontal: 18,
  },
  topRankingBadge: {
    minWidth: 56,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E50914',
    paddingHorizontal: 10,
  },
  topRankingBadgeText: {
    color: '#FFFFFF',
    textAlign: 'center',
    ...FONTS.font11B,
    lineHeight: 14,
  },
  rankingGroup: {
    marginTop: 4,
  },
  topRankingGroup: {
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: 6,
  },
  rankingGroupHeader: {
    minHeight: 38,
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#252525',
  },
  rankingGroupTitle: {
    color: '#FFFFFF',
    ...FONTS.font14B,
    lineHeight: 19,
  },
  rankingGroupMeta: {
    color: '#8A8D95',
    ...FONTS.font12M,
    lineHeight: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  sectionTitle: {
    color: '#FFFFFF',
    ...FONTS.font18B,
  },
  sectionMeta: {
    color: '#8A8D95',
    ...FONTS.font12M,
  },
  item: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: '#252525',
  },
  itemTextWrap: {
    flex: 1,
    paddingRight: 16,
  },
  itemTitle: {
    color: '#D6D8DE',
    ...FONTS.font15R,
  },
  itemDescription: {
    marginTop: 5,
    color: '#8A8D95',
    ...FONTS.font12R,
    lineHeight: 16,
  },
  plus: {
    color: '#E50914',
    ...FONTS.font15B,
  },
  minus: {
    color: '#8A8D95',
    ...FONTS.font15B,
  },
  rankingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: '#252525',
  },
  rankingItemMe: {
    backgroundColor: 'rgba(229,9,20,0.08)',
    marginHorizontal: -10,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  rankBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#272727',
    marginRight: 12,
  },
  rankBadgeIcon: {
    backgroundColor: 'transparent',
  },
  rankIcon: {
    width: 34,
    height: 34,
    resizeMode: 'contain',
  },
  rankText: {
    color: '#A9ABB2',
    ...FONTS.font14B,
  },
  rankingUser: {
    flex: 1,
  },
  rankingName: {
    color: '#FFFFFF',
    ...FONTS.font15B,
  },
  rankingTeam: {
    marginTop: 4,
    color: '#8A8D95',
    ...FONTS.font12R,
  },
  rankingCoins: {
    color: '#FFFFFF',
    ...FONTS.font16B,
    marginLeft: 14,
  },
  raffleHistoryItem: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: '#252525',
  },
  raffleHistorySection: {
    marginTop: 18,
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 4,
    backgroundColor: '#171717',
    borderWidth: 1,
    borderColor: '#252525',
  },
  raffleHistorySectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  raffleHistorySectionTitle: {
    color: '#FFFFFF',
    ...FONTS.font17B,
    lineHeight: 22,
  },
  raffleHistorySectionMeta: {
    color: '#8A8D95',
    ...FONTS.font12M,
    lineHeight: 16,
  },
  raffleHistoryInlineState: {
    minHeight: 160,
    alignItems: 'center',
    justifyContent: 'center',
    borderTopWidth: 1,
    borderTopColor: '#252525',
  },
  raffleHistoryTextWrap: {
    flex: 1,
  },
  raffleHistoryTitle: {
    color: '#FFFFFF',
    ...FONTS.font15B,
    lineHeight: 20,
  },
  raffleHistoryLabel: {
    marginTop: 5,
    color: '#8A8D95',
    ...FONTS.font12R,
    lineHeight: 16,
  },
  raffleHistoryTime: {
    flexShrink: 0,
    color: '#A9ABB2',
    ...FONTS.font12M,
    lineHeight: 16,
  },
  raffleHistoryEmpty: {
    minHeight: 220,
    alignItems: 'center',
    justifyContent: 'center',
    borderTopWidth: 1,
    borderTopColor: '#252525',
    paddingHorizontal: 18,
  },
  raffleHistoryEmptyTitle: {
    color: '#FFFFFF',
    ...FONTS.font16B,
    lineHeight: 21,
  },
  raffleHistoryEmptyText: {
    marginTop: 8,
    color: '#8A8D95',
    textAlign: 'center',
    ...FONTS.font13R,
    lineHeight: 18,
  },
  raffleHistoryEmptyButton: {
    minWidth: 116,
    height: 38,
    marginTop: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E50914',
    paddingHorizontal: 16,
  },
  raffleHistoryEmptyButtonText: {
    color: '#FFFFFF',
    ...FONTS.font13B,
    lineHeight: 17,
  },
  errorText: {
    color: '#E66B70',
    ...FONTS.font12R,
    marginBottom: 8,
  },
  emptyText: {
    paddingVertical: 32,
    color: '#8A8D95',
    textAlign: 'center',
    ...FONTS.font14M,
    lineHeight: 19,
  },
  raffleHeader: {
    height: 56,
    marginTop: -16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  raffleBackButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  raffleBackIcon: {
    width: 24,
    height: 24,
    resizeMode: 'contain',
  },
  raffleTabRow: {
    marginBottom: 22,
  },
  raffleHero: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 8,
    padding: 12,
    gap: 12,
    marginBottom: 14,
  },
  raffleEyebrow: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: 'rgba(229,9,20,0.14)',
    color: '#E50914',
    ...FONTS.font11B,
    lineHeight: 14,
  },
  raffleTitle: {
    flex: 1,
    color: '#FFFFFF',
    ...FONTS.font16B,
    lineHeight: 21,
  },
  raffleBalancePill: {
    flexShrink: 0,
    height: 34,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2D2D2D',
    backgroundColor: '#111114',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    // paddingHorizontal: 10,
    paddingRight: 10,
  },
  raffleBalanceIcon: {
    width: 34,
    height: 34,
    paddingRight: 10,
  },
  raffleBalanceText: {
    color: '#FFFFFF',
    ...FONTS.font13B,
    lineHeight: 17,
  },
  raffleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: 10,
    rowGap: 16,
    marginBottom: 14,
  },
  raffleLoadingState: {
    minHeight: 342,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  raffleEmptyState: {
    minHeight: 240,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    paddingHorizontal: 18,
    marginBottom: 14,
    backgroundColor: '#171717',
    borderWidth: 1,
    borderColor: '#252525',
  },
  raffleEmptyTitle: {
    color: '#FFFFFF',
    ...FONTS.font16B,
    lineHeight: 21,
  },
  raffleEmptyText: {
    marginTop: 8,
    color: '#8A8D95',
    textAlign: 'center',
    ...FONTS.font13R,
    lineHeight: 18,
  },
  raffleItemSlot: {
    width: '48%',
  },
  raffleItemCard: {
    width: '100%',
    height: 'auto',
    borderRadius: 12,
    padding: 12,
    backgroundColor: '#171717',
    borderWidth: 1,
    borderColor: '#252525',
  },
  raffleItemCardSelected: {
    borderColor: '#E50914',
    backgroundColor: '#1F1012',
  },
  raffleItemCardDisabled: {
    opacity: 0.58,
  },
  raffleCheckWrap: {
    flexDirection: 'row',
    // alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 12,
  },
  raffleCheckLabelWrap: {
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingVertical: 2,
    borderWidth: 1,
    borderRadius: 6,
    borderColor: '#555555',
  },
  raffleCheckLabel: {
    color: '#FFFFFF',
    ...FONTS.font12M,
  },
  raffleCheckMeta: {
    color: '#8A8D95',
    ...FONTS.font12M,
    lineHeight: 16,
  },
  raffleCheck: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#555555',
    backgroundColor: '#1C1C1C',
  },
  raffleCheckSelected: {
    borderColor: '#E50914',
    backgroundColor: '#E50914',
  },
  raffleCheckIcon: {
    width: 18,
    height: 18,
    resizeMode: 'contain',
    tintColor: '#FFFFFF',
  },
  rafflePrizeVisual: {
    height: 98,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  rafflePrizeIcon: {
    width: 96,
    height: 96,
    resizeMode: 'contain',
  },
  raffleItemLabel: {
    height: 42,
    color: '#FFFFFF',
    ...FONTS.font14B,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 9,
  },
  raffleItemLabelExpanded: {
    height: 82,
  },
  raffleItemMeta: {
    marginTop: 8,
    justifyContent: 'flex-start',
  },
  raffleItemCost: {
    width: '100%',
    minHeight: 16,
    color: '#A9ABB2',
    ...FONTS.font12M,
    lineHeight: 16,
    textAlign: 'center',
  },
  raffleItemCount: {
    width: '100%',
    minHeight: 16,
    marginTop: 3,
    color: '#777A82',
    ...FONTS.font12R,
    lineHeight: 16,
    textAlign: 'center',
  },
  raffleSummary: {
    minHeight: 86,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14,
    backgroundColor: '#171717',
    borderWidth: 1,
    borderColor: '#252525',
  },
  raffleFixedFooter: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
    backgroundColor: '#000000',
    borderTopWidth: 1,
    borderTopColor: '#161616',
  },
  raffleSummaryLabel: {
    color: '#8A8D95',
    ...FONTS.font12M,
    lineHeight: 16,
  },
  raffleSummaryTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  raffleSummaryTitle: {
    marginTop: 5,
    color: '#FFFFFF',
    ...FONTS.font16B,
    lineHeight: 21,
    paddingRight: 12,
  },
  raffleApplyButton: {
    minWidth: 96,
    height: 44,
    flexShrink: 0,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E50914',
    paddingHorizontal: 16,
  },
  raffleApplyButtonDisabled: {
    backgroundColor: '#2A2A2A',
  },
  raffleApplyText: {
    color: '#FFFFFF',
    ...FONTS.font14B,
    lineHeight: 18,
  },
  raffleApplyTextDisabled: {
    color: '#777A82',
  },
  raffleModalOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  raffleModalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.72)',
  },
  raffleModalCard: {
    width: '100%',
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 18,
    backgroundColor: '#171717',
    borderWidth: 1,
    borderColor: '#252525',
  },
  raffleModalLottie: {
    alignSelf: 'center',
    width: 142,
    height: 142,
  },
  raffleModalTitle: {
    marginTop: 8,
    color: '#FFFFFF',
    ...FONTS.font22B,
    lineHeight: 28,
    textAlign: 'center',
  },
  raffleModalDescription: {
    marginTop: 10,
    color: '#D8DAE0',
    ...FONTS.font14R,
    lineHeight: 21,
    textAlign: 'center',
  },
  raffleModalError: {
    marginTop: 10,
    color: '#E50914',
    ...FONTS.font13M,
    lineHeight: 18,
    textAlign: 'center',
  },
  raffleModalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },
  raffleModalButton: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  raffleModalButtonDisabled: {
    opacity: 0.62,
  },
  raffleModalCancelButton: {
    backgroundColor: '#252525',
  },
  raffleModalConfirmButton: {
    backgroundColor: '#E50914',
  },
  raffleModalButtonText: {
    color: '#FFFFFF',
    ...FONTS.font15B,
    lineHeight: 20,
  },
  raffleModalCancelButtonText: {
    color: '#D8DAE0',
  },
  profileModalOverlay: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 36,
    backgroundColor: 'rgba(0,0,0,0.68)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  employeeProfileCard: {
    width: '100%',
    maxWidth: 430,
    maxHeight: '100%',
    borderRadius: 12,
    backgroundColor: '#171717',
    borderWidth: 1,
    borderColor: '#252525',
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOpacity: 0.36,
    shadowRadius: 22,
    shadowOffset: {width: 0, height: 12},
    elevation: 12,
  },
  employeeProfileHeader: {
    minHeight: 54,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#24262D',
  },
  employeeProfileHeaderButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  employeeProfileTitle: {
    flex: 1,
    color: '#FFFFFF',
    textAlign: 'center',
    ...FONTS.font16B,
    lineHeight: 21,
  },
  closeIcon: {
    width: 22,
    height: 22,
    resizeMode: 'contain',
    tintColor: '#A9ABB2',
  },
  employeeProfileScroll: {
    flex: 1,
  },
  employeeProfileScrollContent: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 18,
  },
  employeeProfileHero: {
    alignItems: 'center',
  },
  employeeProfileAvatar: {
    width: 94,
    height: 94,
    borderRadius: 47,
    backgroundColor: '#24262B',
  },
  employeeProfileName: {
    marginTop: 13,
    maxWidth: '90%',
    color: '#FFFFFF',
    textAlign: 'center',
    ...FONTS.font22B,
    lineHeight: 28,
  },
  employeeProfileSubText: {
    marginTop: 6,
    maxWidth: '92%',
    color: '#A7AAB4',
    textAlign: 'center',
    ...FONTS.font13M,
    lineHeight: 18,
  },
  employeeInfoList: {
    marginTop: 20,
    borderRadius: 12,
    backgroundColor: '#111114',
    overflow: 'hidden',
  },
  employeeInfoRow: {
    minHeight: 46,
    paddingHorizontal: 14,
    paddingVertical: 11,
    flexDirection: 'row',
    alignItems: 'center',
  },
  employeeInfoLabel: {
    width: 52,
    color: '#8F939D',
    ...FONTS.font13M,
    lineHeight: 18,
  },
  employeeInfoValue: {
    flex: 1,
    color: '#F0F1F4',
    ...FONTS.font14M,
    lineHeight: 20,
  },
  employeePostSectionHeader: {
    marginTop: 22,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  employeePostSectionTitle: {
    color: '#FFFFFF',
    ...FONTS.font17B,
    lineHeight: 22,
  },
  employeePostCountText: {
    color: '#8F939D',
    ...FONTS.font13M,
    lineHeight: 18,
  },
  employeeProfileLoading: {
    minHeight: 132,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  employeeProfileErrorText: {
    paddingVertical: 34,
    color: '#FF5962',
    textAlign: 'center',
    ...FONTS.font14M,
    lineHeight: 20,
  },
  employeeProfileEmptyText: {
    paddingVertical: 34,
    color: '#8F939D',
    textAlign: 'center',
    ...FONTS.font14M,
    lineHeight: 20,
  },
  employeePostGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -2,
  },
  employeePostTile: {
    width: '33.333%',
    aspectRatio: 1,
    padding: 2,
  },
  employeePostTileInner: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: '#24262B',
  },
  employeePostThumbnail: {
    width: '100%',
    height: '100%',
  },
  employeePostFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    backgroundColor: '#24262B',
  },
  employeePostFallbackTitle: {
    color: '#D9DBE2',
    textAlign: 'center',
    ...FONTS.font12B,
    lineHeight: 16,
  },
  employeePostTileOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 7,
    paddingTop: 20,
    paddingBottom: 7,
    backgroundColor: 'rgba(0,0,0,0.38)',
  },
  employeePostTileTitle: {
    color: '#FFFFFF',
    ...FONTS.font11B,
    lineHeight: 14,
  },
});
