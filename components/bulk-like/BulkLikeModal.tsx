// Full-screen "like several profiles at once" modal.
// Angular: components/fullpage-modalpopup/fullpage-modalpopup.component — a
// full-screen popup (all candidates pre-checked) + a single "Send likes"
// button. No existing full-screen modal precedent in this app (the closest,
// components/bottom-sheet/BottomSheet.tsx, is a transparent scrim+sheet, not
// a true full-screen cover), so this is a new pattern.
//
// Scoped simplifications from the Angular reference (see plan):
// - Skips the 3-way post-submit bottom-sheet branching (plain success /
//   male-photo-upsell / skip-with-continue-prompt) — this shows a lightweight
//   inline confirmation instead, then closes.
// - The 'bulklikechk' trigger flag (Angular: registration.service.ts's
//   handleRegistrationSuccess(), set once right after registration) is now
//   wired: registrationService.ts's submitFullRegistration() sets it, and
//   MatchesScreen.tsx's load effect reads/consumes it — so this only shows
//   once, right after registering, not on every Matches mount.
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ActivityIndicator, FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import SelectableProfileTile from './SelectableProfileTile'
import BulkLikeSentSheet from './BulkLikeSentSheet'
import { sendBulkLikes } from '../../service/profileService'
import { Colors } from '../../constants/colors'
import { Fonts, FontSize } from '../../src/theme/fonts'

