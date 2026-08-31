import { useCallback, useEffect, useRef, useState } from 'react'
import { useFocusEffect } from '@react-navigation/native'
import { useTranslation } from 'react-i18next'
import {
  Animated,
  Dimensions,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { Image } from 'expo-image'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Colors } from '../../constants/colors'
import { CDN_REACT } from '../../constants/cdn'
import { StorageKeys } from '../../constants/storage.keys'
import { getItem } from '../../service/storageService'
import { getSession, getSessionValue } from '../../service/registrationService'
import { fetchMenuPromo } from '../../service/homeService'
import { paymentTrack, redirectToIntermediatePage } from '../../service/paymentService'
import { checkFreeTrialCondition } from '../../service/payWallService'
import { stripAndDecodeHtml } from '../../utils/htmlEntities'
import { clearSession } from '../../service/apiClient'
import { handleBack } from '../../utils/navigationRef'
import { disconnectSocket } from '../../service/socketService'
import { logEvent, dispatchNativeEvent } from '../../service/analyticsService'
import CdnSvg from '../../components/cdn-svg/CdnSvg'
import { getOwnGenderAvatarUrl } from '../../utils/avatar'
import ButtonRevamp from '../../components/button-revamp/ButtonRevamp'
import LanguagePillSheet from '../../components/language-pill/LanguagePillSheet'

// ─── CDN ──────────────────────────────────────────────────────────────────────

const R = CDN_REACT + '/'
const SCREEN_H = Dimensions.get('window').height

// Angular: external-page.page.ts's hardcoded urlObjs = {1: privacy, 2: terms}.
const PRIVACY_POLICY_URL   = 'https://www.jodii.com/privacy-policy.html'
const TERMS_CONDITIONS_URL = 'https://www.jodii.com/terms.html'

export const ICON = {
  back:          R + 'menu_back_arrow.svg',
  verified:      R + 'menu_verified.svg',
  paidTag:       R + 'menu_paid_tag.svg',
  edit:          R + 'menu_edit_icon.svg',
  biodata:       R + 'menu_info_paper.svg',
  wedding:       R + 'menu_wedding_rings.svg',
  searchId:      R + 'menu_file_info.svg',
  support:       R + 'menu_support.svg',
  dontShow:      R + 'menu_profile_close.svg',
  arrow:         R + 'menu_right_arrow.svg',
  camera:        R + 'menu_camera.svg',
  language:      R + 'setting_language_selection.svg',
  deleteAccount: R + 'settings_delete_account.svg',
  privacy:       R + 'settings_privacy_ploicy.svg',
  terms:         R + 'settings_terms_condition.svg',
  logout:        R + 'settings_logout.svg',
  logoutSheet:   R + 'bottomsheet_logout.svg',
  // Expired-membership banner glyph. Hyphenated, unlike the underscore names
  // above — that's how it is on the server (react/expired-alert.svg, 44x44).
  expiredAlert:  R + 'expired-alert.svg',
}

// Angular: menu.page.html's buy-membership banner binds CONTENT1 with
// [innerHTML]. It arrives as a one-line HTML string with a single <br> between
// the headline and its sub-line — e.g. "Flat &#8377;300 OFF<br>on Jodii
// membership". RN <Text> can't parse markup, so split on the <br> and decode
// each half. `sub` is '' when the server sends no <br>.
function splitPromoLines(html: string): [string, string] {
  const [head = '', ...rest] = html.split(/<br\s*\/?>/i)
  return [stripAndDecodeHtml(head), stripAndDecodeHtml(rest.join(' '))]
}

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = { navigation: any }

// ─── Logout side effects ─────────────────────────────────────────────────────
// Extracted so other entry points (e.g. HomeSidebar's desktop logout row) can
// fire the exact same sequence without duplicating it — only the confirm-sheet
// UI around it (LogoutSheet, also exported below) differs per caller.

