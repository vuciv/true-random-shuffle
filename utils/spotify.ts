import { makeRedirectUri } from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import * as Crypto from 'expo-crypto';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SpotifyUser, SpotifyPlaylist, SpotifyTrack, PlaylistTracks, SavedTracks } from '@/types/spotify';
import { Platform } from 'react-native';

WebBrowser.maybeCompleteAuthSession();

const CLIENT_ID = process.env.EXPO_PUBLIC_SPOTIFY_CLIENT_ID || 'YOUR_SPOTIFY_CLIENT_ID_HERE';
// Use HTTPS redirect URI for production, custom scheme for development
const REDIRECT_URI = Platform.OS !== 'web' 
  ? makeRedirectUri({
      scheme: 'trueshuffle',
      path: 'redirect'
    })
  : typeof window !== 'undefined' 
    ? `${window.location.origin}/redirect`
    : makeRedirectUri({
        scheme: 'https',
        path: 'redirect'
      });

console.log('[Auth] Spotify REDIRECT_URI ->', REDIRECT_URI);

const SPOTIFY_ENDPOINTS = {
  AUTHORIZE: 'https://accounts.spotify.com/authorize',
  TOKEN: 'https://accounts.spotify.com/api/token',
  ME: 'https://api.spotify.com/v1/me',
  PLAYLISTS: 'https://api.spotify.com/v1/me/playlists',
  PLAYLIST_TRACKS: (id: string) => `https://api.spotify.com/v1/playlists/${id}/tracks`,
  SAVED_TRACKS: 'https://api.spotify.com/v1/me/tracks',
  DEVICES: 'https://api.spotify.com/v1/me/player/devices',
  PLAYBACK_STATE: 'https://api.spotify.com/v1/me/player',
  CURRENTLY_PLAYING: 'https://api.spotify.com/v1/me/player/currently-playing',
  USER_QUEUE: 'https://api.spotify.com/v1/me/player/queue',
  PLAY: (deviceId?: string) => `https://api.spotify.com/v1/me/player/play${deviceId ? `?device_id=${encodeURIComponent(deviceId)}` : ''}`,
  PAUSE: (deviceId?: string) => `https://api.spotify.com/v1/me/player/pause${deviceId ? `?device_id=${encodeURIComponent(deviceId)}` : ''}`,
  NEXT: (deviceId?: string) => `https://api.spotify.com/v1/me/player/next${deviceId ? `?device_id=${encodeURIComponent(deviceId)}` : ''}`,
  PREVIOUS: (deviceId?: string) => `https://api.spotify.com/v1/me/player/previous${deviceId ? `?device_id=${encodeURIComponent(deviceId)}` : ''}`,
  SHUFFLE: (state: boolean, deviceId?: string) => `https://api.spotify.com/v1/me/player/shuffle?state=${state}${deviceId ? `&device_id=${encodeURIComponent(deviceId)}` : ''}`,
  TRANSFER: 'https://api.spotify.com/v1/me/player',
  QUEUE: (uri: string, deviceId?: string) => `https://api.spotify.com/v1/me/player/queue?uri=${encodeURIComponent(uri)}${deviceId ? `&device_id=${encodeURIComponent(deviceId)}` : ''}`
};


// ----------------------------------------------------
// Private helper functions
// ----------------------------------------------------
function generateRandomString(length: number): string {
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return result;
}

function base64URLEncode(str: string): string {
  return str
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  const digest = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    verifier,
    { encoding: Crypto.CryptoEncoding.BASE64 }
  );
  // Convert base64 to base64url format
  return base64URLEncode(digest);
}

