// The 3-dot dropdown shown top-right of a profile card's photo — Angular:
// report-remove-profile.component.html/.ts/.scss. Verified directly against
// that source (not a guess): it's a plain absolutely-positioned dropdown
// panel anchored just below the 3-dot button (`position: absolute; right:
// 12px; top: 48px; z-index: 9999`), NOT a native action sheet / bottom
// sheet — a previous version of this port used a plain Alert.alert instead,
// which looks nothing like this and has no icons.
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import { useTranslation } from 'react-i18next'
import CdnSvg from '../cdn-svg/CdnSvg'
import { Colors } from '../../constants/colors'
import { CDN_SVG } from '../../constants/cdn'
import { SemanticFontsEnglish } from '../../src/theme/fonts'

const REMOVE_ICON_URI  = CDN_SVG + 'remove-photo-img.svg'
const REPORT_ICON_URI  = CDN_SVG + 'viewprofile/report-profile-img.svg'
// Confirmed real asset (old Angular: assets/images/svg/unblock-jodii-chat-img.svg) —
// no dedicated "unblock" icon existed anywhere else in this port's CDN usage yet.
const UNBLOCK_ICON_URI = CDN_SVG + 'unblock-jodii-chat-img.svg'
// Angular: button.component.html's blockProfileBtn case — confirmed real asset,
// reused rather than a dedicated "block" icon (Angular's own menu item does this too).
const BLOCK_ICON_URI   = CDN_SVG + 'revamp/close-icon.svg'
// Angular: messages.component.html:43's phoneViewBtn case — view-profile-message.svg.
const VIEW_ICON_URI    = CDN_SVG + 'view-profile-message.svg'
// Angular: messages.component.html:64-67's safetyTipBtn case — safety-tips-message.svg.
const SAFETY_TIPS_ICON_URI = CDN_SVG + 'safety-tips-message.svg'

export interface ThreeDotMenuProps {
  // Angular: report-remove-profile.component.ts's @Input IsShowRemoveProfile/
  // IsShowReportProfile — both default false, caller opts each in. Order is
  // fixed in the real markup: Remove ABOVE Report when both show.
  showRemove?: boolean | undefined
  showReport?: boolean | undefined
  onRemove?:   (() => void) | undefined
  onReport?:   (() => void) | undefined
  // Desktop "Ignored profiles" screen's Blocked tab (Figma node 735:31320) —
  // a single "Unblock this profile" item, mutually exclusive with Remove/Report
  // in practice (no caller passes both today).
  showUnblock?: boolean | undefined
  onUnblock?:   (() => void) | undefined
  // ChatScreen.tsx's overflow menu — "Block profile", shown only when there's
  // no existing block relationship (mutually exclusive with showUnblock there).
  showBlock?: boolean | undefined
  onBlock?:   (() => void) | undefined
  // Angular: messages.component.html:43 — "View #HIS_HER# profile", always
  // shown (no *ngIf), first item in the chat overflow menu. Text is gendered
  // to the profile being viewed (the chat partner), not the logged-in user.
  showView?:  boolean | undefined
  onView?:    (() => void) | undefined
  viewGender?: 'M' | 'F' | undefined
  // Angular: messages.component.html:64-67 — "Safety tips", always shown,
  // last item (lines="none" — no divider under it).
  showSafetyTips?: boolean | undefined
  onSafetyTips?:   (() => void) | undefined
  // Desktop cards anchor this button inline in the icon row (relatively
  // positioned wrapper), not floating over the whole card's photo like
  // mobile does — override top/right to anchor to that smaller wrapper.
  positionStyle?: StyleProp<ViewStyle>
}

// Angular: ion-item's default `lines="inset"` — a thin bottom border that
// starts/ends INSET from the row's own edges (not full-bleed edge-to-edge),
// under every row except the last (`lines="none"`). A border directly on the
// Pressable ignores its own paddingHorizontal and spans edge-to-edge in RN,
// so the divider is a separate inset View sitting below the row's content
// instead of a border on the row itself.
function MenuItem({ onPress, isLast, children }: { onPress?: (() => void) | undefined; isLast: boolean; children: React.ReactNode }) {
  return (
    <View>
      <Pressable style={s.item} onPress={onPress}>{children}</Pressable>
      {!isLast && <View style={s.itemDivider} />}
    </View>
  )
}

