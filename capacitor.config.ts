import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.fdaytalk.studyhelp',
  appName: 'StudyHelp',
  webDir: 'dist',
  server: {
    url: 'https://studyhelp.fdaytalk.com',
    cleartext: false,
    allowNavigation: [
      'studyhelp.fdaytalk.com',
      'api.studyhelp.fdaytalk.com',
      'checkout.razorpay.com',
      'api.razorpay.com',
      '*.razorpay.com'
    ]
  },
  plugins: {
    CapacitorHttp: {
      enabled: false
    },
    SplashScreen: {
      launchShowDuration: 1500,
      launchAutoHide: true,
      backgroundColor: "#14102B"
    },
    // Native "Continue with Google" (Android Credential Manager). Only Google is
    // bundled: facebook:false keeps the Facebook SDK and its AD_ID permission
    // out of the build (otherwise Play Console can reject the release when the
    // app declares it doesn't use the advertising ID).
    SocialLogin: {
      providers: {
        google: true,
        facebook: false,
        apple: false,
        twitter: false
      }
    }
  }
};

export default config;