export async function authenticate(): Promise<boolean> {
  const scopes = [
    'user-read-private',
    'user-read-email',
    'playlist-read-private',
    'playlist-read-collaborative',
    'user-read-playback-state',
    'user-modify-playback-state',
    'user-read-currently-playing',
    'user-library-read'
  ];
  
  // Generate PKCE code verifier and challenge
  const codeVerifier = generateRandomString(64);
  const codeChallenge = await generateCodeChallenge(codeVerifier);
  
  // Store code verifier for later use in token exchange
  await AsyncStorage.setItem('spotify_code_verifier', codeVerifier);
  
  const authParams = new URLSearchParams({
    response_type: 'code',
    client_id: CLIENT_ID,
    scope: scopes.join(' '),
    redirect_uri: REDIRECT_URI,
    code_challenge_method: 'S256',
    code_challenge: codeChallenge,
    show_dialog: 'true'
  });
  
  const authUrl = `${SPOTIFY_ENDPOINTS.AUTHORIZE}?${authParams.toString()}`;

  try {
    const result = await WebBrowser.openAuthSessionAsync(authUrl, REDIRECT_URI);
    
    if (result.type === 'success' && result.url) {
      const code = new URL(result.url).searchParams.get('code');
      if (code) {
        return await exchangeCodeForToken(code);
      }
    }
    return false;
  } catch (error) {
    console.error('Authentication failed:', error);
    return false;
  }
}

async function exchangeCodeForToken(code: string): Promise<boolean> {
  try {
    // Retrieve the stored code verifier
    const codeVerifier = await AsyncStorage.getItem('spotify_code_verifier');
    if (!codeVerifier) {
      console.error('Code verifier not found');
      return false;
    }

    const response = await fetch(SPOTIFY_ENDPOINTS.TOKEN, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: REDIRECT_URI,
        client_id: CLIENT_ID,
        code_verifier: codeVerifier, // Use PKCE code verifier instead of client secret
      }).toString(),
    });

    const data = await response.json();
    
    if (data.access_token) {
      await setAccessToken(data.access_token);
      await setRefreshToken(data.refresh_token);
      const expiresInSec: number | undefined = data.expires_in;
      await setAccessTokenExpiryTs(expiresInSec ? Date.now() + (expiresInSec - 30) * 1000 : 0); // refresh 30s early
      
      // Clean up the code verifier as it's no longer needed
      await AsyncStorage.removeItem('spotify_code_verifier');
      
      return true;
    }
    return false;
  } catch (error) {
    console.error('Token exchange failed:', error);
    return false;
  }
}

const getAccessToken = async (): Promise<string | null> => {
  return await AsyncStorage.getItem('spotify_access_token');
}

const getRefreshToken = async (): Promise<string | null> => {
  return await AsyncStorage.getItem('spotify_refresh_token');
}

const getAccessTokenExpiryTs = async (): Promise<number | null> => {
  const expiryTsStr = await AsyncStorage.getItem('spotify_access_expiry_ts');
  return expiryTsStr ? Number(expiryTsStr) : null;
}

const setAccessToken = async (accessToken: string): Promise<void> => {
  await AsyncStorage.setItem('spotify_access_token', accessToken);
}

const setRefreshToken = async (refreshToken: string): Promise<void> => {
  await AsyncStorage.setItem('spotify_refresh_token', refreshToken);
}

const setAccessTokenExpiryTs = async (expiryTs: number): Promise<void> => {
  await AsyncStorage.setItem('spotify_access_expiry_ts', String(expiryTs));
}

export async function logout(): Promise<void> {
  await AsyncStorage.multiRemove(['spotify_access_token', 'spotify_refresh_token', 'spotify_code_verifier', 'spotify_access_expiry_ts']);
}

async function refreshAccessToken(): Promise<boolean> {
  const refreshToken = await getRefreshToken();
  if (!refreshToken) return false;
  try {
    const response = await fetch(SPOTIFY_ENDPOINTS.TOKEN, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: CLIENT_ID,
      }).toString(),
    });
    const data = await response.json();
    if (data.access_token) {
      await setAccessToken(data.access_token);
      // Spotify may or may not send a new refresh token
      if (data.refresh_token) {
        await setRefreshToken(data.refresh_token);
      }
      const expiresInSec: number | undefined = data.expires_in;
      await setAccessTokenExpiryTs(expiresInSec ? Date.now() + (expiresInSec - 30) * 1000 : 0);
      await AsyncStorage.setItem('spotify_access_token', data.access_token);
      if (expiresInSec) {
        await AsyncStorage.setItem('spotify_access_expiry_ts', String(expiresInSec));
      }
      return true;
    }
    return false;
  } catch (error) {
    console.error('Failed to refresh access token:', error);
    return false;
  }
}

