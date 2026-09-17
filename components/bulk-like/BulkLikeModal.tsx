// Full-screen "like several profiles at once" modal.
// Angular: components/fullpage-modalpopup/fullpage-modalpopup.component — a
// full-screen popup (all candidates pre-checked) + a single "Send likes"
// button. No existing full-screen modal precedent in this app (the closest,
// components/bottom-sheet/BottomSheet.tsx, is a transparent scrim+sheet, not
// a true full-screen cover), so this is a new pattern.
//
// Angular's three bottom sheets around this modal are all ported:
// - skip (CONFIG.SKIP_BULK_LIKE, action 'skipbulk') — opened by the header ✕,
//   NOT by closing outright: bulkSkip() offers "Send interests & continue"
//   (-> sendLikes()) or "Skip" (-> dismiss). Non-dismissable otherwise
//   (backdropDismiss:false, showClose:false).
// - success (CONFIG.BULK_LIKE, action 'Successbtmpopup') — BulkLikeSentSheet,
//   auto-dismissed after 2s, then the modal closes.
// - male photo upsell (CONFIG.PHOTO_BULK_LIKE) — raised by the parent via
//   onSentNeedsPhoto(), since MatchesScreen owns the photo picker.
//
// The 'bulklikechk' trigger flag (Angular: registration.service.ts's
//   handleRegistrationSuccess(), set once right after registration) is now
// wired: registrationService.ts's submitFullRegistration() sets it, and
// MatchesScreen.tsx's load effect reads/consumes it — so this only shows once,
// right after registering, not on every Matches mount.
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ActivityIndicator, Animated, Easing, FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import SelectableProfileTile from './SelectableProfileTile'
import BulkLikeSentSheet from './BulkLikeSentSheet'
import BottomSheet from '../bottom-sheet/BottomSheet'
import { sendBulkLikes } from '../../service/profileService'
import { Colors } from '../../constants/colors'
import { Fonts, FontSize } from '../../src/theme/fonts'

