import React, {useEffect, useRef} from 'react';
import {Animated, Dimensions, Image, StyleSheet, Text, View, type ImageSourcePropType} from 'react-native';
import {image} from '../../assets/images';
import {AnimatedPressable} from '../../components/AnimatedPressable';
import {FONTS} from '../../constants/theme';

const {width: SCREEN_WIDTH, height: SCREEN_HEIGHT} = Dimensions.get('window');
const MAIN_POSTER_CARD_WIDTH = 327;
const MAIN_POSTER_CARD_HEIGHT = 474;
const MAIN_POSTER_ASPECT_RATIO = MAIN_POSTER_CARD_WIDTH / MAIN_POSTER_CARD_HEIGHT;
const EXECUTIVE_POSTER_MAX_HEIGHT = Math.min(MAIN_POSTER_CARD_HEIGHT, Math.max(330, SCREEN_HEIGHT * 0.48));
const EXECUTIVE_POSTER_MAX_WIDTH = Math.min(MAIN_POSTER_CARD_WIDTH, SCREEN_WIDTH - 56);
const EXECUTIVE_POSTER_CARD_WIDTH = Math.round(
  Math.min(EXECUTIVE_POSTER_MAX_WIDTH, EXECUTIVE_POSTER_MAX_HEIGHT * MAIN_POSTER_ASPECT_RATIO),
);
const EXECUTIVE_POSTER_CARD_HEIGHT = Math.round(EXECUTIVE_POSTER_CARD_WIDTH / MAIN_POSTER_ASPECT_RATIO);
const EXECUTIVE_VOTE_BUTTON_HEIGHT = 54;

export const EXECUTIVE_SELECTOR_STAGE_HEIGHT = EXECUTIVE_POSTER_CARD_HEIGHT;

export type ExecutiveSelectorProfile = {
  department?: string;
  imageSource?: ImageSourcePropType;
  name: string;
};

export type ExecutiveVoteOption = {
  id: string;
};

type ExecutivePredictionSelectorProps = {
  profile: ExecutiveSelectorProfile;
};

type ExecutivePredictionVoteButtonsProps<T extends ExecutiveVoteOption> = {
  employeeTeam: T | null;
  executiveTeam: T | null;
  onVote: (team: T | null) => void;
  selectedTeamId: string;
};

const executiveImageByName: Record<string, ImageSourcePropType> = {
  김보람: image.executiveKimBoRam,
  김형석: image.executiveKimHyungSeok,
  박성호: image.executiveParkSungHo,
  추연진: image.executiveChooYeonJin,
  추종원: image.executiveChooJongWon,
  이준석: image.executiveLeeJoonSuck,
  강성구: image.executiveKangSungGoo,
};

function splitProfileText(profile: ExecutiveSelectorProfile): {department?: string; name: string} {
  const rawName = profile.name.trim();
  const wrappedDepartmentMatch =
    rawName.match(/^(.+?)\s*\(\s*([^)]+)\s*\)$/) ?? rawName.match(/^(.+?)\s*\[\s*([^\]]+)\s*\]$/);

  if (wrappedDepartmentMatch) {
    return {
      department: profile.department?.trim() || wrappedDepartmentMatch[2].trim(),
      name: wrappedDepartmentMatch[1].trim(),
    };
  }

  const compactDepartmentMatch =
    rawName.match(/^([가-힣]{3})(.+(?:부문|본부|팀|실|센터|그룹|파트|담당|장).*)$/) ??
    rawName.match(/^([가-힣]{2})(.+(?:부문|본부|팀|실|센터|그룹|파트|담당|장).*)$/) ??
    rawName.match(/^([가-힣]{4})([A-Za-z0-9].+(?:부문|본부|팀|실|센터|그룹|파트|담당|장).*)$/);

  if (compactDepartmentMatch) {
    return {
      department: profile.department?.trim() || compactDepartmentMatch[2].trim(),
      name: compactDepartmentMatch[1].trim(),
    };
  }

  return {
    department: profile.department?.trim(),
    name: rawName,
  };
}

function getExecutiveImageSource(profile: ExecutiveSelectorProfile, name: string): ImageSourcePropType {
  return executiveImageByName[name.replace(/\s/g, '')] ?? profile.imageSource ?? image.human;
}

