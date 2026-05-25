import type {ImageSourcePropType} from 'react-native';

type IconMap = {
  battle: ImageSourcePropType;
  coin: ImageSourcePropType;
  commentOutline: ImageSourcePropType;
  feed: ImageSourcePropType;
  heartFilled: ImageSourcePropType;
  heartOutline: ImageSourcePropType;
  home: ImageSourcePropType;
  vs: ImageSourcePropType;
};

export const icon: IconMap = {
  battle: require('./battle.png'),
  coin: require('./coin.png'),
  commentOutline: require('./comment_outline_icon.png'),
  feed: require('./feed.png'),
  heartFilled: require('./heart_filled_icon.png'),
  heartOutline: require('./heart_outline_icon.png'),
  home: require('./home.png'),
  vs: require('./vs.png'),
};
