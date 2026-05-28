import type {ImageSourcePropType} from 'react-native';

type IconMap = {
  backBtn: ImageSourcePropType;
  battle: ImageSourcePropType;
  closeBtn: ImageSourcePropType;
  coin: ImageSourcePropType;
  commentOutline: ImageSourcePropType;
  feed: ImageSourcePropType;
  heartFilled: ImageSourcePropType;
  heartOutline: ImageSourcePropType;
  home: ImageSourcePropType;
  vs: ImageSourcePropType;
};

export const icon: IconMap = {
  backBtn: require('./backBtn.png'),
  battle: require('./battle.png'),
  closeBtn: require('./closeBtn.png'),
  coin: require('./coin.png'),
  commentOutline: require('./comment_outline_icon.png'),
  feed: require('./feed.png'),
  heartFilled: require('./heart_filled_icon.png'),
  heartOutline: require('./heart_outline_icon.png'),
  home: require('./home.png'),
  vs: require('./vs.png'),
};