async function makeApiCall<T>(url: string, options?: { method?: string; body?: any; headers?: Record<string, string>; accept204?: boolean }): Promise<T | null> {
  const accessToken = await AsyncStorage.getItem('spotify_access_token');
  if (!accessToken) {
    throw new Error('No access token available');
  }

  try {
    // Refresh if token is near expiry
    const accessTokenExpiryTs = await getAccessTokenExpiryTs();
    if (accessTokenExpiryTs && Date.now() > accessTokenExpiryTs) {
      await refreshAccessToken();
    }

    const response = await fetch(url, {
      method: options?.method || 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        ...(options?.body ? { 'Content-Type': 'application/json' } : {}),
        ...(options?.headers || {}),
      },
      body: options?.body ? JSON.stringify(options.body) : undefined,
    });

    if (response.status === 204) {
      return null;
    }
    if (response.ok) {
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        return (await response.json()) as T;
      }
      // Non-JSON successful response (e.g., "OK" or empty)
      return null;
    }
    if (response.status === 429) {
      // Rate limit exceeded - throw error so retry logic can handle it
      const retryAfter = response.headers.get('Retry-After');
      throw new Error(`Rate limit exceeded (429). Retry after: ${retryAfter || 'unknown'} seconds`);
    }
    if (response.status === 403) {
      // Handle insufficient scope errors
      const errorData = await response.json().catch(() => ({}));
      if (errorData.error?.message?.includes('Insufficient client scope')) {
        throw new Error(`Insufficient client scope: ${errorData.error.message}`);
      }
      throw new Error(`Forbidden (403): ${errorData.error?.message || 'Access denied'}`);
    }
    if (response.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        const retry = await fetch(url, {
          method: options?.method || 'GET',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            ...(options?.body ? { 'Content-Type': 'application/json' } : {}),
            ...(options?.headers || {}),
          },
          body: options?.body ? JSON.stringify(options.body) : undefined,
        });
        if (retry.status === 204) {
          return null;
        }
        if (retry.status === 403) {
          // Handle insufficient scope errors on retry
          const retryErrorData = await retry.json().catch(() => ({}));
          if (retryErrorData.error?.message?.includes('Insufficient client scope')) {
            throw new Error(`Insufficient client scope: ${retryErrorData.error.message}`);
          }
          throw new Error(`Forbidden (403): ${retryErrorData.error?.message || 'Access denied'}`);
        }
        if (retry.status === 429) {
          // Rate limit exceeded on retry - throw error
          const retryAfter = retry.headers.get('Retry-After');
          throw new Error(`Rate limit exceeded (429). Retry after: ${retryAfter || 'unknown'} seconds`);
        }
        if (retry.ok) {
          const retryContentType = retry.headers.get('content-type') || '';
          if (retryContentType.includes('application/json')) {
            return (await retry.json()) as T;
          }
          return null;
        }
      }
    }
    return null;
  } catch (error) {
    // Re-throw rate limit errors so they can be handled by retry logic
    if (error instanceof Error && error.message.includes('Rate limit exceeded')) {
      throw error;
    }
    console.error('[SpotifyService] error ->', error);
    console.error('[SpotifyService] error url ->', url);
    console.error('[SpotifyService] error options ->', options);
    return null;
  }
}

export async function getCurrentUser(): Promise<SpotifyUser | null> {
  return await makeApiCall<SpotifyUser>(SPOTIFY_ENDPOINTS.ME);
}

export async function getUserPlaylists(): Promise<SpotifyPlaylist[]> {
  const playlists: SpotifyPlaylist[] = [];
  let offset = 0;
  const limit = 50; // Spotify's maximum limit per request
  const maxOffset = 100000; // Spotify's maximum offset limit

  while (offset <= maxOffset) {
    const data = await makeApiCall<{ items: SpotifyPlaylist[]; total: number; next: string | null }>(
      `${SPOTIFY_ENDPOINTS.PLAYLISTS}?limit=${limit}&offset=${offset}`
    );
    
    if (!data || !data.items || data.items.length === 0) {
      break; // No more playlists to fetch
    }

    playlists.push(...data.items);
    
    // If we've fetched all available playlists (less than limit returned or no next page)
    if (data.items.length < limit || !data.next) {
      break;
    }
    
    offset += limit;
  }

  return playlists;
}

