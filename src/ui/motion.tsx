import { useEffect, useRef, type ReactNode } from 'react'
import { Animated, Easing, Platform, type StyleProp, type ViewStyle } from 'react-native'

const native = Platform.OS !== 'web'

/** Slides up and fades in once, on mount. `delay` staggers lists. */
export function FadeIn({ children, delay = 0, from = 10, style }: { children: ReactNode; delay?: number; from?: number; style?: StyleProp<ViewStyle> }) {
  const v = useRef(new Animated.Value(0)).current
  useEffect(() => {
    Animated.timing(v, { toValue: 1, duration: 380, delay, easing: Easing.out(Easing.cubic), useNativeDriver: native }).start()
  }, [v, delay])
  return (
    <Animated.View style={[style, { opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [from, 0] }) }] }]}>
      {children}
    </Animated.View>
  )
}

/** A slow, soft breathing glow for things that need attention (never a blink). */
export function Pulse({ active, children, color, radius = 16, style }: {
  active: boolean
  children: ReactNode
  color: string
  radius?: number
  style?: StyleProp<ViewStyle>
}) {
  const v = useRef(new Animated.Value(0)).current
  useEffect(() => {
    if (!active) return
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.sin), useNativeDriver: native }),
        Animated.timing(v, { toValue: 0, duration: 1400, easing: Easing.inOut(Easing.sin), useNativeDriver: native }),
      ])
    )
    loop.start()
    return () => loop.stop()
  }, [active, v])

  return (
    <Animated.View style={style}>
      {active && (
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute', top: -3, left: -3, right: -3, bottom: -3,
            borderRadius: radius + 3, borderWidth: 3, borderColor: color,
            opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.08, 0.45] }),
          }}
        />
      )}
      {children}
    </Animated.View>
  )
}

/** A little live dot that softly pings outward. */
export function LiveDot({ color, size = 8 }: { color: string; size?: number }) {
  const v = useRef(new Animated.Value(0)).current
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(v, { toValue: 1, duration: 1800, easing: Easing.out(Easing.quad), useNativeDriver: native }))
    loop.start()
    return () => loop.stop()
  }, [v])
  return (
    <Animated.View style={{ width: size, height: size }}>
      <Animated.View
        style={{
          position: 'absolute', width: size, height: size, borderRadius: size, backgroundColor: color,
          opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] }),
          transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [1, 2.6] }) }],
        }}
      />
      <Animated.View style={{ width: size, height: size, borderRadius: size, backgroundColor: color }} />
    </Animated.View>
  )
}
