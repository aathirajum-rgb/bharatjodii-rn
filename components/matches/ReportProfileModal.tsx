// Full reasons-picker report form — Angular: pages/report-profile/report-profile
// .component.ts/.html (a routed page there; a modal here — kept as a modal for
// consistency with every other Angular "popup" flow this app already ports as
// a bottom sheet/modal rather than a real navigation route).
//
// Verified directly against report-profile.component.html: the comment
// textarea / photo-attachment / audio-recording block (lines 55-438) is
// wrapped in `*ngIf="false"` in Angular's own source — it's dead code, never
// rendered in the live app despite the component still having full logic for
// it. The PREVIOUS version of this file built that now-nonexistent-in-
// production evidence UI anyway; simplified to match what Angular's real
// users actually see today — a plain reason list + single submit button.
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native'
import LottieView from 'lottie-react-native'
import CdnSvg from '../cdn-svg/CdnSvg'
import { Colors } from '../../constants/colors'
import { CDN_SVG, CDN_LOTTIE } from '../../constants/cdn'
import { fetchReportReasons, submitReport, type ReportReason } from '../../service/reportProfileService'
import { Fonts, SemanticFontsEnglish } from '../../src/theme/fonts'

const BACK_ICON_URI = CDN_SVG + 'arrow-back-activity.svg'
// Angular: bottom-sheet.component.html:21 — same success animation used for
// action='reportProfile', ImgDomain() + 'assets/jodii-lottie-files/success-new.json'.
const SUCCESS_LOTTIE_URL = CDN_LOTTIE + 'success-new.json'

export interface ReportProfileModalProps {
  visible:       boolean
  partnerId:     string
  partnerName?:  string | undefined
  onClose:       () => void
  onSubmitted:   () => void
}

