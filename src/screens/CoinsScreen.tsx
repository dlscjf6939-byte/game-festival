import React, {useEffect, useMemo, useRef, useState} from 'react';
import {Animated, Image, Modal, StyleSheet, Text, View, type ImageSourcePropType} from 'react-native';
import LottieView from 'lottie-react-native';
import {AnimatedPressable} from '../components/AnimatedPressable';
import {AppLoading} from '../components/AppLoading';
import {useAuth} from '../auth/AuthProvider';
import {useCoin} from '../coin/CoinProvider';
import {MainScaffold} from '../components/MainScaffold';
import {FONTS} from '../constants/theme';
import {coinHistories, type CoinHistory, type CoinRanking} from '../dummyData/coinDummyData';
import {icon} from '../assets/icons';
import {image} from '../assets/images';
import {withMinimumLoadingTime} from '../utils/loading';

const giftLottie = require('../assets/lotties/Gift.json');
const API_BASE = 'http://121.254.240.93:8090';

const coinTabs = [
  {id: 'coinHistory', label: '코인내역'},
  {id: 'ranking', label: '코인랭킹'},
  {id: 'luckyHistory', label: '응모내역'},
] as const;

type CoinTabId = (typeof coinTabs)[number]['id'];
type CoinViewMode = 'overview' | 'raffle';
type RaffleHistory = {
  id: string;
  productName: string;
  appliedAt: string;
};
type RaffleProduct = {
  applyCount: number;
  applyPrice: number;
  id: number;
  image: ImageSourcePropType;
  productName: string;
};
type RaffleProductsResponse = {
  code?: string;
  data?: unknown;
  message?: string;
  success?: boolean;
};
type RaffleProductApiItem = {
  applyCount?: number | string;
  applyPrice?: number | string;
  productId?: number | string;
  productName?: string;
};

function formatRaffleAppliedAt(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');

  return `${year}.${month}.${day} ${hours}:${minutes}`;
}

function getRaffleProductImage() {
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

  if (productId === null || !productName || applyPrice === null) {
    return null;
  }

  return {
    applyCount: applyCount ?? 0,
    applyPrice,
    id: productId,
    image: getRaffleProductImage(),
    productName,
  };
}

function getRaffleProductsFromResponse(responseBody: RaffleProductsResponse): unknown[] {
  return Array.isArray(responseBody.data) ? responseBody.data : [];
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

function RankingItem({item, index}: {item: CoinRanking; index: number}): JSX.Element {
  const entranceProgress = useRef(new Animated.Value(0)).current;
  const translateY = entranceProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [18, 0],
  });
  const rankIcon = getRankIcon(item.rank);

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
      <AnimatedPressable style={[styles.rankingItem, item.isMe && styles.rankingItemMe]}>
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
          <Text numberOfLines={1} style={styles.raffleHistoryTitle}>
            {item.productName}
          </Text>
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
  onPress,
}: {
  index: number;
  isAffordable: boolean;
  isSelected: boolean;
  item: RaffleProduct;
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
        <View style={[styles.raffleCheck, isSelected && styles.raffleCheckSelected]}>
          {isSelected ? <Image source={icon.check} style={styles.raffleCheckIcon} /> : null}
        </View>
        <View style={styles.rafflePrizeVisual}>
          <Image source={item.image} style={styles.rafflePrizeIcon} />
        </View>
        <Text numberOfLines={2} style={styles.raffleItemLabel}>
          {item.productName}
        </Text>
        <Text style={styles.raffleItemCost}>응모가격 {item.applyPrice}코인</Text>
        <Text style={styles.raffleItemCount}>전체 응모 {item.applyCount}회</Text>
      </AnimatedPressable>
    </Animated.View>
  );
}

