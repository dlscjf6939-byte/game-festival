import type {NavigatorScreenParams} from '@react-navigation/native';

export type MainStackParamList = {
  Home: undefined;
  Coins: undefined;
  Feed: undefined;
  CoinBattle: NavigatorScreenParams<CoinBattleStackParamList> | undefined;
  Prediction: undefined;
};

export type CoinBattleStackParamList = {
  CoinBattleHome: undefined;
  CoinBattleRoom: {
    game: string;
    host: string;
    isRealtime: boolean;
    roomId: string;
    status: string;
    title: string;
  };
};

export type PredictionStackParamList = {
  PredictionHome: undefined;
  PredictionDetail:
    | {
        cheerComment?: string;
        mode?: 'participated';
        selectedTeamId?: 'team-red' | 'team-black';
      }
    | undefined;
};

export type RootStackParamList = {
  Login: undefined;
  Main: NavigatorScreenParams<MainStackParamList> | undefined;
  ProfileSetup: undefined;
  QrScan: undefined;
};
