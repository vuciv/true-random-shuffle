import { useEffect } from 'react';
import * as WebBrowser from 'expo-web-browser';
import { View, Text, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSpotify } from '@/contexts/SpotifyContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SPOTIFY_ENDPOINTS = {
  TOKEN: 'https://accounts.spotify.com/api/token',
};

const CLIENT_ID = process.env.EXPO_PUBLIC_SPOTIFY_CLIENT_ID || 'YOUR_SPOTIFY_CLIENT_ID_HERE';

export default function RedirectScreen() {
  const router = useRouter();
  const { code, error } = useLocalSearchParams<{ code?: string; error?: string }>();
  const { refreshUser } = useSpotify();

  useEffect(() => {
    const handleCallback = async () => {
      if (error) {
        console.error('OAuth error:', error);
        router.replace('/');
        return;
      }

      if (code) {
        try {
          const success = await exchangeCodeForToken(code);
          if (success) {
            // Refresh user data in context
            await refreshUser();
            router.replace('/(tabs)');
          } else {
            router.replace('/');
          }
        } catch (err) {
          console.error('Token exchange failed:', err);
          router.replace('/');
        }
      } else {
        // No code parameter, redirect back to main screen
        router.replace('/');
      }
    };

    handleCallback();
  }, [code, error, router, refreshUser]);

  return (
    <View style={{ 
      flex: 1, 
      justifyContent: 'center', 
      alignItems: 'center',
      backgroundColor: '#000000'
    }}>
      <ActivityIndicator size="large" color="#1DB954" />
      <Text style={{ 
        color: '#FFFFFF', 
        marginTop: 16,
        fontSize: 16
      }}>
        Completing authentication...
      </Text>
    </View>
  );
}

async function exchangeCodeForToken(code: string): Promise<boolean> {
  try {
    // Retrieve the stored code verifier
    const codeVerifier = await AsyncStorage.getItem('spotify_code_verifier');
    if (!codeVerifier) {
      console.error('Code verifier not found');
      return false;
    }

    // Get the redirect URI (same as used in auth)
    const redirectUri = window.location.origin + '/redirect';

    const response = await fetch(SPOTIFY_ENDPOINTS.TOKEN, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        client_id: CLIENT_ID,
        code_verifier: codeVerifier,
      }).toString(),
    });

    const data = await response.json();
    
    if (data.access_token) {
      await AsyncStorage.setItem('spotify_access_token', data.access_token);
      if (data.refresh_token) {
        await AsyncStorage.setItem('spotify_refresh_token', data.refresh_token);
      }
      const expiresInSec: number | undefined = data.expires_in;
      if (expiresInSec) {
        await AsyncStorage.setItem('spotify_access_expiry_ts', String(Date.now() + (expiresInSec - 30) * 1000));
      }
      
      // Clean up the code verifier as it's no longer needed
      await AsyncStorage.removeItem('spotify_code_verifier');
      
      return true;
    } else {
      console.error('Token exchange failed:', data);
      return false;
    }
  } catch (error) {
    console.error('Token exchange failed:', error);
    return false;
  }
}
