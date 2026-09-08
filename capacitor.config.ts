import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.fdaytalk.studyhelp',
  appName: 'StudyHelp',
  webDir: 'dist',
  server: {
    url: 'https://capacitor-testing.studyhelp-ea2.pages.dev',
    cleartext: false,
    allowNavigation: ['capacitor-testing.studyhelp-ea2.pages.dev', 'api.studyhelp.fdaytalk.com']
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