export async function performLogout(): Promise<void> {
  // 1. Emit socket Logout event and disconnect
  disconnectSocket()
  // 2. Fire analytics events (matches Angular's pushfirebaseEvents + triggerAppNativeEvent)
  logEvent({ category: 'ManageAccount', action: 'Logout', label: 'Submitted' })
  dispatchNativeEvent({ event_name: 'logout' })
  // 3. Clear session storage and flip navigation to AuthStack
  await clearSession()
}

// ─── MenuRow ──────────────────────────────────────────────────────────────────

interface RowProps {
  icon: string
  iconSize?: number
  title: string
  onPress: () => void
  showDivider?: boolean
}

function MenuRow({ icon, iconSize = 24, title, onPress, showDivider }: RowProps) {
  return (
    <>
      <Pressable
        style={({ pressed }) => [s.row, pressed && s.rowPressed]}
        onPress={onPress}
        accessibilityRole="button"
      >
        <View style={s.rowIconWrap}>
          <CdnSvg uri={icon} width={iconSize} height={iconSize} />
        </View>
        <Text style={s.rowTitle}>{title}</Text>
        <CdnSvg uri={ICON.arrow} width={16} height={16} />
      </Pressable>
      {showDivider && <View style={s.rowDivider} />}
    </>
  )
}

// ─── LogoutSheet ──────────────────────────────────────────────────────────────
// Ported from the old SettingsScreen — same confirm-before-logout bottom sheet.

export function LogoutSheet({ visible, onYes, onNo }: { visible: boolean; onYes: () => void; onNo: () => void }) {
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()
  const [modalVisible, setModalVisible] = useState(visible)
  const slideAnim = useRef(new Animated.Value(SCREEN_H)).current
  const scrimAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (visible) {
      setModalVisible(true)
      Animated.parallel([
        Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 55, friction: 11 }),
        Animated.timing(scrimAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start()
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: SCREEN_H, duration: 220, useNativeDriver: true }),
        Animated.timing(scrimAnim, { toValue: 0, duration: 180, useNativeDriver: true }),
      ]).start(({ finished }) => { if (finished) setModalVisible(false) })
    }
  }, [visible, slideAnim, scrimAnim])

  return (
    <Modal visible={modalVisible} transparent animationType="none" onRequestClose={onNo} statusBarTranslucent>
      {/* Scrim */}
      <Animated.View
        style={[StyleSheet.absoluteFill, {
          backgroundColor: Colors.black,
          opacity: scrimAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.5] }),
        }]}
        pointerEvents="none"
      />
      <Pressable style={StyleSheet.absoluteFill} onPress={onNo} />

      {/* Sheet */}
      <Animated.View style={[ls.sheet, { paddingBottom: insets.bottom + 20 }, { transform: [{ translateY: slideAnim }] }]}>
        {/* Icon */}
        <View style={ls.iconWrap}>
          <CdnSvg uri={ICON.logoutSheet} width={48} height={48} />
        </View>

        {/* Title — left aligned */}
        <Text style={ls.title}>{t('ACCOUNT.LOGOUT')}</Text>

        {/* Message */}
        <Text style={ls.message}>{t('ACCOUNT.LOGOUT_MSG_2')}</Text>

        {/* Side-by-side: Yes (secondary) | No (primary) */}
        <View style={ls.btnRow}>
          <ButtonRevamp
            label={t('ACCOUNT.YES')}
            variant="secondary"
            style={{ flex: 1 }}
            onPress={onYes}
          />
          <ButtonRevamp
            label={t('ACCOUNT.NO')}
            variant="primary"
            style={{ flex: 1 }}
            onPress={onNo}
          />
        </View>
      </Animated.View>
    </Modal>
  )
}

// ─── MenuScreen ───────────────────────────────────────────────────────────────

