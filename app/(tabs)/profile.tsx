import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ScrollView } from 'react-native';
import { useSpotify } from '@/contexts/SpotifyContext';
import { LogOut, Music, Shuffle } from 'lucide-react-native';

export default function ProfileTab() {
  const { user, logout, currentPlaylist } = useSpotify();

  const handleLogout = async () => {
    await logout();
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Profile</Text>
      </View>

      {user && (
        <View style={styles.userSection}>
          <Image
            source={{ 
              uri: user.images[0]?.url || 'https://images.pexels.com/photos/771742/pexels-photo-771742.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&fit=crop'
            }}
            style={styles.userImage}
          />
          <Text style={styles.userName}>{user.display_name}</Text>
          <Text style={styles.userEmail}>{user.email}</Text>
        </View>
      )}

      <View style={styles.howItWorksSection}>
        <Text style={styles.sectionTitle}>How It Works & Why</Text>
        
        <View style={styles.explanationCard}>
          <View style={styles.featureItem}>
            <Text style={styles.explanationTitle}>🎲 True Randomness</Text>
            <Text style={styles.explanationText}>
              Unlike Spotify's "smart shuffle," every song has an equal chance of playing next, helping you rediscover your music.
            </Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.featureItem}>
            <Text style={styles.explanationTitle}>🔄 Fisher-Yates Algorithm</Text>
            <Text style={styles.explanationText}>
              We use the gold standard for shuffling to ensure unbiased randomization, just like in scientific research.
            </Text>
          </View>

          <View style={styles.divider} />

          <View style={[styles.featureItem, { marginBottom: 0 }]}>
            <Text style={styles.explanationTitle}>🎵 Rediscover Your Music</Text>
            <Text style={styles.explanationText}>
              Break free from algorithmic bubbles. Hear forgotten gems, discover new favorites, and experience your playlist as it was meant to be.
            </Text>
          </View>
        </View>

        <View style={styles.quoteCard}>
          <Text style={styles.quote}>
            "Give Luck A Chance"
          </Text>
          <Text style={styles.quoteAuthor}>- Farhad Mohit</Text>
        </View>
      </View>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <LogOut size={20} color="#fff" />
          <Text style={styles.logoutText}>Disconnect from Spotify</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    padding: 20,
    paddingTop: 60,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
  },
  userSection: {
    alignItems: 'center',
    padding: 20,
  },
  userImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#333',
    marginBottom: 16,
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 16,
    color: '#b3b3b3',
  },
  howItWorksSection: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 16,
  },
  explanationCard: {
    backgroundColor: '#1a1a1a',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  featureItem: {
    marginBottom: 16,
  },
  divider: {
    height: 1,
    backgroundColor: '#333',
    marginHorizontal: -16,
    marginBottom: 16,
  },
  explanationTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1DB954',
    marginBottom: 8,
  },
  explanationText: {
    fontSize: 14,
    color: '#b3b3b3',
    lineHeight: 20,
  },
  quoteCard: {
    backgroundColor: '#1a1a1a',
    padding: 20,
    borderRadius: 12,
    marginTop: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333',
  },
  quote: {
    fontSize: 18,
    fontStyle: 'italic',
    color: '#1DB954',
    textAlign: 'center',
    marginBottom: 8,
    fontWeight: '600',
  },
  quoteAuthor: {
    fontSize: 14,
    color: '#b3b3b3',
    fontWeight: '500',
  },
  footer: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: 20,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#333',
    padding: 16,
    borderRadius: 12,
  },
  logoutText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});