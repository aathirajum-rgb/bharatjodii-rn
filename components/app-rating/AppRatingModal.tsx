// "Rate our app" popup — Angular: components/app-rating/app-rating.component.
//
// One component, four sections (Angular's compData.SECTION), driven in sequence
// by app-rating.service.ts's chain of modals:
//
//   Rating  --(stars >= 4)--> PS-Rating --> Play Store
//           --(stars <  4)--> Form      --> Thanks-Rating (auto-dismiss 3s)
//
// Angular presents each step as a separate Ionic modal; RN has no modal stack
// here, so the steps are states of one bottom sheet. The sheet shell itself is
// the shared BottomSheet (scrim, slide-up, floating ✕) via its `children`
// escape hatch — Angular's .bottomsheet-popup is a bottom sheet, not the
// centered card this component used to render.
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import BottomSheet from '../bottom-sheet/BottomSheet'
import ButtonRevamp from '../button-revamp/ButtonRevamp'
import SelectableCard from '../radio-checkbox-card/SelectableCard'
import CdnSvg, { CdnImage } from '../cdn-svg/CdnSvg'
import CdnLottie from '../CdnLottie'
import {
  fetchRatingContent, markRatingPopupClosed, redirectToPlayStore, submitRating,
  RATING_SECTIONS, STAR_IMG, THANKS_AUTO_DISMISS_MS,
  type RatingContent, type RatingSection,
} from '../../service/appRatingService'
import { Colors } from '../../constants/colors'
import { CDN_SVG } from '../../constants/cdn'
import { useLanguageFonts } from '../../hooks/useLanguageFonts'
import { FontSize } from '../../src/theme/fonts'

const OR_LEFT  = CDN_SVG + 'revamp/or-left-side.svg'
const OR_RIGHT = CDN_SVG + 'revamp/or-right-side.svg'

// Angular: AppRatingComponent's checkboxValues = [0,0,0,0]
const EMPTY_CHECKBOXES = [0, 0, 0, 0]

export interface AppRatingModalProps {
  visible: boolean
  /**
   * Angular's actionNo / componentData.source — which trigger opened this
   * ('1' passive, '2' like, '3' VP, '4'/'5' login-time). Sent as the SOURCE
   * param on submit. Defaults to Angular's own '1'.
   */
  source?: string | undefined
  onClose: () => void
}

