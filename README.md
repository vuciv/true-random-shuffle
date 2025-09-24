# True Shuffle

Experience true randomness in your music. Break free from algorithmic bubbles with mathematically pure shuffle using the Fisher-Yates algorithm.

## Features

- **True Random Shuffle**: Uses cryptographically secure randomness with the Fisher-Yates algorithm
- **Spotify Integration**: Connect with your Spotify account to access playlists and liked songs
- **Cross-Platform**: Built with Expo and React Native for iOS, Android, and Web
- **Modern UI**: Beautiful, dark-themed interface optimized for music discovery

## Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/vuciv/true-random-shuffle.git
   cd true-random-shuffle
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure Spotify API**
   - Create a Spotify app at [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
   - Create a `.env` file in the root directory:
     ```
     EXPO_PUBLIC_SPOTIFY_CLIENT_ID=your_spotify_client_id_here
     ```
   - Add redirect URIs to your Spotify app:
     - For development: `trueshuffle://redirect`
     - For web: `https://yourdomain.com/redirect`

4. **Run the app**
   ```bash
   npm run dev
   ```

## Deployment

The app can be deployed to various platforms:

- **Web**: Use `npm run build:web` to build for web deployment
- **Mobile**: Use Expo Application Services (EAS) for mobile app builds
- **Netlify**: Use the included `deploy.sh` script for web deployment

## Technologies

- **Expo** - Cross-platform development framework
- **React Native** - Mobile app framework
- **TypeScript** - Type-safe JavaScript
- **Spotify Web API** - Music streaming integration
- **React Query** - Data fetching and caching

## License

This project is open source and available under the MIT License.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request. For major changes, please open an issue first to discuss what you would like to change.
