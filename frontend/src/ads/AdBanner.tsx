import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { adsSupported, AdMob, AD_IDS, adsReady, onAdsReady } from "./index";
import { colors, fonts } from "../theme";

// Renders a real AdMob banner in native builds, and a styled placeholder
// everywhere else (Expo Go / web) so layouts stay consistent.
export default function AdBanner({ testID }: { testID?: string }) {
  // Wait for the consent flow before requesting a banner.
  const [ready, setReady] = useState(adsReady());
  useEffect(() => (ready ? undefined : onAdsReady(() => setReady(true))), [ready]);

  if (adsSupported && AdMob?.BannerAd && ready) {
    const { BannerAd, BannerAdSize } = AdMob;
    return (
      <View testID={testID ?? "ad-banner"} style={styles.wrap}>
        <BannerAd
          unitId={AD_IDS.banner}
          size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        />
      </View>
    );
  }
  return (
    <View testID={testID ?? "ad-banner"} style={[styles.wrap, styles.placeholder]}>
      <Text style={styles.text}>ADVERTISEMENT</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 50,
  },
  placeholder: {
    width: 320,
    height: 50,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSecondary,
  },
  text: {
    color: colors.onSurfaceTertiary,
    fontFamily: fonts.displayMed,
    fontSize: 12,
    letterSpacing: 2,
  },
});