export default function BulkLikeModal({
  visible, candidates, showPhotoPromo, onClose, onSent, onSentNeedsPhoto,
}: {
  visible:    boolean
  candidates: Record<string, any>[]
  // Angular: fullpage-modalpopup.component.ts sendLikes() — male users mid photo
  // promotion (PROFILEPUBLISHEDFLAG=='0' && PROFILEPUBLISHEDTYPE in ['1','2']) see
  // a photo-upsell prompt instead of the plain success confirmation after sending.
  showPhotoPromo: boolean
  onClose:    () => void
  onSent:     () => void
  onSentNeedsPhoto: () => void
}) {
  const { t } = useTranslation()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [sending,  setSending]  = useState(false)
  const [sent,     setSent]     = useState(false)
  // Tracks the "brief confirmation, then close" timer in handleSend so it
  // can be cancelled — matching BulkLikeDesktopModal.tsx's own autoCloseRef
  // pattern — instead of firing onSent() against an already-unmounted modal
  // if the parent closes it within the ~1.2s window.
  const autoCloseRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Reset selection (all pre-checked, matching Angular) whenever a fresh
  // candidate batch is shown.
  useEffect(() => {
    if (visible) {
      setSelected(new Set(candidates.map(c => String(c.MATRIID))))
      setSending(false)
      setSent(false)
    }
    if (autoCloseRef.current) clearTimeout(autoCloseRef.current)
  }, [visible, candidates])

  useEffect(() => {
    return () => { if (autoCloseRef.current) clearTimeout(autoCloseRef.current) }
  }, [])

  function toggle(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleSend() {
    if (selected.size === 0 || sending) return
    setSending(true)
    try {
      const ok = await sendBulkLikes(Array.from(selected))
      if (ok) {
        if (showPhotoPromo) {
          onSentNeedsPhoto()   // caller shows the photo-upsell bottom sheet instead
        } else {
          setSent(true)
          autoCloseRef.current = setTimeout(onSent, 1200)   // brief confirmation, then close + reload
        }
      }
    } finally {
      setSending(false)
    }
  }

  return (
    // Two sibling <Modal>s, not one nested inside the other — same convention
    // MatchesScreen uses when pairing this modal with a BottomSheet; nesting
    // RN Modals is a known source of z-order/rendering quirks on Android.
    <>
    {/* `transparent` — every other Modal in this app passes it (BulkLikeModal was
        the sole exception); a non-transparent Modal is a known react-native-web
        pitfall where its content can render correctly but stop receiving pointer
        events entirely, which is exactly what made both the close X and Send
        buttons unresponsive on desktop web despite the cursor showing a pointer.
        `s.screen`'s own opaque white background already fills the full screen, so
        this doesn't change how it looks. */}
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <LinearGradient
        colors={[Colors.bulkLikeGradientStart, Colors.white]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={s.screen}
      >
        <View style={s.header}>
          {/* Figma (119:268) renders this as two literal lines, not a single
              wrapped line — replacing <br> with a space instead produced a
              double space, since the translation already has one before it. */}
          <Text style={s.title}>
            {t('MATCHES.BULK_LIKE_TITLE').split(/<br\s*\/?>/gi).map(line => line.trim()).join('\n')}
          </Text>
          <Pressable onPress={onClose} hitSlop={8}>
            <Text style={s.close}>✕</Text>
          </Pressable>
        </View>

        <FlatList
          data={candidates}
          keyExtractor={c => String(c.MATRIID)}
          contentContainerStyle={s.list}
          renderItem={({ item }) => (
            <SelectableProfileTile
              candidate={item}
              checked={selected.has(String(item.MATRIID))}
              onToggle={() => toggle(String(item.MATRIID))}
            />
          )}
        />

        <Pressable
          style={[s.sendBtn, selected.size === 0 && s.sendBtnDisabled]}
          onPress={handleSend}
          disabled={selected.size === 0 || sending}
        >
          {sending
            ? <ActivityIndicator size="small" color={Colors.white} />
            : <Text style={s.sendBtnText}>{t('MATCHES.BULK_LIKE_CTA')} ({selected.size})</Text>
          }
        </Pressable>
      </LinearGradient>
    </Modal>

    <BulkLikeSentSheet visible={sent} />
    </>
  )
}

const s = StyleSheet.create({
  screen: { flex: 1 },
  // FLAGGED — diverges from Angular's `.full-popup-header pb-16 pl-16 pr-16`
  // (fullpage-modalpopup.component.html:6) plus the close row's own `pt-16`:
  //   - paddingRight 20 vs Angular's pr-16
  //   - paddingVertical 24 vs Angular's 16 top / 16 bottom
  //   - the 1px bottom border has no Angular source at all — .full-popup-header
  //     (…scss:14) sets only position/top/z-index/flex-shrink, no border.
  // Left as-is: reshaping the header is a layout change, not a typography fix.
  header: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingLeft:       16,
    paddingRight:      20,
    paddingVertical:   24,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderSubtle,
  },
  // Angular: fullpage-modalpopup.component.html:12 —
  // `bulk-title color-1f1e1b heading2-semibold-18 line-height-24 pb-8`.
  // heading2-semibold-18 = var(--font18) + --english-semibold-poppins, and
  // line-height-24 is a flat 24 — both already matched. The colour did not:
  // .color-1f1e1b is #1f1e1b, not textPrimary's #111111.
  //
  // FLAGGED, not restructured: Angular stacks the close button on its OWN row
  // ABOVE this title (a `justify-content-flex-end pt-16` row), whereas this
  // port puts title and close side by side on one row.
  title: {
    flex:       1,
    fontFamily: Fonts.poppinsSemiBold,
    fontSize:   FontSize.font18,
    lineHeight: 24,
    color:      '#1F1E1B',
    paddingRight: 12,
  },
  // Angular renders an <ion-img> close-btn.svg here, not a text glyph, so no
  // typography rule governs this. Size tokenised only, value unchanged.
  close: {
    fontSize: FontSize.font18,
    color:    Colors.textPrimary,
  },
  // gap 20 == Angular's `mb-20` on each .list-view-card grid — exact.
  // FLAGGED: the insets are not. Angular's `.full-popup-list pl-4 pr-4 pt-16`
  // gives 4 of side padding, and each card's own `.card.bulklike`
  // (list-view-card.component.scss:5) adds 16 — 20 total per side, vs 16 here
  // with none on the tile. Its `padding-bottom: 5rem` (~80) is also far more
  // than the 16 below.
  list: {
    paddingHorizontal: 16,
    paddingTop:        16,
    paddingBottom:     16,
    gap:               20,
  },
  sendBtn: {
    backgroundColor:   Colors.primaryDark,
    borderRadius:      8,
    paddingVertical:   14,
    alignItems:        'center',
    marginHorizontal:  16,
    marginVertical:    16,
  },
  sendBtnDisabled: {
    backgroundColor: Colors.primaryLight,
  },
  sendBtnText: {
    fontFamily: Fonts.poppinsSemiBold,
    fontSize:   FontSize.font15,
    color:      Colors.white,
  },
})
