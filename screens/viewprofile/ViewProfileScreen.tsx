// ViewProfile screen — Angular: pages/viewprofile/viewprofile.page.ts/.html.
// Phase 1 (core profile view): photo, badges, name/ID, Like/ViewLater/DontShow or
// after-like CTA row, Call/WhatsApp, and all detail sections (display-only for
// horoscope — no request/upload actions yet). Deferred to later passes: pinch-zoom
// photo gestures, prev/next profile swipe + cache, Daily-Recommendation mode,
// horoscope request/upload, similar-profiles carousel, report-profile popover,
// self-preview/edit-profile mode, and GAM ads (no RN equivalent, dropped for good).
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ActivityIndicator, Alert, Dimensions, Linking,
  NativeScrollEvent, NativeSyntheticEvent,
  Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import CdnSvg from '../../components/cdn-svg/CdnSvg'
import { LANG_LABELS } from '../../components/matches-header/MatchesHeader'
import {
  WhatsAppIcon, WhatsAppUnlockButton, CallIcon, CloseIcon, ViewLaterIcon, LikeIcon,
  showLikeCTA, showAfterLikeCTA, disableDontShow, disableViewLater, HtmlText,
  getBlurPhotoUri, NEWLY_JOINED_STAR_URI, ProfileBadge, PhotoSwiper,
  getAfterLikeCtaLabel, getAfterLikeCtaIcon, getAfterLikeContentText, showContactsLeftBanner, showFreeBadge,
  type AfterLikeCtx,
} from '../../components/matches/matchesCard.shared'
import WhatsAppPaywallModal from '../../components/matches/WhatsAppPaywallModal'
import StickyBanner from '../../components/sticky-banner/StickyBanner'
import { getViewProfile, markProfileViewed, _debugLastViewProfileResult } from '../../service/viewProfileService'
import { viewProfileAdapter } from '../../adapters/viewProfile.adapter'
import { communicationBtnOnClick, reportAndBlockProfile } from '../../service/communicationService'
import { getHeroBannerDetails } from '../../service/paymentService'
import { getItem, getJson } from '../../service/storageService'
import { getSessionValue } from '../../service/registrationService'
import { StorageKeys } from '../../constants/storage.keys'
import { Colors } from '../../constants/colors'
import { CDN_SVG } from '../../constants/cdn'
import i18n from '../../i18n'
import type { ViewProfileModel } from '../../types/interfaces/viewProfile.interface'

// Angular: viewprofile.page.html — one <img> per detail row, under assets/images/svg/
// (most under a viewprofile/ subfolder, two — children/physical-status — are not).
const ICON = {
  createdFor:     CDN_SVG + 'viewprofile/profile-created-icon.svg',
  age:            CDN_SVG + 'viewprofile/age-icon.svg',
  height:         CDN_SVG + 'viewprofile/height-icon.svg',
  maritalStatus:  CDN_SVG + 'viewprofile/marital-status-icon.svg',
  children:       CDN_SVG + 'revamp-child.svg',
  physicalStatus: CDN_SVG + 'physical-status.svg',
  motherTongue:   CDN_SVG + 'viewprofile/language-icon.svg',
  location:       CDN_SVG + 'viewprofile/hometown-vp.svg',
  education:      CDN_SVG + 'viewprofile/education-icon.svg',
  occupation:     CDN_SVG + 'viewprofile/occupation-icon.svg',
  salary:         CDN_SVG + 'viewprofile/salary-icon.svg',
  caste:          CDN_SVG + 'viewprofile/caste-icon.svg',
  raasi:          CDN_SVG + 'viewprofile/raasi-icon.svg',
  star:           CDN_SVG + 'viewprofile/star-icon.svg',
  dosham:         CDN_SVG + 'viewprofile/dosham-icon.svg',
  drinking:       CDN_SVG + 'viewprofile/drinking-habit-icon.svg',
  smoking:        CDN_SVG + 'viewprofile/smoking-habit-icon.svg',
  eating:         CDN_SVG + 'viewprofile/eating-habit-icon.svg',
  brother:        CDN_SVG + 'viewprofile/brother-icon.svg',
  sister:         CDN_SVG + 'viewprofile/sister-icon.svg',
  property:       CDN_SVG + 'viewprofile/property-details-icon.svg',
  vehicle:        CDN_SVG + 'viewprofile/vehicle-details-icon.svg',
  horoscope:      CDN_SVG + 'viewprofile/horoscope-icon.svg',
}

// Angular: viewprofile.page.html's photo swiper is sized to scrWidth (viewport
// width) with NO explicit height override — i.e. a flat, full-bleed SQUARE photo,
// not the rounded/cropped rectangle Matches cards use.
const SCREEN_WIDTH = Dimensions.get('window').width
const PHOTO_HEIGHT = SCREEN_WIDTH