export default function AppRatingModal({ visible, source = '1', onClose }: AppRatingModalProps) {
  const { t } = useTranslation()
  const fonts = useLanguageFonts()

  const [section, setSection] = useState<RatingSection>('Rating')
  const [stars,   setStars]   = useState(0)
  const [content, setContent] = useState<RatingContent | null>(null)
  // Angular: checkboxValues — one 0/1 per content option, joined with '|'.
  // Seeded with Angular's own literal [0,0,0,0] so a failed content fetch still
  // sends the four-slot OPTIONS string the server expects, then resized to the
  // real option count once the content arrives.
  const [checked, setChecked] = useState<number[]>(EMPTY_CHECKBOXES)
  const [suggestion, setSuggestion] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const thanksTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Angular: the component's constructor fires getContent() as soon as the modal
  // is created, so the star captions (EXPERIENCE) are already in hand by the time
  // the user taps a star, and the form's options are ready if it's needed.
  useEffect(() => {
    if (!visible) return
    let cancelled = false
    setSection('Rating')
    setStars(0)
    setSuggestion('')
    setChecked(EMPTY_CHECKBOXES)
    setSubmitting(false)
    fetchRatingContent()
      .then(res => {
        if (cancelled || !res) return
        setContent(res)
        setChecked(new Array(res.options.length).fill(0))
      })
      .catch(() => { /* Angular ignores a failed getContent() too — stars still work */ })
    return () => { cancelled = true }
  }, [visible])

  useEffect(() => () => { if (thanksTimer.current) clearTimeout(thanksTimer.current) }, [])

  const close = useCallback(() => {
    if (thanksTimer.current) { clearTimeout(thanksTimer.current); thanksTimer.current = null }
    markRatingPopupClosed()
    onClose()
  }, [onClose])

  // Angular: clickOnBtn('Rating') → SubmitRating() → dismiss, then the service's
  // onDidDismiss picks the next modal by rating value.
  async function handleStarsSubmit() {
    if (stars === 0 || submitting) return
    if (stars >= 4) {
      // Angular SubmitRating(): for 4-5 the guard passes, so the rating posts
      // immediately with no options/suggestions.
      setSubmitting(true)
      await submitRating({ source, ratingValue: stars })
      setSubmitting(false)
      setSection('PS-Rating')
      return
    }
    // Angular: for 1-3 SubmitRating() early-returns (nothing to send yet) and
    // openRatingFormPopup() collects the reason first.
    setSection('Form')
  }

  // Angular: isValidInput() — at least one checkbox or some free text.
  const formValid = checked.includes(1) || suggestion.trim() !== ''

  async function handleFormSubmit() {
    if (!formValid || submitting) return
    setSubmitting(true)
    await submitRating({ source, ratingValue: stars, suggestions: suggestion, options: checked })
    setSubmitting(false)
    setSection('Thanks-Rating')
    thanksTimer.current = setTimeout(close, THANKS_AUTO_DISMISS_MS)
  }

  function handleRateUs() {
    void redirectToPlayStore()
    close()
  }

  const cfg = RATING_SECTIONS[section]
  // Angular: .section-popup gap is 2.5rem, overridden to 0 for Thanks-Rating
  // and 1.5rem for PS-Rating.
  const sectionGap = section === 'Thanks-Rating' ? 0 : section === 'PS-Rating' ? 24 : 40
  // Angular: the title/note block is centered only on the star step.
  const centered = section === 'Rating'
  // Angular: EXPERIENCE is indexed by ratingIndex (0-based), so 1 star = [0].
  const experience = stars > 0 ? content?.experience?.[stars - 1] : undefined

  return (
    <BottomSheet
      visible={visible}
      showClose={cfg.closeCta}
      // Angular: every rating modal is created with backdropDismiss:false.
      dismissOnBackdrop={false}
      onClose={close}
    >
      <View style={[s.section, { rowGap: sectionGap }]}>
        {/* ── Header illustration (Angular: HDR_IMG + IMG/ANIMATION) ── */}
        {!!cfg.lottie && (
          <View style={s.animSlot}>
            <CdnLottie uri={cfg.lottie} width={100} height={100} loop={false} />
          </View>
        )}
        {!cfg.lottie && !!cfg.image && (
          <View style={s.headerImgRow}>
            <CdnImage uri={cfg.image} width={64} height={64} />
          </View>
        )}

        {/* ── Title + note (Angular: compData.TITLE / compData.NOTE) ── */}
        {section !== 'Form' && (
          <View>
            {!!cfg.titleKey && (
              <Text
                style={[s.title, { fontFamily: fonts.semiBold }, centered && s.textCenter]}
              >
                {t(cfg.titleKey)}
              </Text>
            )}
            {!!cfg.noteKey && (
              <Text
                style={[
                  s.note,
                  { fontFamily: fonts.regular },
                  centered && s.textCenter,
                  // Angular: Thanks-Rating's note gets mb-20 pr-32.
                  section === 'Thanks-Rating' && s.thanksNote,
                ]}
              >
                {t(cfg.noteKey)}
              </Text>
            )}
          </View>
        )}

        {/* ── Section: Rating (stars) ── */}
        {section === 'Rating' && (
          <View>
            {/* Angular: the EXPERIENCE emoji + caption appear only once a star
                is picked, above the star row. */}
            {!!experience && (
              <View style={s.experienceBlock}>
                {!!experience.IMG && <CdnImage uri={experience.IMG} width={48} height={48} />}
                {!!experience.VALUE && (
                  <Text style={[s.experienceText, { fontFamily: fonts.regular }]}>
                    {experience.VALUE}
                  </Text>
                )}
              </View>
            )}
            <View style={s.starRow}>
              {[1, 2, 3, 4, 5].map(n => (
                <Pressable key={n} onPress={() => setStars(n)} hitSlop={6}>
                  <CdnSvg
                    uri={n <= stars ? STAR_IMG.filled : STAR_IMG.empty}
                    width={32}
                    height={32}
                  />
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {/* Angular's App_Rating CTA has no [isDisabled] binding — it stays
            enabled with no star picked and clickOnBtn() simply no-ops
            (only the form step's CTA is disabled, via isValidInput()). */}
        {section === 'Rating' && (
          <ButtonRevamp
            label={t(cfg.ctaKey)}
            variant="primary"
            fullWidth
            disabled={submitting}
            onPress={() => { void handleStarsSubmit() }}
          />
        )}

        {/* ── Section: Form (what went wrong) ── */}
        {section === 'Form' && (
          <View>
            {!!content?.question && (
              <Text style={[s.question, { fontFamily: fonts.medium }]}>{content.question}</Text>
            )}

            <View style={s.optionList}>
              {content?.options.map((label, i) => (
                <SelectableCard
                  key={i}
                  type="checkbox"
                  label={label}
                  selected={checked[i] === 1}
                  onPress={() => setChecked(prev => {
                    const next = [...prev]
                    next[i] = next[i] === 1 ? 0 : 1
                    return next
                  })}
                />
              ))}
            </View>

            {/* Angular: or-left-side.svg | 'GENERAL.OR' | or-right-side.svg */}
            <View style={s.orRow}>
              <Image source={{ uri: OR_LEFT }} style={s.orLine} resizeMode="contain" />
              <Text style={[s.orText, { fontFamily: fonts.regular }]}>{t('GENERAL.OR')}</Text>
              <Image source={{ uri: OR_RIGHT }} style={s.orLine} resizeMode="contain" />
            </View>

            <TextInput
              style={[s.textArea, { fontFamily: fonts.regular }]}
              placeholder={t('STAR_RATING.TEXTAREA')}
              placeholderTextColor={Colors.textPlaceholder}
              value={suggestion}
              onChangeText={setSuggestion}
              multiline
              numberOfLines={4}
            />

            <ButtonRevamp
              label={t(cfg.ctaKey)}
              variant="primary"
              fullWidth
              style={s.formCta}
              disabled={!formValid || submitting}
              onPress={() => { void handleFormSubmit() }}
            />
          </View>
        )}

        {/* ── Section: PS-Rating (thanks + Play Store) ── */}
        {section === 'PS-Rating' && (
          <View style={s.psCtaBlock}>
            <ButtonRevamp
              label={t(cfg.ctaKey)}
              variant="primary"
              fullWidth
              onPress={handleRateUs}
            />
            {/* Angular: the SKIP link uses EButtonTextColor.grey + regular14 +
                line-height-20, not the link variant's brand color — same grey
                link treatment BottomSheet's own linkCtaText already uses. */}
            <Pressable onPress={close} hitSlop={6} style={s.linkCtaBtn}>
              <Text style={[s.linkCtaText, { fontFamily: fonts.regular }]}>
                {t(cfg.linkCtaKey)}
              </Text>
            </Pressable>
          </View>
        )}
      </View>
    </BottomSheet>
  )
}

const s = StyleSheet.create({
  // Angular: .section-popup — a vertical stack whose gap varies per section.
  section: {
    width: '100%',
  },
  // Angular: .anim-slot — a left-aligned success animation above the title. Its
  // 140x132 box and negative margins are tuned to the transparent padding baked
  // into Angular's success-animation.gif; this renders the same success-new.json
  // lottie every other success sheet in this app uses (ReportProfileModal,
  // BulkLikeSentSheet, OTPSuccessSheet), at their shared 100x100 slot size.
  animSlot: {
    width:        100,
    height:       100,
    alignSelf:    'flex-start',
    marginBottom: 16,
  },
  headerImgRow: {
    flexDirection: 'row',
  },
  // Angular: .heading2-semibold-18 .black-color .line-height-24
  title: {
    fontSize:   FontSize.font18,
    lineHeight: 24,
    color:      Colors.textPrimary,
  },
  // Angular: .mt-8 .body2-regular-14 .black-color .line-height-20
  note: {
    marginTop:  8,
    fontSize:   FontSize.font14,
    lineHeight: 20,
    color:      Colors.textPrimary,
  },
  thanksNote: {
    marginBottom: 20,
    paddingRight: 32,
  },
  textCenter: {
    textAlign: 'center',
  },
  // Angular: .mb-16 .d-block .text-align-center
  experienceBlock: {
    alignItems:   'center',
    marginBottom: 16,
    rowGap:       8,
  },
  experienceText: {
    fontSize: FontSize.font14,
    color:    Colors.textPrimary,
  },
  // Angular: .star-content — centered row, 1rem gap, 2rem icons.
  starRow: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'center',
    columnGap:      16,
  },
  // Angular: .heading4-medium-16 .clr0
  question: {
    fontSize:     FontSize.font16,
    lineHeight:   22,
    color:        Colors.textPrimary,
    marginBottom: 8,
  },
  // Angular: .list-content — display grid, row-gap 12px.
  optionList: {
    rowGap:    12,
    marginTop: 8,
  },
  // Angular: .d-flex .align-center-item .ion-justify-content-center .pt-16 .pb-16
  orRow: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'center',
    paddingVertical: 16,
    columnGap:      8,
  },
  orLine: {
    flex:   1,
    height: 8,
  },
  // Angular: .body3-regular-12 .or-color (#000 at 50% opacity)
  orText: {
    fontSize: FontSize.font12,
    color:    Colors.textPrimary,
    opacity:  0.5,
  },
  // Angular: .any-suggestion-textarea-feedback — 8px radius, 1px #8A8A8A border,
  // 16px inner start padding, .body3-regular-12, 4 rows.
  textArea: {
    minHeight:         88,
    borderWidth:       1,
    borderColor:       '#8A8A8A',
    borderRadius:      8,
    paddingHorizontal: 16,
    paddingVertical:   12,
    fontSize:          FontSize.font12,
    color:             '#1f1e1b',
    textAlignVertical: 'top',
  },
  // Angular: .mt-24 around the form's submit button
  formCta: {
    marginTop: 24,
  },
  // Angular: .pt-12 wrapper with a .pt-8 gap between the two CTAs
  psCtaBlock: {
    paddingTop: 12,
    rowGap:     8,
  },
  linkCtaBtn: {
    alignItems:      'center',
    paddingVertical: 10,
  },
  linkCtaText: {
    fontSize:   FontSize.font14,
    lineHeight: 20,
    color:      '#333333',
  },
})