export default function ThreeDotMenu({
  showRemove, showReport, onRemove, onReport, showUnblock, onUnblock, showBlock, onBlock,
  showView, onView, viewGender = 'M', showSafetyTips, onSafetyTips, positionStyle,
}: ThreeDotMenuProps) {
  const { t } = useTranslation()

  // Which row ends up last varies by which flags the caller passes (e.g.
  // showSafetyTips is chat-only), so this computes it from the same order the
  // rows render in below, rather than hardcoding one.
  const order = [
    ['view', showView], ['remove', showRemove], ['block', showBlock],
    ['unblock', showUnblock], ['report', showReport], ['safetyTips', showSafetyTips],
  ] as const
  const visible = order.filter(([, show]) => show).map(([key]) => key)
  const lastKey = visible[visible.length - 1]

  return (
    <View style={[s.dropdown, positionStyle]}>
      {/* Angular: messages.component.html:39-68 — chat overflow menu order is
          View profile → Block/Unblock profile → Report profile → Safety tips. */}
      {showView && (
        <MenuItem onPress={onView} isLast={lastKey === 'view'}>
          <CdnSvg uri={VIEW_ICON_URI} width={20} height={20} />
          <Text style={s.itemText}>{t('MESSAGES.VIEW_CONTACT').replace(/#HER_HIS#/gi, t(`PRONOUN.${viewGender}.hisher`))}</Text>
        </MenuItem>
      )}
      {showRemove && (
        <MenuItem onPress={onRemove} isLast={lastKey === 'remove'}>
          <CdnSvg uri={REMOVE_ICON_URI} width={20} height={20} />
          <Text style={s.itemText}>{t('MATCHES.REMOVEPROFILE')}</Text>
        </MenuItem>
      )}
      {showBlock && (
        <MenuItem onPress={onBlock} isLast={lastKey === 'block'}>
          <CdnSvg uri={BLOCK_ICON_URI} width={20} height={20} />
          <Text style={s.itemText}>{t('MESSAGES.BLOCK_PROFILE', 'Block this profile')}</Text>
        </MenuItem>
      )}
      {showUnblock && (
        <MenuItem onPress={onUnblock} isLast={lastKey === 'unblock'}>
          <CdnSvg uri={UNBLOCK_ICON_URI} width={20} height={20} />
          <Text style={s.itemText}>{t('PROFILES.UNBLOCK')}</Text>
        </MenuItem>
      )}
      {showReport && (
        <MenuItem onPress={onReport} isLast={lastKey === 'report'}>
          <CdnSvg uri={REPORT_ICON_URI} width={20} height={20} />
          <Text style={s.itemText}>{t('MATCHES.MORE_OPT_2')}</Text>
        </MenuItem>
      )}
      {showSafetyTips && (
        <MenuItem onPress={onSafetyTips} isLast={lastKey === 'safetyTips'}>
          <CdnSvg uri={SAFETY_TIPS_ICON_URI} width={20} height={20} />
          <Text style={s.itemText}>{t('MESSAGES.SAFETY_TIPS')}</Text>
        </MenuItem>
      )}
    </View>
  )
}

const s = StyleSheet.create({
  // Angular: .jodii-chat-report-block { position:absolute; right:31%; top:50px;
  // border:1px solid #e5e5e5; border-radius:8px; z-index:99 } — confirmed NO
  // box-shadow/elevation anywhere in this SCSS file, just the 1px border.
  dropdown: {
    position: 'absolute', top: 48, right: 12, zIndex: 9999,
    backgroundColor: Colors.white, borderRadius: 8, minWidth: 190,
    borderWidth: 1, borderColor: '#e5e5e5',
  },
  // Angular: .jodii-chat-report-block ion-item — inner-padding-top/bottom 8px,
  // inner-padding-start 0, padding-end 16px; row content div is d-flex
  // align-center-item with ml-4 (4px) gap between icon and label text.
  item: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 8, paddingHorizontal: 16 },
  // Angular: ion-item's default `lines="inset"` — a thin line inset from
  // BOTH the left and right edges (not full-bleed edge-to-edge), matching the
  // row's own 16px horizontal padding. Ionic's default border color is a
  // very light gray (--ion-border-color) — lightened from an earlier, too-
  // dark #e0e0e0 guess. A little extra vertical breathing room around the
  // line itself (rather than changing the row's own Angular-matched 8px
  // padding) so rows don't feel cramped against it.
  itemDivider: { height: StyleSheet.hairlineWidth, backgroundColor: '#f0f0f0', marginHorizontal: 16, marginVertical: 4 },
  itemText: { fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: 14, color: Colors.black },
})
