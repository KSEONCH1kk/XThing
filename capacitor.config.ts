import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.xthing.vpn",
  appName: "XThing",
  webDir: "client/dist",
  server: {
    androidScheme: "https",
    iosScheme: "capacitor",  // origin страницы будет capacitor://localhost
  },
  android: {
    minWebViewVersion: 80,
    allowMixedContent: false,
  },
  ios: {
    contentInset: "always",
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 0,
    },
  },
};

export default config;
