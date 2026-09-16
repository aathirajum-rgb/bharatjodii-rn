// Shared shell for desktop-web onboarding steps — Figma "Jodii Desktop -
// Registration" (997-27790, 997-29066): persistent Jodii logo + language
// top bar, a centered white card (rounded, shadowed) with an optional back
// arrow, and a full-width primary "Next" button pinned to the card's bottom.
// Mirrors the presentational-only split MatchesDesktopLayout.tsx/
// ViewProfileDesktopLayout.tsx already use — this component owns no data,
// the calling step screen passes everything in as props/children.
//
// No decorative mandala background graphic yet (Figma shows one in the side
// margins) — skipped rather than guessing at an unconfirmed CDN asset URL.

import type { ReactNode } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import ButtonRevamp from '../../components/button-revamp/ButtonRevamp'
import { Colors } from '../../constants/colors'
import { Fonts, SemanticFontsEnglish } from '../../src/theme/fonts'

const CARD_WIDTH = 480

interface Props {
  children:      ReactNode
  onBack?:       (() => void) | undefined
  onNext:        () => void
  nextLabel?:    string
  nextDisabled?: boolean
  nextLoading?:  boolean
}

export default function OnboardingDesktopLayout({
  children, onBack, onNext, nextLabel, nextDisabled, nextLoading,
}: Props) {
  const { t } = useTranslation()
  // Default resolved here rather than as a parameter default so it re-translates
  // on a language change (a param default would bake in the mount-time string).
  const ctaLabel = nextLabel ?? t('REGISTRATION.NEXTCTA', 'Next')
  return (
    <View style={s.screen}>
      <View style={s.topBar}>
        <Text style={s.logo}>BharatJodii</Text>
        <View style={s.langPill}>
          <Text style={s.langPillText}>English ▾</Text>
        </View>
      </View>

      <View style={s.body}>
        <View style={s.card}>
          {!!onBack && (
            <Pressable style={s.backBtn} onPress={onBack} hitSlop={8} accessibilityRole="button" accessibilityLabel="Back">
              <Text style={s.backArrow}>←</Text>
            </Pressable>
          )}

          <ScrollView
            style={s.cardScroll}
            contentContainerStyle={s.cardScrollContent}
            showsVerticalScrollIndicator={false}
          >
            {children}
          </ScrollView>

          <View style={s.footer}>
            <ButtonRevamp
              label={ctaLabel}
              variant="primary"
              size="large"
              fullWidth
              disabled={nextDisabled}
              loading={nextLoading}
              style={{ backgroundColor: Colors.primaryDark }}
              onPress={onNext}
            />
          </View>
        </View>
      </View>
    </View>
  )
}

export function DesktopSectionTitle({ title }: { title: string }) {
  return <Text style={s.sectionTitle}>{title}</Text>
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FDF8F8' },

  topBar: {
    height: 72, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 32, backgroundColor: Colors.white,
    borderBottomWidth: 1, borderBottomColor: Colors.divider,
  },
  logo: { fontFamily: Fonts.poppinsSemiBold, fontSize: 24, color: Colors.primaryDark },
  langPill: {
    borderWidth: 1, borderColor: Colors.borderNeutral, borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 8,
  },
  langPillText: { fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: 14, color: Colors.black },

  body: { flex: 1, alignItems: 'center', paddingVertical: 48, paddingHorizontal: 24 },

  card: {
    width: CARD_WIDTH, maxWidth: '100%', flex: 1, maxHeight: 760,
    backgroundColor: Colors.white, borderRadius: 16,
    shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.08, shadowRadius: 16,
    elevation: 4, position: 'relative',
  },
  backBtn: { position: 'absolute', top: 24, left: 24, zIndex: 1, padding: 4 },
  backArrow: { fontSize: 20, color: Colors.black },

  cardScroll: { flex: 1 },
  cardScrollContent: { paddingHorizontal: 40, paddingTop: 40, paddingBottom: 24, gap: 20 },

  footer: { paddingHorizontal: 40, paddingBottom: 32, paddingTop: 8 },

  sectionTitle: { fontFamily: Fonts.poppinsSemiBold, fontSize: 20, color: Colors.black, marginTop: 8 },
})
