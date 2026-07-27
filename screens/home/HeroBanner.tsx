// Home screen's top promo banner — Angular: components/home-banner/home-banner.component.
// One presentational shell reused across every precedence-chain variant computed by
// homeGating.ts's computeHeroBannerVariant(); only the content object and the
// presence of a countdown differ per variant (same "one component, many data
// sources" shape MatchesScreen.tsx's PhotoPromotionBanner/applyHeroBanner already
// uses for its own 3-variant subset).
import { useEffect, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Colors } from '../../constants/colors'

// Angular: matches.page.ts:2317 / home-banner.component.ts:108 / recharge.page.ts:739 —
// the real PAYMENTFAILEDCONTENT string uses this literal token for its live countdown.
const TIMER_TOKEN = '##TIMER##'

// Angular: home-banner.component.ts's showPayFailedTimer() — pad2(minutes) +
// ':' + pad2(seconds). MM:SS, not HH:MM:SS (confirmed against source; the
// previous version here was a guess and wrong).
function formatRemaining(deadlineMs: number): string {
  const remainingMs = Math.max(0, deadlineMs - Date.now())
  const totalSec    = Math.floor(remainingMs / 1000)
  const mm          = String(Math.floor(totalSec / 60)).padStart(2, '0')
  const ss          = String(totalSec % 60).padStart(2, '0')
  return `${mm}:${ss}`
}

export interface HeroBannerContent {
  title:               string
  body:                string
  ctaLabel:            string
  bgColor?:            string | undefined
  ctaBgColor?:         string | undefined
  ctaColor?:           string | undefined
  countdownDeadlineMs?: number | undefined
}

export interface HeroBannerProps {
  content:    HeroBannerContent
  onPress:    () => void
  onDismiss?: (() => void) | undefined
}

export default function HeroBanner({ content, onPress, onDismiss }: HeroBannerProps) {
  const [remaining, setRemaining] = useState(() =>
    content.countdownDeadlineMs != null ? formatRemaining(content.countdownDeadlineMs) : ''
  )

  useEffect(() => {
    if (content.countdownDeadlineMs == null) return
    setRemaining(formatRemaining(content.countdownDeadlineMs))
    const id = setInterval(() => setRemaining(formatRemaining(content.countdownDeadlineMs!)), 1000)
    return () => clearInterval(id)
  }, [content.countdownDeadlineMs])

  const body = content.countdownDeadlineMs != null ? content.body.replace(TIMER_TOKEN, remaining) : content.body

  return (
    <View style={[s.wrap, content.bgColor ? { backgroundColor: content.bgColor } : null]}>
      {!!onDismiss && (
        <Pressable style={s.close} onPress={onDismiss} hitSlop={8}>
          <Text style={s.closeText}>✕</Text>
        </Pressable>
      )}
      {!!content.title && <Text style={s.title}>{content.title}</Text>}
      {!!body && <Text style={s.body}>{body}</Text>}
      <Pressable
        style={[s.cta, content.ctaBgColor ? { backgroundColor: content.ctaBgColor } : null]}
        onPress={onPress}
      >
        <Text style={[s.ctaText, content.ctaColor ? { color: content.ctaColor } : null]}>{content.ctaLabel}</Text>
      </Pressable>
    </View>
  )
}

const s = StyleSheet.create({
  wrap: {
    backgroundColor:   '#29339B',
    paddingHorizontal: 16,
    paddingVertical:   14,
    gap:               6,
  },
  close: {
    position: 'absolute',
    top:      10,
    right:    12,
    zIndex:   1,
  },
  closeText: {
    fontSize: 16,
    color:    Colors.white,
  },
  title: {
    fontFamily: 'Poppins-SemiBold',
    fontSize:   15,
    color:      Colors.white,
    paddingRight: 20,
  },
  body: {
    fontFamily: 'Poppins-Regular',
    fontSize:   12,
    color:      Colors.white,
    opacity:    0.9,
  },
  cta: {
    alignSelf:         'flex-start',
    backgroundColor:   Colors.white,
    borderRadius:      20,
    paddingVertical:   7,
    paddingHorizontal: 20,
    marginTop:         6,
  },
  ctaText: {
    fontFamily: 'Poppins-SemiBold',
    fontSize:   13,
    color:      '#29339B',
  },
})
