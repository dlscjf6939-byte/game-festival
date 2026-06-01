import type {ImageSourcePropType} from 'react-native';
import {image} from '../assets/images';

export type HighlightItem = {
  id: string;
  image: ImageSourcePropType;
  title: string;
  description: string;
  time: string;
};

export type HighlightGroup = {
  id: string;
  label: string;
  cover: ImageSourcePropType;
  items: HighlightItem[];
};

export type FeedComment = {
  id: string;
  user: string;
  text: string;
  time: string;
};

export type FeedPost = {
  commentCount?: number;
  id: string;
  isLiked?: boolean;
  user: string;
  role: string;
  avatar: ImageSourcePropType;
  image?: ImageSourcePropType;
  images?: ImageSourcePropType[];
  title: string;
  caption: string;
  hashtags: string[];
  time: string;
  likes: number;
  comments: FeedComment[];
};

const commentUsers = ['이인철', '김소진', '길기환', '박민준', '정다은', '최유진', '한민수', '윤서연'];
const commentTexts = [
  '현장감 제대로네요.',
  '오늘 경기 너무 기대됩니다.',
  '사진만 봐도 분위기 미쳤어요.',
  '응원석 열기가 여기까지 느껴집니다.',
  '다음 경기 라인업도 궁금해요.',
  '이 장면은 저장해야겠네요.',
  '무대 연출 진짜 좋습니다.',
  '결승전 분위기 완전 제대로예요.',
];

function makeComments(postId: string, firstComments: FeedComment[], count: number): FeedComment[] {
  const generatedComments = Array.from({length: count - firstComments.length}, (_, index) => {
    const displayIndex = index + firstComments.length + 1;

    return {
      id: `${postId}-comment-${displayIndex}`,
      user: commentUsers[index % commentUsers.length],
      text: commentTexts[index % commentTexts.length],
      time: `${displayIndex + 2}분 전`,
    };
  });

  return [...firstComments, ...generatedComments];
}

export const highlightGroups: HighlightGroup[] = [
  {
    id: 'lol-champions',
    label: 'LoL 결승',
    cover: image.gameFestival1,
    items: [
      {
        id: 'lol-champions-stage',
        image: image.gameFestival1,
        title: '챔피언 탄생의 순간',
        description: '우승 트로피와 함께 마무리된 LoL 챔피언십 결승전.',
        time: '12분 전',
      },
      {
        id: 'lol-champions-photo',
        image: image.gameFestival1,
        title: '우승팀 단체 포토',
        description: '무대 조명 아래에서 남긴 오늘의 대표 장면.',
        time: '21분 전',
      },
    ],
  },
  {
    id: 't1-geng',
    label: 'T1 vs GEN',
    cover: image.gameFestival2,
    items: [
      {
        id: 't1-geng-opening',
        image: image.gameFestival2,
        title: '결승전 오프닝',
        description: '관중석을 가득 채운 응원봉과 함께 시작된 빅매치.',
        time: '방금 전',
      },
      {
        id: 't1-geng-crowd',
        image: image.gameFestival2,
        title: '응원석 풀하우스',
        description: 'T1과 GEN.G 팬들의 함성이 경기장 전체를 채웠습니다.',
        time: '8분 전',
      },
    ],
  },
  {
    id: 'university',
    label: '대학리그',
    cover: image.gameFestival3,
    items: [
      {
        id: 'university-selection',
        image: image.gameFestival3,
        title: '영남권 대표 선발전',
        description: '대학리그 본선을 향한 지역 대표 선발전 현장.',
        time: '28분 전',
      },
      {
        id: 'university-booth',
        image: image.gameFestival3,
        title: '선수석 세팅 완료',
        description: '경기 전 장비 점검과 리허설이 차분하게 진행됐습니다.',
        time: '35분 전',
      },
    ],
  },
  {
    id: 'crowd',
    label: '응원석',
    cover: image.gameFestival2,
    items: [
      {
        id: 'crowd-wide',
        image: image.gameFestival2,
        title: '경기장 전체가 한눈에',
        description: '무대, 선수석, 관중석이 모두 들어온 결승전 와이드샷.',
        time: '42분 전',
      },
      {
        id: 'crowd-lightstick',
        image: image.gameFestival2,
        title: '응원봉 물결',
        description: '오프닝 순간 객석에서 동시에 올라온 응원봉.',
        time: '51분 전',
      },
    ],
  },
  {
    id: 'starcraft',
    label: '스타전',
    cover: image.starcraft,
    items: [
      {
        id: 'starcraft-pick',
        image: image.starcraft,
        title: '스타크래프트 인기 픽',
        description: '승부예측 참여율이 빠르게 올라가고 있어요.',
        time: '1시간 전',
      },
    ],
  },
];

