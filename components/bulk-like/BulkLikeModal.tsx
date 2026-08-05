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
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ActivityIndicator, FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import SelectableProfileTile from './SelectableProfileTile'
import BulkLikeSentSheet from './BulkLikeSentSheet'
import { sendBulkLikes } from '../../service/profileService'
import { Colors } from '../../constants/colors'

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

  // Reset selection (all pre-checked, matching Angular) whenever a fresh
  // candidate batch is shown.
  useEffect(() => {
    if (visible) {
      setSelected(new Set(candidates.map(c => String(c.MATRIID))))
      setSending(false)
      setSent(false)
    }
  }, [visible, candidates])

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
          setTimeout(onSent, 1200)   // brief confirmation, then close + reload
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
  title: {
    flex:       1,
    fontFamily: 'Poppins-SemiBold',
    fontSize:   18,
    lineHeight: 24,
    color:      Colors.textPrimary,
    paddingRight: 12,
  },
  close: {
    fontSize: 18,
    color:    Colors.textPrimary,
  },
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
    fontFamily: 'Poppins-SemiBold',
    fontSize:   15,
    color:      Colors.white,
  },
})
