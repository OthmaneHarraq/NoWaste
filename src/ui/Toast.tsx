import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { Animated, Pressable, Text, View, useWindowDimensions } from 'react-native'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

export type ToastTone = 'fresh' | 'soon' | 'expired' | 'info'

type Toast = { id: number; tone: ToastTone; title: string; body?: string }

const TONES: Record<ToastTone, { icon: keyof typeof MaterialCommunityIcons.glyphMap; bar: string; iconColor: string; bg: string }> = {
  fresh:   { icon: 'check-circle-outline', bar: 'bg-fresh-500',   iconColor: '#23804a', bg: 'bg-fresh-50' },
  soon:    { icon: 'clock-alert-outline',  bar: 'bg-soon-500',    iconColor: '#b8760a', bg: 'bg-soon-50' },
  expired: { icon: 'alert-octagon-outline', bar: 'bg-spoiled-500', iconColor: '#b53427', bg: 'bg-spoiled-50' },
  info:    { icon: 'information-outline',  bar: 'bg-ink-soft',    iconColor: '#4c5d55', bg: 'bg-frost' },
}

const ToastContext = createContext<(t: Omit<Toast, 'id'>) => void>(() => {})

/** show({ tone, title, body }) from anywhere under <ToastProvider>. */
export const useToast = () => useContext(ToastContext)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const nextId = useRef(1)
  const { width } = useWindowDimensions()
  const insets = useSafeAreaInsets()

  const show = useCallback((t: Omit<Toast, 'id'>) => {
    const id = nextId.current++
    setToasts(list => [...list.slice(-3), { ...t, id }])
  }, [])
  const dismiss = useCallback((id: number) => setToasts(list => list.filter(t => t.id !== id)), [])

  return (
    <ToastContext.Provider value={show}>
      {children}
      <View
        pointerEvents="box-none"
        className="absolute gap-2"
        // Wide: bottom-right, clear of content (above the tab bar when it's at the bottom).
        // Phone: just under the header, below the notch / status bar.
        style={width >= 700 ? { right: 20, bottom: width >= 900 ? 20 : 76, width: 360 } : { top: insets.top + 60, left: 12, right: 12 }}
      >
        {toasts.map(t => <ToastCard key={t.id} toast={t} onDone={() => dismiss(t.id)} />)}
      </View>
    </ToastContext.Provider>
  )
}

function ToastCard({ toast, onDone }: { toast: Toast; onDone: () => void }) {
  const anim = useRef(new Animated.Value(0)).current
  const tone = TONES[toast.tone]

  useEffect(() => {
    Animated.spring(anim, { toValue: 1, useNativeDriver: true, friction: 8, tension: 70 }).start()
    const timer = setTimeout(close, toast.tone === 'expired' ? 9000 : 6000)
    return () => clearTimeout(timer)
  }, [])

  function close() {
    Animated.timing(anim, { toValue: 0, duration: 180, useNativeDriver: true }).start(onDone)
  }

  return (
    <Animated.View
      style={{
        opacity: anim,
        transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-16, 0] }) }],
        shadowColor: '#17251f', shadowOpacity: 0.12, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 6,
        borderRadius: 16,
      }}
    >
      <View className="flex-row overflow-hidden rounded-2xl border border-line bg-white">
        <View className={`w-1.5 ${tone.bar}`} />
        <Pressable onPress={close} className="flex-1 flex-row items-start gap-3 p-3.5" accessibilityRole="alert">
          <View className={`h-8 w-8 items-center justify-center rounded-full ${tone.bg}`}>
            <MaterialCommunityIcons name={tone.icon} size={18} color={tone.iconColor} />
          </View>
          <View className="flex-1">
            <Text className="text-[15px] font-semibold text-ink">{toast.title}</Text>
            {toast.body ? <Text className="mt-0.5 text-[13px] leading-5 text-ink-soft" numberOfLines={3}>{toast.body}</Text> : null}
          </View>
          <Pressable onPress={close} hitSlop={10} accessibilityLabel="Dismiss" className="h-6 w-6 items-center justify-center rounded-full active:bg-frost">
            <MaterialCommunityIcons name="close" size={15} color="#8a9a93" />
          </Pressable>
        </Pressable>
      </View>
    </Animated.View>
  )
}
