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
          "deploymentTarget": "15.1"
        }
      }
    ]
  ],
  ios: {
    supportsTablet: false,
    bundleIdentifier: "com.theodez.zeno-forme",
    buildNumber: "5",
    entitlements: {
      "com.apple.developer.healthkit": true
    },
    infoPlist: {
      NSCameraUsageDescription: "Pour prendre ta photo de progression quotidienne.",
      NSPhotoLibraryUsageDescription: "Pour choisir une photo depuis ta galerie.",
      NSHealthShareUsageDescription: "L'app utilise vos données Santé pour synchroniser vos calories, votre poids, vos pas, votre rythme cardiaque, votre sommeil, la distance parcourue et d'autres métriques pour vous offrir un tableau de bord complet.",
      NSHealthUpdateUsageDescription: "L'app peut enregistrer vos calories et votre poids dans Santé pour les synchroniser avec vos autres applications comme Yazio ou Renpho.",
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
      "ACCESS_FINE_LOCATION",
      "android.permission.CAMERA",
      "android.permission.RECORD_AUDIO"
    ]
  },
  extra: {
    eas: {
      projectId: "801802ce-d528-407d-8105-db194cd6e50c"
    }
  }
});