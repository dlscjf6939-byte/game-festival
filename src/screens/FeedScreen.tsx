import React, {useCallback, useMemo, useRef, useState} from 'react';
import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetFlatList,
  BottomSheetTextInput,
} from '@gorhom/bottom-sheet';
import {
  Animated,
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import {AppGnb} from '../components/AppGnb';
import {TabSceneTransition} from '../components/TabSceneTransition';

const stories = [
  {
    id: 'kim-sojin',
    name: '김소진',
    image:
      'https://images.unsplash.com/photo-1517849845537-4d257902454a?auto=format&fit=crop&w=200&q=80',
    showAdd: true,
  },
  {
    id: 'lee-incheol',
    name: '이인철',
    image:
      'https://images.unsplash.com/photo-1517849845537-4d257902454a?auto=format&fit=crop&w=200&q=80',
  },
  {
    id: 'gil-gihan',
    name: '길기환',
    image:
      'https://images.unsplash.com/photo-1517849845537-4d257902454a?auto=format&fit=crop&w=200&q=80',
  },
  {
    id: 'kim-sojin-2',
    name: '김소진',
    image:
      'https://images.unsplash.com/photo-1517849845537-4d257902454a?auto=format&fit=crop&w=200&q=80',
  },
];

const postImage =
  'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=1200&q=80';

const initialComments = [
  {id: '1', user: 'User name', text: '하잉하이하잉하이잉하이이~~~'},
  {id: '2', user: 'User name', text: '하잉하이하잉하이잉하이이~~~'},
  {id: '3', user: 'User name', text: '하잉하이하잉하이잉하이이~~~'},
  {id: '4', user: 'User name', text: '하잉하이하잉하이잉하이이~~~'},
  {id: '5', user: 'User name', text: '하잉하이하잉하이잉하이이~~~'},
  {id: '6', user: 'User name', text: '하잉하이하잉하이잉하이이~~~'},
  {id: '7', user: 'User name', text: '하잉하이하잉하이잉하이이~~~'},
  {id: '8', user: 'User name', text: '하잉하이하잉하이잉하이이~~~'},
];

export function FeedScreen(): JSX.Element {
  const bottomSheetRef = useRef<BottomSheet>(null);
  const scrollY = useRef(new Animated.Value(0)).current;
  const snapPoints = useMemo(() => ['62%'], []);
  const [commentDraft, setCommentDraft] = useState('');
  const [comments, setComments] = useState(initialComments);

  const openComments = useCallback(() => {
    bottomSheetRef.current?.snapToIndex(0);
  }, []);

  const handleCommentSubmit = useCallback(() => {
    const trimmedComment = commentDraft.trim();
    if (!trimmedComment) {
      return;
    }

    setComments(prevComments => [
      ...prevComments,
      {id: String(Date.now()), user: 'User name', text: trimmedComment},
    ]);
    setCommentDraft('');
  }, [commentDraft]);

  const renderBackdrop = useCallback(
    (props: React.ComponentProps<typeof BottomSheetBackdrop>) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        opacity={0.45}
        pressBehavior="close"
      />
    ),
    [],
  );

  const renderComment = useCallback(
    ({item}: {item: (typeof initialComments)[number]}) => (
      <View style={styles.commentRow}>
        <Text style={styles.commentLine}>
          <Text style={styles.commentUser}>{item.user}</Text> {item.text}
        </Text>
      </View>
    ),
    [],
  );

  return (
    <TabSceneTransition>
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="light-content" backgroundColor="#000000" />

        <View style={styles.screen}>
          <View style={styles.mainArea}>
            <AppGnb scrollY={scrollY} />

            <View style={styles.feedContentWrap}>
              <Animated.ScrollView
                bounces={false}
                contentContainerStyle={styles.feedFrame}
                showsVerticalScrollIndicator={false}
                onScroll={Animated.event(
                  [{nativeEvent: {contentOffset: {y: scrollY}}}],
                  {useNativeDriver: true},
                )}
                scrollEventThrottle={16}>
                <ScrollView
                  horizontal
                  contentContainerStyle={styles.storyRow}
                  showsHorizontalScrollIndicator={false}>
                  {stories.map(story => (
                    <View key={story.id} style={styles.storyItem}>
                      <View style={styles.storyAvatarWrap}>
                        <LinearGradient
                          colors={['#FF1220', '#E10D1A', '#A20812']}
                          start={{x: 0.2, y: 0}}
                          end={{x: 0.85, y: 1}}
                          style={styles.storyRingGradient}>
                          <View style={styles.storyRing}>
                            <Image
                              source={{uri: story.image}}
                              style={styles.storyImage}
                            />
                          </View>
                        </LinearGradient>
                        {story.showAdd ? (
                          <View style={styles.addBadge}>
                            <View style={styles.addHorizontal} />
                            <View style={styles.addVertical} />
                          </View>
                        ) : null}
                      </View>
                      <Text numberOfLines={1} style={styles.storyName}>
                        {story.name}
                      </Text>
                    </View>
                  ))}
                </ScrollView>

                <View style={styles.postHeader}>
                  <View style={styles.postHeaderLeft}>
                    <View style={styles.profileDot} />
                    <Text style={styles.profileName}>User name</Text>
                  </View>
                  <Text style={styles.moreIcon}>...</Text>
                </View>

                <Image source={{uri: postImage}} style={styles.postImage} />

                <View style={styles.actionRow}>
                  <View style={styles.actionCircle} />
                  <View style={styles.actionCircle} />
                </View>

                <View style={styles.captionBlock}>
                  <Text style={styles.captionLine}>
                    <Text style={styles.captionUser}>User name </Text>
                    하잉하이하잉하이잉하이이~~~
                  </Text>
                  <Text style={styles.captionLine}>
                    <Text style={styles.captionUser}>User name </Text>
                    하잉하이하잉하이잉하이이~~~
                  </Text>
                  <Text style={styles.captionLine}>
                    <Text style={styles.captionUser}>User name </Text>
                    하잉하이하잉하이잉하이이~~~
                  </Text>
                  <Pressable onPress={openComments}>
                    <Text style={styles.commentLink}>
                      View all {comments.length} comments
                    </Text>
                  </Pressable>
                </View>
              </Animated.ScrollView>
            </View>
          </View>

          <BottomSheet
            ref={bottomSheetRef}
            index={-1}
            snapPoints={snapPoints}
            enablePanDownToClose
            backdropComponent={renderBackdrop}
            handleIndicatorStyle={styles.sheetHandle}
            handleStyle={styles.sheetHandleArea}
            backgroundStyle={styles.sheetBackground}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>댓글</Text>
            </View>

            <BottomSheetFlatList
              data={comments}
              keyExtractor={item => item.id}
              renderItem={renderComment}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.commentListContent}
            />

            <View style={styles.commentInputWrap}>
              <BottomSheetTextInput
                placeholder="댓글을 입력하세요"
                placeholderTextColor="#9FA2AA"
                style={styles.commentInput}
                value={commentDraft}
                onChangeText={setCommentDraft}
              />
              <Pressable
                style={styles.commentSubmitButton}
                onPress={handleCommentSubmit}>
                <Text style={styles.commentSubmitIcon}>↑</Text>
              </Pressable>
            </View>
          </BottomSheet>
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
  mainArea: {
    flex: 1,
  },
  feedContentWrap: {
    flex: 1,
  },
  feedFrame: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 16,
    paddingTop: 8,
    paddingBottom: 36,
  },
  storyRow: {
    paddingLeft: 14,
    paddingRight: 14,
    gap: 14,
  },
  storyItem: {
    width: 100,
    alignItems: 'center',
    overflow: 'visible',
  },
  storyAvatarWrap: {
    position: 'relative',
    width: 88,
    height: 88,
    overflow: 'visible',
  },
  storyRingGradient: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 5,
  },
  storyRing: {
    width: '100%',
    height: '100%',
    borderRadius: 44,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    backgroundColor: '#FFFFFF',
    padding: 4,
    overflow: 'visible',
  },
  storyImage: {
    width: '100%',
    height: '100%',
    borderRadius: 40,
  },
  addBadge: {
    position: 'absolute',
    right: 1,
    bottom: 0,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#000000',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
    elevation: 20,
  },
  addHorizontal: {
    position: 'absolute',
    width: 13,
    height: 3,
    borderRadius: 1,
    backgroundColor: '#FFFFFF',
  },
  addVertical: {
    position: 'absolute',
    width: 3,
    height: 13,
    borderRadius: 1,
    backgroundColor: '#FFFFFF',
  },
  storyName: {
    marginTop: 10,
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  postHeader: {
    width: '100%',
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  postHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#D9D9D9',
    marginRight: 12,
  },
  profileName: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  moreIcon: {
    color: '#FFFFFF',
    fontSize: 22,
    lineHeight: 22,
    letterSpacing: 1,
  },
  postImage: {
    width: '100%',
    height: 456,
    backgroundColor: '#1A1A1A',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 12,
  },
  actionCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E2E2E2',
  },
  captionBlock: {
    width: '100%',
    paddingHorizontal: 12,
    gap: 4,
  },
  captionLine: {
    color: '#FFFFFF',
    fontSize: 14,
    lineHeight: 22,
  },
  captionUser: {
    fontWeight: '700',
  },
  commentLink: {
    marginTop: 2,
    color: '#E2E2E2',
    fontSize: 14,
    lineHeight: 22,
  },
  sheetHandleArea: {
    paddingTop: 10,
  },
  sheetHandle: {
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D9D9D9',
  },
  sheetBackground: {
    backgroundColor: '#2E2E31',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
  },
  sheetHeader: {
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  sheetTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 34,
  },
  sheetCloseIcon: {
    color: '#FFFFFF',
    fontSize: 32,
    lineHeight: 32,
    fontWeight: '300',
  },
  commentListContent: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  commentRow: {
    marginBottom: 11,
  },
  commentLine: {
    color: '#F5F5F5',
    fontSize: 14,
    lineHeight: 32,
  },
  commentUser: {
    fontWeight: '700',
  },
  commentInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 24,
    backgroundColor: '#545457',
  },
  commentInput: {
    flex: 1,
    height: 42,
    borderRadius: 8,
    backgroundColor: '#232427',
    color: '#FFFFFF',
    paddingHorizontal: 14,
    fontSize: 18,
  },
  commentSubmitButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#C4C6CC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  commentSubmitIcon: {
    color: '#FFFFFF',
    fontSize: 22,
    lineHeight: 24,
    fontWeight: '700',
  },
});
