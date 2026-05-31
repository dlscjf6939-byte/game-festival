import type {ImageSourcePropType} from 'react-native';

type LogoMap = {
  boongkwon: ImageSourcePropType;
  gwantaekdong: ImageSourcePropType;
};

export const logo: LogoMap = {
  boongkwon: require('./붕권-removebg-preview.png'),
  gwantaekdong: require('./관택동-removebg-preview.png'),
};