export function ExecutivePredictionSelector({profile}: ExecutivePredictionSelectorProps): JSX.Element {
  const entranceProgress = useRef(new Animated.Value(0)).current;
  const profileText = splitProfileText(profile);
  const executiveImageSource = getExecutiveImageSource(profile, profileText.name);

  useEffect(() => {
    entranceProgress.setValue(0);
    Animated.spring(entranceProgress, {
      toValue: 1,
      friction: 8,
      tension: 72,
      useNativeDriver: true,
    }).start();
  }, [entranceProgress, profileText.name]);

  return (
    <View style={styles.wrap}>
      <Animated.View
        style={[
          styles.imageStage,
          {
            opacity: entranceProgress,
            transform: [
              {
                translateY: entranceProgress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [18, 0],
                }),
              },
              {
                scale: entranceProgress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.96, 1],
                }),
              },
            ],
          },
        ]}>
        <Image resizeMode="contain" source={executiveImageSource} style={styles.directProfileImage} />
      </Animated.View>
    </View>
  );
}

export function ExecutivePredictionVoteButtons<T extends ExecutiveVoteOption>({
  employeeTeam,
  executiveTeam,
  onVote,
  selectedTeamId,
}: ExecutivePredictionVoteButtonsProps<T>): JSX.Element {
  const entranceProgress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    entranceProgress.setValue(0);
    Animated.timing(entranceProgress, {
      toValue: 1,
      duration: 360,
      useNativeDriver: true,
    }).start();
  }, [entranceProgress, employeeTeam?.id, executiveTeam?.id]);

  const leftButtonStyle = {
    opacity: entranceProgress.interpolate({
      inputRange: [0, 0.4, 1],
      outputRange: [0, 0, 1],
    }),
    transform: [
      {
        translateY: entranceProgress.interpolate({
          inputRange: [0, 1],
          outputRange: [12, 0],
        }),
      },
    ],
  };
  const rightButtonStyle = {
    opacity: entranceProgress.interpolate({
      inputRange: [0, 0.58, 1],
      outputRange: [0, 0, 1],
    }),
    transform: [
      {
        translateY: entranceProgress.interpolate({
          inputRange: [0, 1],
          outputRange: [12, 0],
        }),
      },
    ],
  };

  return (
    <View style={styles.voteButtonRow}>
      <Animated.View style={[styles.voteButtonLift, leftButtonStyle]}>
        <AnimatedPressable
          accessibilityLabel="임원이 승리한다 O"
          accessibilityRole="button"
          disabled={!executiveTeam}
          onPress={() => onVote(executiveTeam)}
          style={[
            styles.voteButton,
            executiveTeam?.id === selectedTeamId && styles.voteButtonSelected,
            !executiveTeam && styles.voteButtonDisabled,
          ]}>
          <Text style={[styles.voteButtonMark, !executiveTeam && styles.voteButtonMarkDisabled]}>승리</Text>
        </AnimatedPressable>
      </Animated.View>
      <Animated.View style={[styles.voteButtonLift, rightButtonStyle]}>
        <AnimatedPressable
          accessibilityLabel="일반사원이 승리한다 X"
          accessibilityRole="button"
          disabled={!employeeTeam}
          onPress={() => onVote(employeeTeam)}
          style={[
            styles.voteButton,
            employeeTeam?.id === selectedTeamId && styles.voteButtonSelected,
            !employeeTeam && styles.voteButtonDisabled,
          ]}>
          <Text style={[styles.voteButtonMark, !employeeTeam && styles.voteButtonMarkDisabled]}>패배</Text>
        </AnimatedPressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  imageStage: {
    height: EXECUTIVE_POSTER_CARD_HEIGHT,
    width: EXECUTIVE_POSTER_CARD_WIDTH,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  directProfileImage: {
    width: '100%',
    height: '100%',
  },
  voteButtonRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  voteButtonLift: {
    flex: 1,
  },
  voteButton: {
    height: EXECUTIVE_VOTE_BUTTON_HEIGHT,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: '#242428',
  },
  voteButtonSelected: {
    backgroundColor: '#E50914',
    borderColor: 'rgba(255,255,255,0.14)',
  },
  voteButtonDisabled: {
    backgroundColor: '#242428',
  },
  voteButtonMark: {
    color: '#FFFFFF',
    ...FONTS.font16B,
    lineHeight: 21,
  },
  voteButtonMarkDisabled: {
    color: '#777A82',
  },
});