export function CoinsScreen(): JSX.Element {
  const {auth} = useAuth();
  const {rankingItems, isRankingLoading, rankingError} = useCoin();
  const [activeTab, setActiveTab] = useState<CoinTabId>('coinHistory');
  const [viewMode, setViewMode] = useState<CoinViewMode>('overview');
  const [isRaffleModalVisible, setIsRaffleModalVisible] = useState(false);
  const [selectedRaffleProductId, setSelectedRaffleProductId] = useState<number | null>(null);
  const [raffleProducts, setRaffleProducts] = useState<RaffleProduct[]>([]);
  const [isRaffleProductsLoading, setIsRaffleProductsLoading] = useState(true);
  const [raffleProductsError, setRaffleProductsError] = useState<string | null>(null);
  const [raffleHistories, setRaffleHistories] = useState<RaffleHistory[]>([]);
  const viewTransitionProgress = useRef(new Animated.Value(1)).current;
  const tabContentProgress = useRef(new Animated.Value(1)).current;
  const tabContentTranslateY = tabContentProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [14, 0],
  });

  useEffect(() => {
    tabContentProgress.setValue(0);

    Animated.timing(tabContentProgress, {
      toValue: 1,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [activeTab, tabContentProgress]);

  useEffect(() => {
    if (!auth?.accessToken) {
      setRaffleProducts([]);
      setIsRaffleProductsLoading(false);
      return;
    }

    const accessToken = auth.accessToken;
    let isCancelled = false;

    async function fetchRaffleProducts() {
      setIsRaffleProductsLoading(true);
      setRaffleProductsError(null);

      try {
        const response = await withMinimumLoadingTime(
          fetch(`${API_BASE}/api/products/applications`, {
            headers: {
              Accept: 'application/json',
              Authorization: `Bearer ${accessToken}`,
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

        if (isCancelled) {
          return;
        }

        setRaffleProducts(products);
        setSelectedRaffleProductId(currentProductId => {
          if (currentProductId !== null && products.some(product => product.id === currentProductId)) {
            return currentProductId;
          }

          return products[0]?.id ?? null;
        });
      } catch (error) {
        if (isCancelled) {
          return;
        }

        setRaffleProducts([]);
        setSelectedRaffleProductId(null);
        setRaffleProductsError(error instanceof Error ? error.message : '경품 목록 조회 중 오류가 발생했습니다.');
        console.log('[CoinsScreen] raffle products request failed', error);
      } finally {
        if (!isCancelled) {
          setIsRaffleProductsLoading(false);
        }
      }
    }

    fetchRaffleProducts();

    return () => {
      isCancelled = true;
    };
  }, [auth?.accessToken]);

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

  const myProfile = auth?.profile;
  const coinBalance = toCoinNumber(myProfile?.coinBalance) ?? 0;
  const sortedRankingItems = useMemo(
    () => [...rankingItems].sort((left, right) => left.rank - right.rank).slice(0, 30),
    [rankingItems],
  );
  const myRankingItem = rankingItems.find(item => item.isMe);
  const accumulatedCoin =
    myRankingItem?.coins ??
    toCoinNumber(myProfile?.accumulatedCoin) ??
    toCoinNumber(myProfile?.totalCoin) ??
    toCoinNumber(myProfile?.totalCoins) ??
    0;
  const topRankingItems = sortedRankingItems.slice(0, 10);
  const restRankingItems = sortedRankingItems.slice(10);

  const openRaffleConfirm = () => {
    setIsRaffleModalVisible(true);
  };

  const confirmRaffleApply = (item: RaffleProduct) => {
    setRaffleHistories(currentHistories => [
      {
        id: `raffle-history-${Date.now()}`,
        productName: item.productName,
        appliedAt: formatRaffleAppliedAt(new Date()),
      },
      ...currentHistories,
    ]);
    setIsRaffleModalVisible(false);
    setActiveTab('luckyHistory');
    switchViewMode('overview');
  };

  if (viewMode === 'raffle') {
    const selectedRaffleItem = raffleProducts.find(item => item.id === selectedRaffleProductId) ?? null;
    const canApply = selectedRaffleItem !== null && coinBalance >= selectedRaffleItem.applyPrice;

    return (
      <MainScaffold>
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

        <Animated.View style={viewTransitionStyle}>
          <View style={styles.raffleHero}>
            <Text numberOfLines={1} style={styles.raffleTitle}>
              행운의 주인공이 되어보세요
            </Text>
            <View style={styles.raffleBalancePill}>
              <Text style={styles.raffleBalanceText}>코인 {coinBalance}개</Text>
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
                  />
                );
              })}
            </View>
          ) : (
            <View style={styles.raffleEmptyState}>
              <Text style={styles.raffleEmptyTitle}>응모 가능한 경품이 없습니다.</Text>
              <Text style={styles.raffleEmptyText}>경품이 등록되면 이곳에 표시됩니다.</Text>
            </View>
          )}

          <View style={styles.raffleSummary}>
            <View>
              <Text style={styles.raffleSummaryLabel}>선택 상품</Text>
              <Text style={styles.raffleSummaryTitle}>{selectedRaffleItem?.productName ?? '상품을 선택하세요'}</Text>
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
        </Animated.View>

        <Modal
          animationType="fade"
          onRequestClose={() => setIsRaffleModalVisible(false)}
          transparent
          visible={isRaffleModalVisible}>
          <View style={styles.raffleModalOverlay}>
            <AnimatedPressable
              accessibilityLabel="응모 확인 모달 닫기"
              accessibilityRole="button"
              onPress={() => setIsRaffleModalVisible(false)}
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
              <View style={styles.raffleModalActions}>
                <AnimatedPressable
                  accessibilityRole="button"
                  onPress={() => setIsRaffleModalVisible(false)}
                  style={[styles.raffleModalButton, styles.raffleModalCancelButton]}>
                  <Text style={[styles.raffleModalButtonText, styles.raffleModalCancelButtonText]}>취소</Text>
                </AnimatedPressable>
                <AnimatedPressable
                  accessibilityRole="button"
                  disabled={selectedRaffleItem === null}
                  onPress={() => {
                    if (selectedRaffleItem) {
                      confirmRaffleApply(selectedRaffleItem);
                    }
                  }}
                  style={[styles.raffleModalButton, styles.raffleModalConfirmButton]}>
                  <Text style={styles.raffleModalButtonText}>응모하기</Text>
                </AnimatedPressable>
              </View>
            </View>
          </View>
        </Modal>
      </MainScaffold>
    );
  }

  return (
    <MainScaffold>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>코인</Text>
      </View>

      <View style={styles.tabRow}>
        {coinTabs.map(tab => {
          const isActive = activeTab === tab.id;

          return (
            <AnimatedPressable
              key={tab.id}
              accessibilityRole="button"
              onPress={() => setActiveTab(tab.id)}
              style={[styles.tabChip, isActive && styles.tabChipActive]}>
              <Text style={[styles.tabChipText, isActive && styles.tabChipTextActive]}>{tab.label}</Text>
            </AnimatedPressable>
          );
        })}
      </View>

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
                  onPress={() => switchViewMode('raffle')}
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
                  <Text style={styles.value}>{accumulatedCoin}개</Text>
                </View>
              </View>
            </View>

            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>최근 내역</Text>
                <Text style={styles.sectionMeta}>총 {coinHistories.length}건</Text>
              </View>

              {coinHistories.map((item, index) => (
                <HistoryItem key={item.id} index={index} item={item} />
              ))}
            </View>
          </>
        ) : activeTab === 'ranking' ? (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>코인 랭킹</Text>
              <Text style={styles.topRankingBadge}>TOP 10</Text>
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
                          <RankingItem key={item.id} index={index} item={item} />
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
        ) : (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>응모내역</Text>
              <Text style={styles.sectionMeta}>총 {raffleHistories.length}건</Text>
            </View>

            {raffleHistories.length ? (
              raffleHistories.map((item, index) => (
                <RaffleHistoryItem key={item.id} index={index} item={item} />
              ))
            ) : (
              <View style={styles.raffleHistoryEmpty}>
                <Text style={styles.raffleHistoryEmptyTitle}>응모내역이 없습니다.</Text>
                <Text style={styles.raffleHistoryEmptyText}>코인을 획득하여 상품에 응모해보세요</Text>
                <AnimatedPressable
                  accessibilityRole="button"
                  onPress={() => switchViewMode('raffle')}
                  style={styles.raffleHistoryEmptyButton}>
                  <Text style={styles.raffleHistoryEmptyButtonText}>응모하러 가기</Text>
                </AnimatedPressable>
              </View>
            )}
          </View>
        )}
      </Animated.View>
    </MainScaffold>
  );
}

