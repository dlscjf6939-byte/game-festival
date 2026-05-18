import React from 'react';
import {useNavigation, type NavigationProp} from '@react-navigation/native';
import {
  Image,
  Pressable,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {image} from '../assets/images';
import type {MainStackParamList} from '../navigation/types';

export function QrScanScreen(): JSX.Element {
  const navigation = useNavigation<NavigationProp<MainStackParamList>>();

  const handleClose = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }

    navigation.navigate('Home');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />

      <View style={styles.header}>
        <Text style={styles.title}>QR 스캔</Text>
        <Pressable
          accessibilityLabel="QR 스캔 닫기"
          accessibilityRole="button"
          onPress={handleClose}
          style={styles.closeButton}>
          <Text style={styles.closeText}>×</Text>
        </Pressable>
      </View>

      <View style={styles.body}>
        <View style={styles.scanFrame}>
          <View style={[styles.corner, styles.cornerTopLeft]} />
          <View style={[styles.corner, styles.cornerTopRight]} />
          <View style={[styles.corner, styles.cornerBottomLeft]} />
          <View style={[styles.corner, styles.cornerBottomRight]} />
          <Image source={image.qrCode} style={styles.qrIcon} />
        </View>

        <Text style={styles.guideText}>QR 코드를 화면 중앙에 맞춰주세요.</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#000000',
  },
  header: {
    height: 56,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#171717',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '300',
    lineHeight: 32,
  },
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingBottom: 92,
  },
  scanFrame: {
    width: 244,
    height: 244,
    borderRadius: 18,
    backgroundColor: '#0F0F0F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  corner: {
    position: 'absolute',
    width: 42,
    height: 42,
    borderColor: '#F40D21',
  },
  cornerTopLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: 18,
  },
  cornerTopRight: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: 18,
  },
  cornerBottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: 18,
  },
  cornerBottomRight: {
    right: 0,
    bottom: 0,
    borderRightWidth: 4,
    borderBottomWidth: 4,
    borderBottomRightRadius: 18,
  },
  qrIcon: {
    width: 72,
    height: 72,
    tintColor: '#FFFFFF',
  },
  guideText: {
    marginTop: 24,
    color: '#B7B9C0',
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
    textAlign: 'center',
  },
});