// ─── Gendered placeholder substitution ─────────────────────────────────────────
// Angular's real content carries BOTH single-# (#HESHE#/#HISHER#/#HIMHER#) and
// double-# (##HE_SHE##/##HIS_HER##/##HIM_HER##, plus a lowercase ##he_she## quirk
// on one specific string) token conventions across VIEWPROFILE.* strings — same
// underlying pronoun slots, just spelled differently by string. Substituted via
// the existing PRONOUN.{M|F}.* keys (established pattern from Matches).
function withPronouns(raw: string, oppGender: 'M' | 'F', t: (key: string) => string): string {
  const heshe   = t(`PRONOUN.${oppGender}.heshe`)
  const hisher  = t(`PRONOUN.${oppGender}.hisher`)
  const himhers = t(`PRONOUN.${oppGender}.himhers`)
  return raw
    .replace(/##HE_SHE##/g, heshe).replace(/##HIS_HER##/g, hisher).replace(/##HIM_HER##/g, himhers)
    .replace(/##he_she##/g, heshe.toLowerCase())
    .replace(/#HESHE#/g, heshe).replace(/#HISHER#/g, hisher).replace(/#HIMHER#/g, himhers)
}

// Angular: none/1/many/"more than 5" text variants for brothers/sisters counts.
function familyCountText(
  count: string | undefined,
  t: (key: string) => string,
  keys: { none: string; one: string; many: string; moreThan: string },
): string {
  const n = Number(count)
  if (!count || Number.isNaN(n) || n <= 0) return t(keys.none)
  if (n > 5) return t(keys.moreThan)
  if (n === 1) return `1 ${t(keys.one)}`
  return `${n} ${t(keys.many)}`
}

// ─── Small presentational helpers ──────────────────────────────────────────────

function SectionHeader({ title }: { title: string }) {
  return <Text style={s.sectionHeader}>{title}</Text>
}

// Angular: each row is icon + (label directly ABOVE value, not side-by-side), with
// a border-bottom on every row except the last one in its section
// (viewprofile.page.html — border-bottom-global omitted on each section's final row).
function DetailRow({
  icon, label, value, isLast,
}: { icon: string; label: string; value?: string | undefined; isLast?: boolean }) {
  if (!value) return null
  return (
    <View style={[s.detailRow, !isLast && s.detailRowBorder]}>
      <View style={s.detailIconCol}>
        <CdnSvg uri={icon} width={20} height={20} />
      </View>
      <View style={s.detailTextCol}>
        <Text style={s.detailLabel}>{label}</Text>
        {/* Angular binds several of these via [innerHTML] (e.g. HEIGHTCATEGORY carries
            a literal <span class="height-revamp-text-small">...</span>) — a plain Text
            would show the raw tag text; HtmlText strips/renders it properly. */}
        <HtmlText html={value} style={s.detailValue} />
      </View>
    </View>
  )
}

// ─── Screen ─────────────────────────────────────────────────────────────────────

export default function ViewProfileScreen({ navigation, route }: { navigation: any; route: any }) {
  const { t } = useTranslation()
  const matriId  = route?.params?.matriId ?? ''
  const fromPage = route?.params?.fromPage ?? 'matches'

  const [profile, setProfile] = useState<ViewProfileModel | null>(null)
  const [loading, setLoading] = useState(true)
  const [loginGender, setLoginGender] = useState<'M' | 'F'>('F')
  const [ownEntryType, setOwnEntryType] = useState('')
  const [femaleFreeEligible, setFemaleFreeEligible] = useState(false)
  const [indNumbersLeft, setIndNumbersLeft] = useState('0')
  const [whatsappPaywallOpen, setWhatsappPaywallOpen] = useState(false)
  const [paymentStickyInfo, setPaymentStickyInfo] = useState<{ content: string; ctaLabel: string; deadlineMs: number } | null>(null)
  const [stickyDismissed, setStickyDismissed] = useState(false)
  // Angular: the header transforms once the photo scrolls out of view — plain
  // floating back+language pill over the photo becomes a solid white bar with
  // Name/Call/language/3-dot-menu (confirmed live against the real app, not the
  // dead CSS classes an earlier code-only pass had wrongly ruled out).
  const [scrolled, setScrolled] = useState(false)
  const [showMenu, setShowMenu] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      const [lg, entryType, femaleFreeRaw, contactDetail] = await Promise.all([
        getItem(StorageKeys.User.LOGIN_GENDER),
        getSessionValue('ENTRYTYPE'),
        getSessionValue('FEMALEFREECONACT'),
        getJson<Record<string, any>>('CONTACT_DETAIL'),
      ])
      if (cancelled) return
      const gender = lg === 'M' ? 'M' : 'F'
      setLoginGender(gender)
      setOwnEntryType(entryType ?? '')
      const femaleFree: any = femaleFreeRaw
      setFemaleFreeEligible(String(femaleFree?.FLAG) === '1' && gender === 'F' && String(femaleFree?.Left ?? '0') !== '0')
      setIndNumbersLeft(String(contactDetail?.IndNumbersLeft ?? '0'))

      const raw = await getViewProfile(matriId)
      if (cancelled) return
      if (raw) {
        const adapted = viewProfileAdapter.adapt(raw)
        setProfile(adapted)
        // Angular: assignProfileDtl() skips viewedtrack for same-gender/own-profile views.
        if (adapted.gender !== gender && adapted.profileId !== '') {
          markProfileViewed(matriId).catch(() => {})
        }
      }
      setLoading(false)

      // Angular: getContactsData() — payment-failed sticky bar (matches.page.ts:2254-2310).
      if (!cancelled && (await getItem('PAYMENTFAILTYPE')) === '1') {
        const banner  = await getHeroBannerDetails(true, 1)
        const content = banner?.PAYMENTFAILEDCONTENT
        const cta     = banner?.PAYMENTFAILEDCTA
        if (!cancelled && content && cta) {
          const startMs = Date.parse(banner?.OFFSTTIME ?? '')
          const endMs   = Date.parse(banner?.OFFEDTIME ?? '')
          const deadlineMs = !Number.isNaN(startMs) && !Number.isNaN(endMs)
            ? Date.now() + Math.max(0, endMs - startMs)
            : Date.now() + 10 * 60 * 1000
          setPaymentStickyInfo({ content, ctaLabel: cta, deadlineMs })
        }
      }
    }

    load()
    return () => { cancelled = true }
  }, [matriId])

  const insets = useSafeAreaInsets()

  function onScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const isScrolled = e.nativeEvent.contentOffset.y > PHOTO_HEIGHT - 80
    setScrolled(isScrolled)
    if (!isScrolled) setShowMenu(false)
  }

  // ── Actions — same communicationBtnOnClick plumbing Matches uses ─────────────

  async function handleLike() {
    if (!profile) return
    setProfile(prev => prev && { ...prev, likedStatus: '1' })
    try {
      const result = await communicationBtnOnClick(fromPage, 'like', { MATRIID: profile.profileId })
      if (result.type === 'error') setProfile(prev => prev && { ...prev, likedStatus: '0' })
    } catch { /* keep optimistic state */ }
  }

  async function handleDontShow() {
    if (!profile) return
    try {
      await communicationBtnOnClick(fromPage, 'skip', { MATRIID: profile.profileId })
      navigation.goBack()
    } catch { /* ignore */ }
  }

  async function handleViewLater() {
    if (!profile) return
    try {
      await communicationBtnOnClick(fromPage, 'viewlater', { MATRIID: profile.profileId })
      navigation.goBack()
    } catch { /* ignore */ }
  }

  async function handleCall() {
    if (!profile) return
    try {
      const result = await communicationBtnOnClick(fromPage, 'call', { MATRIID: profile.profileId })
      if (result.type === 'show_contact' && result.contact) Linking.openURL(`tel:${result.contact}`)
      else if (result.type === 'payment_promo') navigation.navigate('recharge')
    } catch { /* ignore */ }
  }

  async function handleWhatsApp() {
    if (!profile) return
    try {
      const result = await communicationBtnOnClick(fromPage, 'whatsapp', { MATRIID: profile.profileId })
      if (result.type === 'show_contact' && result.contact) {
        const num = result.contact.replace(/\D/g, '')
        if (num) Linking.openURL(`https://wa.me/${num}`)
      } else if (result.type === 'payment_promo') {
        setWhatsappPaywallOpen(true)
      }
    } catch { /* ignore */ }
  }

  function handleWhatsappPaywallPayNow() {
    setWhatsappPaywallOpen(false)
    navigation.navigate('recharge')
  }

  function handleStickyPress() {
    navigation.navigate('recharge')
  }

  // Angular: MATCHES.MORE_OPT_2 ("Report this profile") + GENERAL.REPORT_BLOCK_CTA
  // ("Report and Block") — the 3-dot menu's report action bundles report+block under
  // one confirm. The full reasons-picker form (GENERAL.REPORTING_REASON, attachments,
  // etc.) is a separate, larger feature — deferred; this is the direct confirm+submit.
  function handleReportProfile() {
    setShowMenu(false)
    if (!profile) return
    Alert.alert(
      t('MESSAGES.REPORT_PROFILE'),
      t('GENERAL.REPORT_NOTE'),
      [
        { text: t('REG.CANCEL'), style: 'cancel' },
        {
          text: t('GENERAL.REPORT_BLOCK_CTA'),
          style: 'destructive',
          onPress: async () => {
            const ok = await reportAndBlockProfile(profile.profileId)
            if (ok) navigation.goBack()
          },
        },
      ],
    )
  }

  // ── Loading / not-found ───────────────────────────────────────────────────────

  if (loading) {
    return (
      <SafeAreaView style={s.loaderScreen}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </SafeAreaView>
    )
  }
  if (!profile) {
    // TEMP DEBUG — shows the raw API response so we can see exactly why adapting
    // failed (bad matriId param, RESPONSECODE/ERRCODE mismatch, or an unexpected
    // response envelope shape) without needing a dev console. Remove once confirmed.
    return (
      <SafeAreaView style={s.loaderScreen}>
        <Text style={s.notFoundText}>Unable to load this profile.</Text>
        <Pressable style={s.backBtnInline} onPress={() => navigation.goBack()}>
          <Text style={s.backBtnInlineText}>{'‹ Back'}</Text>
        </Pressable>
        <ScrollView style={s.debugBox}>
          <Text style={s.debugLabel}>DEBUG matriId: {JSON.stringify(matriId)}</Text>
          <Text style={s.debugLabel}>DEBUG raw response:</Text>
          <Text style={s.debugText}>{JSON.stringify(_debugLastViewProfileResult(), null, 2)}</Text>
        </ScrollView>
      </SafeAreaView>
    )
  }

  const oppGender = profile.gender
  // Angular: sameGender hides Call/WhatsApp/Like entirely.
  const sameGender = profile.gender === loginGender
  const hasReligiousInfo = !!(profile.caste || profile.raasi || profile.star || (profile.dosham && profile.dosham.length > 0))

  const ctaCtx: AfterLikeCtx = {
    entryType:   ownEntryType,
    likedStatus: profile.likedStatus,
    phoneViewed: profile.phoneViewed,
    femaleFreeEligible,
    indNumbersLeft,
    oppGender,
  }

  const activeSticky = !stickyDismissed && paymentStickyInfo

  return (
    <View style={s.screen}>
      <StatusBar style="dark" />

      {/* ── Header — a SEPARATE solid white bar above the photo (not floating over
          it) — confirmed against the real app's screenshots. Rest state: back +
          language pill. Once scrolled past the photo: back + Name + Call + language
          + a 3-dot report/don't-show menu. */}
      <View style={[s.headerBar, { paddingTop: insets.top + 8 }]}>
        <Pressable style={s.headerBackBtn} onPress={() => navigation.goBack()} hitSlop={8}>
          <Text style={s.backIcon}>{'‹'}</Text>
        </Pressable>

        {scrolled && (
          <>
            <Text style={s.headerName} numberOfLines={1}>{profile.name}</Text>
            {!sameGender && (
              <Pressable style={s.headerIconBtn} onPress={handleCall} hitSlop={8}>
                <CallIcon width={20} height={21} />
              </Pressable>
            )}
          </>
        )}
        {!scrolled && <View style={s.headerSpacer} />}

        <Pressable
          style={[s.langPill, scrolled && s.langPillCompact]}
          onPress={() => navigation.navigate('LanguageSelection')}
          hitSlop={8}
        >
          <CdnSvg uri={CDN_SVG + 'revamp/lang-change-img.svg'} width={18} height={18} />
          <Text style={s.langPillText} numberOfLines={1}>
            {LANG_LABELS[i18n.language] ?? 'English'}
          </Text>
        </Pressable>

        {scrolled && (
          <View>
            <Pressable style={s.headerIconBtn} onPress={() => setShowMenu(v => !v)} hitSlop={8}>
              <Text style={s.menuDots}>⋮</Text>
            </Pressable>
            {showMenu && (
              <View style={s.menuDropdown}>
                <Pressable
                  style={s.menuItem}
                  onPress={() => { setShowMenu(false); handleDontShow() }}
                >
                  <Text style={s.menuItemText}>{t('MATCHES.MORE_OPT_1')}</Text>
                </Pressable>
                <Pressable style={s.menuItem} onPress={handleReportProfile}>
                  <Text style={[s.menuItemText, s.menuItemDanger]}>{t('MATCHES.MORE_OPT_2')}</Text>
                </Pressable>
              </View>
            )}
          </View>
        )}
      </View>

      <ScrollView
        style={s.scrollView}
        onScroll={onScroll}
        scrollEventThrottle={32}
        contentContainerStyle={[s.scrollContent, { paddingBottom: 32 + insets.bottom }]}
      >
        {/* ── Photo ──────────────────────────────────────────────────────────── */}
        <View style={s.photoBox}>
          {profile.isPhotoAvailable && !profile.isPhotoProtect && profile.photos.length > 0 ? (
            <PhotoSwiper images={profile.photos} width={SCREEN_WIDTH} height={PHOTO_HEIGHT} />
          ) : (
            <View>
              <CdnSvg uri={getBlurPhotoUri(oppGender)} width="100%" height={PHOTO_HEIGHT} />
              {!sameGender && (
                <View style={s.photoOverlay}>
                  <View style={s.overlayCard}>
                    <Text style={s.overlayText}>
                      {t('GENERAL.REQUEST_ADD_PHOTO_WHATSAPP').replace('#HER_HIS#', t(`PRONOUN.${oppGender}.hisher`))}
                    </Text>
                    <WhatsAppUnlockButton label={t('GENERAL.WHATSAPP')} onPress={handleWhatsApp} />
                  </View>
                </View>
              )}
            </View>
          )}
          {profile.isNewlyJoined && (
            <View style={s.newBadge} pointerEvents="none">
              <CdnSvg uri={NEWLY_JOINED_STAR_URI} width={14} height={14} />
              <Text style={s.newBadgeText}>{t('MATCHES.NEW')}</Text>
            </View>
          )}
        </View>

        {/* ── Info card ──────────────────────────────────────────────────────── */}
        <View style={s.infoCard}>
          <View style={s.badgeRow}>
            {profile.isPaidMember && <ProfileBadge variant="paid" text={t('MENU.PAID_BADGE')} />}
            {profile.isIdVerified && loginGender === 'F' && (
              <ProfileBadge variant="verified" text={t('MATCHES.VERIFIED_ID')} />
            )}
          </View>

          <View style={s.nameRow}>
            <Text style={s.name} numberOfLines={1}>{profile.name}</Text>
            {!sameGender && (
              <View style={s.contactIcons}>
                <Pressable onPress={handleCall} hitSlop={8}><CallIcon width={22} height={22} /></Pressable>
                <Pressable onPress={handleWhatsApp} hitSlop={8}><WhatsAppIcon width={24} height={24} /></Pressable>
              </View>
            )}
          </View>
          <Text style={s.jodiId}>{t('EDITPROFILE.JODIIID')} : {profile.profileId}</Text>

          {profile.likedMsg && <Text style={s.likedMsg}>{profile.likedMsg}</Text>}

          {/* ── Basic details ────────────────────────────────────────────────── */}
          <SectionHeader title={t('VIEWPROFILE.BASIC_DETAILS')} />
          <DetailRow icon={ICON.createdFor} label={t('VIEWPROFILE.CREATEDFOR')} value={profile.profileFor} />
          <DetailRow icon={ICON.age} label={t('VIEWPROFILE.AGEIS')} value={profile.age ? `${profile.age} ${t('VIEWPROFILE.YEARS')}` : undefined} />
          <DetailRow icon={ICON.height} label={t('VIEWPROFILE.HEIGHT')} value={profile.height} />
          <DetailRow icon={ICON.maritalStatus} label={t('REG.MARITAL_STATUS')} value={profile.maritalStatus} />
          <DetailRow icon={ICON.children} label={t('VIEWPROFILE.NOOFCHILDREN')} value={profile.noOfChildren} />
          <DetailRow icon={ICON.physicalStatus} label={t('REG.PHYSICAL_STATUS')} value={profile.physicalStatus} />
          <DetailRow icon={ICON.motherTongue} label={t('VIEWPROFILE.MOTHERTONGUE')} value={profile.motherTongue} />
          <DetailRow icon={ICON.location} label={t('VIEWPROFILE.CURRENTLOCATION')} value={profile.location} isLast />

          {/* ── Professional details ─────────────────────────────────────────── */}
          {(profile.education || profile.occupation || profile.income) && (
            <>
              <SectionHeader title={t('VIEWPROFILE.PROFESS_DETAILS')} />
              <DetailRow icon={ICON.education} label={t('VIEWPROFILE.EDUCATION')} value={profile.education} />
              <DetailRow icon={ICON.occupation} label={t('VIEWPROFILE.OCCUPATION')} value={profile.occupation} />
              <DetailRow icon={ICON.salary} label={t('VIEWPROFILE.MONTHLYINCOME')} value={profile.income} isLast />
            </>
          )}

          {/* ── Religious details ────────────────────────────────────────────── */}
          {hasReligiousInfo && (
            <>
              <SectionHeader title={t('VIEWPROFILE.RELIGIOUSDETAIL')} />
              {/* Angular combines Religion/Caste/Subcaste into a SINGLE row under one
                  "Caste" label + caste-icon.svg — not three separate rows. */}
              <DetailRow
                icon={ICON.caste}
                label={t('VIEWPROFILE.CASTE')}
                value={[profile.religion, profile.caste, profile.subCaste].filter(Boolean).join(', ') || undefined}
              />
              <DetailRow icon={ICON.raasi} label={t('VIEWPROFILE.RAASIIS')} value={profile.raasi} />
              <DetailRow icon={ICON.star} label={t('VIEWPROFILE.STARIS')} value={profile.star} />
              <DetailRow icon={ICON.dosham} label={t('VIEWPROFILE.DOSHAMIS')} value={profile.dosham?.join(', ')} isLast />
              {/* Star-match porutham teaser — paid users with both raasi+star see the real
                  compatibility value; free users see a static teaser (Angular's own
                  paywall-teaser trick, preserved deliberately per the plan). */}
              {profile.hasStarMatchInputs && (
                profile.isPaidMember && profile.horoCompatibility ? (
                  <Text style={s.starMatchText}>
                    {withPronouns(t('VIEWPROFILE.HOROCOMPATIBILITY'), oppGender, t).replace('#COMPARE#', profile.horoCompatibility)}
                  </Text>
                ) : (
                  <Pressable onPress={() => navigation.navigate('recharge')}>
                    <Text style={s.starMatchTeaser}>{t('VIEWPROFILE.FREE_MEMBER_REPORT')}</Text>
                  </Pressable>
                )
              )}
            </>
          )}

          {/* ── Life style ────────────────────────────────────────────────────── */}
          {(profile.drinking || profile.smoking || profile.eatingHabits) && (
            <>
              <SectionHeader title={t('VIEWPROFILE.LIFE_STYLE')} />
              <DetailRow icon={ICON.drinking} label={t('VIEWPROFILE.DRINKINGHABIT')} value={profile.drinking} />
              <DetailRow icon={ICON.smoking} label={t('VIEWPROFILE.SMOKINGHABIT')} value={profile.smoking} />
              <DetailRow icon={ICON.eating} label={t('VIEWPROFILE.EATINGHABIT')} value={profile.eatingHabits} isLast />
            </>
          )}

          {/* ── Family details ────────────────────────────────────────────────── */}
          {(profile.brothers !== undefined || profile.sisters !== undefined) && (
            <>
              <SectionHeader title={t('VIEWPROFILE.FAMILYDETAIL')} />
              <DetailRow
                icon={ICON.brother}
                label={t('VIEWPROFILE.BROTHERS')}
                value={familyCountText(profile.brothers, t, {
                  none: 'VIEWPROFILE.NOBROTHERS', one: 'VIEWPROFILE.BROTHER',
                  many: 'VIEWPROFILE.BROTHERSS', moreThan: 'VIEWPROFILE.MORETHANBROTHER',
                })}
              />
              <DetailRow
                icon={ICON.sister}
                label={t('VIEWPROFILE.SISTERS')}
                value={familyCountText(profile.sisters, t, {
                  none: 'VIEWPROFILE.NOSISTERS', one: 'VIEWPROFILE.SISTER',
                  many: 'VIEWPROFILE.SISTERSS', moreThan: 'VIEWPROFILE.MORETHANSISTER',
                })}
                isLast
              />
            </>
          )}

          {/* ── Property details ──────────────────────────────────────────────── */}
          {(profile.property.length > 0 || profile.vehicle.length > 0) && (
            <>
              <SectionHeader title={t('VIEWPROFILE.PROPERTY_DETAILS')} />
              <DetailRow
                icon={ICON.property}
                label={t('VIEWPROFILE.PROPERTY_DETAILS')}
                value={profile.property.map(p => p.label).join(', ') || undefined}
              />
              <DetailRow
                icon={ICON.vehicle}
                label={t('VIEWPROFILE.OWN_VEHICLE')}
                value={profile.vehicle.map(v => v.label).join(', ') || undefined}
                isLast
              />
            </>
          )}

          {/* ── Horoscope details (display only) ─────────────────────────────── */}
          {profile.showHoroSection && (
            <>
              <SectionHeader title={t('VIEWPROFILE.HORO_DETAILS')} />
              <DetailRow
                icon={ICON.horoscope}
                label={t('VIEWPROFILE.HOROSCOPE')}
                value={profile.horoscopeAvailable ? t('VIEWPROFILE.VERIFIED_PROFILE') : undefined}
                isLast
              />
            </>
          )}
        </View>
      </ScrollView>

      {activeSticky && (
        <StickyBanner
          text={activeSticky.content}
          ctaLabel={activeSticky.ctaLabel}
          onPress={handleStickyPress}
          onClose={() => setStickyDismissed(true)}
          countdownDeadlineMs={activeSticky.deadlineMs}
        />
      )}

      {/* ── Fixed bottom CTA bar — Angular: .button-banner/.sticky-btm, position:sticky
          bottom:0, white bg, shadow — ALWAYS visible regardless of scroll position,
          not inline scrolling content (confirmed against the real app). */}
      {!sameGender && showLikeCTA(profile.likedStatus) && (
        <View style={[s.bottomCtaBar, { paddingBottom: 12 + insets.bottom }]}>
          <View style={s.ctaRow}>
            <Pressable
              style={[s.ctaDontShow, disableDontShow(profile.dontShowStatus) && s.ctaDisabled]}
              onPress={handleDontShow}
              disabled={disableDontShow(profile.dontShowStatus)}
            >
              <CloseIcon width={14} height={14} />
              <Text style={s.ctaDontShowText}>{t('GENERAL.DONTSHOWCTA')}</Text>
            </Pressable>
            <Pressable
              style={[s.ctaViewLater, disableViewLater(profile.viewLaterStatus) && s.ctaDisabled]}
              onPress={handleViewLater}
              disabled={disableViewLater(profile.viewLaterStatus)}
            >
              <ViewLaterIcon width={14} height={14} />
              <Text style={s.ctaViewLaterText}>{t('GENERAL.VIEWLATER')}</Text>
            </Pressable>
            <Pressable style={s.ctaLike} onPress={handleLike}>
              <LikeIcon width={16} height={17} />
              <Text style={s.ctaLikeText}>{t('GENERAL.LIKE_CTA').replace('#HER_HIM#', '').trim()}</Text>
            </Pressable>
          </View>
        </View>
      )}

      {!sameGender && showAfterLikeCTA(profile.likedStatus) && (
        <View style={[s.bottomCtaBar, { paddingBottom: 12 + insets.bottom }]}>
          <View style={s.afterLikeRow}>
            <View style={s.afterLikeTopRow}>
              <Text style={s.afterLikeText}>{getAfterLikeContentText(ctaCtx, t)}</Text>
              <View style={s.ctaSendInterestWrap}>
                {showFreeBadge(ctaCtx) && (
                  <View style={s.freeBadge} pointerEvents="none">
                    <Text style={s.freeBadgeText}>{t('GENERAL.FREE')}</Text>
                  </View>
                )}
                <Pressable style={s.ctaSendInterest} onPress={handleCall}>
                  <CdnSvg uri={getAfterLikeCtaIcon(ctaCtx)} width={16} height={16} />
                  <Text style={s.ctaSendInterestText}>{getAfterLikeCtaLabel(ctaCtx, t)}</Text>
                </Pressable>
              </View>
            </View>
            {showContactsLeftBanner(ctaCtx) && (
              <Text style={s.contactsLeftText}>{t('VIEWPROFILE.CONTACT_SEEN_INFO')}</Text>
            )}
          </View>
        </View>
      )}

      <WhatsAppPaywallModal
        visible={whatsappPaywallOpen}
        profile={profile}
        oppGender={oppGender}
        onClose={() => setWhatsappPaywallOpen(false)}
        onPayNow={handleWhatsappPaywallPayNow}
      />
    </View>
  )
}

