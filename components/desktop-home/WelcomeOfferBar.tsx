// Desktop Home "Welcome/Pay-Now" banner (Figma "Jodii Desktop - Registration",
// node 1034:1890) — the desktop skin for the SAME generic promo-banner data
// (HeroBannerContent, computed once by homeGating.ts's computeHeroBannerVariant
// and already shared with mobile's HeroBanner.tsx) rather than a new, separate
// "special offer" feature — renders nothing when there's no active banner, same
// gate mobile already uses (`heroBannerVariant && heroBannerContent`).
import { useEffect, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { Colors } from '../../constants/colors'
import type { HeroBannerContent } from '../../screens/home/HeroBanner'
import { SemanticFontsEnglish } from '../../src/theme/fonts'

const TIMER_TOKEN = '##TIMER##'

// Figma copy shows "23h : 45m : 14s" — unlike mobile's HeroBanner (MM:SS, sized
// for short payment-retry windows), this bar's countdown windows run much
// longer (offer-expiry style), so it needs hour-aware formatting.
function formatRemainingHMS(deadlineMs: number): string {
  const remainingMs = Math.max(0, deadlineMs - Date.now())
  const totalSec     = Math.floor(remainingMs / 1000)
  const hh = String(Math.floor(totalSec / 3600)).padStart(2, '0')
  const mm = String(Math.floor((totalSec % 3600) / 60)).padStart(2, '0')
  const ss = String(totalSec % 60).padStart(2, '0')
  return `${hh}h : ${mm}m : ${ss}s`
}

// Figma's 12-fragment gift illustration + circle badge lived in
// assets/desktop-home/, was never committed to git, and got wiped from disk —
// a plain emoji in a colored circle can't go missing the same way.
function GiftIcon() {
  return (
    <View style={s.giftWrap}>
      <Text style={s.giftGlyph}>{'🎁'}</Text>
    </View>
  )
}

type Props = {
  content: HeroBannerContent
  onPress: () => void
}

export default function WelcomeOfferBar({ content, onPress }: Props) {
  const deadline = content.countdownDeadlineMs
  const [remaining, setRemaining] = useState(() => (deadline != null ? formatRemainingHMS(deadline) : ''))

  useEffect(() => {
    if (deadline == null) return
    setRemaining(formatRemainingHMS(deadline))
    const id = setInterval(() => setRemaining(formatRemainingHMS(deadline)), 1000)
    return () => clearInterval(id)
  }, [deadline])

  const body = deadline != null ? content.body.replace(TIMER_TOKEN, remaining) : content.body

  return (
    <LinearGradient colors={['#fffcf7', '#fff0d2']} style={s.card}>
      <View style={s.left}>
        <GiftIcon />
        <View style={s.textCol}>
          {!!content.title && <Text style={s.title} numberOfLines={1}>{content.title}</Text>}
          {!!body && (
            <LinearGradient
              colors={['rgba(41,51,155,0.06)', 'rgba(41,51,155,0)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={s.bodyPill}
            >
              <Text style={s.bodyText} numberOfLines={1}>{body}</Text>
            </LinearGradient>
          )}
        </View>
      </View>
      <Pressable style={s.cta} onPress={onPress}>
        <Text style={s.ctaText}>{content.ctaLabel || 'Pay Now'}</Text>
      </Pressable>
    </LinearGradient>
  )
}

const s = StyleSheet.create({
  card: {
    width:             '100%',
    borderRadius:      16,
    borderWidth:        1,
    borderColor:        '#ffffff',
    paddingHorizontal: 24,
    paddingVertical:   12,
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
  },
  left: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           24,
    flexShrink:    1,
  },
  giftWrap: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: '#ffe9c7',
    alignItems: 'center', justifyContent: 'center',
  },
  giftGlyph: { fontSize: 36 },

  textCol: { gap: 8, flexShrink: 1 },
  title: {
    fontFamily: SemanticFontsEnglish.headingEnglishMedium,
    fontSize:   14,
    lineHeight: 16,
    color:      Colors.black,
  },
  bodyPill: {
    alignSelf:         'flex-start',
    borderLeftWidth:   0.8,
    borderTopWidth:    0.8,
    borderBottomWidth: 0.8,
    borderColor:       Colors.link,
    borderTopLeftRadius:    4,
    borderBottomLeftRadius: 4,
    paddingHorizontal: 8,
    paddingVertical:   4,
  },
  bodyText: {
    fontFamily: SemanticFontsEnglish.specialCtaEnglishMedium,
    fontSize:   14,
    lineHeight: 16,
    color:      Colors.black,
  },

  cta: {
    backgroundColor:   Colors.link,
    borderRadius:      50,
    paddingHorizontal: 24,
    height:            40,
    alignItems:        'center',
    justifyContent:    'center',
    flexShrink:        0,
  },
  ctaText: {
    fontFamily: SemanticFontsEnglish.buttonEnglishMedium,
    fontSize:   14,
    lineHeight: 16,
    color:      Colors.white,
  },
})
