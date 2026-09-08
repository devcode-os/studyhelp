import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.fdaytalk.studyhelp',
  appName: 'StudyHelp',
  webDir: 'dist',
  server: {
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
