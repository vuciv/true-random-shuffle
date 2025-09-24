import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { useSpotify } from '@/contexts/SpotifyContext';
import { useQueueShuffleMutation } from '@/hooks/useSpotifyQueries';
import { useRouter } from 'expo-router';
import { Music, Play, AlertCircle } from 'lucide-react-native';
import QueueProgressOverlay from '@/components/QueueProgressOverlay';
import AlertModal from '@/components/AlertModal';
import { hasActiveDevice, hasQueuedSongs } from '@/utils/spotify';
import type { SpotifyPlaylist } from '@/types/spotify';

export default function HomeTab() {
  const { 
    isAuthenticated, 
    isLoading, 
    user, 
    allPlaylistsWithLiked,
    playlistsLoading,
    savedTracksLoading,
    needsReauth,
    login
  } = useSpotify();
  
  // ✅ The component now manages its own queueing UI state
  const [queueStatus, setQueueStatus] = useState({
    isQueueing: false,
    progress: 0,
    total: 0,
    message: null as string | null,
    playlistImage: null as string | null,
  });

  // Alert modal state
  const [alertModal, setAlertModal] = useState({
    isVisible: false,
    type: 'generic' as 'no-device' | 'queue-not-empty' | 'generic',
    pendingPlaylist: null as SpotifyPlaylist | null,
    queueCount: 0,
  });

  // ✅ Instantiate the mutation hook right where you use it
  const { mutate: shufflePlaylist, isPending } = useQueueShuffleMutation(
    (progress) => setQueueStatus(prev => ({ ...prev, ...progress }))
  );

  const handleLogin = async () => {
    await login();
  };

  const handlePlaylistSelect = async (playlist: SpotifyPlaylist) => {
    try {
      // Check for active device first
      const hasDevice = await hasActiveDevice();
      if (!hasDevice) {
        setAlertModal({
          isVisible: true,
          type: 'no-device',
          pendingPlaylist: playlist,
          queueCount: 0,
        });
        return;
      }

      // Check if queue has songs
      const queueStatus = await hasQueuedSongs();
      if (queueStatus.hasQueue) {
        setAlertModal({
          isVisible: true,
          type: 'queue-not-empty',
          pendingPlaylist: playlist,
          queueCount: queueStatus.queueCount,
        });
        return;
      }

      // All checks passed, proceed with shuffle
      proceedWithShuffle(playlist);
    } catch (error) {
      console.error('Error checking prerequisites:', error);
      // If checks fail, still allow the user to try
      proceedWithShuffle(playlist);
    }
  };

  const proceedWithShuffle = (playlist: SpotifyPlaylist) => {
    // Set the initial state for the overlay before calling the mutation
    setQueueStatus({
      isQueueing: true,
      progress: 0,
      total: 0, // Will be updated by the mutation's progress callback
      message: 'Connecting to Spotify...',
      playlistImage: playlist.images?.[0]?.url || null
    });
    shufflePlaylist({ playlist });
  };

  const handleAlertPrimaryAction = async () => {
    const { pendingPlaylist } = alertModal;
    setAlertModal({ isVisible: false, type: 'generic', pendingPlaylist: null, queueCount: 0 });
    
    if (pendingPlaylist) {
      // Re-run the checks and proceed if they pass
      await handlePlaylistSelect(pendingPlaylist);
    }
  };

  const handleAlertClose = () => {
    setAlertModal({ isVisible: false, type: 'generic', pendingPlaylist: null, queueCount: 0 });
  };

    // Automatically trigger login if not authenticated
    React.useEffect(() => {
      console.log('[Auth Status]', { isAuthenticated, isLoading });
      if (!isAuthenticated && !isLoading) {
        handleLogin();
      }
    }, [isAuthenticated, isLoading]);

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#1DB954" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  // Show a loading state while attempting to log in
  if (!isAuthenticated) {
    return (
      <View style={styles.centerContainer}>
        <Music size={80} color="#1DB954" />
        <Text style={styles.title}>True Random Shuffle</Text>
        <Text style={styles.subtitle}>
          Connecting to Spotify...
        </Text>
        <ActivityIndicator size="large" color="#1DB954" style={styles.loginIndicator} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.welcomeText}>Welcome back, {user?.display_name}!</Text>
          <Text style={styles.headerSubtext}>Choose a playlist to shuffle</Text>
        </View>

        {/* Re-authentication banner */}
        {needsReauth && (
          <View style={styles.reauthBanner}>
            <AlertCircle size={20} color="#ff6b35" />
            <View style={styles.reauthContent}>
              <Text style={styles.reauthTitle}>Update Required</Text>
              <Text style={styles.reauthText}>
                To access your Liked Songs, please reconnect your Spotify account.
              </Text>
            </View>
            <TouchableOpacity 
              style={styles.reauthButton} 
              onPress={login}
            >
              <Text style={styles.reauthButtonText}>Reconnect</Text>
            </TouchableOpacity>
          </View>
        )}

        {playlistsLoading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color="#1DB954" />
            <Text style={styles.loadingText}>Loading playlists...</Text>
          </View>
        ) : allPlaylistsWithLiked.length === 0 ? (
          <View style={styles.centerContainer}>
            <Text style={styles.loadingText}>No playlists found</Text>
          </View>
        ) : (
          <View style={styles.playlistGrid}>
            {allPlaylistsWithLiked.map((playlist) => {
              const isLikedSongs = playlist.id === 'liked-songs';
              const isLikedSongsLoading = isLikedSongs && savedTracksLoading;
              
              return (
                <TouchableOpacity
                  key={playlist.id}
                  style={[
                    styles.playlistCard,
                    isLikedSongsLoading && styles.playlistCardLoading
                  ]}
                  onPress={() => handlePlaylistSelect(playlist)}
                  disabled={isPending || isLikedSongsLoading}
                >
                  <View style={styles.playlistImageContainer}>
                    <Image
                      source={{ 
                        uri: playlist.images?.[0]?.url || 'https://images.pexels.com/photos/1389429/pexels-photo-1389429.jpeg?auto=compress&cs=tinysrgb&w=300&h=300&fit=crop'
                      }}
                      style={[
                        styles.playlistImage,
                        isLikedSongsLoading && styles.playlistImageLoading
                      ]}
                    />
                    {isLikedSongsLoading && (
                      <View style={styles.playlistLoadingOverlay}>
                        <ActivityIndicator size="small" color="#1DB954" />
                      </View>
                    )}
                  </View>
                  <View style={styles.playlistInfo}>
                    <Text style={styles.playlistName} numberOfLines={2}>
                      {playlist.name}
                    </Text>
                    <Text style={styles.playlistMeta}>
                      {isLikedSongsLoading 
                        ? 'Loading your liked songs...' 
                        : `${playlist.tracks.total} tracks • ${playlist.owner.display_name}`
                      }
                    </Text>
                  </View>
                  <View style={[
                    styles.playButton,
                    isLikedSongsLoading && styles.playButtonDisabled
                  ]}>
                    {isLikedSongsLoading ? (
                      <ActivityIndicator size="small" color="#666" />
                    ) : (
                      <Play size={20} color="#000" fill="#1DB954" />
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* 🎨 New immersive progress overlay with blur and animations */}
      <QueueProgressOverlay
        isVisible={queueStatus.isQueueing || isPending}
        progress={queueStatus.progress}
        total={queueStatus.total}
        message={queueStatus.message}
        playlistImage={queueStatus.playlistImage}
      />

      {/* 🚨 Alert modal for device and queue checks */}
      <AlertModal
        isVisible={alertModal.isVisible}
        type={alertModal.type}
        queueCount={alertModal.queueCount}
        onPrimaryPress={handleAlertPrimaryAction}
        onSecondaryPress={handleAlertClose}
        onClose={handleAlertClose}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#000',
  },
  header: {
    padding: 20,
    paddingTop: 60,
  },
  welcomeText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  headerSubtext: {
    fontSize: 16,
    color: '#b3b3b3',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 24,
    marginBottom: 16,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#b3b3b3',
    textAlign: 'center',
    marginBottom: 32,
    paddingHorizontal: 20,
    lineHeight: 24,
  },
  loginButton: {
    backgroundColor: '#1DB954',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 25,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  loginButtonText: {
    color: '#000',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  loadingText: {
    color: '#b3b3b3',
    fontSize: 16,
    marginTop: 16,
  },
  playlistGrid: {
    padding: 16,
    gap: 16,
  },
  playlistCard: {
    flexDirection: 'row',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    marginBottom: 8,
  },
  playlistCardLoading: {
    opacity: 0.7,
  },
  playlistImageContainer: {
    position: 'relative',
    width: 60,
    height: 60,
  },
  playlistImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: '#333',
  },
  playlistImageLoading: {
    opacity: 0.5,
  },
  playlistLoadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 8,
  },
  playlistInfo: {
    flex: 1,
    marginLeft: 16,
  },
  playlistName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  playlistMeta: {
    color: '#b3b3b3',
    fontSize: 14,
  },
  playButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1DB954',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playButtonDisabled: {
    backgroundColor: '#333',
  },
  reauthBanner: {
    flexDirection: 'row',
    backgroundColor: '#2a1810',
    borderColor: '#ff6b35',
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 16,
    alignItems: 'center',
  },
  reauthContent: {
    flex: 1,
    marginLeft: 12,
    marginRight: 12,
  },
  reauthTitle: {
    color: '#ff6b35',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  reauthText: {
    color: '#b3b3b3',
    fontSize: 14,
    lineHeight: 18,
  },
  reauthButton: {
    backgroundColor: '#ff6b35',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  reauthButtonText: {
    color: '#000',
    fontSize: 14,
    fontWeight: '600',
  },
  loginIndicator: {
    marginTop: 24,
  },
});