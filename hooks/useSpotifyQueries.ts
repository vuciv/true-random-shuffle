import { useQuery, useMutation, useQueryClient, CancelledError } from '@tanstack/react-query';
import { SpotifyService, trueRandomShuffle } from '@/utils/spotify';
import type { SpotifyUser, SpotifyPlaylist, SpotifyTrack } from '@/types/spotify';

const spotifyService = SpotifyService;

// Query keys
export const spotifyQueryKeys = {
  user: ['spotify', 'user'] as const,
  playlists: ['spotify', 'playlists'] as const,
  playlistTracks: (playlistId: string) => ['spotify', 'playlist', playlistId, 'tracks'] as const,
  savedTracks: ['spotify', 'saved-tracks'] as const,
};

// User query
export function useSpotifyUser() {
  return useQuery({
    queryKey: spotifyQueryKeys.user,
    queryFn: async (): Promise<SpotifyUser | null> => {
      return await spotifyService.getCurrentUser();
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
    retry: 1,
  });
}

// Playlists query with improved caching
export function useSpotifyPlaylists(enabled: boolean = true) {
  return useQuery({
    queryKey: spotifyQueryKeys.playlists,
    queryFn: async (): Promise<SpotifyPlaylist[]> => {
      return await spotifyService.getUserPlaylists();
    },
    enabled,
    staleTime: 10 * 60 * 1000, // 10 minutes - playlists don't change often
    gcTime: 20 * 60 * 1000, // 20 minutes - keep in cache longer
    refetchOnWindowFocus: true,
    refetchOnMount: false, // Don't refetch if we have cached data
    placeholderData: (previousData) => previousData, // Keep previous data while refetching
  });
}

// Saved tracks query with aggressive caching
export function useSpotifySavedTracks(enabled: boolean = true) {
  return useQuery({
    queryKey: spotifyQueryKeys.savedTracks,
    queryFn: async (): Promise<SpotifyTrack[]> => {
      try {
        return await spotifyService.getUserSavedTracks();
      } catch (error: any) {
        // If insufficient scope, return empty array instead of failing
        if (error?.message?.includes('Insufficient client scope')) {
          console.warn('[useSpotifySavedTracks] Insufficient scope for saved tracks');
          return [];
        }
        // Re-throw other errors
        throw error;
      }
    },
    enabled,
    staleTime: 15 * 60 * 1000, // 15 minutes - liked songs don't change that often
    gcTime: 30 * 60 * 1000, // 30 minutes - keep in cache longer
    retry: (failureCount, error: any) => {
      // Don't retry on insufficient scope errors
      if (error?.message?.includes('Insufficient client scope')) {
        return false;
      }
      // Default retry behavior for other errors
      return failureCount < 3;
    },
    // Enable background refetch when user returns to app
    refetchOnWindowFocus: true,
    refetchOnMount: false, // Don't refetch if we have cached data
    // Keep previous data while refetching
    placeholderData: (previousData) => previousData,
  });
}

// Playlist tracks query
export function usePlaylistTracks(playlistId: string | null, enabled: boolean = true) {
  return useQuery({
    queryKey: playlistId ? spotifyQueryKeys.playlistTracks(playlistId) : ['spotify', 'playlist', 'none', 'tracks'],
    queryFn: async (): Promise<SpotifyTrack[]> => {
      if (!playlistId) return [];
      return await spotifyService.getPlaylistTracks(playlistId);
    },
    enabled: enabled && !!playlistId,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

// Queue shuffle mutation
interface QueueShuffleParams {
  playlist: SpotifyPlaylist;
  tracks?: SpotifyTrack[];
}

// Smart queue size limit for better performance and user experience
const MAX_QUEUE_SIZE = 150;

interface QueueShuffleProgress {
  isQueueing: boolean;
  progress: number;
  total: number;
  message: string | null;
}

async function batchQueueTracks({
  tracks,
  deviceId,
  onProgress,
}: {
  tracks: SpotifyTrack[];
  deviceId: string;
  onProgress: (progress: { progress: number; total: number }) => void;
}) {
  const trackUris = tracks.map(t => t.uri);
  const total = trackUris.length;
  let completed = 0;

  // Queue tracks one by one to avoid rate limiting
  for (let i = 0; i < trackUris.length; i++) {
    const uri = trackUris[i];
    
    // Retry logic with exponential backoff for 429 errors
    let retryCount = 0;
    const maxRetries = 3;
    let success = false;
    
    while (!success && retryCount <= maxRetries) {
      try {
        await spotifyService.addToQueue(uri, deviceId);
        success = true;
      } catch (error: any) {
        if (error?.status === 429 || (error?.message && error.message.includes('429'))) {
          retryCount++;
          if (retryCount <= maxRetries) {
            // Exponential backoff: 1s, 2s, 4s
            const delay = Math.pow(2, retryCount - 1) * 1000;
            console.log(`Rate limited, retrying in ${delay}ms (attempt ${retryCount}/${maxRetries})`);
            await new Promise(resolve => setTimeout(resolve, delay));
          } else {
            console.error(`Failed to queue track after ${maxRetries} retries:`, error);
            // Continue with next track instead of failing completely
          }
        } else {
          console.error('Error queueing track:', error);
          break; // Don't retry for non-rate-limit errors
        }
      }
    }

    completed++;
    onProgress({ progress: completed, total });

    // Add delay between requests to be respectful to the API
    // Skip delay on the last track
    if (i < trackUris.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 150)); // 150ms between requests
    }
  }
}

export function useQueueShuffleMutation(
  onProgressUpdate?: (progress: QueueShuffleProgress) => void
) {
  const queryClient = useQueryClient(); // Get the query client instance

  return useMutation({
    mutationFn: async (variables: QueueShuffleParams): Promise<boolean> => {
      const { playlist } = variables;
      let { tracks } = variables;

      // ✅ If tracks aren't provided, fetch them right here!
      if (!tracks || tracks.length === 0 || tracks.some(track => track.uri === null)) {
        // Check if this is the special "Liked Songs" playlist
        if (playlist.id === 'liked-songs') {
          // Fetch saved tracks instead of playlist tracks
          tracks = await queryClient.fetchQuery({
            queryKey: spotifyQueryKeys.savedTracks,
            queryFn: () => spotifyService.getUserSavedTracks(),
          });
        } else {
          // Use fetchQuery to get the data from the cache or network
          tracks = await queryClient.fetchQuery({
            queryKey: spotifyQueryKeys.playlistTracks(playlist.id),
            queryFn: () => spotifyService.getPlaylistTracks(playlist.id),
          });
        }
      }
      
      if (!tracks || tracks.length === 0) return false;

      const freshShuffled = trueRandomShuffle(tracks);
      const first = freshShuffled[0];
      
      // 🎵 Smart queue limit: Queue up to MAX_QUEUE_SIZE songs for better performance
      const rest = freshShuffled.slice(1);
      const tracksToQueue = rest.slice(0, MAX_QUEUE_SIZE - 1); // -1 because we're playing the first track
      const totalToQueue = tracksToQueue.length;

      console.log(`[QueueShuffle] Playlist has ${tracks.length} tracks, queueing ${totalToQueue + 1} tracks (first track + ${totalToQueue} queued)`);
      
      if (tracks.length > MAX_QUEUE_SIZE) {
        console.log(`[QueueShuffle] Large playlist detected (${tracks.length} tracks). Queueing first ${MAX_QUEUE_SIZE} songs for better performance.`);
      }

      // 1. Get Device and Play First Track
      const playlistUri = playlist.id === 'liked-songs' ? 'spotify:collection:tracks' : playlist.uri;
      const ensuredDeviceId = await spotifyService.ensureActiveDevice(first.uri, playlistUri);
      if (!ensuredDeviceId) {
        //await spotifyService.openSpotifyApp(playlist.id);
        return false;
      }
      await spotifyService.transferPlayback(ensuredDeviceId, true);
      await spotifyService.playUris([first.uri], ensuredDeviceId);

      // 2. Start Batch Queueing
      const initialMessage = tracks.length > MAX_QUEUE_SIZE 
        ? `Queueing ${MAX_QUEUE_SIZE} randomly selected songs...`
        : 'Preparing your truly random queue...';
        
      onProgressUpdate?.({
        isQueueing: true,
        progress: 0,
        total: totalToQueue,
        message: initialMessage,
      });

      // We pass down the onProgress callback, but no longer the signal
      await batchQueueTracks({
        tracks: tracksToQueue,
        deviceId: ensuredDeviceId,
        onProgress: ({ progress, total }) => {
          const progressMessage = tracks.length > MAX_QUEUE_SIZE
            ? `Queued ${progress} of ${total} songs (${progress + 1}/${MAX_QUEUE_SIZE} total)...`
            : `Queued ${progress} of ${total} tracks...`;
            
          onProgressUpdate?.({
            isQueueing: true,
            progress,
            total,
            message: progressMessage,
          });
        },
      });

      // 3. Finalize
      const finalMessage = tracks.length > MAX_QUEUE_SIZE 
        ? `✅ Queued ${MAX_QUEUE_SIZE} random songs! More will be added as you listen.`
        : null;
        
      onProgressUpdate?.({ 
        isQueueing: false, 
        progress: totalToQueue, 
        total: totalToQueue, 
        message: finalMessage 
      });
      
      // Show final message briefly before clearing
      if (finalMessage) {
        setTimeout(() => {
          onProgressUpdate?.({ isQueueing: false, progress: totalToQueue, total: totalToQueue, message: null });
        }, 2000);
      }
      
      //await spotifyService.openSpotifyApp(playlist.id);

      return true;
    },
    onError: (error) => {
      // CANCELLATION HANDLING: Check if the error is a CancelledError
      if (error instanceof CancelledError) {
        console.log('Shuffle was cancelled by React Query.');
        // We don't need to show a generic error message for a user-initiated cancellation
        onProgressUpdate?.({ isQueueing: false, progress: 0, total: 0, message: null });
        return;
      }
      
      // Handle actual errors
      console.error('Queue shuffle failed:', error);
      onProgressUpdate?.({ isQueueing: false, progress: 0, total: 0, message: 'An error occurred.' });
    },
  });
}
