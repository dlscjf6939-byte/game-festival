import React, {useState} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {MainScaffold} from '../components/MainScaffold';
import {FONTS} from '../constants/theme';

const coinTabs = [
  {id: 'history', label: '코인내역'},
  {id: 'ranking', label: '코인랭킹'},
] as const;

type CoinTabId = (typeof coinTabs)[number]['id'];

const coinHistories = [
  {id: 'prediction', title: '승부예측 참여', description: '철권7 결승전 TEAM RED 선택', amount: -2},
  {id: 'attendance', title: '출석 체크', description: '게임대회 현장 QR 출석 완료', amount: 1},
  {id: 'event', title: '이벤트 보상', description: '응원 댓글 미션 달성', amount: 3},
  {id: 'base', title: '기본 지급', description: '섹타나인 임직원 기본 코인', amount: 24},
];

const coinRankings = [
  {id: '1', rank: 1, name: '김소진', team: '서비스개발팀', coins: 42, isMe: false},
  {id: '2', rank: 2, name: '길기환', team: '주니어보드', coins: 38, isMe: false},
  {id: '3', rank: 3, name: '이인철', team: '서비스개발팀', coins: 24, isMe: true},
  {id: '4', rank: 4, name: '박민준', team: '운영팀', coins: 21, isMe: false},
  {id: '5', rank: 5, name: '정다은', team: '디자인팀', coins: 18, isMe: false},
];

export function CoinsScreen(): JSX.Element {
  const [activeTab, setActiveTab] = useState<CoinTabId>('history');

  return (
    <MainScaffold>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>코인</Text>
      </View>

      <View style={styles.tabRow}>
        {coinTabs.map(tab => {
          const isActive = activeTab === tab.id;

          return (
            <Pressable
              key={tab.id}
              accessibilityRole="button"
              onPress={() => setActiveTab(tab.id)}
              style={[styles.tabChip, isActive && styles.tabChipActive]}>
              <Text style={[styles.tabChipText, isActive && styles.tabChipTextActive]}>{tab.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {activeTab === 'history' ? (
        <>
          <View style={styles.balanceCard}>
            <Text style={styles.label}>나의 보유 코인</Text>
            <Text style={styles.value}>24개</Text>
            <Text style={styles.balanceMeta}>현재 랭킹 3위 · 이번 주 +4개</Text>
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>최근 변동 내역</Text>
              <Text style={styles.sectionMeta}>총 4건</Text>
            </View>

            {coinHistories.map(item => {
              const isPlus = item.amount > 0;

              return (
                <View key={item.id} style={styles.item}>
                  <View style={styles.itemTextWrap}>
                    <Text style={styles.itemTitle}>{item.title}</Text>
                    <Text style={styles.itemDescription}>{item.description}</Text>
                  </View>
                  <Text style={isPlus ? styles.plus : styles.minus}>
                    {isPlus ? '+' : ''}
                    {item.amount}
                  </Text>
                </View>
              );
            })}
          </View>
        </>
      ) : (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>코인 랭킹</Text>
            <Text style={styles.sectionMeta}>TOP 5</Text>
          </View>

          <View style={styles.myRankSummary}>
            <Text style={styles.myRankLabel}>내 순위</Text>
            <Text style={styles.myRankValue}>3위</Text>
            <Text style={styles.myRankMeta}>24개 · 2위와 14개 차이</Text>
          </View>

          {coinRankings.map(item => (
            <View key={item.id} style={[styles.rankingItem, item.isMe && styles.rankingItemMe]}>
              <View style={[styles.rankBadge, item.rank <= 3 && styles.rankBadgeTop]}>
                <Text style={[styles.rankText, item.rank <= 3 && styles.rankTextTop]}>{item.rank}</Text>
              </View>
              <View style={styles.rankingUser}>
                <Text style={styles.rankingName}>
                  {item.name}
                  {item.isMe ? ' 나' : ''}
                </Text>
                <Text style={styles.rankingTeam}>{item.team}</Text>
              </View>
              <Text style={styles.rankingCoins}>{item.coins}개</Text>
            </View>
          ))}
        </View>
      )}
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
    color: '#FF6A61',
    ...FONTS.font15B,
  },
  minus: {
    color: '#8A8D95',
    ...FONTS.font15B,
  },
  myRankSummary: {
    borderRadius: 18,
    padding: 18,
    backgroundColor: '#111111',
    borderWidth: 1,
    borderColor: '#2B2B2B',
    marginBottom: 8,
  },
  myRankLabel: {
    color: '#A9ABB2',
    ...FONTS.font13M,
  },
  myRankValue: {
    marginTop: 8,
    color: '#FFFFFF',
    ...FONTS.font34B,
  },
  myRankMeta: {
    marginTop: 8,
    color: '#FF6A61',
    ...FONTS.font13M,
  },
  rankingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: '#252525',
  },
  rankingItemMe: {
    backgroundColor: 'rgba(244,13,33,0.08)',
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
  rankBadgeTop: {
    backgroundColor: '#FFFFFF',
  },
  rankText: {
    color: '#A9ABB2',
    ...FONTS.font14B,
  },
  rankTextTop: {
    color: '#000000',
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
  },
});