const s = StyleSheet.create({
  screen:       { flex: 1, backgroundColor: Colors.background },
  loaderScreen: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, backgroundColor: Colors.background },
  notFoundText: { fontFamily: 'Poppins-Medium', fontSize: 14, color: Colors.textSecondary },
  backBtnInline:     { paddingHorizontal: 16, paddingVertical: 8 },
  backBtnInlineText: { fontFamily: 'Poppins-Medium', fontSize: 14, color: Colors.link },
  debugBox:   { maxHeight: 300, width: '100%', paddingHorizontal: 16 },
  debugLabel: { fontFamily: 'Poppins-SemiBold', fontSize: 12, color: Colors.primary, marginTop: 8 },
  debugText:  { fontFamily: 'Poppins-Regular', fontSize: 11, color: Colors.textSecondary },

  scrollView:    { flex: 1 },
  scrollContent: {},

  // Flat, full-bleed square — Angular has no border-radius on this photo (unlike
  // the rounded Matches-card photo), confirmed against viewprofile.page.scss.
  photoBox: { width: SCREEN_WIDTH, height: PHOTO_HEIGHT, backgroundColor: Colors.divider },
  newBadge: {
    position: 'absolute', top: 0, left: 0,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.primaryDark, height: 24,
    paddingLeft: 8, paddingRight: 12, borderBottomRightRadius: 10, gap: 4,
  },
  newBadgeText: { fontFamily: 'Poppins-Regular', fontSize: 12, color: Colors.white },
  photoOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center', justifyContent: 'center',
  },
  overlayCard: {
    backgroundColor: Colors.scrimStrong, marginHorizontal: 24, padding: 16,
    borderRadius: 12, borderWidth: 1, borderColor: Colors.overlayBorder,
    alignItems: 'center', gap: 16,
  },
  overlayText: {
    fontFamily: 'Poppins-Regular', fontSize: 12, color: Colors.white,
    textAlign: 'center', lineHeight: 17,
  },

  // Angular: .details-section { background:#fff } — plain white, flush against the
  // photo, no radius/negative-margin "floating card" effect and no elevation/shadow.
  infoCard: {
    backgroundColor:   Colors.surface,
    paddingHorizontal: 24,
    paddingTop:        16,
    paddingBottom:     8,
  },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },

  nameRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  // Angular: heading1-semibold-22 black-color
  name:    { flex: 1, fontFamily: 'Poppins-SemiBold', fontSize: 22, color: Colors.black },
  contactIcons: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  // Angular: body2-regular-14 black-color
  jodiId:  { fontFamily: 'Poppins-Regular', fontSize: 14, color: Colors.black, marginTop: 4 },
  likedMsg: { fontFamily: 'Poppins-Regular', fontSize: 12, color: Colors.likedStripText, marginTop: 6 },

  // Angular: .button-banner/.sticky-btm — the CTA row is a FIXED bottom bar (white
  // bg, shadow), always visible regardless of scroll position — not inline content.
  bottomCtaBar: {
    backgroundColor: Colors.surface,
    paddingHorizontal: 24, paddingTop: 12,
    shadowColor: '#000000', shadowOpacity: 0.25, shadowRadius: 24, shadowOffset: { width: 0, height: -4 },
    elevation: 12,
  },

  // Angular: <app-button-revamp> default buttonSize.standard — 44px height, 8px
  // radius, body2-regular-14 text (button-revamp.component.scss). Don't Show/View
  // Later = tertiaryBtn: white bg, 1px #545454 border, #545454 text. Like =
  // primaryBtn: primaryBg (#B50033) / noBorder / white text.
  ctaRow: { flexDirection: 'row', gap: 8 },
  ctaDontShow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    height: 44, backgroundColor: Colors.white,
    borderWidth: 1, borderColor: '#545454', borderRadius: 8, paddingHorizontal: 14,
  },
  ctaDontShowText: { fontFamily: 'Poppins-Regular', fontSize: 14, color: '#545454' },
  ctaViewLater: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    height: 44, backgroundColor: Colors.white,
    borderWidth: 1, borderColor: '#545454', borderRadius: 8, paddingHorizontal: 14,
  },
  ctaViewLaterText: { fontFamily: 'Poppins-Regular', fontSize: 14, color: '#545454' },
  ctaDisabled: { opacity: 0.4 },
  ctaLike: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    height: 44, backgroundColor: Colors.primaryDark, borderRadius: 8, gap: 6,
  },
  ctaLikeText: { fontFamily: 'Poppins-Regular', fontSize: 14, color: Colors.white },

  afterLikeRow: {
    backgroundColor: Colors.afterLikeBg, borderRadius: 8, borderWidth: 1,
    borderColor: Colors.afterLikeBorder, paddingHorizontal: 14, paddingVertical: 10,
  },
  afterLikeTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  afterLikeText:   { flex: 1, fontFamily: 'Poppins-Medium', fontSize: 13, color: Colors.black },
  ctaSendInterestWrap: { position: 'relative', flexShrink: 0 },
  ctaSendInterest: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    height: 44, backgroundColor: Colors.primaryDark, borderRadius: 8, paddingHorizontal: 16,
  },
  ctaSendInterestText: { fontFamily: 'Poppins-Regular', fontSize: 14, color: Colors.white },
  freeBadge: {
    position: 'absolute', top: -10, right: 8, zIndex: 1,
    backgroundColor: Colors.badgeNewBg, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2,
  },
  freeBadgeText: { fontFamily: 'Poppins-SemiBold', fontSize: 10, color: Colors.badgeNewText },
  contactsLeftText: {
    fontFamily: 'Poppins-Regular', fontSize: 11, color: Colors.textSecondary, textAlign: 'center', marginTop: 8,
  },

  // Angular: heading1-semibold-20 black-color, line-height:16, mt-24 mb-4
  sectionHeader: {
    fontFamily: 'Poppins-SemiBold', fontSize: 20, color: Colors.black,
    marginTop: 24, marginBottom: 4,
  },
  // Angular: icon column (ion-col size="1") + text column (size="11", pl-12) —
  // label directly above value (not side-by-side), pt-20/pb-20 vertical padding,
  // border-bottom rgba(204,204,204,0.5) on every row except a section's last.
  detailRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 20 },
  detailRowBorder: { borderBottomWidth: 1, borderBottomColor: 'rgba(204,204,204,0.5)' },
  detailIconCol: { width: 20, flexShrink: 0 },
  detailTextCol: { flex: 1, paddingLeft: 12 },
  detailLabel: { fontFamily: 'Poppins-Regular', fontSize: 14, color: Colors.black },
  detailValue: { fontFamily: 'Poppins-Medium', fontSize: 14, color: Colors.black, marginTop: 8 },

  starMatchText:   { fontFamily: 'Poppins-Medium', fontSize: 13, color: Colors.textDark, marginTop: 8 },
  starMatchTeaser: { fontFamily: 'Poppins-Medium', fontSize: 13, color: Colors.link, marginTop: 8 },

  // Header — a SEPARATE solid white bar in normal flow above the photo (never
  // overlaying it) — confirmed against the real app's screenshots. Content swaps
  // (back+language only, vs. back+Name+Call+language+3-dot) once scrolled.
  headerBar: {
    backgroundColor: Colors.surface,
    borderBottomWidth: 1, borderBottomColor: Colors.divider,
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingBottom: 10,
  },
  headerBackBtn: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  backIcon: { fontSize: 22, lineHeight: 22, color: '#333333' },
  headerSpacer: { flex: 1 },
  headerName: { flex: 1, fontFamily: 'Poppins-SemiBold', fontSize: 16, color: Colors.black },
  headerIconBtn: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  menuDots: { fontSize: 20, lineHeight: 20, color: '#333333', fontWeight: '700' },

  langPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderWidth: 1, borderColor: '#000000', borderRadius: 8,
    paddingLeft: 8, paddingRight: 12, paddingVertical: 4,
    backgroundColor: Colors.white, maxWidth: 120,
  },
  langPillCompact: { maxWidth: 84, paddingRight: 8 },
  langPillText: { fontFamily: 'Poppins-Medium', fontSize: 12, color: '#000000' },

  menuDropdown: {
    position: 'absolute', top: 34, right: 0, minWidth: 200,
    backgroundColor: Colors.white, borderRadius: 8, paddingVertical: 4,
    shadowColor: '#000000', shadowOpacity: 0.15, shadowRadius: 8, shadowOffset: { width: 0, height: 4 },
    elevation: 6, zIndex: 10,
  },
  menuItem: { paddingHorizontal: 16, paddingVertical: 12 },
  menuItemText: { fontFamily: 'Poppins-Regular', fontSize: 14, color: Colors.textDark },
  menuItemDanger: { color: Colors.primary },
})
