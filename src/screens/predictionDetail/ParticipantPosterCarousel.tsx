import React, {useCallback, useEffect, useRef} from 'react';
import {
  Animated,
  Dimensions,
  Image,
  StyleSheet,
  Text,
  View,
  type ImageSourcePropType,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import {AnimatedPressable} from '../../components/AnimatedPressable';
import {FONTS} from '../../constants/theme';

const {width: SCREEN_WIDTH, height: SCREEN_HEIGHT} = Dimensions.get('window');
const MAIN_POSTER_CARD_WIDTH = 327;
const MAIN_POSTER_CARD_HEIGHT = 474;
const MAIN_POSTER_ASPECT_RATIO = MAIN_POSTER_CARD_WIDTH / MAIN_POSTER_CARD_HEIGHT;
const PARTICIPANT_POSTER_MAX_HEIGHT = Math.min(MAIN_POSTER_CARD_HEIGHT, Math.max(240, SCREEN_HEIGHT * 0.38));
const PARTICIPANT_POSTER_MAX_WIDTH = Math.min(MAIN_POSTER_CARD_WIDTH, SCREEN_WIDTH - 48);
const PARTICIPANT_POSTER_CARD_WIDTH = Math.round(
  Math.min(PARTICIPANT_POSTER_MAX_WIDTH, PARTICIPANT_POSTER_MAX_HEIGHT * MAIN_POSTER_ASPECT_RATIO),
);
const PARTICIPANT_POSTER_CARD_HEIGHT = Math.round(PARTICIPANT_POSTER_CARD_WIDTH / MAIN_POSTER_ASPECT_RATIO);
const PARTICIPANT_POSTER_CARD_GAP = 18;
const PARTICIPANT_POSTER_ITEM_WIDTH = PARTICIPANT_POSTER_CARD_WIDTH + PARTICIPANT_POSTER_CARD_GAP;
const PARTICIPANT_POSTER_SNAP_INTERVAL = PARTICIPANT_POSTER_ITEM_WIDTH;
const PARTICIPANT_POSTER_SIDE_PADDING = (SCREEN_WIDTH - PARTICIPANT_POSTER_ITEM_WIDTH) / 2;

export const PARTICIPANT_POSTER_STAGE_HEIGHT = PARTICIPANT_POSTER_CARD_HEIGHT + 36;

export type PosterParticipant = {
  department?: string;
  id: string;
  imageSource?: ImageSourcePropType;
  isIndividual?: boolean;
  members: string[];
  name: string;
};

type ParticipantPosterText = {
  department: string;
  name: string;
};

type ParticipantPosterCarouselProps = {
  onSelectTeam: (teamId: string) => void;
  selectedTeamId: string;
  teams: PosterParticipant[];
};

function splitInlineDepartment(rawName: string): ParticipantPosterText | null {
  const compactMatch =
    rawName.match(/^([가-힣]{3})(.+(?:부문|본부|팀|실|센터|그룹|파트|담당|장).*)$/) ??
    rawName.match(/^([가-힣]{2})(.+(?:부문|본부|팀|실|센터|그룹|파트|담당|장).*)$/) ??
    rawName.match(/^([가-힣]{4})([A-Za-z0-9].+(?:부문|본부|팀|실|센터|그룹|파트|담당|장).*)$/);

  if (compactMatch) {
    return {
      department: compactMatch[2].trim(),
      name: compactMatch[1].trim(),
    };
  }

  const spacedMatch = rawName.match(/^(.+?)\s+(.+(?:부문|본부|팀|실|센터|그룹|파트|담당|장).*)$/);

  if (!spacedMatch) {
    return null;
  }

  return {
    department: spacedMatch[2].trim(),
    name: spacedMatch[1].trim(),
  };
}

function getParticipantPosterText(team: PosterParticipant): ParticipantPosterText {
  const rawName = team.name.trim();
  const rawDepartment = (team.department ?? (team.isIndividual ? team.members.join(' / ') : '')).trim();

  if (rawDepartment) {
    const name = rawName
      .replace(rawDepartment, '')
      .replace(/\(\s*\)|\[\s*\]|\s*[-/|·]\s*$/g, '')
      .trim();

    return {
      department: rawDepartment,
      name: name || rawName,
    };
  }

  const inlineDepartment = team.isIndividual ? splitInlineDepartment(rawName) : null;

  if (inlineDepartment) {
    return inlineDepartment;
  }

  return {
    department: team.members.join(' / '),
    name: rawName,
  };
}

export function ParticipantPosterCarousel({
  onSelectTeam,
  selectedTeamId,
  teams,
}: ParticipantPosterCarouselProps): JSX.Element {
  const scrollX = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!teams.length || teams.some(team => team.id === selectedTeamId)) {
      return;
    }

    onSelectTeam(teams[0].id);
  }, [onSelectTeam, selectedTeamId, teams]);

  const selectCenteredParticipantPoster = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (!teams.length) {
        return;
      }

      const offsetX = event.nativeEvent.contentOffset.x;
      const centeredIndex = Math.max(
        0,
        Math.min(teams.length - 1, Math.round(offsetX / PARTICIPANT_POSTER_SNAP_INTERVAL)),
      );
      const centeredTeam = teams[centeredIndex];

      if (centeredTeam && centeredTeam.id !== selectedTeamId) {
        onSelectTeam(centeredTeam.id);
      }
    },
    [onSelectTeam, selectedTeamId, teams],
  );

  const renderParticipantPosterCard = useCallback(
    ({item: team, index}: {item: PosterParticipant; index: number}) => {
      const inputRange = [
        (index - 1) * PARTICIPANT_POSTER_SNAP_INTERVAL,
        index * PARTICIPANT_POSTER_SNAP_INTERVAL,
        (index + 1) * PARTICIPANT_POSTER_SNAP_INTERVAL,
      ];
      const scale = scrollX.interpolate({
        inputRange,
        outputRange: [0.92, 1, 0.92],
        extrapolate: 'clamp',
      });
      const opacity = scrollX.interpolate({
        inputRange,
        outputRange: [0.72, 1, 0.72],
        extrapolate: 'clamp',
      });
      const translateY = scrollX.interpolate({
        inputRange,
        outputRange: [14, 0, 14],
        extrapolate: 'clamp',
      });
      const rotate = scrollX.interpolate({
        inputRange,
        outputRange: ['5deg', '0deg', '-5deg'],
        extrapolate: 'clamp',
      });
      const selectionRingOpacity = scrollX.interpolate({
        inputRange,
        outputRange: [0, 1, 0],
        extrapolate: 'clamp',
      });
      const posterText = getParticipantPosterText(team);

      return (
        <View style={styles.participantPosterItem}>
          <AnimatedPressable
            accessibilityRole="button"
            onPress={() => onSelectTeam(team.id)}
            style={styles.participantPosterPressable}>
            <Animated.View
              style={[
                styles.participantPosterCard,
                {
                  opacity,
                  transform: [{translateY}, {scale}, {rotate}],
                },
              ]}>
              <View style={styles.participantPosterFace}>
                {team.imageSource ? (
                  <Image resizeMode="cover" source={team.imageSource} style={styles.participantPosterImage} />
                ) : (
                  <View style={styles.participantPosterPlaceholder}>
                    <Text style={styles.participantPosterInitial}>{team.name.trim().slice(0, 1)}</Text>
                  </View>
                )}
                <View style={styles.participantPosterNoise} />
                <View pointerEvents="none" style={styles.participantPosterTextBlock}>
                  <Text numberOfLines={1} adjustsFontSizeToFit style={styles.participantPosterName}>
                    {posterText.name}
                  </Text>
                  <Text numberOfLines={1} adjustsFontSizeToFit style={styles.participantPosterDepartment}>
                    {posterText.department}
                  </Text>
                </View>
              </View>
            </Animated.View>
            <Animated.View
              pointerEvents="none"
              style={[
                styles.participantPosterSelectionRing,
                {
                  opacity: selectionRingOpacity,
                },
              ]}
            />
          </AnimatedPressable>
        </View>
      );
    },
    [onSelectTeam, scrollX],
  );

  return (
    <View style={styles.participantPosterChoiceStage}>
      <Animated.FlatList
        data={teams}
        decelerationRate="fast"
        disableIntervalMomentum
        getItemLayout={(_, index) => ({
          index,
          length: PARTICIPANT_POSTER_SNAP_INTERVAL,
          offset: PARTICIPANT_POSTER_SNAP_INTERVAL * index,
        })}
        horizontal
        initialNumToRender={teams.length}
        keyExtractor={team => team.id}
        nestedScrollEnabled
        onMomentumScrollEnd={selectCenteredParticipantPoster}
        onScroll={Animated.event([{nativeEvent: {contentOffset: {x: scrollX}}}], {useNativeDriver: true})}
        onScrollEndDrag={selectCenteredParticipantPoster}
        renderItem={renderParticipantPosterCard}
        showsHorizontalScrollIndicator={false}
        snapToInterval={PARTICIPANT_POSTER_SNAP_INTERVAL}
        style={styles.participantPosterList}
        contentContainerStyle={styles.participantPosterListContent}
      />
      <View style={styles.participantPosterPagination}>
        {teams.map((team, index) => {
          const inputRange = [
            (index - 1) * PARTICIPANT_POSTER_SNAP_INTERVAL,
            index * PARTICIPANT_POSTER_SNAP_INTERVAL,
            (index + 1) * PARTICIPANT_POSTER_SNAP_INTERVAL,
          ];
          const opacity = scrollX.interpolate({
            inputRange,
            outputRange: [0.3, 1, 0.3],
            extrapolate: 'clamp',
          });

          return (
            <Animated.View
              key={team.id}
              style={[
                styles.participantPosterPaginationDot,
                {
                  opacity,
                },
              ]}
            />
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  participantPosterChoiceStage: {
    flex: 1,
  },
  participantPosterList: {
    height: PARTICIPANT_POSTER_CARD_HEIGHT + 8,
  },
  participantPosterListContent: {
    paddingTop: 8,
    paddingHorizontal: PARTICIPANT_POSTER_SIDE_PADDING,
  },
  participantPosterItem: {
    width: PARTICIPANT_POSTER_ITEM_WIDTH,
    alignItems: 'center',
  },
  participantPosterPressable: {
    width: PARTICIPANT_POSTER_CARD_WIDTH,
    height: PARTICIPANT_POSTER_CARD_HEIGHT,
    position: 'relative',
  },
  participantPosterCard: {
    width: PARTICIPANT_POSTER_CARD_WIDTH,
    height: PARTICIPANT_POSTER_CARD_HEIGHT,
    borderRadius: 12,
    backgroundColor: '#171717',
    borderWidth: 1,
    borderColor: '#E5091455',
    overflow: 'hidden',
    position: 'relative',
  },
  participantPosterFace: {
    ...StyleSheet.absoluteFillObject,
    backfaceVisibility: 'hidden',
  },
  participantPosterImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  participantPosterPlaceholder: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#18181C',
  },
  participantPosterInitial: {
    color: '#FFFFFF',
    ...FONTS.font40B,
    lineHeight: 48,
  },
  participantPosterNoise: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  participantPosterSelectionRing: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E50914',
  },
  participantPosterTextBlock: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 18,
    alignItems: 'flex-start',
  },
  participantPosterName: {
    alignSelf: 'flex-start',
    color: '#FFFFFF',
    ...FONTS.font24B,
    lineHeight: 30,
    textShadowColor: 'rgba(0,0,0,0.72)',
    textShadowOffset: {width: 0, height: 2},
    textShadowRadius: 6,
  },
  participantPosterDepartment: {
    alignSelf: 'flex-start',
    marginTop: 6,
    color: '#FFFFFF',
    ...FONTS.font13B,
    lineHeight: 18,
    textShadowColor: 'rgba(0,0,0,0.78)',
    textShadowOffset: {width: 0, height: 1},
    textShadowRadius: 5,
  },
  participantPosterPagination: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 10,
  },
  participantPosterPaginationDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: '#E50914',
  },
});
