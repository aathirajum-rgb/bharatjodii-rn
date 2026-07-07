// Shared sticky bottom bar for the payment-failed and force-update banners.
// Angular: components/payment-stickey/payment-stickey.component — one reusable
// component bound to two different data slots (payment-failed content, or
// app-update content). Pinned as a sibling directly above the footer, not a
// Modal overlay.
import { useEffect, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Colors } from '../../constants/colors'

const TIMER_TOKEN = '{{TIMER}}'

function formatRemaining(deadlineMs: number): string {
  const remainingMs = Math.max(0, deadlineMs - Date.now())
  const totalSec    = Math.floor(remainingMs / 1000)
  const mm          = String(Math.floor(totalSec / 60)).padStart(2, '0')
  const ss          = String(totalSec % 60).padStart(2, '0')
  return `${mm}:${ss}`
}

export default function StickyBanner({
  text, ctaLabel, onPress, onClose, countdownDeadlineMs,
}: {
  text:                 string
  ctaLabel:             string
  onPress:              () => void
  onClose:              () => void
  countdownDeadlineMs?: number
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
  text: {
    flex:       1,
    fontFamily: 'Poppins-Medium',
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
    fontFamily: 'Poppins-SemiBold',
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