export default function MenuScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets()
  const { t } = useTranslation()

  // Angular: Menu's own languageChange() opens LanguageSelectionComponent as a
  // real modal overlay (ModalController), not a page push — React Navigation's
  // presentation:'modal' (still used by the LanguageSelection route for
  // onboarding) is a full-screen page with a different transition, not a true
  // popup. This local sheet replaces the navigate() call below for Menu only.
  const [showLanguageSheet, setShowLanguageSheet] = useState(false)

  const [userName,      setUserName]      = useState('')
  const [userId,        setUserId]        = useState('')
  const [photoUrl,      setPhotoUrl]      = useState('')
  // No photo (or a photo whose URL fails to load) falls back to the member's
  // OWN-gender silhouette — the same getOwnGenderAvatarUrl() placeholder the
  // edit-profile photo grid uses, so the two screens agree. This replaced a
  // single genderless menu_avatar.svg.
  const [genderAvatarUrl, setGenderAvatarUrl] = useState('')
  const [photoFailed,     setPhotoFailed]     = useState(false)
  const [entryType,     setEntryType]     = useState('')
  const [isVerified,    setIsVerified]    = useState(false)
  const [membershipExp, setMembershipExp] = useState('')
  const [appVersion,    setAppVersion]    = useState('')
  const [logoutSheetVisible, setLogoutSheetVisible] = useState(false)
  // Angular's PROMO_CONT — payment/nbmenu/v1's RESPONSE, carrying CONTENT1
  // (the offer copy), CTA_TXT (button label), PAYMENTID, and a HOMEPAGE object
  // whose MENUTITLE/CTA drive the expired variant of the banner.
  const [promo, setPromo] = useState<Record<string, any> | null>(null)
  // Angular: payWallService.checkFreeTrialCondition('expired') — decides which
  // of the two banner variants renders. Async here (storage reads), so it lands
  // in state rather than being called inline from render.
  const [promoExpired, setPromoExpired] = useState(false)

  // On FOCUS, not just mount. Menu stays mounted in the tab stack, so a photo
  // uploaded from Edit Profile never reached it — the mount-only read meant the
  // avatar placeholder persisted until the app was restarted. HomeScreen
  // already refetches on focus (useFocusEffect -> loadHome) for this reason.
  const loadProfileSummary = useCallback(() => {
    let cancelled = false
    Promise.all([
      getSession(),
      getItem(StorageKeys.Auth.USER_ID),
      getItem(StorageKeys.User.PHOTO_URL),
      getItem(StorageKeys.App.APP_VERSION),
      getItem(StorageKeys.Verification.EKYC_STATUS),
    ]).then(([session, id, photo, ver, ekyc]) => {
      if (cancelled) return
      setUserName(String(session['NAME'] ?? ''))
      setUserId(id ?? '')
      setPhotoUrl(photo ?? '')
      // A newly arrived photo clears any earlier load failure, otherwise the
      // placeholder would stick for the life of the mount.
      setPhotoFailed(false)
      const et = String(session['ENTRYTYPE'] ?? '')
      setEntryType(et)

      // Angular: gethttpArrayValue() only calls getMenuPromo(0) when
      // ENTRYTYPE == 'F' — paid members never fetch it. Same gate here, so a
      // paid member costs no extra request.
      if (et === 'F') {
        fetchMenuPromo().then(p => { if (!cancelled) setPromo(p ?? null) })
        checkFreeTrialCondition('expired').then(exp => { if (!cancelled) setPromoExpired(exp) })
      } else {
        setPromo(null)
        setPromoExpired(false)
      }
      setMembershipExp(String(session['PLANEXPIRY'] ?? session['VALIDTILL'] ?? ''))
      setAppVersion(ver ?? '')
      setIsVerified(ekyc === '1')
    })
    return () => { cancelled = true }
  }, [])

  useFocusEffect(loadProfileSummary)

  useEffect(() => {
    getOwnGenderAvatarUrl().then(setGenderAvatarUrl)
  }, [])

  const isPaid = entryType !== '' && !['B', 'F'].includes(entryType)

  // Angular: menu.page.ts redirectToBioData() → /download-biodata — a
  // dedicated screen (BiodataScreen.tsx), not ViewProfileScreen's own-profile
  // mode.
  function handleDownloadBiodata() {
    navigation.navigate('Biodata')
  }

  // Angular menu.page.html has TWO mutually-exclusive variants of this banner,
  // both requiring `PROMO_CONT && ENTRYTYPE === 'F'` and split on
  // payWallService.checkFreeTrialCondition('expired'):
  //
  //   !expired → CONTENT1            + CTA_TXT          (offer band)
  //    expired → HOMEPAGE.MENUTITLE  + HOMEPAGE.CTA     (expired band)
  //
  // Heads up: in the current Angular build the expired variant is UNREACHABLE —
  // checkFreeTrialCondition() has its body commented out (JODII-345) and
  // unconditionally returns false. The condition is implemented for real here
  // (see checkFreeTrialCondition in payWallService), ported from that
  // commented-out body, which is also still live and uncommented in
  // explore.component.ts's own copy of the method.
  const showPromo = !!promo && entryType === 'F'

  // Angular renders both variants' copy with [innerHTML]; RN <Text> can't parse
  // markup, so the <br> is split here and each half decoded (₹ arrives as
  // &#8377;). The expired variant reads its copy from PROMO_CONT.HOMEPAGE.
  const promoHome = (promo?.['HOMEPAGE'] ?? {}) as Record<string, any>

  const [promoHeadline, promoSub] = splitPromoLines(
    String(promoExpired ? (promoHome['MENUTITLE'] ?? '') : (promo?.['CONTENT1'] ?? '')),
  )
  const promoCta = stripAndDecodeHtml(
    String(promoExpired ? (promoHome['CTA'] ?? '') : (promo?.['CTA_TXT'] ?? '')),
  )

  // Angular goToPayment(): paymentTrack('98') → redirectToIntermediatePage(
  //   router.url, PROMO_CONT.PAYMENTID, S&FPROMOTION ?? '7') → GA beacons.
  const handleBuyMembership = useCallback(async () => {
    await paymentTrack('98')
    const paymentId = String(promo?.['PAYMENTID'] ?? '')
    const promotion = String((await getSessionValue(StorageKeys.Promotions.SF_PROMOTION)) ?? '7')
    await redirectToIntermediatePage('menu', paymentId, promotion)
    // Angular: pushfirebaseEvents('Menu', 'Banner-Clicked', 'PaymentBannerPromo')
    // — signature is (action, label, category).
    logEvent({ category: 'PaymentBannerPromo', action: 'Menu', label: 'Banner-Clicked' })
  }, [promo])

  const handleLogout = useCallback(() => {
    setLogoutSheetVisible(true)
  }, [])

  const handleConfirmLogout = useCallback(async () => {
    setLogoutSheetVisible(false)
    await performLogout()
  }, [])

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <View style={[s.screen, { paddingTop: insets.top }]}>

      {/* ── Header back button ── */}
      <Pressable
        style={[s.backBtn, { marginTop: 8 }]}
        onPress={() => handleBack()}
        accessibilityRole="button"
        accessibilityLabel="Back"
      >
        <CdnSvg uri={ICON.back} width={24} height={24} />
      </Pressable>

      <ScrollView
        style={s.flex1}
        contentContainerStyle={[s.scrollContent, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >

        {/* ── Card 1: Profile ── */}
        <View style={s.card}>
          <View style={s.profileRow}>
            {/* Avatar with camera badge */}
            <View style={s.avatarContainer}>
              <View style={s.avatarWrap}>
                {photoUrl && !photoFailed ? (
                  <Image
                    source={{ uri: photoUrl }}
                    style={s.avatar}
                    contentFit="cover"
                    onError={() => setPhotoFailed(true)}
                  />
                ) : (
                  // Waits for genderAvatarUrl rather than rendering a
                  // half-second wrong-gender guess — the circle just stays
                  // empty for the one tick it takes to read login gender.
                  !!genderAvatarUrl && <CdnSvg uri={genderAvatarUrl} width={70} height={70} />
                )}
              </View>
              <View style={s.cameraBadge}>
                <CdnSvg uri={ICON.camera} width={13} height={13} />
              </View>
            </View>

            {/* Info */}
            <View style={s.profileInfo}>
              {/* Name + verified badge */}
              <View style={s.nameRow}>
                <Text style={s.profileName} numberOfLines={1}>{userName || '—'}</Text>
                {isVerified && (
                  <View style={{ marginLeft: 6 }}>
                    <CdnSvg uri={ICON.verified} width={16} height={16} />
                  </View>
                )}
              </View>

              {/* ID */}
              <Text style={s.profileId}>{t('MENU.ID')} {userId}</Text>

              {/* Paid tag */}
              {isPaid && (
                <View style={s.paidTagRow}>
                  <CdnSvg uri={ICON.paidTag} width={125} height={24} />
                </View>
              )}

              {/* Membership expiry */}
              {isPaid && !!membershipExp && (
                <Text style={s.expiryText}>{t('MENU.MEMBERSHIP_TILL')} {membershipExp}</Text>
              )}
            </View>
          </View>

          {/* ── Buy-membership promo band (free members only) ──
              Sits INSIDE the profile card as its bottom section, so the two
              share one rounded outline (card has overflow:'hidden', which clips
              this band's corners to the card radius).

              Content is server-driven: CONTENT1 arrives as
              "Flat ₹300 OFF<br>on Jodii membership" — headline before the <br>,
              sub-line after. splitPromoLines() does that split, so nothing here
              is hardcoded copy. */}
          {showPromo && (promoExpired ? (
            // EXPIRED variant: pink ground, alert glyph left of the copy, and a
            // text-link CTA on its own line rather than a filled button.
            <Pressable
              style={s.promoBandExpired}
              onPress={handleBuyMembership}
              accessibilityRole="button"
            >
              <View style={s.promoExpiredRow}>
                <CdnSvg uri={ICON.expiredAlert} width={28} height={28} />
                <View style={s.promoTextCol}>
                  <Text style={s.promoHeadline}>{promoHeadline}</Text>
                  {!!promoSub && <Text style={s.promoSub}>{promoSub}</Text>}
                </View>
              </View>

              {!!promoCta && (
                <View style={s.promoLinkRow}>
                  <Text style={s.promoLink}>{promoCta}</Text>
                  {/* Chevron drawn as a glyph, not the CDN arrow icon — it has
                      to inherit the link's pink, and CdnSvg can't recolor. */}
                  <Text style={s.promoLinkChevron}>{'›'}</Text>
                </View>
              )}
            </Pressable>
          ) : (
            // OFFER variant: green ground, copy left, filled pill right.
            <Pressable
              style={s.promoBand}
              onPress={handleBuyMembership}
              accessibilityRole="button"
            >
              <View style={s.promoTextCol}>
                <Text style={s.promoHeadline}>{promoHeadline}</Text>
                {!!promoSub && <Text style={s.promoSub}>{promoSub}</Text>}
              </View>

              {!!promoCta && (
                <View style={s.promoBtn}>
                  <Text style={s.promoBtnText}>{promoCta}</Text>
                </View>
              )}
            </Pressable>
          ))}
        </View>

        {/* ── Card 2: Edit Profile + Search by ID ── */}
        <View style={s.card}>
          <MenuRow
            icon={ICON.edit}
            title={t('MENU.SUBMENU_1_1')}
            onPress={() => navigation.navigate('EditProfile')}
            showDivider
          />
          <MenuRow
            icon={ICON.searchId}
            title={t('SEARCH.SEARCH_BY_ID')}
            onPress={() => navigation.navigate('SearchById')}
          />
        </View>

        {/* ── Card 3: Download Biodata ── */}
        <View style={s.card}>
          <MenuRow
            icon={ICON.biodata}
            title={t('BIO_DATA.DOWNLOAD_BIODATA')}
            onPress={handleDownloadBiodata}
          />
        </View>

        {/* ── Card 4: Main menu ── */}
        <View style={s.card}>
          <MenuRow
            icon={ICON.wedding}
            title={t('MENU.WEDDING_STORY')}
            onPress={() => navigation.navigate('SuccessStories')}
            showDivider
          />
          <MenuRow
            icon={ICON.dontShow}
            title={t('PROFILES.DONT_SHOW')}
            onPress={() => navigation.navigate('IgnoredProfiles')}
            showDivider
          />
          <MenuRow
            icon={ICON.support}
            title={t('GENERAL.NEED_HELP')}
            onPress={() => navigation.navigate('HelpCenter')}
          />
        </View>

        {/* ── Card 5: Settings (merged from the old SettingsScreen) ── */}
        <View style={s.card}>
          <MenuRow
            icon={ICON.language}
            title={t('MENU.TTTLE_6')}
            onPress={() => setShowLanguageSheet(true)}
            showDivider
          />
          <MenuRow
            icon={ICON.deleteAccount}
            title={t('ACCOUNT.DEL_PRO')}
            onPress={() => navigation.navigate('DeleteProfile')}
            showDivider
          />
          <MenuRow
            icon={ICON.privacy}
            iconSize={18}
            title={t('ACCOUNT.PRIVACY_POLICY')}
            onPress={() => navigation.navigate('ExternalPage', { url: PRIVACY_POLICY_URL, title: t('ACCOUNT.PRIVACY_POLICY') })}
            showDivider
          />
          <MenuRow
            icon={ICON.terms}
            iconSize={18}
            title={t('REGISTRATION.TERMSANDCONDITIONS')}
            onPress={() => navigation.navigate('ExternalPage', { url: TERMS_CONDITIONS_URL, title: t('REGISTRATION.TERMSANDCONDITIONS') })}
            showDivider
          />
          <MenuRow
            icon={ICON.logout}
            title={t('ACCOUNT.LOGOUT')}
            onPress={handleLogout}
          />
        </View>

        {/* ── Footer ── */}
        {!!appVersion && (
          <Text style={s.footerVersion}>{t('MENU.APPVERSION')} {appVersion}</Text>
        )}

      </ScrollView>

      <LogoutSheet
        visible={logoutSheetVisible}
        onYes={handleConfirmLogout}
        onNo={() => setLogoutSheetVisible(false)}
      />

      <LanguagePillSheet
        visible={showLanguageSheet}
        onClose={() => setShowLanguageSheet(false)}
        allLanguages
      />
    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  screen: {
    flex:            1,
    backgroundColor: '#F1F3FB',
  },
  flex1: { flex: 1 },

  // ── Back button ──
  backBtn: {
    width:          44,
    height:         44,
    alignItems:     'center',
    justifyContent: 'center',
    marginLeft:     16,
  },

  // ── Scroll ──
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop:        16,
    gap:               12,
  },

  // ── Card shell ──
  card: {
    backgroundColor: Colors.white,
    borderRadius:    12,
    overflow:        'hidden',
  },

  // ── Buy-membership promo band ──
  // Bottom section of the profile card: pale-green ground, copy left, solid
  // green pill right. No radius of its own — the parent card clips it.
  promoBand: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    gap:               12,
    paddingVertical:   14,
    paddingHorizontal: 16,
    backgroundColor:   '#EAF7E7',
  },
  // Expired variant: same band slot, pink ground, stacked (icon+copy row, then
  // the link row) rather than side-by-side.
  promoBandExpired: {
    paddingVertical:   14,
    paddingHorizontal: 16,
    backgroundColor:   '#FDECEF',
  },
  promoExpiredRow: {
    flexDirection: 'row',
    alignItems:    'flex-start',
    gap:           10,
  },
  promoLinkRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           4,
    marginTop:     10,
  },
  promoLink: {
    fontSize:   14,
    lineHeight: 18,
    fontWeight: '600',
    color:      Colors.inputError,
  },
  promoLinkChevron: {
    fontSize:   18,
    lineHeight: 18,
    fontWeight: '600',
    color:      Colors.inputError,
  },
  promoTextCol: {
    flexShrink: 1,
  },
  promoHeadline: {
    fontSize:   17,
    lineHeight: 22,
    fontWeight: '700',
    color:      '#1A1A1A',
  },
  promoSub: {
    marginTop:  2,
    fontSize:   13,
    lineHeight: 18,
    color:      '#4A4A4A',
  },
  // Pill, not the 8pt rounded rect — radius is half the ~44pt tap height.
  promoBtn: {
    flexShrink:        0,
    backgroundColor:   '#1D8A34',
    borderRadius:      22,
    paddingVertical:   11,
    paddingHorizontal: 24,
  },
  promoBtnText: {
    fontSize:   14,
    lineHeight: 18,
    fontWeight: '600',
    color:      Colors.white,
  },

  // ── Profile card internals ──
  profileRow: {
    flexDirection: 'row',
    alignItems:    'center',
    padding:       16,
    gap:           12,
  },
  avatarContainer: {
    width:     70,
    height:    70,
    flexShrink: 0,
  },
  avatarWrap: {
    width:        70,
    height:       70,
    borderRadius: 35,
    overflow:     'hidden',
  },
  avatar: {
    width:        70,
    height:       70,
    borderRadius: 35,
  },
  cameraBadge: {
    position:        'absolute',
    bottom:          0,
    right:           0,
    width:           24,
    height:          24,
    borderRadius:    12,
    backgroundColor: Colors.white,
    borderWidth:     1.5,
    borderColor:     'rgba(204,204,204,0.5)',
    alignItems:      'center',
    justifyContent:  'center',
  },
  profileInfo: { flex: 1 },
  nameRow: {
    flexDirection: 'row',
    alignItems:    'center',
    marginBottom:  2,
  },
  profileName: {
    fontSize:   16,
    fontWeight: '700',
    color:      Colors.textPrimary,
    flexShrink: 1,
  },
  profileId: {
    fontSize:     14,
    color:        '#372F3A',
    marginBottom: 6,
  },
  paidTagRow:  { marginBottom: 4 },
  expiryText: {
    fontSize: 12,
    color:    '#888686',
    marginTop: 4,
  },

  // ── Menu rows ──
  row: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: 12,
    paddingVertical:   20,
    gap:               12,
  },
  rowPressed: { opacity: 0.6 },
  rowIconWrap: {
    width:          24,
    alignItems:     'center',
    justifyContent: 'center',
    flexShrink:     0,
  },
  rowTitle: {
    flex:       1,
    fontSize:   14,
    fontWeight: '500',
    color:      Colors.textPrimary,
  },
  rowDivider: {
    height:           StyleSheet.hairlineWidth,
    backgroundColor:  'rgba(204,204,204,0.5)',
    marginHorizontal: 12,
  },

  // ── Footer ──
  footerVersion: {
    fontSize:  12,
    color:     'rgba(0,0,0,0.5)',
    marginTop: 4,
  },
})

// ─── LogoutSheet styles ───────────────────────────────────────────────────────

const ls = StyleSheet.create({
  sheet: {
    position:             'absolute',
    bottom:               0,
    left:                 0,
    right:                0,
    backgroundColor:      Colors.white,
    borderTopLeftRadius:  20,
    borderTopRightRadius: 20,
    paddingHorizontal:    24,
    paddingTop:           28,
    shadowColor:          '#000',
    shadowOpacity:        0.15,
    shadowRadius:         16,
    shadowOffset:         { width: 0, height: -4 },
    elevation:            16,
  },
  iconWrap: {
    alignItems:    'flex-start',
    marginBottom:  16,
  },
  title: {
    fontSize:     18,
    fontWeight:   '700',
    color:        Colors.textPrimary,
    marginBottom: 10,
  },
  message: {
    fontSize:     14,
    color:        Colors.textMedium,
    lineHeight:   22,
    marginBottom: 24,
  },
  btnRow: {
    flexDirection: 'row',
    gap:           12,
  },
})
