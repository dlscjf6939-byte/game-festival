import type {ImageSourcePropType} from 'react-native';

type ImageMap = {
  crazyarcade: ImageSourcePropType;
  crazyarcadeLetter: ImageSourcePropType;
  // coinBattle: ImageSourcePropType;
  homeBanner: ImageSourcePropType;
  logo: ImageSourcePropType;
  poster: ImageSourcePropType;
  profile: ImageSourcePropType;
  qrCode: ImageSourcePropType;
  starcraft: ImageSourcePropType;
  starcraftLetter: ImageSourcePropType;
  tekken: ImageSourcePropType;
  tekkenLetter: ImageSourcePropType;
  noti: ImageSourcePropType;
  paper: ImageSourcePropType;
  rock: ImageSourcePropType;
  scissor: ImageSourcePropType;
  tekken7: ImageSourcePropType;
};

export const image: ImageMap = {
  crazyarcade: require('./crazyarcade.png'),
  crazyarcadeLetter: require('./crazyarcade_letter.png'),
  // coinBattle: require('./코인대전.png'),
  homeBanner: require('./home-banner.png'),
  logo: require('./logo.png'),
  poster: require('./poster.png'),
  profile: require('./profile.png'),
  qrCode: require('./qrCode.png'),
  starcraft: require('./starcraft.png'),
  starcraftLetter: require('./starcraft_letter.png'),
  tekken: require('./tekken.png'),
  tekkenLetter: require('./tekken_letter.png'),
  noti: require('./noti.png'),
  paper: require('./paper.png'),
  rock: require('./rock.png'),
  scissor: require('./scissor.png'),
  tekken7: require('./tekken7.png'),
};