// MATCHES.SKIP_SUBCONTENT carries a literal <br> (Angular renders it through
// [innerHTML]); RN's <Text> has no markup, so collapse it to a space.
const stripBreaks = (s: string) =>
  s.replace(/<br[^>]*>/gi, ' ').split(' ').filter(Boolean).join(' ')

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
  const { t, i18n } = useTranslation()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [sending,  setSending]  = useState(false)
  const [sent,     setSent]     = useState(false)
  // Angular: closeModal() -> bulkSkip() -> bottomSheetService.skipBulkLike().
  // The ✕ never closes this modal directly; it raises this sheet, and only its
  // "Skip" link actually dismisses.
  const [showSkip, setShowSkip] = useState(false)
  // Tracks the "brief confirmation, then close" timer in handleSend so it
  // can be cancelled — matching BulkLikeDesktopModal.tsx's own autoCloseRef
  // pattern — instead of firing onSent() against an already-unmounted modal
  // if the parent closes it within the ~1.2s window.
  const autoCloseRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Reset selection (all pre-checked, matching Angular) whenever a fresh
  // candidate batch is shown.
  //
  // The `else` branch is what tears the success sheet back down, and it is not
  // optional. Angular runs two INDEPENDENT ion-modals here: BulkLikepopup()
  // dismisses its own sheet on a 2000ms timer while sendLikes() dismisses the
  // full page on a second 2000ms timer. In this port BulkLikeSentSheet is a
  // sibling of the <Modal> below — outside it — driven by `sent`, and this
  // component stays mounted for the life of MatchesScreen (only `visible`
  // flips). Resetting `sent` only under `if (visible)` therefore never fired on
  // the CLOSE transition, so the confirmation stayed pinned on screen over
  // whatever opened next (the welcome paywall) indefinitely.
  useEffect(() => {
    if (visible) {
      setSelected(new Set(candidates.map(c => String(c.MATRIID))))
      setSending(false)
      setSent(false)
      setShowSkip(false)
    } else {
      setSent(false)
      setShowSkip(false)
    }
    if (autoCloseRef.current) clearTimeout(autoCloseRef.current)
  }, [visible, candidates])

  useEffect(() => {
    return () => { if (autoCloseRef.current) clearTimeout(autoCloseRef.current) }
  }, [])

  // ── Showcase auto-scroll ───────────────────────────────────────────────────
  // Angular: runScrollAnimation()/startAnimate()/animateScroll() — 1.5s after the
  // list renders it glides all the way down, pauses 1s, then glides back to the
  // top, so the member sees there are more matches below the fold. Duration is
  // clamp(4s, 4ms/px, 10s) with an ease-in-out-quad curve, and ANY touch
  // (Angular listens on touchstart/wheel/mousedown/pointerdown) cancels it.
  //
  // Angular drives el.scrollTop from requestAnimationFrame; the RN equivalent is
  // one Animated.Value whose listener calls scrollToOffset — useNativeDriver is
  // necessarily false, since scroll offset is not a native-animatable prop.
  const listRef     = useRef<FlatList<Record<string, any>> | null>(null)
  const contentHRef = useRef(0)
  const layoutHRef  = useRef(0)
  const scrollAnim  = useRef(new Animated.Value(0)).current
  const scrollRunRef   = useRef<Animated.CompositeAnimation | null>(null)
  const startTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null)
  const retryTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null)

  const stopShowcaseScroll = useCallback(() => {
    if (startTimerRef.current) { clearTimeout(startTimerRef.current); startTimerRef.current = null }
    if (retryTimerRef.current) { clearTimeout(retryTimerRef.current); retryTimerRef.current = null }
    scrollRunRef.current?.stop()
    scrollRunRef.current = null
  }, [])

  const runShowcaseScroll = useCallback(() => {
    const start = (): boolean => {
      const maxScroll = contentHRef.current - layoutHRef.current
      if (maxScroll <= 0) return false

      const duration = Math.min(Math.max(4000, maxScroll * 4), 10000)
      const easing   = Easing.inOut(Easing.quad)

      scrollAnim.setValue(0)
      const run = Animated.sequence([
        Animated.timing(scrollAnim, { toValue: maxScroll, duration, easing, useNativeDriver: false }),
        Animated.delay(1000),
        Animated.timing(scrollAnim, { toValue: 0, duration, easing, useNativeDriver: false }),
      ])
      scrollRunRef.current = run
      run.start(() => { scrollRunRef.current = null })
      return true
    }

    // Angular: when scrollHeight is still 0 the list hasn't laid out yet — one
    // 500ms retry, then give up.
    if (!start()) retryTimerRef.current = setTimeout(start, 500)
  }, [scrollAnim])

  useEffect(() => {
    const id = scrollAnim.addListener(({ value }) => {
      listRef.current?.scrollToOffset({ offset: value, animated: false })
    })
    return () => scrollAnim.removeListener(id)
  }, [scrollAnim])

  useEffect(() => {
    if (!visible) { stopShowcaseScroll(); return }
    // Angular: fetchMatches() -> setTimeout(runScrollAnimation, 1500).
    startTimerRef.current = setTimeout(() => runShowcaseScroll(), 1500)
    return () => stopShowcaseScroll()
  }, [visible, candidates, runShowcaseScroll, stopShowcaseScroll])

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
          // Angular: bottomSheetService.BulkLikepopup() auto-dismisses at 2000ms
          // and sendLikes() fires its own modal dismiss on the same 2000ms timer.
          autoCloseRef.current = setTimeout(onSent, 2000)
        }
      }
    } finally {
      setSending(false)
    }
  }

  // Angular: closeModal() { this.bulkSkip() } — the ✕ does not close anything on
  // its own, it opens the skip sheet. Cancel the showcase scroll first, exactly
  // as any other touch would.
  function handleClosePress() {
    stopShowcaseScroll()
    setShowSkip(true)
  }

  // Angular bulkSkip(): resp.data.action === 'sendLikesAndContinue' -> sendLikes()
  function handleSkipSendLikes() {
    setShowSkip(false)
    handleSend()
  }

  // Angular bulkSkip(): resp.data.action === 'later' -> modalCtrl.dismiss()
  function handleSkipLater() {
    setShowSkip(false)
    onClose()
  }

  // Angular's bulkLikeCtaKey getter: a single selected profile in English reads
  // "Send like" (singular); every other case falls back to the translated key.
  // Angular renders no selection count on this button.
  const ctaLabel = i18n.language === 'en' && selected.size === 1
    ? 'Send like'
    : t('MATCHES.BULK_LIKE_CTA')

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
        {/* Angular: [style.pointer-events]="sendingLikes ? 'none' : 'auto'" on
            both the header and the list — nothing is tappable mid-submit. */}
        <View style={s.header} pointerEvents={sending ? 'none' : 'auto'}>
          {/* Figma (119:268) renders this as two literal lines, not a single
              wrapped line — replacing <br> with a space instead produced a
              double space, since the translation already has one before it. */}
          <Text style={s.title}>
            {t('MATCHES.BULK_LIKE_TITLE').split(/<br\s*\/?>/gi).map(line => line.trim()).join('\n')}
          </Text>
          <Pressable onPress={handleClosePress} hitSlop={8}>
            <Text style={s.close}>✕</Text>
          </Pressable>
        </View>

        <FlatList
          ref={listRef}
          data={candidates}
          keyExtractor={c => String(c.MATRIID)}
          contentContainerStyle={s.list}
          pointerEvents={sending ? 'none' : 'auto'}
          scrollEnabled={!sending}
          onLayout={e => { layoutHRef.current = e.nativeEvent.layout.height }}
          onContentSizeChange={(_w, h) => { contentHRef.current = h }}
          // Angular addScrollListeners(): touchstart/wheel/mousedown/pointerdown
          // all abort the showcase scroll the moment the member takes over.
          onTouchStart={stopShowcaseScroll}
          onScrollBeginDrag={stopShowcaseScroll}
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
            : <Text style={s.sendBtnText}>{ctaLabel}</Text>
          }
        </Pressable>
      </LinearGradient>
    </Modal>

    <BulkLikeSentSheet visible={sent} />

    {/* Angular: CONFIG.SKIP_BULK_LIKE rendered through bottom-sheet.component's
        'skipbulk' action — no image, no cross, backdropDismiss:false, primary
        CTA 'sendLikesAndContinue' and a plain DOLATER link 'later'. */}
    <BottomSheet
      visible={showSkip}
      type="skipBulk"
      dismissOnBackdrop={false}
      data={{
        title:        t('MATCHES.SKIP_TITLE'),
        content:      stripBreaks(t('MATCHES.SKIP_SUBCONTENT')),
        ctaLabel:     t('MATCHES.SKIP_CTA'),
        linkCtaLabel: t('MATCHES.SKIP'),
        showClose:    false,
      }}
      onClose={() => {}}
      onPrimaryPress={handleSkipSendLikes}
      onLinkPress={handleSkipLater}
    />
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
