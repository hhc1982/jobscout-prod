import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'app.jobscout.mobile',
  appName: 'JobScout',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    // For development, point to your Vercel URL:
    // url: 'https://your-app.vercel.app',
    // cleartext: false,
  },
  plugins: {
    LocalNotifications: {
      smallIcon: 'ic_stat_icon_config_sample',
      iconColor: '#7c6af5',
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
  android: {
    buildOptions: {
      releaseType: 'APK',
    },
  },
  ios: {
    contentInset: 'automatic',
  },
}

export default config
