import React from 'react';
import {Dimensions, Image, StyleSheet, Text, View, type ImageSourcePropType} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
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
const EXECUTIVE_VOTE_BUTTON_GAP = 12;

export const EXECUTIVE_SELECTOR_STAGE_HEIGHT =
  EXECUTIVE_POSTER_CARD_HEIGHT + EXECUTIVE_VOTE_BUTTON_HEIGHT + EXECUTIVE_VOTE_BUTTON_GAP;

export type ExecutiveSelectorProfile = {
  department?: string;
  imageSource?: ImageSourcePropType;
  name: string;
};

export type ExecutiveVoteOption = {
  id: string;
};

type ExecutivePredictionSelectorProps<T extends ExecutiveVoteOption> = {
  employeeTeam: T | null;
  executiveTeam: T | null;
  onVote: (team: T | null) => void;
  profile: ExecutiveSelectorProfile;
  selectedTeamId: string;
};

function splitProfileText(profile: ExecutiveSelectorProfile): {department?: string; name: string} {
  const rawName = profile.name.trim();
  const wrappedDepartmentMatch = rawName.match(/^(.+?)\s*[\(\[]\s*([^\)\]]+)\s*[\)\]]$/);

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

export function ExecutivePredictionSelector<T extends ExecutiveVoteOption>({
  employeeTeam,
  executiveTeam,
  onVote,
  profile,
  selectedTeamId,
}: ExecutivePredictionSelectorProps<T>): JSX.Element {
  const profileText = splitProfileText(profile);

  return (
    <View style={styles.wrap}>
      <View style={styles.cardShell}>
        <View style={styles.posterCard}>
          <Image blurRadius={22} resizeMode="cover" source={image.poster2} style={styles.posterBackgroundImage} />
          <View style={styles.posterBackgroundWash} />
          <LinearGradient
            pointerEvents="none"
            colors={['rgba(229,9,20,0.52)', 'rgba(229,9,20,0.07)', 'rgba(0,0,0,0)']}
            start={{x: 0, y: 0}}
            end={{x: 1, y: 1}}
            style={styles.posterRedSweep}
          />
          <LinearGradient
            pointerEvents="none"
            colors={['rgba(0,0,0,0.1)', 'rgba(0,0,0,0.82)']}
            locations={[0.42, 1]}
            style={styles.posterBottomFade}
          />
          <View pointerEvents="none" style={styles.posterVignette} />
          <View pointerEvents="none" style={styles.profileNameBadge}>
            <Text numberOfLines={1} adjustsFontSizeToFit style={styles.profileName}>
              {profileText.department ? `${profileText.name} / ${profileText.department}` : profileText.name}
            </Text>
          </View>
          {profile.imageSource ? (
            <Image resizeMode="contain" source={profile.imageSource} style={styles.profileImage} />
          ) : (
            <View style={styles.profilePlaceholder}>
              <Text style={styles.profileInitial}>{profileText.name.slice(0, 1)}</Text>
            </View>
          )}
          <View pointerEvents="none" style={styles.posterNoise} />
        </View>
      </View>

      <View style={styles.voteButtonRow}>
        <AnimatedPressable
          accessibilityLabel="임원이 승리한다 O"
          accessibilityRole="button"
          disabled={!executiveTeam}
          onPress={() => onVote(executiveTeam)}
          style={[
            styles.voteButton,
            styles.voteButtonO,
            executiveTeam?.id === selectedTeamId && styles.voteButtonSelected,
            !executiveTeam && styles.voteButtonDisabled,
          ]}>
          <Text style={[styles.voteButtonMark, !executiveTeam && styles.voteButtonMarkDisabled]}>O</Text>
        </AnimatedPressable>
        <AnimatedPressable
          accessibilityLabel="일반사원이 승리한다 X"
          accessibilityRole="button"
          disabled={!employeeTeam}
          onPress={() => onVote(employeeTeam)}
          style={[
            styles.voteButton,
            styles.voteButtonX,
            employeeTeam?.id === selectedTeamId && styles.voteButtonSelected,
            !employeeTeam && styles.voteButtonDisabled,
          ]}>
          <Text style={[styles.voteButtonMark, !employeeTeam && styles.voteButtonMarkDisabled]}>X</Text>
        </AnimatedPressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    gap: EXECUTIVE_VOTE_BUTTON_GAP,
  },
  cardShell: {
    height: EXECUTIVE_POSTER_CARD_HEIGHT,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  posterCard: {
    width: EXECUTIVE_POSTER_CARD_WIDTH,
    height: EXECUTIVE_POSTER_CARD_HEIGHT,
    borderRadius: 12,
    backgroundColor: '#171717',
    borderWidth: 1,
    borderColor: '#E5091455',
    overflow: 'hidden',
    position: 'relative',
  },
  posterBackgroundImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  posterBackgroundWash: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.62)',
  },
  posterRedSweep: {
    position: 'absolute',
    top: -20,
    left: -18,
    width: EXECUTIVE_POSTER_CARD_WIDTH * 0.88,
    height: EXECUTIVE_POSTER_CARD_HEIGHT * 0.78,
    zIndex: 1,
  },
  posterBottomFade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: EXECUTIVE_POSTER_CARD_HEIGHT * 0.52,
    zIndex: 1,
  },
  posterVignette: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(0,0,0,0.12)',
    zIndex: 2,
  },
  profileImage: {
    position: 'absolute',
    right: -42,
    bottom: -10,
    width: '112%',
    height: '90%',
    zIndex: 5,
  },
  profilePlaceholder: {
    position: 'absolute',
    right: 28,
    bottom: 34,
    width: EXECUTIVE_POSTER_CARD_WIDTH * 0.58,
    height: EXECUTIVE_POSTER_CARD_WIDTH * 0.58,
    borderRadius: EXECUTIVE_POSTER_CARD_WIDTH * 0.29,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(24,24,28,0.9)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    zIndex: 5,
  },
  profileInitial: {
    color: '#FFFFFF',
    ...FONTS.font40B,
    lineHeight: 48,
  },
  profileNameBadge: {
    position: 'absolute',
    left: 16,
    top: 16,
    maxWidth: EXECUTIVE_POSTER_CARD_WIDTH - 32,
    paddingHorizontal: 14,
    paddingTop: 13,
    paddingBottom: 12,
    borderRadius: 9,
    backgroundColor: 'rgba(8,8,10,0.7)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    zIndex: 7,
  },
  profileName: {
    maxWidth: EXECUTIVE_POSTER_CARD_WIDTH - 60,
    color: '#FFFFFF',
    textAlign: 'left',
    ...FONTS.font20B,
    lineHeight: 24,
  },
  posterNoise: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.035)',
    zIndex: 6,
  },
  voteButtonRow: {
    flexDirection: 'row',
    gap: 12,
    width: EXECUTIVE_POSTER_CARD_WIDTH,
  },
  voteButton: {
    flex: 1,
    height: EXECUTIVE_VOTE_BUTTON_HEIGHT,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  voteButtonSelected: {
    borderColor: '#FFFFFF',
    borderWidth: 2,
  },
  voteButtonO: {
    backgroundColor: '#E50914',
  },
  voteButtonX: {
    backgroundColor: '#242428',
  },
  voteButtonDisabled: {
    backgroundColor: '#242428',
  },
  voteButtonMark: {
    color: '#FFFFFF',
    ...FONTS.font24B,
    lineHeight: 30,
  },
  voteButtonMarkDisabled: {
    color: '#777A82',
  },
});
