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
// `||` (not `??`): CI passes unset GitHub vars through as empty strings.
const iosBundleId = process.env.JAMEZ_IOS_BUNDLE_ID || 'com.joelyoung.jamez'

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
    bundleIdentifier: iosBundleId,
    buildNumber: process.env.JAMEZ_IOS_BUILD_NUMBER || '1',
    supportsTablet: true,
    infoPlist: {
      NSCameraUsageDescription:
        "Jamez uses the camera to scan a host's QR code so you can join their game session.",
      NSPhotoLibraryUsageDescription:
        'Jamez uses your photo library so you can set a profile photo friends see at the table.',
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  android: {
    package: 'com.joelyoung.jamez',
    // Shrink the window above the keyboard so ScrollViews can reach covered fields.
    softwareKeyboardLayoutMode: 'resize',
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
    [
      'expo-image-picker',
      {
        photosPermission:
          'Jamez uses your photo library so you can set a profile photo friends see at the table.',
      },
    ],
    [
      'expo-widgets',
      {
        // Widget extension + App Group for Live Activities (Lock Screen card +
        // Dynamic Island). No home-screen widgets yet — WidgetLiveActivity is
        // always registered by the extension even with an empty `widgets` list.
        bundleIdentifier: `${iosBundleId}.widgets`,
        groupIdentifier: `group.${iosBundleId}`,
        frequentUpdates: true,
        widgets: [],
      },
    ],
  ],
  extra: {
    webAppUrl: 'https://playjamez.com',
  },
})