export default function ReportProfileModal({
  visible, partnerId, partnerName, onClose, onSubmitted,
}: ReportProfileModalProps) {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(true)
  const [reasons, setReasons] = useState<ReportReason[]>([])
  const [disabledKeys, setDisabledKeys] = useState<string[]>([])
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  // Angular: report-profile.component.ts:289-296 — on success, opens the shared
  // BottomSheetComponent (action='reportProfile') instead of just toasting.
  const [success, setSuccess] = useState<{ title: string; content: string; cta: string } | null>(null)

  useEffect(() => {
    if (!visible) return
    let cancelled = false
    setLoading(true)
    setSelectedKey(null)
    setSuccess(null)
    fetchReportReasons(partnerId).then(({ reasons: r, disabledKeys: d }) => {
      if (cancelled) return
      setReasons(r)
      setDisabledKeys(d)
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [visible, partnerId])

  const selectedReason = reasons.find(r => r.key === selectedKey) ?? null

  async function handleSubmit() {
    if (!selectedReason) return
    setSubmitting(true)
    try {
      const result = await submitReport(partnerId, { key: selectedReason.key, title: selectedReason.title })
      if (result.ok) {
        setSuccess({
          title: result.title ?? t('GENERAL.REPORT_RECEIVED_TITLE', 'Your report has been received!'),
          content: result.content ?? t(
            'GENERAL.REPORT_RECEIVED_CONTENT',
            'We will investigate your complaint, and if found valid, the phone number reduced for this profile will be credited back.',
          ),
          cta: result.cta ?? t('GENERAL.OK', 'Ok'),
        })
      }
    } finally {
      setSubmitting(false)
    }
  }

  // Angular: generalContent.REPORT = "Report <span class='report-profile-name'>
  // #NAME#</span>" — the reported person's name IS part of this header, colored
  // #de2a68 (report-profile.component.html:1-18) — a previous version of this
  // modal used a generic, nameless "Report profile" title instead.
  const reportPrefix = t('GENERAL.REPORT').split('#NAME#')[0]?.replace(/<[^>]+>/g, '') ?? ''

  return (
    // `transparent` — same fix as BulkLikeModal.tsx: this was the only other
    // Modal in the app missing it, the same known react-native-web pitfall
    // (content renders fine, pointer events silently stop reaching it).
    // `m.screen`'s own opaque white background already covers the full screen.
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={m.screen}>
        <View style={m.header}>
          <Pressable onPress={onClose} hitSlop={10}>
            <CdnSvg uri={BACK_ICON_URI} width={22} height={22} />
          </Pressable>
          <Text style={m.headerTitle}>
            {reportPrefix}
            <Text style={m.headerTitleName}>{partnerName ?? ''}</Text>
          </Text>
        </View>

        {loading ? (
          <View style={m.loaderBox}>
            <ActivityIndicator size="large" color={Colors.primary} />
          </View>
        ) : (
          <ScrollView style={m.body} contentContainerStyle={m.bodyContent}>
            <Text style={m.subtitle}>{t('GENERAL.REPORTING_REASON')}</Text>

            {/* Angular: report-profile.component.html:37 — `.report-profile-reason`
                (border:1px solid #545454; border-radius:8px; background:#FFF)
                is applied INSIDE the *ngFor, once PER reason, each with its
                own mt-16 gap — NOT one card wrapping the whole list. An
                earlier pass here misread the CSS class alone (defined once)
                without checking the markup applies it per-item, and wrongly
                "corrected" this into a single outer card with inner dividers. */}
            {reasons.map(reason => {
              const disabled = disabledKeys.includes(reason.key)
              const selected = selectedKey === reason.key
              return (
                <Pressable
                  key={reason.key}
                  style={[m.reasonCard, disabled && m.reasonCardDisabled]}
                  onPress={() => !disabled && setSelectedKey(reason.key)}
                  disabled={disabled}
                >
                  <Text style={[m.reasonTitle, disabled && m.reasonTitleDisabled]}>{reason.title}</Text>
                  {disabled ? (
                    <Text style={m.alreadyReported}>{t('GENERAL.ALREADY_REPORTED')}</Text>
                  ) : (
                    <View style={[m.radioOuter, selected && m.radioOuterActive]}>
                      {selected && <View style={m.radioInner} />}
                    </View>
                  )}
                </Pressable>
              )
            })}
          </ScrollView>
        )}

        {/* report-profile.component.scss's own `.report-block-btn` class says
            gold/#fcd34d — but a live screenshot of the real app shows this
            button (and the checked radio) using this app's usual brand-red
            (Colors.primaryDark), matching every other primary CTA — that
            class is evidently stale/overridden in the actually-shipped build,
            so the real rendered app wins over the stylesheet on disk. */}
        <View style={m.footer}>
          <Pressable
            style={[m.submitBtn, (!selectedReason || submitting) && m.submitBtnDisabled]}
            disabled={!selectedReason || submitting}
            onPress={handleSubmit}
          >
            {submitting ? (
              <ActivityIndicator size="small" color={Colors.white} />
            ) : (
              <Text style={m.submitBtnText}>{t('GENERAL.REPORT_BLOCK_CTA')}</Text>
            )}
          </Pressable>
        </View>

        {/* Angular: bottom-sheet.component.html action='reportProfile' — a
            non-dismissable (backdropDismiss:false), backdrop-covered success
            sheet with the success-new.json lottie, TITLE/CONTENT, and a
            single primary CTA that (via modal.onDidDismiss()) navigates back
            / closes — NOT just a toast. */}
        {success && (
          <View style={m.successOverlay}>
            <View style={m.successSheet}>
              <View style={m.successLottieWrap}>
                <LottieView source={{ uri: SUCCESS_LOTTIE_URL }} autoPlay loop={false} style={m.successLottie} />
              </View>
              <Text style={m.successTitle}>{success.title}</Text>
              <Text style={m.successContent}>{success.content}</Text>
              <Pressable style={m.submitBtn} onPress={onSubmitted}>
                <Text style={m.submitBtnText}>{success.cta}</Text>
              </Pressable>
            </View>
          </View>
        )}
      </View>
    </Modal>
  )
}

const m = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.white },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: Colors.divider,
  },
  // Angular: .report-profile-heading { font-family: heading-02-english-Medium;
  // font-size:16px; color:#333333 } — Medium weight, not SemiBold.
  headerTitle: { fontFamily: SemanticFontsEnglish.headingEnglishMedium, fontSize: 16, color: '#333333' },
  // Angular: .report-profile-name { color: #de2a68 } — the reported person's
  // name is colored differently from the rest of the "Report X" title.
  headerTitleName: { color: '#de2a68' },
  loaderBox: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1 },
  // Angular: outer content padding is pl-24/pr-24 only (no top/bottom here —
  // the heading's own mt-32 supplies the top gap from the header).
  bodyContent: { paddingHorizontal: 24, paddingBottom: 16 },
  // Angular: .heading3-semibold-16.color-1f1e1b, classes "mt-32 mb-24" — a
  // real heading (SemiBold 16px), not the small Regular-13px caption this
  // previously used.
  subtitle: { fontFamily: Fonts.poppinsSemiBold, fontSize: 16, color: '#1f1e1b', marginTop: 32, marginBottom: 24 },
  // Angular: report-profile.component.html:37 — `.report-profile-reason`
  // (border:1px solid #545454; border-radius:8px; background:#FFF) + "mt-16"
  // applied to EACH reason individually (inside the *ngFor), not one shared
  // outer card. Padding matches report-profile.component.scss's `.report-
  // profile-reason ion-item` overrides (--padding-top/bottom:12,
  // --inner-padding-start:16, --padding-end:16).
  reasonCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1, borderColor: '#545454', borderRadius: 8, backgroundColor: Colors.white,
    paddingVertical: 12, paddingHorizontal: 16, marginTop: 16,
  },
  reasonCardDisabled: { opacity: 0.6 },
  reasonTitle: { flex: 1, fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: 14, color: Colors.black, paddingRight: 12 },
  reasonTitleDisabled: { color: Colors.textSecondary },
  // Angular: .text-disabled { color: #ef4444 }
  alreadyReported: { fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: 12, color: '#ef4444' },
  // Unselected border a bit more visible than the near-invisible Colors.divider
  // (#f0f0f0) — matches the real screenshot's clearly-visible thin gray ring.
  radioOuter: {
    width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: Colors.inputBorder,
    alignItems: 'center', justifyContent: 'center',
  },
  // Live screenshot confirms the checked radio and submit button are BOTH
  // this app's usual brand-red (Colors.primaryDark, #B50033) — the same red
  // used everywhere else for primary actions, NOT the gold/#F1BA11 the CSS
  // source suggested (that class is evidently stale/overridden — the real
  // rendered app is the authority here, not the stylesheet on disk).
  radioOuterActive: { borderColor: Colors.primaryDark },
  radioInner: { width: 12, height: 12, borderRadius: 6, backgroundColor: Colors.primaryDark },
  // Angular: .report-block-btn-block { padding-top:24px; padding-bottom:24px }
  // on the ion-col wrapping the button, itself pl-24/pr-24 — 24px on all sides,
  // not the smaller uniform 16px this previously had.
  footer: { padding: 24, borderTopWidth: 1, borderTopColor: Colors.divider },
  submitBtn: {
    width: '100%', height: 48, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.primaryDark,
  },
  // Colors.primaryLight — this app's existing "disabled button bg" token,
  // reused here instead of a one-off gray.
  submitBtnDisabled: { backgroundColor: Colors.primaryLight },
  submitBtnText: { fontFamily: Fonts.poppinsSemiBold, fontSize: 16, color: Colors.white },

  // Angular: ion-backdrop (showBackdrop:true) behind the bottomsheet-revamp-popup.
  successOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  // Angular: .btm-sheet-modal / .popup-section.bottomsheet-revamp-popup — rounded
  // top corners, pl-24/pr-24 content, mt-24/mb-24 vertical rhythm.
  successSheet: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 16, borderTopRightRadius: 16,
    paddingHorizontal: 24, paddingTop: 24, paddingBottom: 32,
  },
  // Angular: .anim-slot — left-aligned success-new.json lottie, no image row.
  successLottieWrap: { width: 100, height: 100, alignSelf: 'flex-start', marginBottom: 16 },
  successLottie: { width: 100, height: 100 },
  // Angular: heading2-semibold-18 color-1f1e1b
  successTitle: { fontFamily: Fonts.poppinsSemiBold, fontSize: 18, color: '#1f1e1b', marginBottom: 12 },
  // Angular: body2-regular-14 color-1f1e1b, pr-32 mt-12
  successContent: { fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: 14, color: '#1f1e1b', lineHeight: 20, marginBottom: 24 },
})
