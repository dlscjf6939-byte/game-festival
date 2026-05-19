import {Dimensions, Platform, type TextStyle} from 'react-native';

const {width, height} = Dimensions.get('window');

type FontWeightKey = 'B' | 'L' | 'M' | 'R' | 'T';
type FontSizeKey =
  | 10
  | 11
  | 12
  | 13
  | 14
  | 15
  | 16
  | 17
  | 18
  | 20
  | 22
  | 24
  | 26
  | 28
  | 30
  | 32
  | 34
  | 38
  | 40
  | 44
  | 68;
type FontTokenKey = `font${FontSizeKey}${FontWeightKey}`;

const fontFamily = {
  bold: 'NetflixSans-Bold',
  light: 'NetflixSans-Light',
  medium: 'NetflixSans-Medium',
  regular: 'NetflixSans-Regular',
} as const;

const weightFamilyByKey: Record<FontWeightKey, string> = {
  B: fontFamily.bold,
  L: fontFamily.light,
  M: fontFamily.medium,
  R: fontFamily.regular,
  T: fontFamily.light,
};

const fontSizes = [
  68,
  44,
  40,
  38,
  34,
  32,
  30,
  28,
  26,
  24,
  22,
  20,
  18,
  17,
  16,
  15,
  14,
  13,
  12,
  11,
  10,
] as const;
const fontWeights = ['R', 'M', 'B', 'L', 'T'] as const;

function createFontStyle(fontSize: FontSizeKey, weight: FontWeightKey): TextStyle {
  return {
    fontFamily: weightFamilyByKey[weight],
    fontSize,
    includeFontPadding: false,
  };
}

function createFontTokens(): Record<FontTokenKey, TextStyle> {
  return fontSizes.reduce((tokens, fontSize) => {
    fontWeights.forEach(weight => {
      tokens[`font${fontSize}${weight}` as FontTokenKey] = createFontStyle(fontSize, weight);
    });

    return tokens;
  }, {} as Record<FontTokenKey, TextStyle>);
}

export const COLORS = {
  background: '#000000',
  black: '#000000',
  error: '#F40D21',
  gray: '#898989',
  lightGray: '#F5F5F6',
  primary: '#F40D21',
  transparent: 'transparent',
  white: '#FFFFFF',
} as const;

export const SIZES = {
  base: 8,
  body1: 30,
  body2: 20,
  body3: 16,
  body4: 14,
  body5: 12,
  font: 14,
  h1: 30,
  h2: 22,
  h3: 20,
  h4: 18,
  h5: 12,
  height,
  largeTitle: 50,
  mediumTitle: 45,
  padding: 10,
  padding2: 12,
  radius: 30,
  smallTitle: 40,
  width,
} as const;

export const FONT_FAMILY = {
  ...fontFamily,
  default: fontFamily.regular,
  platform: Platform.select({
    android: fontFamily.regular,
    ios: fontFamily.regular,
    default: fontFamily.regular,
  }),
} as const;

export const FONTS = {
  body1: {fontFamily: fontFamily.regular, fontSize: SIZES.body1, includeFontPadding: false, lineHeight: 36},
  body2: {fontFamily: fontFamily.regular, fontSize: SIZES.body2, includeFontPadding: false, lineHeight: 33},
  body3: {fontFamily: fontFamily.regular, fontSize: SIZES.body3, includeFontPadding: false, lineHeight: 22},
  body4: {fontFamily: fontFamily.regular, fontSize: SIZES.body4, includeFontPadding: false, lineHeight: 22},
  body5: {fontFamily: fontFamily.regular, fontSize: SIZES.body5, includeFontPadding: false, lineHeight: 22},
  h1: {fontFamily: fontFamily.bold, fontSize: SIZES.h1, includeFontPadding: false, lineHeight: 36},
  h2: {fontFamily: fontFamily.bold, fontSize: SIZES.h2, includeFontPadding: false, lineHeight: 30},
  h3: {fontFamily: fontFamily.medium, fontSize: SIZES.h3, includeFontPadding: false, lineHeight: 22},
  h4: {fontFamily: fontFamily.medium, fontSize: SIZES.h4, includeFontPadding: false, lineHeight: 22},
  h5: {fontFamily: fontFamily.medium, fontSize: SIZES.h5, includeFontPadding: false, lineHeight: 22},
  largeTitle: {fontFamily: fontFamily.bold, fontSize: SIZES.largeTitle, includeFontPadding: false, lineHeight: 55},
  mediumTitle: {fontFamily: fontFamily.bold, fontSize: SIZES.mediumTitle, includeFontPadding: false, lineHeight: 55},
  smallTitle: {fontFamily: fontFamily.bold, fontSize: SIZES.smallTitle, includeFontPadding: false, lineHeight: 55},
  ...createFontTokens(),
} as const;

export const theme = {
  COLORS,
  FONT_FAMILY,
  FONTS,
  SIZES,
};

export default theme;
