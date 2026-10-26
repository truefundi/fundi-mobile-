import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  useWindowDimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Linking,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import * as WebBrowser from 'expo-web-browser';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { AdItem } from '@/context/AdsContext';

const AUTO_ADVANCE_DELAY_MS = 5000;
const ANIMATION_DURATION_MS = 400;
const CARD_SPACING = 16;

interface AdsCarouselProps {
  ads: AdItem[];
}

export function AdsCarousel({ ads }: AdsCarouselProps) {
  const colors = useColors();
  const { width: windowWidth } = useWindowDimensions();

  // Screen horizontal gutter on Home is 20px on each side (total 40px)
  const defaultWidth = Math.max(windowWidth - 40, 280);
  const [containerWidth, setContainerWidth] = useState(defaultWidth);
  const cardWidth = containerWidth;
  const step = cardWidth + CARD_SPACING;

  const [activeIndex, setActiveIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  const virtualIndexRef = useRef(ads.length > 1 ? 1 : 0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const jumpTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isInteracting = useRef(false);

  // Construct looped list: [cloneOfLast, item0, item1, ..., itemLast, cloneOfFirst]
  const loopData = useMemo(() => {
    if (ads.length <= 1) return ads;
    return [ads[ads.length - 1], ...ads, ads[0]];
  }, [ads]);

  const handleOpenAd = async (url: string) => {
    try {
      if (Platform.OS !== 'web' && WebBrowser.openBrowserAsync) {
        await WebBrowser.openBrowserAsync(url);
      } else {
        await Linking.openURL(url);
      }
    } catch (error) {
      console.warn('Unable to open URL:', url, error);
    }
  };

  /**
   * Advance forward infinitely without scrolling backwards to the start.
   * When arriving at the cloned first item, silently resets to the real first item.
   */
  const advanceSlide = useCallback(() => {
    if (ads.length <= 1 || isInteracting.current) return;

    const currentVirtual = virtualIndexRef.current;
    const nextVirtual = currentVirtual + 1;
    virtualIndexRef.current = nextVirtual;

    flatListRef.current?.scrollToOffset({
      offset: nextVirtual * step,
      animated: true,
    });

    const realIndex = (nextVirtual - 1) % ads.length;
    setActiveIndex(realIndex);

    // If reaching the cloned item at the end of loopData:
    if (nextVirtual >= ads.length + 1) {
      if (jumpTimerRef.current) clearTimeout(jumpTimerRef.current);
      jumpTimerRef.current = setTimeout(() => {
        flatListRef.current?.scrollToOffset({
          offset: 1 * step,
          animated: false,
        });
        virtualIndexRef.current = 1;
      }, ANIMATION_DURATION_MS);
    }
  }, [ads.length, step]);

  const resetTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (ads.length > 1) {
      timerRef.current = setInterval(advanceSlide, AUTO_ADVANCE_DELAY_MS);
    }
  }, [advanceSlide, ads.length]);

  useEffect(() => {
    resetTimer();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (jumpTimerRef.current) clearTimeout(jumpTimerRef.current);
    };
  }, [resetTimer]);

  // Ensure FlatList starts at virtual index 1 (the first real ad)
  useEffect(() => {
    if (ads.length > 1) {
      virtualIndexRef.current = 1;
      setActiveIndex(0);
      const timer = setTimeout(() => {
        flatListRef.current?.scrollToOffset({
          offset: 1 * step,
          animated: false,
        });
      }, 50);
      return () => clearTimeout(timer);
    } else {
      virtualIndexRef.current = 0;
      setActiveIndex(0);
    }
  }, [step, ads.length]);

  const onScrollBeginDrag = () => {
    isInteracting.current = true;
    if (timerRef.current) clearInterval(timerRef.current);
    if (jumpTimerRef.current) clearTimeout(jumpTimerRef.current);
  };

  const onMomentumScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (ads.length <= 1) return;
    const offsetX = event.nativeEvent.contentOffset.x;
    const vIndex = Math.round(offsetX / step);

    if (vIndex >= ads.length + 1) {
      // Swiped forward past the last real ad onto the end clone
      flatListRef.current?.scrollToOffset({
        offset: 1 * step,
        animated: false,
      });
      virtualIndexRef.current = 1;
      setActiveIndex(0);
    } else if (vIndex <= 0) {
      // Swiped backward past the first real ad onto the start clone
      flatListRef.current?.scrollToOffset({
        offset: ads.length * step,
        animated: false,
      });
      virtualIndexRef.current = ads.length;
      setActiveIndex(ads.length - 1);
    } else {
      virtualIndexRef.current = vIndex;
      setActiveIndex(vIndex - 1);
    }

    isInteracting.current = false;
    resetTimer();
  };

  const handleDotPress = (dotIndex: number) => {
    if (ads.length <= 1) return;
    const targetVirtual = dotIndex + 1;
    virtualIndexRef.current = targetVirtual;
    setActiveIndex(dotIndex);
    flatListRef.current?.scrollToOffset({
      offset: targetVirtual * step,
      animated: true,
    });
    resetTimer();
  };

  const renderAdCard = ({ item }: { item: AdItem }) => {
    return (
      <View
        style={[
          styles.cardItemWrapper,
          {
            width: cardWidth,
            marginRight: ads.length > 1 ? CARD_SPACING : 0,
          },
        ]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${item.title} - ${item.pitch}`}
          onPress={() => handleOpenAd(item.targetUrl)}
          style={({ pressed }) => [
            styles.card,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              opacity: pressed ? 0.92 : 1,
              transform: [{ scale: pressed ? 0.99 : 1 }],
            },
          ]}
        >
          <Image
            source={item.imageSource}
            style={styles.image}
            contentFit="cover"
            transition={200}
          />

          <View style={styles.contentContainer}>
            <View style={styles.textContainer}>
              <Text style={[styles.title, { color: colors.foreground }]} numberOfLines={1}>
                {item.title}
              </Text>
              <Text style={[styles.pitch, { color: colors.mutedForeground }]} numberOfLines={2}>
                {item.pitch}
              </Text>
            </View>

            <View style={[styles.ctaButton, { backgroundColor: colors.primary }]}>
              <Text style={[styles.ctaText, { color: colors.primaryForeground }]}>
                {item.callToAction}
              </Text>
              <Feather name="arrow-up-right" size={14} color={colors.primaryForeground} />
            </View>
          </View>
        </Pressable>
      </View>
    );
  };

  if (!ads.length) return null;

  return (
    <View
      style={styles.wrapper}
      onLayout={(e) => {
        const layoutWidth = e.nativeEvent.layout.width;
        if (layoutWidth > 0 && Math.abs(layoutWidth - containerWidth) > 1) {
          setContainerWidth(layoutWidth);
        }
      }}
    >
      <FlatList
        ref={flatListRef}
        data={loopData}
        keyExtractor={(item, index) => `${item.id}-loop-${index}`}
        renderItem={renderAdCard}
        horizontal
        pagingEnabled={false}
        showsHorizontalScrollIndicator={false}
        snapToInterval={step}
        snapToAlignment="start"
        decelerationRate="fast"
        nestedScrollEnabled={true}
        onScrollBeginDrag={onScrollBeginDrag}
        onMomentumScrollEnd={onMomentumScrollEnd}
        contentContainerStyle={styles.listContent}
        getItemLayout={(_, index) => ({
          length: step,
          offset: step * index,
          index,
        })}
        initialScrollIndex={ads.length > 1 ? 1 : 0}
        onScrollToIndexFailed={(info) => {
          setTimeout(() => {
            flatListRef.current?.scrollToOffset({
              offset: info.index * step,
              animated: false,
            });
          }, 50);
        }}
      />

      {ads.length > 1 && (
        <View style={styles.paginationDots}>
          {ads.map((_, index) => {
            const isActive = index === activeIndex;
            return (
              <Pressable
                key={`dot-${index}`}
                onPress={() => handleDotPress(index)}
                hitSlop={6}
                accessibilityRole="button"
                accessibilityLabel={`Go to slide ${index + 1}`}
                style={styles.dotTouch}
              >
                <View
                  style={[
                    styles.dot,
                    {
                      backgroundColor: isActive ? colors.primary : colors.border,
                      width: isActive ? 16 : 6,
                    },
                  ]}
                />
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginVertical: 4,
    width: '100%',
    overflow: 'hidden',
  },
  listContent: {
    paddingHorizontal: 0,
  },
  cardItemWrapper: {},
  card: {
    width: '100%',
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: 124,
    borderTopLeftRadius: 17,
    borderTopRightRadius: 17,
    backgroundColor: '#e2e8f0',
  },
  contentContainer: {
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  textContainer: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontFamily: 'Inter_700Bold',
    fontSize: 15,
  },
  pitch: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    lineHeight: 16,
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    alignSelf: 'center',
  },
  ctaText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 12,
  },
  paginationDots: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    gap: 2,
  },
  dotTouch: {
    padding: 4,
  },
  dot: {
    height: 6,
    borderRadius: 3,
  },
});
