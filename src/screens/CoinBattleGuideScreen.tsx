import React, {useMemo, useState} from 'react';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {
  Image,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {image} from '../assets/images';
import {icon} from '../assets/icons';
import {AnimatedPressable} from '../components/AnimatedPressable';
import {AppGnb} from '../components/AppGnb';
import {TabSceneTransition} from '../components/TabSceneTransition';
import {FONTS} from '../constants/theme';
import type {CoinBattleStackParamList} from '../navigation/types';

type PracticeGameId = 1 | 2 | 21;
type RpsChoice = 'PAPER' | 'ROCK' | 'SCISSORS';
type RpsResult = 'DRAW' | 'LOSE' | 'WIN';

type GuideGame = {
  id: PracticeGameId;
  maxRoundCount: number;
  rules: string[];
  summary: string;
  title: string;
};

type MatchCard = {
  id: string;
  label: string;
};

const guideGames: GuideGame[] = [
  {
    id: 1,
    maxRoundCount: 3,
    rules: ['라운드가 시작되면 바위, 가위, 보 중 하나를 고릅니다.', '상대도 선택하면 결과가 바로 공개됩니다.', '최대 3라운드까지 진행됩니다.'],
    summary: '상대 선택을 예상해서 한 번에 카드를 고르는 게임입니다.',
    title: '가위바위보',
  },
  {
    id: 2,
    maxRoundCount: 1,
    rules: ['처음에 카드 위치를 짧게 기억합니다.', '뒤집힌 카드 중 같은 그림 2장을 찾아 선택합니다.', '한 번의 라운드로 승부가 끝납니다.'],
    summary: '짧은 기억력과 빠른 판단으로 같은 카드를 찾는 게임입니다.',
    title: '같은 카드 맞추기',
  },
  {
    id: 21,
    maxRoundCount: 3,
    rules: ['제시된 문장을 정확하게 입력합니다.', '오타 없이 먼저 제출할수록 유리합니다.', '최대 3라운드까지 진행됩니다.'],
    summary: '정확도와 입력 속도로 겨루는 타자 게임입니다.',
    title: '타자게임',
  },
];

const rpsChoices: Array<{
  id: RpsChoice;
  image: typeof image.rock;
  label: string;
}> = [
  {id: 'ROCK', image: image.rock, label: '바위'},
  {id: 'SCISSORS', image: image.scissor, label: '가위'},
  {id: 'PAPER', image: image.paper, label: '보'},
];
const matchCardLabels = ['A', 'B', 'C'];
const typingSentence = '빠르게 정확하게 입력하세요';

function getRpsResult(myChoice: RpsChoice, opponentChoice: RpsChoice): RpsResult {
  if (myChoice === opponentChoice) {
    return 'DRAW';
  }

  if (
    (myChoice === 'ROCK' && opponentChoice === 'SCISSORS') ||
    (myChoice === 'SCISSORS' && opponentChoice === 'PAPER') ||
    (myChoice === 'PAPER' && opponentChoice === 'ROCK')
  ) {
    return 'WIN';
  }

  return 'LOSE';
}

function getRpsResultText(result: RpsResult): string {
  if (result === 'WIN') {
    return '승리';
  }

  if (result === 'LOSE') {
    return '패배';
  }

  return '무승부';
}

function createMatchCards(): MatchCard[] {
  return matchCardLabels
    .flatMap(label => [
      {id: `${label}-1`, label},
      {id: `${label}-2`, label},
    ])
    .sort(() => Math.random() - 0.5);
}

function RpsPractice(): JSX.Element {
  const [myChoice, setMyChoice] = useState<RpsChoice | null>(null);
  const [opponentChoice, setOpponentChoice] = useState<RpsChoice | null>(null);
  const result = myChoice && opponentChoice ? getRpsResult(myChoice, opponentChoice) : null;

  const choose = (choice: RpsChoice) => {
    const nextOpponentChoice = rpsChoices[Math.floor(Math.random() * rpsChoices.length)].id;
    setMyChoice(choice);
    setOpponentChoice(nextOpponentChoice);
  };

  return (
    <View style={styles.practicePanel}>
      <Text style={styles.practiceTitle}>선택 연습</Text>
      <View style={styles.rpsRow}>
        {rpsChoices.map(choice => {
          const active = myChoice === choice.id;

          return (
            <AnimatedPressable
              key={choice.id}
              accessibilityRole="button"
              onPress={() => choose(choice.id)}
              style={[styles.rpsButton, active && styles.practiceButtonActive]}>
              <Image resizeMode="contain" source={choice.image} style={styles.rpsImage} />
              <Text style={[styles.practiceButtonText, active && styles.practiceButtonTextActive]}>{choice.label}</Text>
            </AnimatedPressable>
          );
        })}
      </View>
      <Text style={styles.practiceResult}>
        {result
          ? `내 선택 ${rpsChoices.find(choice => choice.id === myChoice)?.label ?? '-'} · 상대 ${
              rpsChoices.find(choice => choice.id === opponentChoice)?.label ?? '-'
            } · ${getRpsResultText(result)}`
          : '카드를 하나 선택해보세요'}
      </Text>
    </View>
  );
}

function MatchPractice(): JSX.Element {
  const [cards, setCards] = useState<MatchCard[]>(() => createMatchCards());
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [matchedLabels, setMatchedLabels] = useState<string[]>([]);
  const [message, setMessage] = useState('');

  const reset = () => {
    setCards(createMatchCards());
    setSelectedIds([]);
    setMatchedLabels([]);
    setMessage('');
  };

  const selectCard = (card: MatchCard) => {
    if (selectedIds.includes(card.id) || matchedLabels.includes(card.label)) {
      return;
    }

    const nextSelectedIds = [...selectedIds, card.id];
    setSelectedIds(nextSelectedIds);

    if (nextSelectedIds.length < 2) {
      setMessage('한 장 더 선택하세요');
      return;
    }

    const [firstId, secondId] = nextSelectedIds;
    const firstCard = cards.find(nextCard => nextCard.id === firstId);
    const secondCard = cards.find(nextCard => nextCard.id === secondId);

    if (firstCard && secondCard && firstCard.label === secondCard.label) {
      const nextMatchedLabels = [...matchedLabels, firstCard.label];
      setMatchedLabels(nextMatchedLabels);
      setSelectedIds([]);
      setMessage(nextMatchedLabels.length === matchCardLabels.length ? '모든 카드를 찾았습니다' : '정답입니다');
      return;
    }

    setMessage('다른 카드입니다');
    setTimeout(() => {
      setSelectedIds([]);
      setMessage('다시 찾아보세요');
    }, 650);
  };

  return (
    <View style={styles.practicePanel}>
      <View style={styles.practiceHeaderRow}>
        <Text style={styles.practiceTitle}>기억 연습</Text>
        <AnimatedPressable accessibilityRole="button" onPress={reset} style={styles.resetButton}>
          <Text style={styles.resetButtonText}>다시 섞기</Text>
        </AnimatedPressable>
      </View>
      <View style={styles.matchGrid}>
        {cards.map(card => {
          const open = selectedIds.includes(card.id) || matchedLabels.includes(card.label);

          return (
            <AnimatedPressable
              key={card.id}
              accessibilityRole="button"
              onPress={() => selectCard(card)}
              style={[styles.matchCard, open && styles.matchCardOpen]}>
              {open ? <Text style={styles.matchCardText}>{card.label}</Text> : null}
            </AnimatedPressable>
          );
        })}
      </View>
      {message ? <Text style={styles.practiceResult}>{message}</Text> : null}
    </View>
  );
}

function TypingPractice(): JSX.Element {
  const [typedText, setTypedText] = useState('');
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [completedSeconds, setCompletedSeconds] = useState<number | null>(null);
  const isExact = typedText === typingSentence;

  const updateText = (nextText: string) => {
    const nextStartedAt = startedAt ?? Date.now();
    setStartedAt(nextStartedAt);
    setTypedText(nextText);

    if (nextText === typingSentence && completedSeconds === null) {
      setCompletedSeconds((Date.now() - nextStartedAt) / 1000);
    }
  };

  const reset = () => {
    setTypedText('');
    setStartedAt(null);
    setCompletedSeconds(null);
  };

  return (
    <View style={styles.practicePanel}>
      <View style={styles.practiceHeaderRow}>
        <Text style={styles.practiceTitle}>입력 연습</Text>
        <AnimatedPressable accessibilityRole="button" onPress={reset} style={styles.resetButton}>
          <Text style={styles.resetButtonText}>초기화</Text>
        </AnimatedPressable>
      </View>
      <Text style={styles.typingTarget}>{typingSentence}</Text>
      <TextInput
        autoCapitalize="none"
        autoCorrect={false}
        onChangeText={updateText}
        placeholder="문장을 그대로 입력하세요"
        placeholderTextColor="#777777"
        selectionColor="#E50914"
        style={[styles.typingInput, isExact && styles.typingInputComplete]}
        value={typedText}
      />
      <Text style={styles.practiceResult}>
        {completedSeconds !== null
          ? `완료 ${completedSeconds.toFixed(1)}초`
          : typedText.length > 0
          ? isExact
            ? '완료'
            : '입력 중'
          : '문장을 입력해보세요'}
      </Text>
    </View>
  );
}

function PracticeContent({gameId}: {gameId: PracticeGameId}): JSX.Element {
  if (gameId === 1) {
    return <RpsPractice />;
  }

  if (gameId === 2) {
    return <MatchPractice />;
  }

  return <TypingPractice />;
}

export function CoinBattleGuideScreen(): JSX.Element {
  const navigation = useNavigation<NativeStackNavigationProp<CoinBattleStackParamList>>();
  const [selectedGameId, setSelectedGameId] = useState<PracticeGameId>(1);
  const selectedGame = useMemo(() => {
    return guideGames.find(game => game.id === selectedGameId) ?? guideGames[0];
  }, [selectedGameId]);

  return (
    <TabSceneTransition>
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="light-content" backgroundColor="#000000" />
        <AppGnb />
        <ScrollView bounces={false} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.headerRow}>
            <AnimatedPressable accessibilityRole="button" onPress={() => navigation.goBack()} style={styles.backButton}>
              <Image source={icon.backBtn} style={styles.backIcon} />
            </AnimatedPressable>
            <View style={styles.headerText}>
              <Text style={styles.title}>게임 연습</Text>
              <Text style={styles.subtitle}>규칙을 보고 한 번씩 눌러볼 수 있어요</Text>
            </View>
            <View style={styles.backButton} />
          </View>

          <View style={styles.tabRow}>
            {guideGames.map(game => {
              const active = selectedGame.id === game.id;

              return (
                <AnimatedPressable
                  key={game.id}
                  accessibilityRole="button"
                  onPress={() => setSelectedGameId(game.id)}
                  style={[styles.tabButton, active && styles.tabButtonActive]}>
                  <Text style={[styles.tabText, active && styles.tabTextActive]}>{game.title}</Text>
                </AnimatedPressable>
              );
            })}
          </View>

          <View style={styles.summaryBand}>
            <Text style={styles.gameTitle}>{selectedGame.title}</Text>
            <Text style={styles.summaryText}>{selectedGame.summary}</Text>
            <View style={styles.roundBadge}>
              <Text style={styles.roundBadgeText}>최대 {selectedGame.maxRoundCount}라운드</Text>
            </View>
          </View>

          <View style={styles.ruleList}>
            {selectedGame.rules.map((rule, index) => (
              <View key={rule} style={styles.ruleRow}>
                <Text style={styles.ruleIndex}>{index + 1}.</Text>
                <Text style={styles.ruleText}>{rule}</Text>
              </View>
            ))}
          </View>

          <PracticeContent gameId={selectedGame.id} />
        </ScrollView>
      </SafeAreaView>
    </TabSceneTransition>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#000000',
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 0,
    paddingBottom: 36,
  },
  headerRow: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: {
    width: 24,
    height: 24,
    resizeMode: 'contain',
  },
  headerText: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  title: {
    color: '#FFFFFF',
    ...FONTS.font22B,
    lineHeight: 29,
  },
  subtitle: {
    color: '#A5A7AE',
    ...FONTS.font13M,
    lineHeight: 18,
    marginTop: 3,
  },
  tabRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 18,
  },
  tabButton: {
    minHeight: 38,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#252525',
    backgroundColor: '#111114',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  tabButtonActive: {
    backgroundColor: '#E50914',
    borderColor: '#E50914',
  },
  tabText: {
    color: '#D7D7D7',
    ...FONTS.font13B,
    lineHeight: 18,
  },
  tabTextActive: {
    color: '#FFFFFF',
  },
  summaryBand: {
    marginTop: 18,
    padding: 18,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#252525',
    backgroundColor: '#171717',
  },
  gameTitle: {
    color: '#FFFFFF',
    ...FONTS.font20B,
    lineHeight: 26,
  },
  summaryText: {
    color: '#C9CBD1',
    ...FONTS.font14M,
    lineHeight: 20,
    marginTop: 8,
  },
  roundBadge: {
    alignSelf: 'flex-start',
    height: 28,
    borderRadius: 8,
    backgroundColor: '#252525',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    marginTop: 12,
  },
  roundBadgeText: {
    color: '#FFFFFF',
    ...FONTS.font12B,
    lineHeight: 16,
  },
  ruleList: {
    marginTop: 20,
    gap: 12,
  },
  ruleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  ruleIndex: {
    width: 24,
    color: '#8E929B',
    ...FONTS.font14B,
    lineHeight: 20,
    marginRight: 4,
  },
  ruleText: {
    flex: 1,
    color: '#D8DAE0',
    ...FONTS.font14M,
    lineHeight: 20,
  },
  practicePanel: {
    marginTop: 22,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#252525',
    backgroundColor: '#171717',
    padding: 16,
  },
  practiceHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  practiceTitle: {
    color: '#FFFFFF',
    ...FONTS.font16B,
    lineHeight: 22,
  },
  resetButton: {
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2D2D2D',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  resetButtonText: {
    color: '#DADADA',
    ...FONTS.font12B,
    lineHeight: 16,
  },
  rpsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  rpsButton: {
    flex: 1,
    minHeight: 108,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2D2D2D',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  rpsImage: {
    width: 48,
    height: 48,
    marginBottom: 8,
  },
  practiceButtonActive: {
    borderColor: '#E50914',
    backgroundColor: 'rgba(229,9,20,0.16)',
  },
  practiceButtonText: {
    color: '#D9D9D9',
    ...FONTS.font13B,
    lineHeight: 18,
  },
  practiceButtonTextActive: {
    color: '#FFFFFF',
  },
  practiceResult: {
    color: '#BFC1C8',
    ...FONTS.font13M,
    lineHeight: 18,
    marginTop: 12,
  },
  matchGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  matchCard: {
    width: '30.8%',
    height: 96,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2D2D2D',
    backgroundColor: '#111114',
    alignItems: 'center',
    justifyContent: 'center',
  },
  matchCardOpen: {
    borderColor: '#E50914',
    backgroundColor: '#E50914',
  },
  matchCardText: {
    color: '#FFFFFF',
    ...FONTS.font30B,
    lineHeight: 36,
    textAlign: 'center',
  },
  typingTarget: {
    marginTop: 12,
    color: '#FFFFFF',
    ...FONTS.font17B,
    lineHeight: 24,
  },
  typingInput: {
    minHeight: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2D2D2D',
    backgroundColor: '#111114',
    color: '#FFFFFF',
    ...FONTS.font14M,
    paddingHorizontal: 12,
    marginTop: 12,
  },
  typingInputComplete: {
    borderColor: '#E50914',
  },
});
