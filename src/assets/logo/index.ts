import type {ImageSourcePropType} from 'react-native';

type LogoMap = {
  boongkwon: ImageSourcePropType;
  gwantaekdong: ImageSourcePropType;
};

export const logo: LogoMap = {
  boongkwon: require('./boongkwon.png'),
  gwantaekdong: require('./gwantaekdong.png'),
};
