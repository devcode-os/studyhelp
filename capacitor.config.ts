import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.fdaytalk.studyhelp',
  appName: 'StudyHelp',
  webDir: 'dist',
  server: {
    // TEMPORARY DIAGNOSTIC CHANGE: pointing directly at the live server
    // instead of using `hostname` (which serves from the locally bundled
    // dist/ files via Capacitor's own WebViewLocalServer). This bypasses
    // Capacitor's local asset-serving layer entirely, to test whether the
    // "URL updates but DOM content doesn't" bug is caused by that layer,
    // or reproduces even against the real live site.
    url: 'https://studyhelp.fdaytalk.com',
    cleartext: false,
    allowNavigation: ['studyhelp.fdaytalk.com', 'api.studyhelp.fdaytalk.com']
  },
  plugins: {
    CapacitorHttp: {
      enabled: false
    },
    SplashScreen: {
      launchShowDuration: 1500,
      launchAutoHide: true,
      backgroundColor: "#14102B"
    }
  }
};

export default config;
