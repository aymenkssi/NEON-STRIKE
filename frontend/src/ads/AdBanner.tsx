import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { adsSupported, AdMob, AD_IDS } from "./index";
import { colors, fonts } from "../theme";

// Renders a real AdMob banner in native builds, and a styled placeholder
// everywhere else (Expo Go / web) so layouts stay consistent.
export default function AdBanner({ testID }: { testID?: string }) {
  if (adsSupported && AdMob?.BannerAd) {
    const { BannerAd, BannerAdSize } = AdMob;
    return (
      <View testID={testID ?? "ad-banner"} style={styles.wrap}>
        <BannerAd
          unitId={AD_IDS.banner}
          size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
          requestOptions={{ requestNonPersonalizedAdsOnly: true }}
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
