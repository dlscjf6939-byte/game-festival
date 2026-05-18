import type {ImageSourcePropType} from 'react-native';

type IconMap = {
  battle: ImageSourcePropType;
  coin: ImageSourcePropType;
  feed: ImageSourcePropType;
  home: ImageSourcePropType;
  vs: ImageSourcePropType;
};

export const icon: IconMap = {
  battle: require('./battle.png'),
  coin: require('./coin.png'),
  feed: require('./feed.png'),
  home: require('./home.png'),
  vs: require('./vs.png'),
};