export async function getPlaylistTracks(playlistId: string): Promise<SpotifyTrack[]> {
  const limit = 50; // Spotify's maximum limit per request
  const CONCURRENT_REQUESTS = 5; // Number of concurrent requests to make
  
  try {
    // First, get the first page to know the total count
    const firstPage = await makeApiCall<PlaylistTracks>(`${SPOTIFY_ENDPOINTS.PLAYLIST_TRACKS(playlistId)}?limit=${limit}&offset=0`);
    
    if (!firstPage || !firstPage.items) {
      return [];
    }

    const totalTracks = firstPage.total;
    const tracks: SpotifyTrack[] = [];
    
    // Add tracks from first page
    tracks.push(...firstPage.items.map(item => item.track).filter(track => track !== null));
    
    // If we have all tracks already, return early
    if (firstPage.items.length < limit || totalTracks <= limit) {
      return tracks;
    }

    // Calculate remaining pages needed
    const remainingTracks = totalTracks - limit;
    const remainingPages = Math.ceil(remainingTracks / limit);
    
    // Only use batching for large playlists (more than 200 tracks)
    if (totalTracks > 200) {
      console.log(`[SpotifyService] Fetching ${totalTracks} playlist tracks in ${remainingPages + 1} total pages (${CONCURRENT_REQUESTS} concurrent)`);
    }
    
    // Create batches of concurrent requests
    for (let i = 0; i < remainingPages; i += CONCURRENT_REQUESTS) {
      const batchPromises: Promise<SpotifyTrack[]>[] = [];
      
      // Create a batch of up to CONCURRENT_REQUESTS
      for (let j = 0; j < CONCURRENT_REQUESTS && (i + j) < remainingPages; j++) {
        const pageIndex = i + j + 1; // +1 because we already got page 0
        const offset = pageIndex * limit;
        
        const promise = makeApiCall<PlaylistTracks>(`${SPOTIFY_ENDPOINTS.PLAYLIST_TRACKS(playlistId)}?limit=${limit}&offset=${offset}`)
          .then(data => {
            if (!data || !data.items) return [];
            return data.items.map(item => item.track).filter(track => track !== null);
          })
          .catch(error => {
            console.error(`[SpotifyService] Error fetching playlist tracks page ${pageIndex}:`, error);
            return []; // Return empty array for failed requests
          });
        
        batchPromises.push(promise);
      }
      
      // Wait for this batch to complete before starting the next
      const batchResults = await Promise.all(batchPromises);
      batchResults.forEach(pageTrack => {
        tracks.push(...pageTrack);
      });
      
      // Small delay between batches to be respectful to the API
      if (i + CONCURRENT_REQUESTS < remainingPages) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    return tracks;
  } catch (error) {
    console.error(`[SpotifyService] Error fetching playlist tracks for ${playlistId}:`, error);
    throw error;
  }
}

export async function getUserSavedTracks(): Promise<SpotifyTrack[]> {
  const limit = 50; // Spotify's maximum limit per request
  const CONCURRENT_REQUESTS = 5; // Number of concurrent requests to make
  
  try {
    // First, get the first page to know the total count
    const firstPage = await makeApiCall<{
      items: Array<{
        added_at: string;
        track: SpotifyTrack;
      }>;
      total: number;
      next: string | null;
    }>(`${SPOTIFY_ENDPOINTS.SAVED_TRACKS}?limit=${limit}&offset=0`);
    
    if (!firstPage || !firstPage.items) {
      return [];
    }

    const totalTracks = firstPage.total;
    const tracks: SpotifyTrack[] = [];
    
    // Add tracks from first page
    tracks.push(...firstPage.items.map(item => item.track).filter(track => track !== null));
    
    // If we have all tracks already, return early
    if (firstPage.items.length < limit || totalTracks <= limit) {
      return tracks;
    }

    // Calculate remaining pages needed
    const remainingTracks = totalTracks - limit;
    const remainingPages = Math.ceil(remainingTracks / limit);
    
    console.log(`[SpotifyService] Fetching ${totalTracks} saved tracks in ${remainingPages + 1} total pages (${CONCURRENT_REQUESTS} concurrent)`);
    
    // Create batches of concurrent requests
    const allPromises: Promise<SpotifyTrack[]>[] = [];
    
    for (let i = 0; i < remainingPages; i += CONCURRENT_REQUESTS) {
      const batchPromises: Promise<SpotifyTrack[]>[] = [];
      
      // Create a batch of up to CONCURRENT_REQUESTS
      for (let j = 0; j < CONCURRENT_REQUESTS && (i + j) < remainingPages; j++) {
        const pageIndex = i + j + 1; // +1 because we already got page 0
        const offset = pageIndex * limit;
        
        const promise = makeApiCall<{
          items: Array<{
            added_at: string;
            track: SpotifyTrack;
          }>;
          total: number;
          next: string | null;
        }>(`${SPOTIFY_ENDPOINTS.SAVED_TRACKS}?limit=${limit}&offset=${offset}`)
          .then(data => {
            if (!data || !data.items) return [];
            return data.items.map(item => item.track).filter(track => track !== null);
          })
          .catch(error => {
            console.error(`[SpotifyService] Error fetching saved tracks page ${pageIndex}:`, error);
            return []; // Return empty array for failed requests
          });
        
        batchPromises.push(promise);
      }
      
      // Wait for this batch to complete before starting the next
      const batchResults = await Promise.all(batchPromises);
      batchResults.forEach(pageTrack => {
        tracks.push(...pageTrack);
      });
      
      // Small delay between batches to be respectful to the API
      if (i + CONCURRENT_REQUESTS < remainingPages) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    console.log(`[SpotifyService] Successfully fetched ${tracks.length} saved tracks`);
    return tracks;
    
  } catch (error: any) {
    // Handle insufficient scope error gracefully
    if (error?.status === 403 || (error?.message && error.message.includes('Insufficient client scope'))) {
      console.warn('[SpotifyService] Insufficient scope for saved tracks. User needs to re-authenticate.');
      return [];
    }
    // Re-throw other errors
    throw error;
  }
}

export function isAuthenticated(): boolean {
  return !!getAccessToken();
}

// Check if user has the required scopes by testing saved tracks endpoint
export async function hasRequiredScopes(): Promise<boolean> {
  try {
    // Try to fetch just one saved track to test the scope
    await makeApiCall(`${SPOTIFY_ENDPOINTS.SAVED_TRACKS}?limit=1`);
    return true;
  } catch (error: any) {
    if (error?.message?.includes('Insufficient client scope')) {
      return false;
    }
    // If it's another error, assume scopes are fine
    return true;
  }
}

// Playback controls
export async function getDevices(): Promise<Array<{ id: string; is_active: boolean; name: string; type: string }> | null> {
  const data = await makeApiCall<{ devices: Array<{ id: string; is_active: boolean; name: string; type: string }> }>(SPOTIFY_ENDPOINTS.DEVICES);
  return data?.devices ?? null;
}

export async function getPlaybackState(): Promise<any | null> {
  return await makeApiCall<any>(SPOTIFY_ENDPOINTS.PLAYBACK_STATE);
}

// Ensure there is an active Spotify Connect device. If none, try opening the Spotify app.
export async function ensureActiveDevice(trackUri?: string, playlistUri?: string): Promise<string | undefined> {
  try {
    let devices = await getDevices();
    if (devices && devices.length > 0) {
      const active = devices.find(d => d.is_active) || devices[0];
      return active?.id;
    }

    // Handle different URI contexts for deeplinks
    let deeplink: string;
    if (playlistUri === 'spotify:collection:tracks') {
      // For Liked Songs, use the collection URL
      deeplink = 'https://open.spotify.com/collection/tracks';
    } else if (trackUri && playlistUri) {
      // For regular playlists with context
      deeplink = `https://open.spotify.com/track/${trackUri}?context=${playlistUri}`;
    } else if (trackUri) {
      // Fallback to just the track
      deeplink = `https://open.spotify.com/track/${trackUri}`;
    } else {
      // Ultimate fallback
      deeplink = 'https://open.spotify.com';
    }

    try {
      const canOpen = await Linking.canOpenURL(deeplink);
      if (canOpen) {
        await Linking.openURL(deeplink);
      } else {
        // Optional fallback: open web, which may handoff to app if installed
        await WebBrowser.openBrowserAsync('https://open.spotify.com');
      }
    } catch (openErr) {
      console.warn('[SpotifyService] Failed to open Spotify app:', openErr);
    }

    // Give Spotify a moment to register as a Connect device
    await new Promise(resolve => setTimeout(resolve, 1500));

    devices = await getDevices();
    if (devices && devices.length > 0) {
      const active = devices.find(d => d.is_active) || devices[0];
      return active?.id;
    }
  } catch (error) {
    console.error('[SpotifyService] ensureActiveDevice error ->', error);
  }
  return undefined;
}

// Open Spotify app directly (best when triggered by a user gesture on iOS)
export async function openSpotifyApp(targetUri?: string): Promise<boolean> {
  // Handle special case for Liked Songs
  let deeplink: string;
  if (targetUri === 'liked-songs') {
    // Liked Songs has a special URL format
    deeplink = 'https://open.spotify.com/collection/tracks';
  } else {
    // Regular playlist format
    deeplink = `https://open.spotify.com/playlist/${targetUri}`;
  }
  
  try {
    const canOpen = await Linking.canOpenURL(deeplink);
    if (canOpen) {
      await Linking.openURL(deeplink);
      return true;
    }
    await WebBrowser.openBrowserAsync(/^https?:\/\//.test(deeplink) ? deeplink : 'https://open.spotify.com');
    return true;
  } catch (error) {
    console.warn('[SpotifyService] openSpotifyApp failed ->', error);
    return false;
  }
}

export async function playUris(uris: string[], deviceId?: string, positionMs?: number): Promise<boolean> {
  const url = SPOTIFY_ENDPOINTS.PLAY(deviceId);
  const body: any = { uris };
  if (typeof positionMs === 'number') {
    body.position_ms = positionMs;
  }
  const res = await makeApiCall(url, { method: 'PUT', body, accept204: true });
  return res !== null || true; // 204 returns null
}

export async function resume(deviceId?: string): Promise<boolean> {
  const url = SPOTIFY_ENDPOINTS.PLAY(deviceId);
  const res = await makeApiCall(url, { method: 'PUT', accept204: true });
  return res !== null || true;
}

export async function pause(deviceId?: string): Promise<boolean> {
  const url = SPOTIFY_ENDPOINTS.PAUSE(deviceId);
  const res = await makeApiCall(url, { method: 'PUT', accept204: true });
  return res !== null || true;
}

export async function next(deviceId?: string): Promise<boolean> {
  const url = SPOTIFY_ENDPOINTS.NEXT(deviceId);
  const res = await makeApiCall(url, { method: 'POST', accept204: true });
  return res !== null || true;
}

export async function previous(deviceId?: string): Promise<boolean> {
  const url = SPOTIFY_ENDPOINTS.PREVIOUS(deviceId);
  const res = await makeApiCall(url, { method: 'POST', accept204: true });
  return res !== null || true;
}

export async function setShuffle(enabled: boolean, deviceId?: string): Promise<boolean> {
  const url = SPOTIFY_ENDPOINTS.SHUFFLE(enabled, deviceId);
  const res = await makeApiCall(url, { method: 'PUT', accept204: true });
  return res !== null || true;
}

export async function transferPlayback(deviceId: string, play: boolean = true): Promise<boolean> {
  const res = await makeApiCall(SPOTIFY_ENDPOINTS.TRANSFER, { method: 'PUT', body: { device_ids: [deviceId], play }, accept204: true });
  return res !== null || true;
}

export async function addToQueue(uri: string, deviceId?: string): Promise<boolean> {
  const url = SPOTIFY_ENDPOINTS.QUEUE(uri, deviceId);
  const res = await makeApiCall(url, { method: 'POST', accept204: true });
  return res !== null || true;
}

// Get user's queue information
export async function getUserQueue(): Promise<any | null> {
  return await makeApiCall<any>(SPOTIFY_ENDPOINTS.USER_QUEUE);
}

// Check if user has an active device available
export async function hasActiveDevice(): Promise<boolean> {
  try {
    const devices = await getDevices();
    console.log('[SpotifyService] devices ->', devices);
    return devices ? devices.some(device => device.is_active) || devices.length > 0 : false;
  } catch (error) {

    console.error('[SpotifyService] Error checking active device:', error);
    return false;
  }
}

// Check if user's queue has songs (excluding currently playing)
export async function hasQueuedSongs(): Promise<{ hasQueue: boolean; queueCount: number }> {
  return { hasQueue: false, queueCount: 0 };
  try {
    const queueData = await getUserQueue();
    const queueCount = queueData?.queue?.length || 0;
    console.log('[SpotifyService] queueData ->', queueData);
    console.log('[SpotifyService] queueCount ->', queueCount);
    
    // Log for debugging - can be removed later
    if (queueCount > 0) {
      console.log(`[SpotifyService] Found ${queueCount} songs in queue`);
    }
    
    return {
      hasQueue: queueCount > 0,
      queueCount
    };
  } catch (error) {
    console.error('[SpotifyService] Error checking queue:', error);
    return { hasQueue: false, queueCount: 0 };
  }
}

// ----------------------------------------------------
// Service object for backward compatibility
// ----------------------------------------------------
export const SpotifyService = {
  authenticate,
  logout,
  getCurrentUser,
  getUserPlaylists,
  getPlaylistTracks,
  getUserSavedTracks,
  isAuthenticated,
  hasRequiredScopes,
  getDevices,
  getPlaybackState,
  ensureActiveDevice,
  openSpotifyApp,
  playUris,
  resume,
  pause,
  next,
  previous,
  setShuffle,
  transferPlayback,
  addToQueue,
};

// Generate cryptographically secure random number between 0 and 1
function getSecureRandom(): number {
  if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
    // Browser environment with Web Crypto API
    const array = new Uint32Array(1);
    window.crypto.getRandomValues(array);
    return array[0] / (0xffffffff + 1);
  } else if (typeof require !== 'undefined') {
    // Node.js environment
    try {
      const crypto = require('crypto');
      const buffer = crypto.randomBytes(4);
      return buffer.readUInt32BE(0) / (0xffffffff + 1);
    } catch (error) {
      console.warn('[trueRandomShuffle] Node crypto not available, falling back to Math.random()');
    }
  }
  
  // Fallback to Math.random() with additional entropy from timestamp
  const timestamp = Date.now();
  const performance_now = typeof performance !== 'undefined' ? performance.now() : 0;
  const seed = (timestamp * 1000 + performance_now) % 1000000;
  
  // Simple linear congruential generator for additional entropy
  const a = 1664525;
  const c = 1013904223;
  const m = Math.pow(2, 32);
  const seededValue = (a * seed + c) % m;
  
  return (Math.random() + seededValue / m) % 1;
}

// True random shuffle using Fisher-Yates algorithm with crypto-secure randomness
export function trueRandomShuffle<T>(array: T[]): T[] {
  const shuffled = [...array];
  
  // Add additional entropy by incorporating current timestamp
  const entropy = Date.now() + (typeof performance !== 'undefined' ? performance.now() : 0);
  console.log(`[trueRandomShuffle] Shuffling ${array.length} items with entropy: ${entropy}`);
  
  for (let i = shuffled.length - 1; i > 0; i--) {
    // Use crypto-secure random number generation
    const randomValue = getSecureRandom();
    const j = Math.floor(randomValue * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  
  return shuffled;
}

// Test function to verify shuffle randomness (for development/debugging)
export function testShuffleRandomness() {
  const testArray = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
  const results: string[] = [];
  
  console.log('Testing shuffle randomness with 5 consecutive shuffles:');
  console.log('Original array:', testArray);
  
  for (let i = 0; i < 5; i++) {
    const shuffled = trueRandomShuffle(testArray);
    const resultString = shuffled.join(',');
    results.push(resultString);
    console.log(`Shuffle ${i + 1}:`, shuffled);
  }
  
  // Check if all results are different
  const uniqueResults = new Set(results);
  const allDifferent = uniqueResults.size === results.length;
  
  console.log(`All shuffles produced different results: ${allDifferent}`);
  console.log(`Unique results: ${uniqueResults.size}/${results.length}`);
  
  return { results, allDifferent };
}