const styles = StyleSheet.create({
  header: {
    height: 56,
    justifyContent: 'center',
  },
  headerTitle: {
    color: '#FFFFFF',
    ...FONTS.font22B,
    lineHeight: 29,
  },
  tabRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 22,
  },
  tabChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    backgroundColor: 'transparent',
  },
  tabChipActive: {
    backgroundColor: '#5E5252',
    borderColor: '#5E5252',
  },
  tabChipText: {
    color: 'rgba(255,255,255,0.8)',
    ...FONTS.font14M,
    lineHeight: 18,
  },
  tabChipTextActive: {
    color: 'rgba(255,255,255,0.8)',
  },
  balanceCard: {
    borderRadius: 24,
    padding: 24,
    backgroundColor: '#121212',
    borderWidth: 1,
    borderColor: '#242424',
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
  section: {
    borderRadius: 24,
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
  topRankingBadge: {
    minWidth: 56,
    height: 24,
    borderRadius: 12,
    overflow: 'hidden',
    color: '#FFFFFF',
    textAlign: 'center',
    backgroundColor: '#E50914',
    ...FONTS.font11B,
    lineHeight: 24,
  },
  rankingGroup: {
    marginTop: 4,
  },
  topRankingGroup: {
    borderRadius: 18,
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
    height: 44,
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
  raffleHero: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 8,
    padding: 12,
    gap: 12,
    marginTop: 20,
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
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#E50914',
  },
  raffleBalanceText: {
    color: '#FFFFFF',
    ...FONTS.font14B,
    lineHeight: 18,
  },
  raffleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
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
    borderRadius: 8,
    paddingHorizontal: 18,
    marginBottom: 14,
    backgroundColor: '#151515',
    borderWidth: 1,
    borderColor: '#292929',
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
    minHeight: 150,
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#151515',
    borderWidth: 1,
    borderColor: '#292929',
  },
  raffleItemCardSelected: {
    borderColor: '#E50914',
    backgroundColor: '#1F1012',
  },
  raffleItemCardDisabled: {
    opacity: 0.58,
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
    height: 96,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rafflePrizeIcon: {
    width: 82,
    height: 82,
    resizeMode: 'contain',
  },
  raffleItemLabel: {
    // minHeight: 36,
    color: '#FFFFFF',
    ...FONTS.font14B,
    lineHeight: 18,
    textAlign : 'center',
    marginTop : 8,
  },
  raffleItemCost: {
    marginTop: 7,
    color: '#A9ABB2',
    ...FONTS.font12M,
    lineHeight: 16,
     textAlign : 'center'
  },
  raffleItemCount: {
    marginTop: 3,
    color: '#777A82',
    ...FONTS.font12R,
    lineHeight: 16,
     textAlign : 'center'
  },
  raffleSummary: {
    minHeight: 86,
    borderRadius: 8,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14,
    backgroundColor: '#171717',
    borderWidth: 1,
    borderColor: '#252525',
  },
  raffleSummaryLabel: {
    color: '#8A8D95',
    ...FONTS.font12M,
    lineHeight: 16,
  },
  raffleSummaryTitle: {
    marginTop: 5,
    color: '#FFFFFF',
    ...FONTS.font16B,
    lineHeight: 21,
  },
  raffleApplyButton: {
    minWidth: 96,
    height: 44,
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
    borderRadius: 26,
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 18,
    backgroundColor: '#151519',
    borderWidth: 1,
    borderColor: '#2A2B31',
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
  raffleModalCancelButton: {
    backgroundColor: '#25262B',
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
});
