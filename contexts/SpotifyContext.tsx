import React, { createContext, useContext, useState, ReactNode, useMemo } from 'react';
import { SpotifyService } from '@/utils/spotify';
import type { SpotifyUser, SpotifyPlaylist, SpotifyTrack } from '@/types/spotify';
import { 
  useSpotifyUser, 
  useSpotifyPlaylists,
  useSpotifySavedTracks 
} from '@/hooks/useSpotifyQueries';
import { useQueryClient } from '@tanstack/react-query';
import { spotifyQueryKeys } from '@/hooks/useSpotifyQueries';

interface SpotifyContextType {
  user: SpotifyUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  playlists: SpotifyPlaylist[];
  playlistsLoading: boolean;
  savedTracks: SpotifyTrack[];
  savedTracksLoading: boolean;
  allPlaylistsWithLiked: SpotifyPlaylist[]; // Playlists with "Liked Songs" at the top
  needsReauth: boolean; // Whether user needs to re-authenticate for new scopes
  currentPlaylist: SpotifyPlaylist | null; // We can still keep this for UI purposes
  login: () => Promise<boolean>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  selectPlaylist: (playlist: SpotifyPlaylist) => void;
}

const SpotifyContext = createContext<SpotifyContextType | undefined>(undefined);

export function SpotifyProvider({ children }: { children: ReactNode }) {
  const [currentPlaylist, setCurrentPlaylist] = useState<SpotifyPlaylist | null>(null);
  const [needsReauth, setNeedsReauth] = useState(false);
  const spotifyService = SpotifyService;
  const queryClient = useQueryClient();
  
  const { data: user, isLoading: userLoading, refetch: refetchUser } = useSpotifyUser();
  const isAuthenticated = !!user;
  
  const { data: playlists = [], isLoading: playlistsLoading } = useSpotifyPlaylists(isAuthenticated);
  
  // Start loading saved tracks immediately when authenticated, but don't block UI
  const { 
    data: savedTracks = [], 
    isLoading: savedTracksLoading, 
    error: savedTracksError,
    isFetching: savedTracksFetching 
  } = useSpotifySavedTracks(isAuthenticated);
  
  // Consider saved tracks as "loading" if they're fetching for the first time
  const savedTracksActuallyLoading = savedTracksLoading || (savedTracksFetching && savedTracks.length === 0);

  // Check if we need re-authentication based on saved tracks error
  React.useEffect(() => {
    if (isAuthenticated && savedTracksError && 
        (savedTracksError as any)?.message?.includes('Insufficient client scope')) {
      setNeedsReauth(true);
    } else if (isAuthenticated && savedTracks.length > 0) {
      // If we successfully got saved tracks, we have the right scopes
      setNeedsReauth(false);
    }
  }, [isAuthenticated, savedTracksError, savedTracks.length]);

  // Create a synthetic "Liked Songs" playlist - show it even while loading
  const likedSongsPlaylist: SpotifyPlaylist | null = useMemo(() => {
    if (!user) return null;
    
    // Show liked songs playlist even if tracks are still loading
    // We'll show the actual count when available, or "Loading..." when not
    const trackCount = savedTracksLoading ? 0 : savedTracks.length;
    
    return {
      collaborative: false,
      description: savedTracksActuallyLoading ? "Loading your liked songs..." : "Your Liked Songs",
      external_urls: {
        spotify: "spotify:collection:tracks"
      },
      href: "https://api.spotify.com/v1/me/tracks",
      id: "liked-songs",
      images: [
        {
          url: "https://misc.scdn.co/liked-songs/liked-songs-300.png",
          height: 300,
          width: 300
        }
      ],
      name: "Liked Songs",
      owner: {
        display_name: user.display_name,
        external_urls: {
          spotify: `https://open.spotify.com/user/${user.id}`
        },
        href: `https://api.spotify.com/v1/users/${user.id}`,
        id: user.id,
        type: "user" as const,
        uri: `spotify:user:${user.id}`
      },
      primary_color: null,
      public: false,
      snapshot_id: "liked-songs-snapshot",
      tracks: {
        href: "https://api.spotify.com/v1/me/tracks",
        total: trackCount
      },
      type: "playlist" as const,
      uri: "spotify:collection:tracks"
    };
  }, [user, savedTracks.length, savedTracksActuallyLoading]);

  // Combine liked songs with regular playlists (liked songs at the top)
  const allPlaylistsWithLiked = useMemo(() => {
    if (!likedSongsPlaylist) return playlists;
    return [likedSongsPlaylist, ...playlists];
  }, [likedSongsPlaylist, playlists]);

  const login = async (): Promise<boolean> => {
    const success = await spotifyService.authenticate();
    
    if (success) {
      await refetchUser();
      setNeedsReauth(false); // Reset reauth flag on successful login
      
      // Prefetch saved tracks in the background after successful login
      setTimeout(() => {
        queryClient.prefetchQuery({
          queryKey: spotifyQueryKeys.savedTracks,
          queryFn: () => spotifyService.getUserSavedTracks(),
          staleTime: 15 * 60 * 1000,
        });
      }, 1000); // Small delay to let the main UI load first
      
      return true;
    }
    
    return false;
  };

  const logout = async (): Promise<void> => {
    await spotifyService.logout();
    setCurrentPlaylist(null);
    await refetchUser();
  };

  const selectPlaylist = (playlist: SpotifyPlaylist): void => {
    setCurrentPlaylist(playlist);
  };

  const refreshUser = async (): Promise<void> => {
    await refetchUser();
  };

  return (
    <SpotifyContext.Provider value={{
      user: user || null,
      isAuthenticated,
      isLoading: userLoading,
      playlists,
      playlistsLoading,
      savedTracks,
      savedTracksLoading: savedTracksActuallyLoading,
      allPlaylistsWithLiked,
      needsReauth,
      currentPlaylist,
      login,
      logout,
      refreshUser,
      selectPlaylist,
    }}>
      {children}
    </SpotifyContext.Provider>
  );
}

export function useSpotify() {
  const context = useContext(SpotifyContext);
  if (context === undefined) {
    throw new Error('useSpotify must be used within a SpotifyProvider');
  }
  return context;
}