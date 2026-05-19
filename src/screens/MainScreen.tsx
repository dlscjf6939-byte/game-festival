import React, {useRef} from 'react';
import {
  Animated,
  Dimensions,
  Image,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {image} from '../assets/images';
import {AppGnb} from '../components/AppGnb';
import {TabSceneTransition} from '../components/TabSceneTransition';

const {width: SCREEN_WIDTH} = Dimensions.get('window');

const STORY_CARD_WIDTH = 327;
const STORY_CARD_HEIGHT = 474;
const STORY_CARD_GAP = 18;
const STORY_ITEM_WIDTH = STORY_CARD_WIDTH + STORY_CARD_GAP;
const STORY_SNAP_INTERVAL = STORY_ITEM_WIDTH;

const storyCards = [
  {
    id: 'left',
    title: 'TAKKEN7',
    subtitle: '철권7',
    accent: '#0e5ac5',
    tag: 'LIVE BRACKET',
  },
  {
    id: 'center',
    title: 'TAKKEN7',
    subtitle: '철권7',
    accent: '#E11319',
    tag: 'MAIN EVENT',
  },
  {
    id: 'right',
    title: 'TAKKEN7',
    subtitle: '철권7',
    accent: '#F7CE45',
    tag: 'RISING PICK',
  },
];

function MainScreen(): JSX.Element {
  const scrollX = useRef(new Animated.Value(STORY_SNAP_INTERVAL)).current;
  const scrollY = useRef(new Animated.Value(0)).current;

  const renderStoryCard = React.useCallback(
    ({
      item,
      index,
    }: {
      item: (typeof storyCards)[number];
      index: number;
    }): JSX.Element => {
      const inputRange = [
        (index - 1) * STORY_SNAP_INTERVAL,
        index * STORY_SNAP_INTERVAL,
        (index + 1) * STORY_SNAP_INTERVAL,
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

      const badgeOpacity = scrollX.interpolate({
        inputRange,
        outputRange: [0.55, 1, 0.55],
        extrapolate: 'clamp',
      });

      return (
        <View style={styles.storyItem}>
          <Animated.View
            style={[
              styles.storyCard,
              {borderColor: `${item.accent}55`},
              {
                opacity,
                transform: [{translateY}, {scale}, {rotate}],
              },
            ]}>
            {/* <View
              style={[
                styles.storyGlow,
                {
                  backgroundColor: item.glow,
                },
              ]}
            /> */}
            {/* <View
              style={[
                styles.storyAccentOrb,
                {
                  backgroundColor: item.accent,
                },
              ]}
            /> */}
            <Image
              source={image.poster}
              resizeMode="contain"
              style={styles.storyPosterImage}
            />
            <View style={styles.storyNoise} />
            <View style={styles.storyGradient}>
              <Animated.View
                style={[
                  styles.storyBadge,
                  {
                    opacity: badgeOpacity,
                    borderColor: `${item.accent}66`,
                    backgroundColor: `${item.accent}22`,
                  },
                ]}>
                <Text style={[styles.storyBadgeText, {color: item.accent}]}>
                  {item.tag}
                </Text>
              </Animated.View>
              <Text style={styles.storyEyebrow}>{item.subtitle}</Text>
              <Text style={styles.storyTitle}>{item.title}</Text>
              <Text style={styles.storyMeta}>SCROLL TO NEXT MATCHUP</Text>
            </View>
          </Animated.View>
        </View>
      );
    },
    [scrollX],
  );

  return (
    <TabSceneTransition>
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="light-content" backgroundColor="#000000" />

        <View style={styles.screen}>
          <View pointerEvents="none" style={styles.screenBackgroundLayer}>
            {storyCards.map((card, index) => {
              const inputRange = [
                (index - 1) * STORY_SNAP_INTERVAL,
                index * STORY_SNAP_INTERVAL,
                (index + 1) * STORY_SNAP_INTERVAL,
              ];

              const topOpacity = scrollX.interpolate({
                inputRange,
                outputRange: [0, 0.18, 0],
                extrapolate: 'clamp',
              });
              const bottomOpacity = scrollX.interpolate({
                inputRange,
                outputRange: [0, 0.1, 0],
                extrapolate: 'clamp',
              });

              return (
                <React.Fragment key={card.id}>
                  <Animated.View
                    style={[
                      styles.screenAccentTop,
                      {
                        backgroundColor: card.accent,
                        opacity: Animated.multiply(topOpacity, 1),
                      },
                    ]}
                  />
                  <Animated.View
                    style={[
                      styles.screenAccentBottom,
                      {
                        backgroundColor: card.accent,
                        opacity: bottomOpacity,
                      },
                    ]}
                  />
                </React.Fragment>
              );
            })}
            <View style={styles.screenVignette} />
          </View>

          <View style={styles.mainArea}>
            <AppGnb scrollY={scrollY} />

            <Animated.ScrollView
              bounces={false}
              contentContainerStyle={styles.content}
              showsVerticalScrollIndicator={false}
              onScroll={Animated.event(
                [{nativeEvent: {contentOffset: {y: scrollY}}}],
                {useNativeDriver: true},
              )}
              scrollEventThrottle={16}>
              <Animated.FlatList
                data={storyCards}
                decelerationRate="fast"
                disableIntervalMomentum
                getItemLayout={(_, index) => ({
                  index,
                  length: STORY_SNAP_INTERVAL,
                  offset: STORY_SNAP_INTERVAL * index,
                })}
                horizontal
                initialNumToRender={storyCards.length}
                initialScrollIndex={1}
                keyExtractor={item => item.id}
                onScroll={Animated.event(
                  [{nativeEvent: {contentOffset: {x: scrollX}}}],
                  {useNativeDriver: true},
                )}
                renderItem={renderStoryCard}
                scrollEventThrottle={16}
                showsHorizontalScrollIndicator={false}
                snapToAlignment="start"
                snapToInterval={STORY_SNAP_INTERVAL}
                bounces={false}
                contentContainerStyle={styles.storyListContent}
              />
              <View style={styles.storyPagination}>
                {storyCards.map((card, index) => {
                  const inputRange = [
                    (index - 1) * STORY_SNAP_INTERVAL,
                    index * STORY_SNAP_INTERVAL,
                    (index + 1) * STORY_SNAP_INTERVAL,
                  ];

                  const opacity = scrollX.interpolate({
                    inputRange,
                    outputRange: [0.3, 1, 0.3],
                    extrapolate: 'clamp',
                  });

                  return (
                    <Animated.View
                      key={card.id}
                      style={[
                        styles.paginationDot,
                        {
                          opacity,
                          backgroundColor: card.accent,
                        },
                      ]}
                    />
                  );
                })}
              </View>

              <View style={styles.coinSection}>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    marginBottom: 16,
                  }}>
                  <Image
                    source={image.profile}
                    style={{width: 40, height: 40, marginRight: 12}}
                  />
                  <Text style={styles.greeting}>서비스개발팀 이인철님</Text>
                </View>
                <View style={styles.coinCard}>
                  <View style={styles.coinHeader}>
                    <Text style={styles.coinHeaderTitle}>나의 보유코인</Text>
                    <View style={styles.coinValueWrap}>
                      <Text style={styles.coinValue}>24개</Text>
                      <View style={styles.coinChevron} />
                    </View>
                  </View>

                  <View style={styles.coinDivider} />

                  <View style={styles.coinRows}>
                    <View style={styles.coinRow}>
                      <Text style={styles.coinRowLabel}>
                        승부예측 참여 완료
                      </Text>
                      <Text style={styles.coinRowValue}>-2개</Text>
                    </View>
                    <View style={styles.coinRow}>
                      <Text style={styles.coinRowLabel}>
                        주니어보드 설문 참여 완료
                      </Text>
                      <Text style={styles.coinRowValue}>+2개</Text>
                    </View>
                    <View style={styles.coinRow}>
                      <Text style={styles.coinRowLabel}>
                        섹타나인 임직원 기본 지급
                      </Text>
                      <Text style={styles.coinRowValue}>+2개</Text>
                    </View>
                  </View>
                </View>
              </View>
            </Animated.ScrollView>
          </View>
        </View>
      </SafeAreaView>
    </TabSceneTransition>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#000000',
  },
  screen: {
    flex: 1,
    backgroundColor: '#000000',
  },
  screenBackgroundLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  screenAccentTop: {
    position: 'absolute',
    top: -180,
    left: -120,
    right: -120,
    height: 460,
    borderRadius: 260,
  },
  screenAccentBottom: {
    position: 'absolute',
    bottom: -240,
    left: -160,
    right: -160,
    height: 520,
    borderRadius: 320,
  },
  screenVignette: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.24)',
  },
  mainArea: {
    flex: 1,
  },
  bellBody: {
    width: 18,
    height: 14,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    borderTopLeftRadius: 9,
    borderTopRightRadius: 9,
    borderBottomLeftRadius: 6,
    borderBottomRightRadius: 6,
  },
  bellBase: {
    width: 4,
    height: 2,
    borderRadius: 2,
    backgroundColor: '#FFFFFF',
    marginTop: 2,
  },
  notificationDot: {
    position: 'absolute',
    top: 2,
    right: 3,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E11319',
  },
  coinRing: {
    width: 18,
    height: 18,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    borderRadius: 9,
  },
  coinStripe: {
    position: 'absolute',
    width: 24,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E11319',
  },
  content: {
    paddingBottom: 36,
  },
  storyListContent: {
    paddingTop: 8,
    paddingHorizontal: (SCREEN_WIDTH - STORY_ITEM_WIDTH) / 2,
  },
  storyItem: {
    width: STORY_ITEM_WIDTH,
    alignItems: 'center',
  },
  storyCard: {
    width: STORY_CARD_WIDTH,
    height: STORY_CARD_HEIGHT,
    borderRadius: 23,
    backgroundColor: '#101010',
    borderWidth: 1,
    overflow: 'hidden',
  },
  storyPosterImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  storyGlow: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    top: 56,
    alignSelf: 'center',
    opacity: 0.55,
  },
  storyAccentOrb: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    right: -24,
    top: -20,
    opacity: 0.3,
  },
  storyNoise: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  storyGradient: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: 20,
    backgroundColor: 'rgba(0,0,0,0.42)',
  },
  storyBadge: {
    position: 'absolute',
    top: 20,
    left: 20,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  storyBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.1,
  },
  storyEyebrow: {
    color: '#F2F3F5',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.4,
  },
  storyTitle: {
    marginTop: 8,
    color: '#FFFFFF',
    fontSize: 30,
    fontWeight: '800',
  },
  storyMeta: {
    marginTop: 14,
    color: 'rgba(255,255,255,0.58)',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  storyPagination: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 16,
  },
  paginationDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
  },
  coinSection: {
    width: 335,
    alignSelf: 'center',
    marginTop: 32,
  },
  greeting: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '600',
  },
  coinCard: {
    borderRadius: 20,
    backgroundColor: '#222323',
    paddingHorizontal: 20,
    paddingVertical: 28,
  },
  coinHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  coinHeaderTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  coinValueWrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  coinValue: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  coinChevron: {
    width: 8,
    height: 8,
    marginLeft: 8,
    borderRightWidth: 1.6,
    borderBottomWidth: 1.6,
    borderColor: '#B3B4B9',
    transform: [{rotate: '-45deg'}],
  },
  coinDivider: {
    height: 1,
    backgroundColor: 'rgba(242,243,245,0.3)',
    marginTop: 20,
    marginBottom: 20,
  },
  coinRows: {
    gap: 12,
  },
  coinRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  coinRowLabel: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
  coinRowValue: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
});

export default MainScreen;
