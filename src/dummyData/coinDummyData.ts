export type CoinHistory = {
  id: string;
  title: string;
  description: string;
  amount: number;
};

export type CoinRanking = {
  id: string;
  employeeId?: string;
  rank: number;
  name: string;
  team: string;
  coins: number;
  profileImageUri?: string | null;
  isMe: boolean;
};

const historyTemplates = [
  {title: '승부예측 참여', description: '철권7 결승전 TEAM RED 선택', amount: -2},
  {title: '출석 체크', description: '게임대회 현장 QR 출석 완료', amount: 1},
  {title: '이벤트 보상', description: '응원 댓글 미션 달성', amount: 3},
  {title: '코인대전 승리', description: '가위바위보 3라운드 승리 보상', amount: 5},
  {title: '코인대전 참가', description: '같은 카드 맞추기 참가 베팅', amount: -1},
  {title: '피드 참여', description: '현장스냅 댓글 참여 보상', amount: 2},
  {title: '승부예측 적중', description: '스타크래프트 라이벌전 예측 적중', amount: 6},
  {title: '기본 지급', description: '섹타나인 임직원 기본 코인', amount: 24},
];

const rankingNames = [
  '김소진',
  '길기환',
  '이인철',
  '박민준',
  '정다은',
  '최유진',
  '한민수',
  '윤서연',
  '장우빈',
  '오하늘',
  '문지호',
  '강다현',
];
const rankingTeams = ['서비스개발팀', '주니어보드', '운영팀', '디자인팀', '플랫폼팀', 'QA팀'];

export const coinHistories: CoinHistory[] = Array.from({length: 64}, (_, index) => {
  const template = historyTemplates[index % historyTemplates.length];

  return {
    id: `coin-history-${index + 1}`,
    title: template.title,
    description: template.description,
    amount: template.amount,
  };
});

export const coinRankings: CoinRanking[] = Array.from({length: 64}, (_, index) => {
  const rank = index + 1;

  return {
    id: `coin-ranking-${rank}`,
    rank,
    name: rankingNames[index % rankingNames.length],
    team: rankingTeams[index % rankingTeams.length],
    coins: Math.max(1, 72 - index - (index % 4)),
    isMe: rank === 3,
  };
});