export const feedPosts: FeedPost[] = [
  {
    id: 'main-event',
    user: 'LoL Champions',
    role: '공식 중계팀',
    avatar: image.logo,
    image: image.gameFestival1,
    title: 'Lenovo Intel LoL Champions 우승팀 공개',
    caption:
      '무대 위 confetti가 터지고 우승 트로피가 올라간 순간입니다. 긴 결승전을 끝낸 선수들이 챔피언 보드와 함께 마지막 단체 사진을 남겼어요.',
    hashtags: ['#LoLChampions', '#우승팀', '#결승전', '#현장포토'],
    time: '방금 전',
    likes: 248,
    comments: makeComments(
      'main-event',
      [
        {id: 'main-event-comment-1', user: '이인철', text: '우승 세리머니 사진 진짜 멋지네요.', time: '방금 전'},
        {id: 'main-event-comment-2', user: '김소진', text: '무대 조명까지 완전 결승전 느낌.', time: '2분 전'},
        {id: 'main-event-comment-3', user: '길기환', text: '트로피 든 장면 저장각입니다.', time: '5분 전'},
      ],
      64,
    ),
  },
  {
    id: 'arena-final',
    user: 'Esports Arena',
    role: '현장 운영팀',
    avatar: image.profile,
    image: image.gameFestival2,
    title: 'T1 vs GEN.G 결승전, 경기장 만석',
    caption:
      '오프닝부터 관중석이 꽉 찼습니다. 중앙 무대와 4면 스크린, 객석 응원봉까지 한 번에 잡힌 오늘의 와이드샷입니다.',
    hashtags: ['#T1', '#GENG', '#결승전', '#풀하우스'],
    time: '12분 전',
    likes: 186,
    comments: makeComments(
      'arena-final',
      [
        {id: 'arena-final-comment-1', user: '김소진', text: '관중석 규모 미쳤네요.', time: '9분 전'},
        {id: 'arena-final-comment-2', user: '이인철', text: 'T1 GEN.G 매치면 이 정도는 돼야죠.', time: '11분 전'},
      ],
      58,
    ),
  },
  {
    id: 'university-league',
    user: 'University League',
    role: '대회 사무국',
    avatar: image.profile,
    image: image.gameFestival3,
    title: '영남권 대표 선발전 무대 리허설',
    caption:
      '대학리그 2022 영남권 대표 선발전이 곧 시작됩니다. 선수석과 중계석 세팅을 마치고 마지막 리허설을 진행 중이에요.',
    hashtags: ['#대학리그', '#대표선발전', '#리허설', '#e스포츠'],
    time: '28분 전',
    likes: 132,
    comments: makeComments(
      'university-league',
      [
        {id: 'university-league-comment-1', user: '길기환', text: '대학리그 무대도 생각보다 본격적이네요.', time: '18분 전'},
        {id: 'university-league-comment-2', user: '김소진', text: '선발전 라인업 궁금합니다.', time: '22분 전'},
      ],
      52,
    ),
  },
];
