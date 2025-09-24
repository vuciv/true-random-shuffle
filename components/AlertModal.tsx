import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { BlurView } from 'expo-blur';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { AlertTriangle, Smartphone, Music } from 'lucide-react-native';

interface AlertModalProps {
  isVisible: boolean;
  type: 'no-device' | 'queue-not-empty' | 'generic';
  title?: string;
  message?: string;
  primaryButtonText?: string;
  secondaryButtonText?: string;
  queueCount?: number;
  onPrimaryPress?: () => void;
  onSecondaryPress?: () => void;
  onClose?: () => void;
}

const AnimatedBlurView = Animated.createAnimatedComponent(BlurView);

export default function AlertModal({
  isVisible,
  type,
  title,
  message,
  primaryButtonText,
  secondaryButtonText,
  queueCount,
  onPrimaryPress,
  onSecondaryPress,
  onClose,
}: AlertModalProps) {
  // Shared values for animations
  const scale = useSharedValue(0.9);
  const opacity = useSharedValue(0);

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

  // Animated styles
  const animatedCardStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  if (!isVisible) {
    return null;
  }

  // Get default content based on type
  const getContent = () => {
    switch (type) {
      case 'no-device':
        return {
          icon: <Smartphone size={48} color="#FF9500" />,
          title: title || 'Spotify Connection Lost',
          message: message || 'Spotify may have lost connection. Try these steps:\n\n1. Force close your Spotify app completely\n2. Reopen Spotify and start playing any song\n3. Come back here to continue\n\nThis helps refresh Spotify\'s connection and makes your device discoverable.',
          primaryButtonText: primaryButtonText || 'I Restarted Spotify',
          secondaryButtonText: secondaryButtonText || 'Cancel',
        };
      case 'queue-not-empty':
        const queueMessage = queueCount 
          ? `Your Spotify queue has ${queueCount} song${queueCount === 1 ? '' : 's'} in it. Please clear your queue first for the best shuffle experience.\n\nTip: In Spotify, go to your queue and tap "Clear queue" or swipe left on songs to remove them.`
          : 'Your Spotify queue has songs in it. Please clear your queue first for the best shuffle experience.\n\nTip: In Spotify, go to your queue and tap "Clear queue" or swipe left on songs to remove them.';
        
        return {
          icon: <Music size={48} color="#FF9500" />,
          title: title || 'Clear Your Queue',
          message: message || queueMessage,
          primaryButtonText: primaryButtonText || 'I Cleared My Queue',
          secondaryButtonText: secondaryButtonText || 'Cancel',
        };
      default:
        return {
          icon: <AlertTriangle size={48} color="#FF9500" />,
          title: title || 'Alert',
          message: message || 'Something needs your attention.',
          primaryButtonText: primaryButtonText || 'OK',
          secondaryButtonText: secondaryButtonText || 'Cancel',
        };
    }
  };

  const content = getContent();

  return (
    <AnimatedBlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill}>
      <Animated.View style={[styles.alertCard, animatedCardStyle]}>
        <View style={styles.iconContainer}>
          {content.icon}
        </View>
        
        <Text style={styles.alertTitle}>{content.title}</Text>
        <Text style={styles.alertMessage}>{content.message}</Text>
        
        <View style={styles.buttonContainer}>
          {content.secondaryButtonText && (
            <TouchableOpacity
              style={[styles.button, styles.secondaryButton]}
              onPress={onSecondaryPress || onClose}
            >
              <Text style={styles.secondaryButtonText}>{content.secondaryButtonText}</Text>
            </TouchableOpacity>
          )}
          
          <TouchableOpacity
            style={[styles.button, styles.primaryButton]}
            onPress={onPrimaryPress || onClose}
          >
            <Text style={styles.primaryButtonText}>{content.primaryButtonText}</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </AnimatedBlurView>
  );
}

const styles = StyleSheet.create({
  alertCard: {
    backgroundColor: 'rgba(28, 28, 30, 0.85)',
    borderRadius: 24,
    padding: 24,
    width: '90%',
    maxWidth: 380,
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
  iconContainer: {
    marginBottom: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },
  alertMessage: {
    color: '#b3b3b3',
    fontSize: 16,
    marginBottom: 32,
    textAlign: 'center',
    lineHeight: 22,
  },
  buttonContainer: {
    flexDirection: 'row',
    width: '100%',
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButton: {
    backgroundColor: '#1DB954',
  },
  secondaryButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  primaryButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
});
