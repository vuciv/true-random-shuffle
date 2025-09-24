import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { BlurView } from 'expo-blur';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

interface QueueProgressOverlayProps {
  isVisible: boolean;
  playlistImage: string | null;
  progress: number;
  total: number;
  message: string | null;
}

const AnimatedBlurView = Animated.createAnimatedComponent(BlurView);

export default function QueueProgressOverlay({
  isVisible,
  playlistImage,
  progress,
  total,
  message,
}: QueueProgressOverlayProps) {
  // Shared values for animations
  const scale = useSharedValue(0.9);
  const opacity = useSharedValue(0);
  const progressWidth = useSharedValue(0);

  const percentage = total > 0 ? progress / total : 0;

  useEffect(() => {
    if (isVisible) {
      // Animate the modal into view
      opacity.value = withTiming(1, { duration: 200 });
      scale.value = withSpring(1, { damping: 15, stiffness: 120 });
    } else {
      // Animate out when hiding
      opacity.value = withTiming(0, { duration: 150 });
      scale.value = withTiming(0.9, { duration: 150 });
    }
  }, [isVisible]);

  useEffect(() => {
    // Animate the progress bar smoothly
    progressWidth.value = withTiming(percentage, { duration: 250 });
  }, [percentage]);

  // Animated styles
  const animatedCardStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  const animatedProgressStyle = useAnimatedStyle(() => ({
    width: `${progressWidth.value * 100}%`,
  }));

  if (!isVisible) {
    return null;
  }

  return (
    <AnimatedBlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill}>
      <Animated.View style={[styles.queueCard, animatedCardStyle]}>
        {playlistImage && (
          <Image source={{ uri: playlistImage }} style={styles.playlistImage} />
        )}
        <Text style={styles.queueTitle}>Preparing Your Queue…</Text>
        <Text style={styles.queueSubtitle}>{message || 'Optimizing randomness'}</Text>
        <View style={styles.queueProgressContainer}>
          <View style={styles.progressBar}>
            <Animated.View style={[styles.progressFill, animatedProgressStyle]} />
          </View>
          <View style={styles.progressLabels}>
            <Text style={styles.progressText}>
              Queued {progress} of {total}
            </Text>
            <Text style={styles.progressText}>{`${Math.round(percentage * 100)}%`}</Text>
          </View>
        </View>
      </Animated.View>
    </AnimatedBlurView>
  );
}

const styles = StyleSheet.create({
  queueCard: {
    backgroundColor: 'rgba(28, 28, 30, 0.85)', // A slightly transparent, dark background
    borderRadius: 24,
    padding: 24,
    width: '90%',
    maxWidth: 420,
    alignSelf: 'center',
    marginTop: 'auto',
    marginBottom: 'auto',
    alignItems: 'center',
    // iOS-style shadows
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  playlistImage: {
    width: 100,
    height: 100,
    borderRadius: 16,
    marginBottom: 20,
    backgroundColor: '#333',
  },
  queueTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
  },
  queueSubtitle: {
    color: '#b3b3b3',
    fontSize: 15,
    marginBottom: 24,
    textAlign: 'center',
  },
  queueProgressContainer: {
    width: '100%',
  },
  progressBar: {
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 3,
    marginBottom: 8,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#1DB954',
    borderRadius: 3,
  },
  progressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  progressText: {
    color: '#b3b3b3',
    fontSize: 12,
    fontWeight: '500',
  },
});
