import React from 'react';
import {Image, StyleSheet, Text, View} from 'react-native';
import {MainScaffold} from '../components/MainScaffold';
import {image} from '../assets/images';
import {FONTS} from '../constants/theme';

export function HomeScreen(): JSX.Element {
  return (
    <MainScaffold>
      <View style={styles.heroCard}>
        <Text style={styles.heroEyebrow}>2026 GAME TOURNAMENT</Text>
        <Text style={styles.heroTitle}>사내 게임대회가 시작됐어요</Text>
        <Text style={styles.heroDescription}>코인을 모으고 승부예측에 참여하면서 팀 랭킹을 올려보세요.</Text>
      </View>

      <View style={styles.coinCard}>
        <Text style={styles.coinLabel}>나의 보유코인</Text>
        <Text style={styles.coinValue}>24개</Text>

        <View style={styles.coinRow}>
          <Text style={styles.coinRowLabel}>승부예측 참여 완료</Text>
          <Text style={styles.coinRowMinus}>-2개</Text>
        </View>
        <View style={styles.coinRow}>
          <Text style={styles.coinRowLabel}>주니어보드 설문 참여 완료</Text>
          <Text style={styles.coinRowPlus}>+2개</Text>
        </View>
        <View style={styles.coinRow}>
          <Text style={styles.coinRowLabel}>섹타나인 임직원 기본 지급</Text>
          <Text style={styles.coinRowPlus}>+2개</Text>
        </View>
      </View>

      <View style={styles.posterSection}>
        <Text style={styles.sectionTitle}>지금 가장 뜨거운 매치</Text>
        <View style={styles.posterCard}>
          <Image source={image.homeBanner} style={styles.posterImage} />
          <Text style={styles.posterTitle}>TEAM RED vs TEAM BLACK</Text>
          <Text style={styles.posterSubtitle}>실시간 인기 승부예측</Text>
        </View>
      </View>
    </MainScaffold>
  );
}

const styles = StyleSheet.create({
  heroCard: {
    borderRadius: 24,
    padding: 24,
    backgroundColor: '#111111',
    borderWidth: 1,
    borderColor: '#1F1F1F',
    marginBottom: 20,
  },
  heroEyebrow: {
    color: '#FF6A61',
    ...FONTS.font12B,
    letterSpacing: 1.1,
  },
  heroTitle: {
    marginTop: 12,
    color: '#FFFFFF',
    ...FONTS.font28B,
    lineHeight: 34,
  },
  heroDescription: {
    marginTop: 10,
    color: '#A9ABB2',
    ...FONTS.font14R,
    lineHeight: 22,
  },
  coinCard: {
    borderRadius: 24,
    padding: 20,
    backgroundColor: '#161616',
    borderWidth: 1,
    borderColor: '#262626',
    marginBottom: 20,
  },
  coinLabel: {
    color: '#B7B9C0',
    ...FONTS.font14M,
  },
  coinValue: {
    marginTop: 8,
    color: '#FFFFFF',
    ...FONTS.font38B,
  },
  coinRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  coinRowLabel: {
    color: '#D6D8DE',
    ...FONTS.font14R,
  },
  coinRowPlus: {
    color: '#FF6A61',
    ...FONTS.font14B,
  },
  coinRowMinus: {
    color: '#8A8D95',
    ...FONTS.font14B,
  },
  posterSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    color: '#FFFFFF',
    ...FONTS.font18B,
    marginBottom: 12,
  },
  posterCard: {
    height: 260,
    borderRadius: 24,
    justifyContent: 'flex-end',
    padding: 16,
    backgroundColor: '#1A1A1A',
    borderWidth: 1,
    borderColor: '#262626',
    overflow: 'hidden',
  },
  posterImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
    opacity: 0.42,
  },
  posterTitle: {
    color: '#FFFFFF',
    ...FONTS.font24B,
  },
  posterSubtitle: {
    marginTop: 8,
    color: '#A2A4AB',
    ...FONTS.font14R,
  },
});
