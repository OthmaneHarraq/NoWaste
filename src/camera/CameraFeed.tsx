import { StyleSheet, Text, View } from 'react-native'
import type { CameraFeedProps } from './types'

/**
 * Phone (Expo Go) fallback. The camera device runs the WEB version of the app,
 * because motion detection needs fast pixel access that the browser gives us for free.
 * See CameraFeed.web.tsx for the real thing.
 */
export default function CameraFeed(_props: CameraFeedProps) {
  return (
    <View style={styles.frame}>
      <Text style={styles.text}>
        The fridge camera runs in a browser.{'\n'}Open the web version of NoWaste on the camera device
        (press “w” in the Expo terminal, or use the deployed https link).
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  frame: { width: '100%', aspectRatio: 4 / 3, backgroundColor: '#1c2a24', borderRadius: 16, alignItems: 'center', justifyContent: 'center', padding: 24 },
  text: { color: '#cfe0d8', textAlign: 'center', lineHeight: 20 },
})
