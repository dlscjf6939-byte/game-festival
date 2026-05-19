import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {MainScaffold} from '../components/MainScaffold';

export function CoinsScreen(): JSX.Element {
  return (
    <MainScaffold>
      <View style={styles.balanceCard}>
        <Text style={styles.label}>나의 보유 코인</Text>
        <Text style={styles.value}>24개</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>최근 변동 내역</Text>
        <View style={styles.item}>
          <Text style={styles.itemTitle}>승부예측 참여</Text>
          <Text style={styles.minus}>-2</Text>
        </View>
        <View style={styles.item}>
          <Text style={styles.itemTitle}>출석 체크</Text>
          <Text style={styles.plus}>+1</Text>
        </View>
        <View style={styles.item}>
          <Text style={styles.itemTitle}>이벤트 보상</Text>
          <Text style={styles.plus}>+3</Text>
        </View>
      </View>
    </MainScaffold>
  );
}

const styles = StyleSheet.create({
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
    fontSize: 14,
    fontWeight: '600',
  },
  value: {
    marginTop: 10,
    color: '#FFFFFF',
    fontSize: 40,
    fontWeight: '900',
  },
  section: {
    borderRadius: 24,
    padding: 20,
    backgroundColor: '#171717',
    borderWidth: 1,
    borderColor: '#252525',
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 14,
  },
  item: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: '#252525',
  },
  itemTitle: {
    color: '#D6D8DE',
    fontSize: 15,
  },
  plus: {
    color: '#FF6A61',
    fontSize: 15,
    fontWeight: '700',
  },
  minus: {
    color: '#8A8D95',
    fontSize: 15,
    fontWeight: '700',
  },
});
