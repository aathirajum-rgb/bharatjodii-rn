// Angular: pages/safety-tips/ (safety-tips.component.html/.ts/.css), routed at
// '/safety-tips', navigated to only from the chat overflow menu's "Safety
// tips" item (messages.component.ts's selectSelction('safety-tips')).
//
// Angular fetches its copy LIVE from the backend (initialfetch, type=
// saftytips, LANG=<user's current language>) — confirmed via direct source
// inspection that Angular's own repo has NO local translation for this
// content in ANY of its 11 locale files; every visible string is bound
// straight to the API response with no client-side i18n fallback at all.
// This port does the same (safetyTipsService.ts) rather than hardcoding a
// guessed English-only translation that every non-English user would've
// silently fallen back to (an earlier version of this file wrongly did
// that). Angular's own template English text (visible only for the instant
// before the API responds, or if a key is missing) is kept here as the
// initial/loading state for the same reason.
import { useEffect, useState } from 'react'
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import CdnSvg from '../../components/cdn-svg/CdnSvg'
import { CDN_SVG } from '../../constants/cdn'
import { Colors } from '../../constants/colors'
import { Fonts, SemanticFontsEnglish, FontSize } from '../../src/theme/fonts'
import { handleBack } from '../../utils/navigationRef'
import { fetchSafetyTipsContent, type SafetyTipsContent } from '../../service/safetyTipsService'

const BACK_ICON_URI = CDN_SVG + 'arrow-back-activity.svg'
const TIP_ICON_URI = (n: number) => CDN_SVG + `safety-tips-${n}.svg`

// Angular's own template fallback text (safety-tips.component.html) — shown
// only until the live fetch resolves, or if it fails outright.
const FALLBACK_CONTENT: SafetyTipsContent = {
  header: 'Safety Tips',
  header1: 'Tips & Guidelines for safe chatting',
  tips: [
    { title: 'Be cautious while sharing your personal information', content: 'Safeguard your privacy and personal security by being mindful when disclosing personal information' },
    { title: 'Do not send or request money or share your financial details with anyone', content: 'Do not transfer funds or offer financial help to prospective matches. The moment someone asks you for money citing some reason, you should become cautious and avoid any further communication and report the profile.' },
    { title: 'Never share your OTP', content: 'Be cautious when somebody asks you to share an OTP, In such cases, avoid further communication and report the profile as soon as possible' },
    { title: 'Be mindful of behavior', content: 'Be polite & respectful while having a conversation. Report any inappropriate or offensive messages you may have received.' },
    { title: 'Be cautious while chatting', content: 'Be cautious when clicking on external links or downloading files from unknown sources' },
  ],
}

export default function SafetyTipsScreen() {
  const insets = useSafeAreaInsets()
  const [content, setContent] = useState<SafetyTipsContent>(FALLBACK_CONTENT)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    fetchSafetyTipsContent().then(result => {
      if (cancelled) return
      if (result && (result.header || result.tips.length)) setContent(result)
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [])

  return (
    <View style={[s.screen, { paddingTop: insets.top }]}>
      {/* Angular: ion-toolbar with a bottom border, ion-back-button + title. */}
      <View style={s.header}>
        <Pressable onPress={() => handleBack()} hitSlop={12}>
          <CdnSvg uri={BACK_ICON_URI} width={24} height={48} />
        </Pressable>
        <Text style={s.headerTitle} numberOfLines={1}>{content.header}</Text>
      </View>

      {loading ? (
        <View style={s.loadingWrap}><ActivityIndicator color={Colors.primary} /></View>
      ) : (
        <ScrollView contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 24 }]} showsVerticalScrollIndicator={false}>
          <Text style={s.subheading}>{content.header1}</Text>

          {content.tips.map((tip, i) => (
            <View key={i} style={s.row}>
              <CdnSvg uri={TIP_ICON_URI(i + 1)} width={24} height={24} />
              <View style={s.rowText}>
                <Text style={s.rowTitle}>{tip.title}</Text>
                <Text style={s.rowBody}>{tip.content}</Text>
              </View>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  )
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.white },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 12, paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#e5e5e5',
  },
  // Angular: .heading4-medium-16 — 16px, Poppins-Medium, weight 500, #333333.
  headerTitle: { fontFamily: SemanticFontsEnglish.buttonEnglishMedium, fontSize: FontSize.font16, color: '#333333' },

  content: { paddingHorizontal: 24, paddingTop: 16 },
  // Angular: .heading3-semibold-16 — 16px, Poppins-SEMIBOLD (not Medium),
  // weight 600, #1f1e1b (not #333333 — this one's genuinely a different,
  // slightly darker color than the header title/tip text below it).
  subheading: {
    fontFamily: Fonts.poppinsSemiBold, fontWeight: '600', fontSize: FontSize.font16,
    color: '#1f1e1b', marginBottom: 8,
  },

  // Angular: icon column (size=1) + text column, mt-24 gap between rows,
  // pl-8 between icon and text, mt-6 between title and body.
  row: { flexDirection: 'row', gap: 8, marginTop: 24 },
  rowText: { flex: 1, gap: 6 },
  // Angular: .safety-tips-item-heading — button-english-Medium, 14px, #333333.
  rowTitle: { fontFamily: SemanticFontsEnglish.buttonEnglishMedium, fontSize: FontSize.font14, color: '#333333' },
  // Angular: .body2-regular-14 — 14px, Poppins-Regular, weight 400, #333333
  // (not Colors.textSecondary — Angular's tip body uses the same #333333 as
  // the title above it, just a different weight/family, not a lighter gray).
  rowBody: { fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: FontSize.font14, color: '#333333', lineHeight: 19 },
})
