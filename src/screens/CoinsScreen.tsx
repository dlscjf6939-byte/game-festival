import React, {useEffect, useRef, useState} from 'react';
import {
  Animated,
  Image,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {AnimatedPressable} from '../components/AnimatedPressable';
import {AppLoading} from '../components/AppLoading';
import {useAuth} from '../auth/AuthProvider';
import {useCoin} from '../coin/CoinProvider';
import {MainScaffold} from '../components/MainScaffold';
import {FONTS} from '../constants/theme';
import {
  coinHistories,
  type CoinHistory,
  type CoinRanking,
} from '../dummyData/coinDummyData';
import {icon} from '../assets/icons';

const coinTabs = [
  {id: 'history', label: '코인내역'},
  {id: 'ranking', label: '코인랭킹'},
] as const;

type CoinTabId = (typeof coinTabs)[number]['id'];

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

function HistoryItem({
  index,
  item,
}: {
  index: number;
  item: CoinHistory;
}): JSX.Element {
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
}: {
  item: CoinRanking;
  index: number;
}): JSX.Element {
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
        <Text style={styles.rankingCoins}>{item.coins}개</Text>
      </AnimatedPressable>
    </Animated.View>
  );
}

export function CoinsScreen(): JSX.Element {
  const {auth} = useAuth();
  const {rankingItems, isRankingLoading, rankingError} = useCoin();
  const [activeTab, setActiveTab] = useState<CoinTabId>('history');
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

  const myProfile = auth?.profile;
  const coinBalanceValue =
    typeof myProfile?.coinBalance === 'number'
      ? myProfile.coinBalance
      : typeof myProfile?.coinBalance === 'string'
      ? Number(myProfile.coinBalance)
      : 0;
  const coinBalance = Number.isFinite(coinBalanceValue) ? coinBalanceValue : 0;
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
        {activeTab === 'history' ? (
          <>
            <View style={styles.balanceCard}>
              <Text style={styles.label}>나의 보유 코인</Text>
              <Text style={styles.value}>{coinBalance}개</Text>
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
        ) : (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>코인 랭킹</Text>
              <Text style={styles.sectionMeta}>
                {isRankingLoading ? '불러오는 중...' : '상위 30명까지 표시됩니다.'}
              </Text>
            </View>

            {isRankingLoading ? (
              <AppLoading label="코인 랭킹을 불러오는 중..." />
            ) : (
              <>
                {rankingError ? <Text style={styles.errorText}>{rankingError}</Text> : null}

                {rankingItems.length ? (
                  rankingItems.map((item, index) => <RankingItem key={item.id} index={index} item={item} />)
                ) : (
                  <Text style={styles.emptyText}>표시할 랭킹이 없습니다.</Text>
                )}
              </>
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
  label: {
    color: '#A9ABB2',
    ...FONTS.font14M,
  },
  value: {
    marginTop: 10,
    color: '#FFFFFF',
    ...FONTS.font40B,
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
});
