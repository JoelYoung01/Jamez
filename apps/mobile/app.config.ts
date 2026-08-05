import type { ConfigContext, ExpoConfig } from 'expo/config'

/**
 * Jamez iOS (and Android) Expo config.
 *
 * Continuous Native Generation: the `ios/` / `android/` projects are generated
 * by `expo prebuild` (locally or in CI) and are never committed.
 *
 * CI / environment overrides:
 * - JAMEZ_IOS_BUNDLE_ID    — Apple bundle identifier (must match App Store Connect)
 * - JAMEZ_IOS_BUILD_NUMBER — CFBundleVersion; unique per TestFlight upload
 */
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Jamez',
  slug: 'jamez',
  version: '0.1.0',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  scheme: 'jamez',
  userInterfaceStyle: 'dark',
  backgroundColor: '#0e0e12',
  ios: {
    // `||` (not `??`): CI passes unset GitHub vars through as empty strings.
    bundleIdentifier: process.env.JAMEZ_IOS_BUNDLE_ID || 'com.joelyoung.jamez',
    buildNumber: process.env.JAMEZ_IOS_BUILD_NUMBER || '1',
    supportsTablet: true,
    infoPlist: {
      NSCameraUsageDescription:
        "Jamez uses the camera to scan a host's QR code so you can join their game session.",
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  android: {
    package: 'com.joelyoung.jamez',
    adaptiveIcon: {
      backgroundColor: '#0e0e12',
      foregroundImage: './assets/images/android-icon-foreground.png',
      backgroundImage: './assets/images/android-icon-background.png',
      monochromeImage: './assets/images/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
  },
  web: {
    output: 'static',
    favicon: './assets/images/favicon.png',
  },
  plugins: [
    'expo-router',
    [
      'expo-splash-screen',
      {
        backgroundColor: '#0e0e12',
        image: './assets/images/splash-icon.png',
        imageWidth: 120,
      },
    ],
    [
      'expo-camera',
      {
        cameraPermission:
          "Jamez uses the camera to scan a host's QR code so you can join their game session.",
      },
    ],
  ],
  extra: {
    webAppUrl: 'https://playjames.com',
  },
})
