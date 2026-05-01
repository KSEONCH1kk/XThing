import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.xthing.vpn",
  appName: "XThing",
  webDir: "client/dist",
  server: {
    androidScheme: "https",
  },
  android: {
    minWebViewVersion: 80,
    allowMixedContent: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 0,
    },
  },
};

export default config;
