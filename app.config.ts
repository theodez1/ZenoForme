import { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "Zeno Forme",
  slug: "zeno-forme",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/icon.png",
  userInterfaceStyle: "dark",
  splash: {
    resizeMode: "contain",
    backgroundColor: "#0D0D0D"
  },
  assetBundlePatterns: [
    "**/*"
  ],
  plugins: [
    "expo-notifications",
    "expo-camera",
    "react-native-health",
    [
      "expo-build-properties",
      {
        "ios": {
          "deploymentTarget": "15.1",
          "aps-environment": "production"
        }
      }
    ]
  ],
  ios: {
    supportsTablet: false,
    bundleIdentifier: "com.theodez.zeno-forme",
    buildNumber: "11",
    entitlements: {
      "com.apple.developer.healthkit": true
    },
    infoPlist: {
      NSCameraUsageDescription: "Autorise l'accès à l'appareil photo pour capturer tes photos de progression et suivre ton évolution physique jour après jour.",
      NSPhotoLibraryUsageDescription: "Accède à ta bibliothèque pour importer tes repas ou tes photos de progression et centraliser tout ton historique.",
      NSPhotoLibraryAddUsageDescription: "Permet à Zeno d'enregistrer tes photos de progression ou tes montages directement dans ta galerie photos.",
      NSHealthShareUsageDescription: "Zeno utilise tes données de santé (pas, sommeil, calories) pour calculer ton score quotidien et personnaliser tes objectifs.",
      NSHealthUpdateUsageDescription: "Permet à Zeno de synchroniser ton poids et tes calories avec l'app Santé pour garder toutes tes données à jour.",
      ITSAppUsesNonExemptEncryption: false
    }
  },
  android: {
    adaptiveIcon: {
      backgroundColor: "#0D0D0D"
    },
    package: "com.theodez.zenoforme",
    permissions: [
      "CAMERA",
      "READ_EXTERNAL_STORAGE",
      "WRITE_EXTERNAL_STORAGE",
      "VIBRATE"
    ]
  },
  extra: {
    eas: {
      projectId: "801802ce-d528-407d-8105-db194cd6e50c"
    }
  }
});