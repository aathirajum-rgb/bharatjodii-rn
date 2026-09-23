import { useEffect, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { SvgXml } from 'react-native-svg'
import { useTranslation } from 'react-i18next'
import CdnSvg from '../cdn-svg/CdnSvg'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { getMenuPromo } from '../../service/paymentService'
import { Colors } from '../../constants/colors'
import { CDN_SVG } from '../../constants/cdn'
import { Fonts, FontSize, RupeeSymbolFont, SemanticFontsEnglish } from '../../src/theme/fonts'

// ─── TEMP local preview of the re-exported Messages icon pair ─────────────────
// The corrected message-matches(.svg/_active.svg) files (same artwork/padding
// now, only fill color differs) haven't been uploaded to the CDN yet — inlined
// here so the fix can be checked before that upload happens. DELETE this block
// and the two `tab === 4` SvgXml branches below once the real files are live
// at CDN_SVG + 'message-matches.svg' / 'message-matches_active.svg', reverting
// to plain CdnSvg for tab 4 like every other tab.
const MESSAGE_INACTIVE_SVG_TEMP = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M12.8694 19.5102L13.3857 19.8158V19.8158L12.8694 19.5102ZM13.303 18.7775L12.7867 18.4719V18.4719L13.303 18.7775ZM10.697 18.7775L10.1807 19.0831V19.0831L10.697 18.7775ZM11.1307 19.5102L11.647 19.2046V19.2046L11.1307 19.5102ZM4.30448 15.1308L4.85881 14.9012H4.85881L4.30448 15.1308ZM8.63168 17.5932L8.62135 18.1931V18.1931L8.63168 17.5932ZM6.46928 17.2956L6.23967 17.8499L6.23967 17.8499L6.46928 17.2956ZM19.6956 15.1308L20.2499 15.3604V15.3604L19.6956 15.1308ZM15.3684 17.5932L15.358 16.9933V16.9933L15.3684 17.5932ZM17.5308 17.2956L17.7604 17.8499H17.7604L17.5308 17.2956ZM18.0901 4.58944L17.7766 5.10103V5.10103L18.0901 4.58944ZM19.4106 5.91001L19.9222 5.59651L19.9222 5.59651L19.4106 5.91001ZM5.91001 4.58944L5.59651 4.07786V4.07786L5.91001 4.58944ZM4.58944 5.91001L4.07786 5.59651H4.07786L4.58944 5.91001ZM9.92226 17.7679L10.2239 17.2493L10.2239 17.2493L9.92226 17.7679ZM12.8694 19.5102L13.3857 19.8158L13.8194 19.0831L13.303 18.7775L12.7867 18.4719L12.353 19.2046L12.8694 19.5102ZM10.697 18.7775L10.1807 19.0831L10.6143 19.8158L11.1307 19.5102L11.647 19.2046L11.2133 18.4719L10.697 18.7775ZM12.8694 19.5102L12.353 19.2046C12.1988 19.4651 11.8012 19.4651 11.647 19.2046L11.1307 19.5102L10.6143 19.8158C11.2332 20.8614 12.7668 20.8614 13.3857 19.8158L12.8694 19.5102ZM10.8 4V4.6H13.2V4V3.4H10.8V4ZM20.0001 10.8H19.4001V11.6H20.0001H20.6001V10.8H20.0001ZM4 11.6H4.6V10.8H4H3.4V11.6H4ZM4 11.6H3.4C3.4 12.5237 3.39967 13.2465 3.43945 13.8295C3.47959 14.4179 3.56258 14.9076 3.75015 15.3604L4.30448 15.1308L4.85881 14.9012C4.7419 14.6189 4.67265 14.2751 4.63667 13.7478C4.60033 13.2152 4.6 12.5401 4.6 11.6H4ZM8.63168 17.5932L8.64202 16.9933C7.63766 16.976 7.1114 16.9121 6.69889 16.7412L6.46928 17.2956L6.23967 17.8499C6.88365 18.1166 7.61712 18.1758 8.62135 18.1931L8.63168 17.5932ZM4.30448 15.1308L3.75015 15.3604C4.21703 16.4875 5.11253 17.383 6.23967 17.8499L6.46928 17.2956L6.69889 16.7412C5.86579 16.3962 5.20389 15.7343 4.85881 14.9012L4.30448 15.1308ZM20.0001 11.6H19.4001C19.4001 12.5401 19.3997 13.2152 19.3634 13.7478C19.3274 14.2751 19.2582 14.6189 19.1413 14.9012L19.6956 15.1308L20.2499 15.3604C20.4375 14.9076 20.5205 14.4179 20.5606 13.8295C20.6004 13.2465 20.6001 12.5237 20.6001 11.6H20.0001ZM15.3684 17.5932L15.3787 18.1931C16.3829 18.1758 17.1164 18.1167 17.7604 17.8499L17.5308 17.2956L17.3012 16.7412C16.8887 16.9121 16.3624 16.976 15.358 16.9933L15.3684 17.5932ZM19.6956 15.1308L19.1413 14.9012C18.7962 15.7343 18.1343 16.3962 17.3012 16.7412L17.5308 17.2956L17.7604 17.8499C18.8875 17.383 19.783 16.4875 20.2499 15.3604L19.6956 15.1308ZM13.2 4V4.6C14.521 4.6 15.4696 4.60064 16.2096 4.67099C16.9406 4.74049 17.4057 4.87379 17.7766 5.10103L18.0901 4.58944L18.4036 4.07786C17.8125 3.71565 17.142 3.55423 16.3232 3.47637C15.5133 3.39936 14.4978 3.4 13.2 3.4V4ZM20.0001 10.8H20.6001C20.6001 9.50227 20.6007 8.48681 20.5237 7.6769C20.4458 6.85806 20.2844 6.18757 19.9222 5.59651L19.4106 5.91001L18.899 6.22351C19.1263 6.59434 19.2596 7.05948 19.3291 7.79049C19.3994 8.53042 19.4001 9.47903 19.4001 10.8H20.0001ZM18.0901 4.58944L17.7766 5.10103C18.234 5.38138 18.6187 5.76602 18.899 6.22351L19.4106 5.91001L19.9222 5.59651C19.5429 4.97756 19.0225 4.45715 18.4036 4.07786L18.0901 4.58944ZM10.8 4V3.4C9.50227 3.4 8.48681 3.39936 7.6769 3.47637C6.85806 3.55423 6.18757 3.71565 5.59651 4.07786L5.91001 4.58944L6.22351 5.10103C6.59434 4.87379 7.05948 4.74049 7.79049 4.67099C8.53042 4.60064 9.47903 4.6 10.8 4.6V4ZM4 10.8H4.6C4.6 9.47903 4.60064 8.53042 4.67099 7.79049C4.74049 7.05948 4.87379 6.59434 5.10103 6.22351L4.58944 5.91001L4.07786 5.59651C3.71565 6.18757 3.55423 6.85806 3.47637 7.6769C3.39936 8.48681 3.4 9.50227 3.4 10.8H4ZM5.91001 4.58944L5.59651 4.07786C4.97756 4.45715 4.45715 4.97756 4.07786 5.59651L4.58944 5.91001L5.10103 6.22351C5.38138 5.76602 5.76602 5.38138 6.22351 5.10103L5.91001 4.58944ZM10.697 18.7775L11.2133 18.4719C11.0509 18.1975 10.9083 17.9554 10.7697 17.7651C10.6237 17.5648 10.4562 17.3843 10.2239 17.2493L9.92226 17.7679L9.6206 18.2866C9.65852 18.3086 9.7102 18.3488 9.79991 18.4719C9.897 18.6051 10.0067 18.7892 10.1807 19.0831L10.697 18.7775ZM8.63168 17.5932L8.62135 18.1931C8.97262 18.1992 9.19512 18.2036 9.36473 18.2224C9.52321 18.24 9.58465 18.2657 9.6206 18.2866L9.92226 17.7679L10.2239 17.2493C9.98971 17.1131 9.74599 17.0573 9.4968 17.0297C9.25873 17.0033 8.97102 16.999 8.64202 16.9933L8.63168 17.5932ZM13.303 18.7775L13.8194 19.0831C13.9933 18.7892 14.103 18.6051 14.2001 18.4719C14.2898 18.3488 14.3415 18.3086 14.3794 18.2866L14.0778 17.7679L13.7761 17.2493C13.5439 17.3843 13.3764 17.5648 13.2304 17.7651C13.0917 17.9554 12.9491 18.1975 12.7867 18.4719L13.303 18.7775ZM15.3684 17.5932L15.358 16.9933C15.029 16.999 14.7413 17.0033 14.5032 17.0297C14.254 17.0573 14.0103 17.1131 13.7761 17.2493L14.0778 17.7679L14.3794 18.2866C14.4154 18.2657 14.4768 18.24 14.6353 18.2224C14.8049 18.2036 15.0274 18.1992 15.3787 18.1931L15.3684 17.5932Z" fill="#545454"/>
<path d="M8.80005 9.6001H15.2001" stroke="#545454" stroke-width="1.20001" stroke-linecap="round"/>
<path d="M8.80005 12.3999H13.2001" stroke="#545454" stroke-width="1.20001" stroke-linecap="round"/>
</svg>`
const MESSAGE_ACTIVE_SVG_TEMP = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M12.8694 19.5102L13.3857 19.8158V19.8158L12.8694 19.5102ZM13.303 18.7775L12.7867 18.4719V18.4719L13.303 18.7775ZM10.697 18.7775L10.1807 19.0831V19.0831L10.697 18.7775ZM11.1307 19.5102L11.647 19.2046V19.2046L11.1307 19.5102ZM4.30448 15.1308L4.85881 14.9012H4.85881L4.30448 15.1308ZM8.63168 17.5932L8.62135 18.1931V18.1931L8.63168 17.5932ZM6.46928 17.2956L6.23967 17.8499L6.23967 17.8499L6.46928 17.2956ZM19.6956 15.1308L20.2499 15.3604V15.3604L19.6956 15.1308ZM15.3684 17.5932L15.358 16.9933V16.9933L15.3684 17.5932ZM17.5308 17.2956L17.7604 17.8499H17.7604L17.5308 17.2956ZM18.0901 4.58944L17.7766 5.10103V5.10103L18.0901 4.58944ZM19.4106 5.91001L19.9222 5.59651L19.9222 5.59651L19.4106 5.91001ZM5.91001 4.58944L5.59651 4.07786V4.07786L5.91001 4.58944ZM4.58944 5.91001L4.07786 5.59651H4.07786L4.58944 5.91001ZM9.92226 17.7679L10.2239 17.2493L10.2239 17.2493L9.92226 17.7679ZM12.8694 19.5102L13.3857 19.8158L13.8194 19.0831L13.303 18.7775L12.7867 18.4719L12.353 19.2046L12.8694 19.5102ZM10.697 18.7775L10.1807 19.0831L10.6143 19.8158L11.1307 19.5102L11.647 19.2046L11.2133 18.4719L10.697 18.7775ZM12.8694 19.5102L12.353 19.2046C12.1988 19.4651 11.8012 19.4651 11.647 19.2046L11.1307 19.5102L10.6143 19.8158C11.2332 20.8614 12.7668 20.8614 13.3857 19.8158L12.8694 19.5102ZM10.8 4V4.6H13.2V4V3.4H10.8V4ZM20.0001 10.8H19.4001V11.6H20.0001H20.6001V10.8H20.0001ZM4 11.6H4.6V10.8H4H3.4V11.6H4ZM4 11.6H3.4C3.4 12.5237 3.39967 13.2465 3.43945 13.8295C3.47959 14.4179 3.56258 14.9076 3.75015 15.3604L4.30448 15.1308L4.85881 14.9012C4.7419 14.6189 4.67265 14.2751 4.63667 13.7478C4.60033 13.2152 4.6 12.5401 4.6 11.6H4ZM8.63168 17.5932L8.64202 16.9933C7.63766 16.976 7.1114 16.9121 6.69889 16.7412L6.46928 17.2956L6.23967 17.8499C6.88365 18.1166 7.61712 18.1758 8.62135 18.1931L8.63168 17.5932ZM4.30448 15.1308L3.75015 15.3604C4.21703 16.4875 5.11253 17.383 6.23967 17.8499L6.46928 17.2956L6.69889 16.7412C5.86579 16.3962 5.20389 15.7343 4.85881 14.9012L4.30448 15.1308ZM20.0001 11.6H19.4001C19.4001 12.5401 19.3997 13.2152 19.3634 13.7478C19.3274 14.2751 19.2582 14.6189 19.1413 14.9012L19.6956 15.1308L20.2499 15.3604C20.4375 14.9076 20.5205 14.4179 20.5606 13.8295C20.6004 13.2465 20.6001 12.5237 20.6001 11.6H20.0001ZM15.3684 17.5932L15.3787 18.1931C16.3829 18.1758 17.1164 18.1167 17.7604 17.8499L17.5308 17.2956L17.3012 16.7412C16.8887 16.9121 16.3624 16.976 15.358 16.9933L15.3684 17.5932ZM19.6956 15.1308L19.1413 14.9012C18.7962 15.7343 18.1343 16.3962 17.3012 16.7412L17.5308 17.2956L17.7604 17.8499C18.8875 17.383 19.783 16.4875 20.2499 15.3604L19.6956 15.1308ZM13.2 4V4.6C14.521 4.6 15.4696 4.60064 16.2096 4.67099C16.9406 4.74049 17.4057 4.87379 17.7766 5.10103L18.0901 4.58944L18.4036 4.07786C17.8125 3.71565 17.142 3.55423 16.3232 3.47637C15.5133 3.39936 14.4978 3.4 13.2 3.4V4ZM20.0001 10.8H20.6001C20.6001 9.50227 20.6007 8.48681 20.5237 7.6769C20.4458 6.85806 20.2844 6.18757 19.9222 5.59651L19.4106 5.91001L18.899 6.22351C19.1263 6.59434 19.2596 7.05948 19.3291 7.79049C19.3994 8.53042 19.4001 9.47903 19.4001 10.8H20.0001ZM18.0901 4.58944L17.7766 5.10103C18.234 5.38138 18.6187 5.76602 18.899 6.22351L19.4106 5.91001L19.9222 5.59651C19.5429 4.97756 19.0225 4.45715 18.4036 4.07786L18.0901 4.58944ZM10.8 4V3.4C9.50227 3.4 8.48681 3.39936 7.6769 3.47637C6.85806 3.55423 6.18757 3.71565 5.59651 4.07786L5.91001 4.58944L6.22351 5.10103C6.59434 4.87379 7.05948 4.74049 7.79049 4.67099C8.53042 4.60064 9.47903 4.6 10.8 4.6V4ZM4 10.8H4.6C4.6 9.47903 4.60064 8.53042 4.67099 7.79049C4.74049 7.05948 4.87379 6.59434 5.10103 6.22351L4.58944 5.91001L4.07786 5.59651C3.71565 6.18757 3.55423 6.85806 3.47637 7.6769C3.39936 8.48681 3.4 9.50227 3.4 10.8H4ZM5.91001 4.58944L5.59651 4.07786C4.97756 4.45715 4.45715 4.97756 4.07786 5.59651L4.58944 5.91001L5.10103 6.22351C5.38138 5.76602 5.76602 5.38138 6.22351 5.10103L5.91001 4.58944ZM10.697 18.7775L11.2133 18.4719C11.0509 18.1975 10.9083 17.9554 10.7697 17.7651C10.6237 17.5648 10.4562 17.3843 10.2239 17.2493L9.92226 17.7679L9.6206 18.2866C9.65852 18.3086 9.7102 18.3488 9.79991 18.4719C9.897 18.6051 10.0067 18.7892 10.1807 19.0831L10.697 18.7775ZM8.63168 17.5932L8.62135 18.1931C8.97262 18.1992 9.19512 18.2036 9.36473 18.2224C9.52321 18.24 9.58465 18.2657 9.6206 18.2866L9.92226 17.7679L10.2239 17.2493C9.98971 17.1131 9.74599 17.0573 9.4968 17.0297C9.25873 17.0033 8.97102 16.999 8.64202 16.9933L8.63168 17.5932ZM13.303 18.7775L13.8194 19.0831C13.9933 18.7892 14.103 18.6051 14.2001 18.4719C14.2898 18.3488 14.3415 18.3086 14.3794 18.2866L14.0778 17.7679L13.7761 17.2493C13.5439 17.3843 13.3764 17.5648 13.2304 17.7651C13.0917 17.9554 12.9491 18.1975 12.7867 18.4719L13.303 18.7775ZM15.3684 17.5932L15.358 16.9933C15.029 16.999 14.7413 17.0033 14.5032 17.0297C14.254 17.0573 14.0103 17.1131 13.7761 17.2493L14.0778 17.7679L14.3794 18.2866C14.4154 18.2657 14.4768 18.24 14.6353 18.2224C14.8049 18.2036 15.0274 18.1992 15.3787 18.1931L15.3684 17.5932Z" fill="#B50033"/>
<path d="M8.80005 9.6001H15.2001" stroke="#B50033" stroke-width="1.20001" stroke-linecap="round"/>
<path d="M8.80005 12.4001H13.2001" stroke="#B50033" stroke-width="1.20001" stroke-linecap="round"/>
</svg>`

// ─── Icon sizes — footer.component.scss ───────────────────────────────────────
// Every icon sits in a `.footer-icon-size` span: 1.57rem = 25.12px. Two tabs
// deviate from it in Angular's own markup/SCSS (a third, Messages, deviates
// in Angular but is deliberately NOT matched here — see iconSize() below):
//   • Likes  — the span also gets `.small` (1.125rem = 18px) for EVERY language
//              except Malayalam: [class]="['ml'].includes(language) ? '' : 'small'"
//   • Membership — swaps to `.membership-off-size` (15x12) when the discount
//              chip is present, so the chip has room; otherwise `.height100`.
const ICON_DEFAULT = 25
const ICON_SMALL   = 18

// ─── Types ────────────────────────────────────────────────────────────────────
// Tab IDs match Figma bottom nav order exactly:
//   0 = Home  1 = Matches  2 = Likes  4 = Messages  3 = Membership
// (Kept numeric IDs consistent with Angular mapping.) Tab 4 (GENERAL.ICON_5 =
// "Messages") navigates to MessagerListScreen everywhere this switch appears
// (see handleTabPress in each screen) — that screen now hosts both the real
// chat inbox ("All Messages") and the phone-number-views feature ("Phone
// number views") as its own two top-level tabs, per the Message Relaunch
// Figma.

export type FooterTab = 0 | 1 | 2 | 3 | 4

export interface AppFooterProps {
  activeTab: FooterTab

  // ── Notification counts ────────────────────────────────────────────────────
  exploreCount?:  number | undefined   // bubble on Home
  likesCount?:    number | undefined   // bubble on Likes (was activityCount)
  chatCount?:     number | undefined   // kept for future Messages screen

  // ── Membership tab extras ──────────────────────────────────────────────────
  upgradeTag?:        string  | undefined  // e.g. "₹200 OFF" pill above Membership icon
  showMembershipDot?: boolean | undefined  // red dot for expiry warning

  onTabPress: (tab: FooterTab) => void
}

// ─── CDN ──────────────────────────────────────────────────────────────────────

const CDN = CDN_SVG + 'bottom-nav/'

// [inactive, active] icon pairs — Figma bottom nav node 8379:10131
// Tab order: Home · Matches · Likes · Messages · Membership
// Exported so other nav surfaces (e.g. MatchesDesktopNav) reuse the same icon
// set instead of re-listing overlapping CDN paths. Tab 4's pair lives directly
// under assets/images/svg/ (not the bottom-nav/ subfolder the other four use).
export const TAB_ICONS: Record<FooterTab, [string, string]> = {
  0: [CDN + 'home-deactive.svg',       CDN + 'home-active.svg'],
  1: [CDN + 'matches-deactive.svg',    CDN + 'matches-active.svg'],
  2: [CDN + 'like.svg',                CDN + 'like-active.svg'],
  4: [CDN_SVG + 'message-matches.svg', CDN_SVG + 'message-matches_active.svg'],
  3: [CDN + 'membership-deactive.svg', CDN + 'membership-active.svg'],
}

// Angular: footer.component.ts maps these from res['GENERAL'] as ICON_0/1/3/5/6.
// Angular sizes each tab with `ion-tab-button { min-width: 15%; max-width:
// min-content }` (footer.component.scss:33-34). min-content is the width of the
// widest UNBREAKABLE run — i.e. the longest single WORD — so a multi-word label
// puts one word per line ALWAYS, however much room the row has. That is why
// "Liked profiles" is two lines in the real app.
//
// numberOfLines alone cannot reproduce that: RN's flex columns are far wider
// than min-content, so the label fit on one line and the row read as
// mis-aligned against its neighbours. RN has no min-content, so the break is
// made explicit at the call site below — exactly the layout min-content
// produces, and language-agnostic: it breaks on whatever spaces the
// translation itself has, rather than assuming an English break point.
export const TAB_LABEL_KEYS: Record<FooterTab, string> = {
  0: 'GENERAL.ICON_0',
  1: 'GENERAL.ICON_1',
  2: 'GENERAL.ICON_3',
  4: 'GENERAL.ICON_5',
  3: 'GENERAL.ICON_6',
}

// Left → right render order (matches Figma)
const TAB_ORDER: FooterTab[] = [0, 1, 2, 4, 3]

// ─── Sub-component ────────────────────────────────────────────────────────────

// Angular caps every footer count at "9+", not "99+" — common.ts:848/886
// (`count > 9 ? '9+' : count`) for Activity and :835/873/899 for Home. The
// badge is a small circle sized for two glyphs; three digits overflowed it.
function CountBadge({ count }: { count: number }) {
  return (
    <View style={styles.countBadge}>
      <Text style={styles.countText} numberOfLines={1}>
        {count > 9 ? '9+' : String(count)}
      </Text>
    </View>
  )
}

// ─── AppFooter ────────────────────────────────────────────────────────────────
// Matches Figma node 8379:10131 — bottom nav with 5 tabs.
// Tabs: Home · Matches · Likes (with badge) · Messages (with badge) · Membership (with upgrade tag)

export default function AppFooter({
  activeTab,
  exploreCount,
  likesCount,
  chatCount,
  upgradeTag,
  showMembershipDot = false,
  onTabPress,
}: AppFooterProps) {
  const insets = useSafeAreaInsets()
  const { t, i18n } = useTranslation()

  // Angular: footer.component.ts:97-100 — the FOOTER ITSELF loads the discount
  // chip (paymentService.getMenuPromo(0) → MENUDISCOUNT), which is why it shows
  // on every page there. This port had it as a prop only, so the chip appeared
  // on Home/Membership and was hardcoded on Matches, while Activity/Messages
  // showed none at all. Self-loaded here (getMenuPromo caches, so this is not a
  // per-screen network hit); an explicit prop still wins when a caller passes one.
  const [promoTag, setPromoTag] = useState('')
  useEffect(() => {
    if (upgradeTag !== undefined) return
    let cancelled = false
    getMenuPromo()
      .then(promo => { if (!cancelled) setPromoTag(String(promo?.MENUDISCOUNT ?? '')) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [upgradeTag])

  const tag = upgradeTag ?? (promoTag || undefined)
  // Angular gives the Likes icon the `.small` class for every language but Malayalam.
  const likesIconSize = i18n.language === 'ml' ? ICON_DEFAULT : ICON_SMALL

  function iconSize(tab: FooterTab): { width: number; height: number } {
    if (tab === 2) return { width: likesIconSize, height: likesIconSize }
    // Angular sizes the inactive Messages icon at 20x24 (`.message-icon`) —
    // deliberately NOT matched here, on request: it read as noticeably
    // smaller than the other tab icons, so Messages now stays the same
    // 25x25 size as Home/Matches/Membership(no tag) instead.
    if (tab === 3) return tag ? { width: 15, height: 12 } : { width: ICON_DEFAULT, height: ICON_DEFAULT }
    return { width: ICON_DEFAULT, height: ICON_DEFAULT }
  }

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      <View style={styles.tabBar}>
        {TAB_ORDER.map(tab => {
          const isActive = activeTab === tab
          // One word per line — see TAB_LABEL_KEYS' note on Angular's
          // max-width: min-content. Whitespace runs collapse first, so a
          // translation with a stray double space can't yield a blank line.
          const rawLabel = t(TAB_LABEL_KEYS[tab]).trim()
          const label = rawLabel.replace(/\s+/g, '\n')
          const size = iconSize(tab)

          // Count badge per tab (matches Figma: Likes shows 99+)
          let badgeCount: number | undefined
          if (tab === 0 && exploreCount && exploreCount > 0) badgeCount = exploreCount
          if (tab === 2 && likesCount  && likesCount  > 0)  badgeCount = likesCount
          if (tab === 4 && chatCount   && chatCount   > 0)  badgeCount = chatCount

          return (
            <Pressable
              key={tab}
              style={({ pressed }) => [styles.tabBtn, pressed && styles.tabPressed]}
              onPress={() => onTabPress(tab)}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
              // rawLabel, not label: the newline in `label` is a layout device,
              // and a screen reader must not pause mid-phrase on it.
              accessibilityLabel={rawLabel}
            >
              {/* ── Icon area ── */}
              <View style={styles.iconWrap}>
                {/* TEMP: tab 4 previews the re-exported Messages icon pair
                    inline until it's uploaded to the CDN — see the SVG
                    constants above. Delete this branch once that's live. */}
                {tab === 4 ? (
                  <SvgXml
                    xml={isActive ? MESSAGE_ACTIVE_SVG_TEMP : MESSAGE_INACTIVE_SVG_TEMP}
                    width={size.width}
                    height={size.height}
                  />
                ) : (
                  <CdnSvg
                    uri={isActive ? TAB_ICONS[tab][1] : TAB_ICONS[tab][0]}
                    width={size.width}
                    height={size.height}
                  />
                )}

                {/* Count badge (Home / Likes / Messages) */}
                {badgeCount !== undefined && <CountBadge count={badgeCount} />}

                {/* Membership expiry red dot */}
                {tab === 3 && showMembershipDot && (
                  <View style={styles.redDot} />
                )}
              </View>

              {/* ── Upgrade tag (e.g. "₹200 OFF") ──
                  Angular: footer.component.html:57-59 — the .membership-off
                  div is a SIBLING sitting BETWEEN the icon <span> and the
                  <ion-label>, not above the icon. */}
              {tab === 3 && !!tag && (
                <LinearGradient
                  colors={['#33258C', '#751246']}
                  start={{ x: 0, y: 0.5 }}
                  end={{ x: 1, y: 0.5 }}
                  style={styles.upgradeTag}
                >
                  <Text style={styles.upgradeTagText} numberOfLines={1}>{tag}</Text>
                </LinearGradient>
              )}

              {/* ── Label ── */}
              {/* Angular: two-word labels (Liked profiles / Contacted profiles) wrap
                  to 2 lines by design — numberOfLines=2 + centered text matches that. */}
              <Text
                style={[
                  styles.tabLabel,
                  // Angular: every label is `pt-4` except Message, which is `pt-2`.
                  tab === 4 && styles.tabLabelMessage,
                  isActive && styles.tabLabelActive,
                ]}
                numberOfLines={3}
              >
                {label}
              </Text>
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // Figma: drop-shadow 0px -3px 8px rgba(0,0,0,0.08)
  container: {
    backgroundColor: Colors.white,
    shadowColor:     Colors.shadow,
    shadowOffset:    { width: 0, height: -3 },
    shadowOpacity:   0.08,
    shadowRadius:    8,
    elevation:       8,
  },
  // Angular: `ion-tab-bar` is `min-height: 56px` (footer.component.scss:194) with
  // the tab-bar's own `gap-footer pl-2 pr-2` → gap + 2px side padding. It was a
  // FIXED 56px here, which clipped the second line of a wrapped label.
  tabBar: {
    flexDirection:     'row',
    justifyContent:    'space-around',
    alignItems:        'center',
    paddingHorizontal: 2,
    paddingVertical:   4,
    minHeight:         56,
    // Angular: `.gap-footer { gap: 12px }` (footer.component.scss:105-107).
    // This was dropped to 8 to buy each flex:1 column enough width that a
    // two-word label would not sit on one line — which it did anyway. Now that
    // the label breaks per word (see TAB_LABEL_KEYS), column width no longer
    // has to carry that job, so Angular's real value applies.
    gap:               12,
  },
  tabBtn: {
    flex:           1,
    // Angular: `ion-tab-button { min-width: 15% }`.
    minWidth:       '15%',
    alignItems:     'center',
    justifyContent: 'center',
    position:       'relative',
  },
  tabPressed: { opacity: 0.7 },
  iconWrap: {
    position:       'relative',
    alignItems:     'center',
    justifyContent: 'center',
  },
  // Angular: `.font-10-nav pt-4 line-height-12` — font-size var(--font10)
  // (0.625rem, scales with device width — see FontSize's header comment),
  // Poppins-Regular (var(--english-regular-poppins), weight 400), 12px flat
  // line-height (`.line-height-12` is a plain px value, not rem-based), 4px
  // above. Inactive `.footer-text-in-active` = var(--gray-color1) = #1F1E1B
  // (footer.component.scss:1-8; NOT #545454 — that was never the Angular
  // value); active `.footer-text-active` only repeats the same font-size and
  // swaps color to var(--pink) = #B50033 — it does NOT change weight/family,
  // so the active label stays Poppins-Regular too.
  tabLabel: {
    fontFamily: SemanticFontsEnglish.bottomnavEnglishRegular,
    fontSize:   FontSize.font10,
    color:      '#1F1E1B',
    marginTop:  4,
    lineHeight: 12,
    textAlign:  'center',
  },
  // The Message tab's own label is `pt-2`, not `pt-4`.
  tabLabelMessage: { marginTop: 2 },
  tabLabelActive: {
    color: '#B50033',
  },
  // Count badge — "99+" red pill (Figma: Likes tab)
  countBadge: {
    position:          'absolute',
    top:               -5,
    right:             -8,
    backgroundColor:   '#DE2A68',
    borderRadius:      10,
    minWidth:          16,
    height:            16,
    alignItems:        'center',
    justifyContent:    'center',
    paddingHorizontal: 3,
    borderWidth:       1,
    borderColor:       Colors.white,
  },
  // Angular: `ion-badge` classes `font-8 white-color` (footer.component.html:
  // 12/28/38, all three count badges) — font-8 is font-size var(--font8)
  // (0.5rem, scales with device width) + font-family var(--english-regular-
  // poppins) = Poppins-Regular; no semibold class is applied to these badges.
  countText: {
    fontFamily: Fonts.poppinsRegular,
    color:      Colors.white,
    fontSize:   FontSize.font8,
    lineHeight: 12,
  },
  // "₹200 OFF" upgrade pill above Membership icon — gradient: #33258C → #751246
  // Angular: .membership-off (footer.component.scss:152-163) — padding 1px 5px,
  // radius 2, min-width 60, gradient #33258c → #751246. It sits in normal flow
  // between the icon and the label here rather than Angular's absolute
  // top:20px, which measures from the tab button and lands in the same gap.
  upgradeTag: {
    borderRadius:      2,
    paddingVertical:   1,
    paddingHorizontal: 5,
    minWidth:          60,
    alignItems:        'center',
    justifyContent:    'center',
  },
  // Angular: `.membership-off` div classes `font-8 poppins-family white-color`
  // (footer.component.html:57). font-8 sets font-size var(--font8) (scales
  // with device width) and would also set font-family to Poppins-Regular, but
  // `.poppins-family` is declared LATER in global.scss (line 2316 vs font-8's
  // 2303) and both declare font-family with !important, so at equal
  // specificity poppins-family wins: font-family: var(--english-poppins) =
  // Roboto-Regular. Same alias RupeeSymbolFont already documents (it's meant
  // for the ₹ glyph, but the cascade applies it to the whole "₹200 OFF" text).
  upgradeTagText: {
    fontFamily: RupeeSymbolFont,
    color:      Colors.white,
    fontSize:   FontSize.font8,
  },
  // Membership expiry red dot. Angular's actual equivalent (footer.component.
  // html:51-55, .membership-badge-message ion-badge) renders a full icon
  // badge (membership-exclamationmark.svg) at background-color: rgba(222,
  // 42,104,1) = #DE2A68 — the same red as every other notification badge in
  // this file (footer.component.scss numbers-badge-* rules, #de2a68). This
  // was Colors.primary (#C62828, a different brand red with no Angular or
  // Figma source), which didn't match either reference. Simplified dot
  // shape/size kept as-is (Figma node 8379:10131 shows a plain dot here, not
  // the full icon badge) — only the color was wrong.
  redDot: {
    position:        'absolute',
    top:             -3,
    right:           -6,
    width:           8,
    height:          8,
    borderRadius:    4,
    backgroundColor: '#DE2A68',
  },
})
