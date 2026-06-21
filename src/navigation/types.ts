import type {NavigatorScreenParams} from '@react-navigation/native';

export type MainStackParamList = {
  Home: undefined;
  Coins: undefined;
  Feed: undefined;
  CoinBattle: NavigatorScreenParams<CoinBattleStackParamList> | undefined;
  Prediction: undefined;
};

export type CoinBattleStackParamList = {
  CoinBattleGuide: undefined;
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
  PredictionSelect: {
    gameId: number;
    gameTitle?: string;
  };
  PredictionDetail:
    | {
        cheerComment?: string;
        gameId?: number;
        gameTitle?: string;
        matchStatus?: string;
        matchId?: number;
        matchType?: string;
        mode?: 'participated';
        pickedParticipantId?: number;
        selectedTeamId?: string;
        startStep?: 'comment' | 'counting' | 'result';
      }
    | undefined;
};

export type RootStackParamList = {
  Login: undefined;
  Main: NavigatorScreenParams<MainStackParamList> | undefined;
  ProfileSetup: undefined;
  QrPaymentRequest: {
    qrValue: string;
  };
  QrScan: undefined;
};
