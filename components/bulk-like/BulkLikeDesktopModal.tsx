// Desktop web sibling of BulkLikeModal.tsx (same split PhotoViewerModalDesktop.tsx
// already uses instead of branching one file two ways) — full-screen cover with
// a centered content column, matching mobile's full-screen presentation instead
// of a floating dialog.
// Figma: "Jodii Desktop - Registration" (UaPAN9aG6MfZf6CRpwXf1L, node 1047:11645)
// — full-page pink-wash background, a 720px-wide 2-column grid of 348x136 cards
// under a title, with a centered CTA below.
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ActivityIndicator, FlatList, Modal, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import SelectableProfileCardDesktop from './SelectableProfileCardDesktop'
import BulkLikeSentSheetDesktop from './BulkLikeSentSheetDesktop'
import { sendBulkLikes } from '../../service/profileService'
import { Colors } from '../../constants/colors'
import { Fonts, SemanticFontsEnglish } from '../../src/theme/fonts'

const CARD_GAP   = 24
const GRID_WIDTH = 348 * 2 + CARD_GAP   // 720 — matches Figma's content column

export default function BulkLikeDesktopModal({
  visible, candidates, showPhotoPromo, onClose, onSent, onSentNeedsPhoto,
}: {
  visible:    boolean
  candidates: Record<string, any>[]
  showPhotoPromo: boolean
  onClose:    () => void
  onSent:     () => void
  onSentNeedsPhoto: () => void
}) {
  const { t } = useTranslation()
  const { width } = useWindowDimensions()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [sending,  setSending]  = useState(false)
  const [sent,     setSent]     = useState(false)
  const autoCloseRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (visible) {
      setSelected(new Set(candidates.map(c => String(c.MATRIID))))
      setSending(false)
      setSent(false)
    }
    if (autoCloseRef.current) clearTimeout(autoCloseRef.current)
  }, [visible, candidates])

  // Figma's desktop confirmation (unlike mobile's non-dismissable one) has a
  // manual close X — clicking it skips the ~1.2s auto-close instead of waiting.
  function dismissSent() {
    if (autoCloseRef.current) clearTimeout(autoCloseRef.current)
    onSent()
  }

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
          onSentNeedsPhoto()
        } else {
          setSent(true)
          autoCloseRef.current = setTimeout(onSent, 1200)
        }
      }
    } finally {
      setSending(false)
    }
  }

  const contentWidth = Math.min(GRID_WIDTH, width * 0.9)

  return (
    // Two sibling <Modal>s, not one nested inside the other — see BulkLikeModal.tsx.
    <>
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <LinearGradient
        colors={[Colors.bulkLikeGradientStart, Colors.white]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={s.screen}
      >
        <Pressable style={s.closeBtn} onPress={onClose} hitSlop={8}>
          <Text style={s.close}>✕</Text>
        </Pressable>

        <View style={[s.content, { width: contentWidth }]}>
          {/* Figma (1047:12789) renders this as two literal lines, not a
              single wrapped line — see BulkLikeModal.tsx's title for why
              a plain <br>-to-space replace produces a double space. */}
          <Text style={s.title}>
            {t('MATCHES.BULK_LIKE_TITLE').split(/<br\s*\/?>/gi).map(line => line.trim()).join('\n')}
          </Text>

          <FlatList
            data={candidates}
            keyExtractor={c => String(c.MATRIID)}
            numColumns={2}
            columnWrapperStyle={s.row}
            contentContainerStyle={s.grid}
            style={s.list}
            renderItem={({ item }) => (
              <SelectableProfileCardDesktop
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
        </View>
      </LinearGradient>
    </Modal>

    <BulkLikeSentSheetDesktop visible={sent} onClose={dismissSent} />
    </>
  )
}

const s = StyleSheet.create({
  screen: {
    flex:              1,
    alignItems:        'center',
    paddingTop:        56,
    paddingBottom:     32,
  },
  closeBtn: {
    position: 'absolute', top: 32, right: 40,
    width: 24, height: 24, alignItems: 'center', justifyContent: 'center',
  },
  close: {
    fontSize: 18,
    color:    Colors.textPrimary,
  },
  content: {
    flex: 1,
  },
  title: {
    fontFamily:   Fonts.poppinsSemiBold,
    fontSize:     18,
    lineHeight:   24,
    color:        Colors.textPrimary,
    paddingRight: 48,
    marginBottom: 24,
  },
  list: {
    flex: 1,
  },
  grid: {
    paddingBottom: 8,
  },
  row: {
    gap:          CARD_GAP,
    marginBottom: CARD_GAP,
  },
  sendBtn: {
    backgroundColor:  Colors.primaryDark,
    borderRadius:     8,
    paddingVertical:  14,
    alignItems:       'center',
    width:            360,
    alignSelf:        'center',
    marginTop:        24,
  },
  sendBtnDisabled: {
    backgroundColor: Colors.primaryLight,
  },
  sendBtnText: {
    fontFamily: SemanticFontsEnglish.buttonEnglishMedium,
    fontSize:   14,
    color:      Colors.white,
  },
})
