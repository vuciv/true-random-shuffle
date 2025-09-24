export interface SpotifyUser {
  id: string;
  display_name: string;
  email: string;
  images: Array<{
    url: string;
    height: number;
    width: number;
  }>;
}

export interface SpotifyPlaylist {
  collaborative: boolean;
  description: string;
  external_urls: {
      spotify: string;
  };
  href: string;
  id: string;
  images: {
      url: string;
      height: number;
      width: number;
  }[];
  name: string;
  owner: {
      display_name: string;
      external_urls: {
          spotify: string;
      };
      href: string;
      id: string;
      type: "user";
      uri: string;
  };
  primary_color: string | null;
  public: boolean;
  snapshot_id: string;
  tracks: {
      href: string;
      total: number;
  };
  type: "playlist";
  uri: string;
}

export interface SpotifyTrack {
  id: string;
  name: string;
  uri: string;
  artists: Array<{
    name: string;
  }>;
  album: {
    name: string;
    images: Array<{
      url: string;
      height: number;
      width: number;
    }>;
  };
  duration_ms: number;
  preview_url: string | null;
  external_urls: {
    spotify: string;
  };
}

export interface PlaylistTracks {
  items: Array<{
    track: SpotifyTrack;
  }>;
  next: string | null;
  total: number;
}

export interface SavedTrackObject {
  added_at: string;
  track: SpotifyTrack;
}

export interface SavedTracks {
  items: Array<SavedTrackObject>;
  next: string | null;
  total: number;
  limit: number;
  offset: number;
  href: string;
  previous: string | null;
}