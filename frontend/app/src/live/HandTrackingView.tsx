import { StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import type { GripResult } from "./grip";

/**
 * Native fallback for the live camera background. On-device hand tracking is
 * web-first for the MVP (MediaPipe Tasks Vision runs in the browser); on iOS/
 * Android this keeps the same warm "stove" backdrop `FauxCamera` showed until a
 * native landmarker (Vision/MediaPipe) is wired up.
 *
 * Metro serves `HandTrackingView.web.tsx` on web and this file on native.
 */
export default function HandTrackingView(_props: {
  onStatus?: (s: {
    present: boolean;
    steady: boolean;
    status: string;
    grip: GripResult | null;
    action: string | null;
    cameraMoving: boolean;
  }) => void;
}) {
  return (
    <View style={StyleSheet.absoluteFill}>
      <LinearGradient
        colors={["#5a4838", "#241a12", "#0a0604"]}
        start={{ x: 0.15, y: 0.15 }}
        end={{ x: 0.9, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <Text style={styles.emoji}>🍳</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  emoji: { position: "absolute", alignSelf: "center", top: "42%", fontSize: 64, opacity: 0.3 },
});
