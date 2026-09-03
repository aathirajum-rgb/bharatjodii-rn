// Shared sticky bottom bar for the payment-failed and force-update banners.
// Angular: components/payment-stickey/payment-stickey.component — one reusable
// component bound to two different data slots (payment-failed content, or
// app-update content). Pinned as a sibling directly above the footer, not a
// Modal overlay.
import { useEffect, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Colors } from '../../constants/colors'
import { Fonts, SemanticFontsEnglish } from '../../src/theme/fonts'
import CdnLottie from '../CdnLottie'

// Angular: matches.page.ts:2317 / home-banner.component.ts:108 / recharge.page.ts:739 —
// the real PAYMENTFAILEDCONTENT string from the content API uses this literal token.
const TIMER_TOKEN = '##TIMER##'

function formatRemaining(deadlineMs: number): string {
  const remainingMs = Math.max(0, deadlineMs - Date.now())
  const totalSec    = Math.floor(remainingMs / 1000)
  const mm          = String(Math.floor(totalSec / 60)).padStart(2, '0')
  const ss          = String(totalSec % 60).padStart(2, '0')
  return `${mm}:${ss}`
}

export default function StickyBanner({
  text, ctaLabel, onPress, onClose, countdownDeadlineMs, lottieUri,
}: {
  text:                 string
  ctaLabel:             string
  onPress:              () => void
  onClose:              () => void
  countdownDeadlineMs?: number
  // Optional small looping/decorative animation (e.g. Angular's
  // stickyDetails.ANIMAT_URL autopay-renewal lottie) shown alongside the text.
  // Omitted entirely when not passed — existing callers render unchanged.
  lottieUri?:           string
}) {
  const [remaining, setRemaining] = useState(() =>
    countdownDeadlineMs != null ? formatRemaining(countdownDeadlineMs) : ''
  )

  useEffect(() => {
    if (countdownDeadlineMs == null) return
    setRemaining(formatRemaining(countdownDeadlineMs))
    const id = setInterval(() => setRemaining(formatRemaining(countdownDeadlineMs)), 1000)
    return () => clearInterval(id)
  }, [countdownDeadlineMs])

  const displayText = countdownDeadlineMs != null ? text.replace(TIMER_TOKEN, remaining) : text

  return (
    <View style={s.bar}>
      {lottieUri != null && (
        <CdnLottie uri={lottieUri} width={44} height={44} loop style={s.lottie} />
      )}
      <Text style={s.text} numberOfLines={2}>{displayText}</Text>
      <Pressable style={s.cta} onPress={onPress}>
        <Text style={s.ctaText}>{ctaLabel}</Text>
      </Pressable>
      <Pressable onPress={onClose} hitSlop={8} style={s.close}>
        <Text style={s.closeText}>✕</Text>
      </Pressable>
    </View>
  )
}

const s = StyleSheet.create({
  bar: {
    flexDirection:     'row',
    alignItems:        'center',
    backgroundColor:   Colors.primaryDeep,
    paddingVertical:   10,
    paddingHorizontal: 12,
    gap:               10,
  },
  lottie: {
    flexShrink: 0,
  },
  text: {
    flex:       1,
    fontFamily: SemanticFontsEnglish.specialCtaEnglishMedium,
    fontSize:   12,
    color:      Colors.white,
  },
  cta: {
    backgroundColor:   Colors.white,
    borderRadius:      6,
    paddingVertical:   6,
    paddingHorizontal: 12,
  },
  ctaText: {
    fontFamily: Fonts.poppinsSemiBold,
    fontSize:   12,
    color:      Colors.primaryDeep,
  },
  close: {
    paddingHorizontal: 2,
  },
  closeText: {
    fontSize:   16,
    color:      Colors.white,
  },
})
