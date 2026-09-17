// Angular: pages/addphoto-intermediate/addphoto-intermediate.page.ts — a single
// component handling several unrelated ":page" param variants (CONGRATS,
// ADDPHOTO, ADDPHOTOPUBLISH, photorejection, showguidelines), most of them
// wired through native-camera JS-bridge callbacks (window.addphotointer) that
// don't apply to a pure-native RN app at all.
//
// SCOPE: only the 'CONGRATS' variant (webview page_id "23") is implemented for
// real here — the actual ask. It's a simple, self-contained "you're all set"
// promo screen for the female-free-contact promotion: gift image, congrats
// text, "N free contacts, valid D days" body, one CTA that lands on Matches
// (Angular's own countData>0→Activity branch is dead code in Angular itself —
// callHttpService(), the only thing that would ever populate countData, is
// commented out in the constructor — so the CTA always lands on Matches in
// practice; matched exactly, not simplified).
//
// The 'showguidelines' variant IS now implemented too — the Photo Guidelines
// page reached from Edit Profile's "View Photo Guidelines" link. It renders the
// server-driven copy + illustration grid from
// photoValidationService.fetchPhotoGuidelines() (Angular's callphotoRejection()).
//
// 'ADDPHOTO' and 'photorejection' are now implemented too — both are real
// Angular targets of drService.ts's handleAfterDr() (cases 27 and 57) and were
// previously falling through to a Gallery redirect rather than rendering:
//  - ADDPHOTO: the three-card match fan + "…and N members prefer profiles with
//    photos" promo, copy from REGISTRATIONARRAYS.ADDPHOTOPROMOTION.
//  - photorejection: the rejected-photo hero with its dimmed reason overlay,
//    the first three guideline tiles, and the "View all guidelines" link across
//    to the showguidelines variant below.
//
// 'ADDPHOTOPUBLISH' renders Angular's shared <app-add-photo> component rather
// than any markup of its own (addphoto-intermediate.page.html:270-272), so it
// hands straight over to this port's equivalent of that component — the
// onboarding AddPhotoScreen (pageNo '20') — instead of duplicating it here.
// Any other page value still falls back to Gallery.

import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ActivityIndicator, Dimensions, Image, Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import ButtonRevamp from '../../components/button-revamp/ButtonRevamp'
import CdnSvg from '../../components/cdn-svg/CdnSvg'
import WebPhotoInput from '../../components/add-photo/WebPhotoInput'
import AddPhotoVerdictSheets from '../../components/add-photo/AddPhotoVerdictSheets'
import { useAddPhotoPicker } from '../../hooks/useAddPhotoPicker'
import { Colors } from '../../constants/colors'
import { CDN_IMG, CDN_SVG } from '../../constants/cdn'
import { StorageKeys as SK } from '../../constants/storage.keys'
import { getItem } from '../../service/storageService'
import { getSessionValue, getRegistrationArrays } from '../../service/registrationService'
import { fetchPhotoGuidelines, type PhotoGuidelines } from '../../service/photoValidationService'
import { fetchMatches } from '../../service/homeService'
import { getPPSetData } from '../../service/profileService'
import type { SwiperItem } from '../../components/swiper-card/SwiperCard'
import { Fonts, FontSize } from '../../src/theme/fonts'
import { ENavigation } from '../../types/enums/navigation.enum'

const GIFT_IMG = CDN_IMG + 'png/gift-conrats.png'

// Angular: `.cross-size` (addphoto-intermediate.page.scss) — 30x30.
const ICON_CLOSE = CDN_SVG + 'close-b-icon.svg'
const CLOSE_SIZE = 30
// Angular: the `.photo-rejected-cross` badge's `.width-16` <ion-img> — the
// asset itself is 22x22, forced to 16 wide by that class.
const CROSS_IMG = CDN_IMG + 'png/photo-rejected/photo-rejected-red-cross.png'
const CROSS_SIZE = 16
// Angular: `.photo-rejected-img` — 57x57 ion-avatar (so border-radius 50%),
// background #E7D6E4.
const AVATAR_SIZE = 57

// ADDPHOTO variant assets/metrics — all from addphoto-intermediate.page.scss.
// `.add-photointermediate-center` is a contain-sized background SVG behind the
// whole column; `.close-btn-revamp` pins the ✕ at right/top 24.
const BG_IMG        = CDN_SVG + 'add-photo-intermediate-revamp.svg'
const ICON_CLOSE_PW = CDN_SVG + 'close-paywall.svg'
const ICON_BLUE_TICK = CDN_SVG + 'blue-tick.svg'
const ICON_UPLOAD    = CDN_SVG + 'upload-your-photo-img.svg'
// Angular: `.cross-size` is 30x30 for the rejection close; the white cross on
// the rejected-photo overlay is `.red-cross-img` — a 5px-padded red circle.
const CROSS_WHITE_IMG = CDN_SVG + 'cross-white-img.svg'

// `.addphoto-intermediate-swiper-photo` — the centre card is 55% of the row and
// 200 tall; the two half cards are the same size, absolutely offset ±35%, so
// only the inner 20% of each shows. Widths are percentages of the screen in
// Angular, resolved against window width here since RN cannot offset a
// percentage of a parent that is itself percentage-width.
const SCREEN_W   = Dimensions.get('window').width
const CARD_W     = Math.round(SCREEN_W * 0.55)
const CARD_H     = 200
const CARD_PEEK  = Math.round(SCREEN_W * 0.35)

// Angular renders ADDPHOTOPROMOTION.content2 through [innerHTML]; it wraps
// "Add your photo" in a <span class="heading3-semibold-16">. RN <Text> has no
// markup, so the tags come out — the emphasis is lost, the wording is not.
const stripTags = (s: string) => s.replace(/<[^>]*>/g, '')

// One card of the ADDPHOTO three-card fan. A local render helper rather than a
// shared component — it exists only for this variant's layout and is not the
// listing card any other screen uses.
function PromoCard({ item, style }: { item: SwiperItem; style: any }) {
  return (
    <View style={[p.card, style]}>
      {!!(item.profileImg || item.avatarImg) && (
        <Image
          source={{ uri: item.profileImg || item.avatarImg }}
          style={p.cardImg}
          resizeMode="cover"
        />
      )}
      {/* Angular `.addphoto-intermediate-information`: a white 8-radius chip,
          75% wide, hanging 15px below the card's bottom edge. */}
      <View style={p.cardInfo}>
        <View style={p.cardNameRow}>
          {/* Angular: `heading3-semibold-16 black-color mr-12` */}
          <Text style={p.cardName} numberOfLines={1}>{item.name ?? ''}</Text>
          {item.isIdVerified && <CdnSvg uri={ICON_BLUE_TICK} width={14} height={14} />}
        </View>
        {/* Angular: `body2-regular-14 color-7f7f7f` on CITY */}
        <Text style={p.cardCity} numberOfLines={1}>{item.location ?? ''}</Text>
      </View>
    </View>
  )
}

type Props = { navigation: any; route: any }

export default function AddPhotoIntermediateScreen({ navigation, route }: Props) {
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()
  const page = route?.params?.page ?? 'ADDPHOTO'
  // Angular's own `frm_page` query param (guidelinePageRedirection()).
  const frmPage = route?.params?.frm_page ?? 'edit-profile'

  // Angular's targets here all use replaceUrl: true — these variants are
  // landings reached via resetTo(), with nothing underneath worth returning to.
  const resetToMatches = () => navigation.replace(ENavigation.MATCHES)

  const [freeContactCnt, setFreeContactCnt] = useState('10')
  const [freeContactDays, setFreeContactDays] = useState('30')

  // Angular: every "upload photo" CTA on this page calls
  // common.callNative('registrationAddPhoto'); this port's equivalent single
  // entry point is useAddPhotoPicker's openAddPhoto (native → Gallery screen,
  // web → hidden file input, see that hook for why they differ).
  const addPhoto = useAddPhotoPicker()

  // ── showguidelines / photorejection state ──
  // Both variants are driven by the same initialfetch(type=PHOTOREJECTION)
  // payload — Angular's callphotoRejection() serves them from one call.
  const [guidelines, setGuidelines] = useState<PhotoGuidelines | null>(null)
  const [guidelinesLoading, setGuidelinesLoading] = useState(
    page === 'showguidelines' || page === 'photorejection',
  )
  // Angular: ppsetData?.PHOTOURL (ngOnInit's getPPSETData) — the member's own
  // rejected photo, shown behind the reason overlay.
  const [rejectedPhotoUrl, setRejectedPhotoUrl] = useState('')
  // Angular: PHOTOREASON[PHOTOSTATUSARRAY.REASON ?? '1'].
  const [rejectedReason, setRejectedReason] = useState('')

  // ── ADDPHOTO state ──
  // Angular: the matchesResponce passed through router state by
  // dr.service.ts's handleAfterDr() case "27". This port re-fetches instead of
  // threading it through navigation params — handleAfterDr already had to call
  // the same listing to evaluate its own TOTAL > 0 gate, so the data is warm.
  const [promoMatches, setPromoMatches] = useState<SwiperItem[]>([])
  const [promoTotal, setPromoTotal]     = useState(0)
  const [promoCopy, setPromoCopy]       = useState<Record<string, any> | null>(null)
  const [promoLoading, setPromoLoading] = useState(page === 'ADDPHOTO')
  // Angular: `LOGINGENDER == 'M' ? guidelines?.MIMG : guidelines?.FIMG` — the
  // illustration grid is gendered. Stored as 'M'/'F' (see utils/avatar.ts).
  const [isMale, setIsMale] = useState(true)

  useEffect(() => {
    if (page !== 'showguidelines' && page !== 'photorejection') return
    let cancelled = false
    Promise.all([fetchPhotoGuidelines(), getItem(SK.User.LOGIN_GENDER)]).then(([data, gender]) => {
      if (cancelled) return
      setGuidelines(data)
      setIsMale(gender !== 'F')
      setGuidelinesLoading(false)
    })
    return () => { cancelled = true }
  }, [page])

  // Angular: callphotoRejection()'s reason lookup + ngOnInit's getPPSETData().
  // Split from the fetch above because the reason needs the resolved payload.
  useEffect(() => {
    if (page !== 'photorejection') return
    let cancelled = false
    getPPSetData().then((pp: any) => {
      if (!cancelled && pp?.PHOTOURL) setRejectedPhotoUrl(String(pp.PHOTOURL))
    }).catch(() => {})
    return () => { cancelled = true }
  }, [page])

  useEffect(() => {
    if (page !== 'photorejection' || !guidelines) return
    let cancelled = false
    getSessionValue(SK.Profile.PHOTO_STATUS_ARRAY).then((raw: any) => {
      if (cancelled) return
      // Angular keeps PHOTOSTATUSARRAY as a JSON string; storeWebURLData()
      // stashes whatever the server sent, so it can arrive already parsed.
      let status: any = raw
      if (typeof raw === 'string') {
        try { status = JSON.parse(raw) } catch { status = null }
      }
      // Angular: `photostatusArray?.REASON ? …toString() : '1'` — '1' is the
      // documented default, not a guess.
      const reasonId = status?.REASON != null && status.REASON !== '' ? String(status.REASON) : '1'
      setRejectedReason(guidelines.reasons?.[reasonId] ?? '')
    }).catch(() => {})
    return () => { cancelled = true }
  }, [page, guidelines])

  // Angular: handleAfterDr case "27" hands matchesResponce in via router state,
  // and the copy comes from REGISTRATIONARRAYS.ADDPHOTOPROMOTION.
  useEffect(() => {
    if (page !== 'ADDPHOTO') return
    let cancelled = false
    Promise.all([fetchMatches(0, 20), getRegistrationArrays()])
      .then(([listing, arrays]) => {
        if (cancelled) return
        setPromoMatches(listing.items.slice(0, 3))
        setPromoTotal(listing.totalCount)
        setPromoCopy(arrays?.ADDPHOTOPROMOTION ?? null)
        setPromoLoading(false)
      })
      .catch(() => { if (!cancelled) setPromoLoading(false) })
    return () => { cancelled = true }
  }, [page])

  useEffect(() => {
    if (page !== 'CONGRATS') return
    getSessionValue('FEMALEFREECONACT').then((data: any) => {
      if (data?.AllowedContacts) setFreeContactCnt(String(data.AllowedContacts))
      if (data?.Expirydays)      setFreeContactDays(String(data.Expirydays))
    })
  }, [page])

  // ─── showguidelines / photorejection ──────────────────────────────────────
  // Angular: addphoto-intermediate.page.html:290-377 — one
  // `['photorejection','showguidelines'].includes(showPageType)` block serving
  // both, plus a shared <ion-footer>. Scrolling body + pinned footer CTA.
  if (page === 'showguidelines' || page === 'photorejection') {
    const isRejection = page === 'photorejection'

    // Angular: photoRejectionClose() routes by frm_page — 'login'/'from_login'
    // → /matches, 'notification' → /notification, everything else →
    // /edit-profile. The notification branch falls to Matches here: this port
    // has no notification-list screen (the same documented gap as
    // pageLandingService.ts's case 8).
    const closeRejection = () => {
      if (frmPage === 'login' || frmPage === 'from_login') resetToMatches()
      else navigation.navigate('EditProfile')
    }
    // showguidelines keeps its existing goBack: it is only ever pushed from a
    // screen the member should return to (Edit Profile's "View photo
    // guidelines", or the rejection variant's own link below).
    const close = isRejection ? closeRejection : () => navigation.goBack()

    // Angular: callNative('registrationAddPhoto') on the shared footer CTA.
    // showguidelines keeps the hand-back-to-Edit-Profile behaviour it already
    // had (the picker lives on the screen the member came from); the rejection
    // variant is a landing with nothing underneath, so it opens the picker in
    // place through the standard hook.
    const continueToUpload = () => {
      if (isRejection) { addPhoto.openAddPhoto(navigation); return }
      if (frmPage === 'edit-profile') navigation.navigate('EditProfile', { openPhotoPicker: true })
      else navigation.goBack()
    }

    // Angular: `this.guidelineImages = guideImages.slice(0,3)` for
    // photorejection, the full list for showguidelines.
    const items = isRejection
      ? (guidelines?.items ?? []).slice(0, 3)
      : (guidelines?.items ?? [])

    return (
      <View style={[g.screen, { paddingTop: insets.top }]}>
        {/* Angular: `ion-cust-padding-start pr-16 pt-12 pb-0`, right-aligned. */}
        <View style={g.closeRow}>
          <Pressable onPress={close} hitSlop={8} accessibilityRole="button" accessibilityLabel="Close">
            <CdnSvg uri={ICON_CLOSE} width={CLOSE_SIZE} height={CLOSE_SIZE} />
          </Pressable>
        </View>

        {guidelinesLoading ? (
          <View style={g.loading}><ActivityIndicator color={Colors.primaryDark} size="large" /></View>
        ) : (
          <ScrollView contentContainerStyle={g.body} showsVerticalScrollIndicator={false}>
            {isRejection ? (
              <>
                {/* Angular: `heading2-semibold-18 black-color` on TITLE2. */}
                <Text style={g.rejectTitle}>{guidelines?.title2 || 'Your photo is rejected'}</Text>

                {/* Angular: `.photo-rejected-reason` — a 16-radius #E9F2FB box
                    (`height-55` = 55% of the grid) holding the member's own
                    photo, with `.photo-rejected-reason-block` dimming it at 60%
                    black and centring the cross + reason over it. */}
                <View style={g.rejectHero}>
                  {!!rejectedPhotoUrl && (
                    <Image source={{ uri: rejectedPhotoUrl }} style={g.rejectPhoto} resizeMode="contain" />
                  )}
                  <View style={g.rejectOverlay}>
                    {/* Angular `.red-cross-img`: 5px padding on a fully rounded
                        rgba(249,64,106,1) circle. */}
                    <View style={g.rejectCrossCircle}>
                      <CdnSvg uri={CROSS_WHITE_IMG} width={14} height={14} />
                    </View>
                    <Text style={g.rejectReason}>{rejectedReason}</Text>
                  </View>
                </View>

                {/* Angular: `body1-medium-14 black-color` on TITLE — rendered
                    for every variant EXCEPT showguidelines. */}
                <Text style={g.rejectGuidelinesLabel}>{guidelines?.title || 'Photo guidelines'}</Text>
              </>
            ) : (
              <>
                {/* Angular: `heading3-semibold-16 black-color` */}
                <Text style={g.title}>{guidelines?.title || 'Photo Guidelines'}</Text>
                {/* Angular: `body2-regular-14 color-585858 mt-8` */}
                <Text style={g.note}>
                  {guidelines?.note || 'The following types of photos will be rejected'}
                </Text>
              </>
            )}

            {/* Angular: `<ion-col size="4" class="padd0 mt-12" *ngFor=…>` —
                a 3-up grid, each cell 12px above its row. */}
            <View style={g.grid}>
              {items.map((item, i) => (
                <View key={i} style={g.cell}>
                  <View style={g.avatarWrap}>
                    <Image
                      source={{ uri: isMale ? item.maleImg : item.femaleImg }}
                      style={g.avatar}
                      resizeMode="cover"
                    />
                    {/* Angular `.photo-rejected-cross`: absolute right -6 /
                        bottom 2, 4px of white padding, fully rounded. */}
                    <View style={g.crossBadge}>
                      <Image source={{ uri: CROSS_IMG }} style={g.crossImg} resizeMode="contain" />
                    </View>
                  </View>
                  {/* Angular: `pl-8 pr-8 text-align-center` +
                      `body3-regular-12 color-333333` */}
                  <Text style={g.caption}>{item.reason}</Text>
                </View>
              ))}
            </View>

            {/* Angular: guidelinePageRedirection() — photorejection only. Opens
                this same screen's showguidelines variant with frm_page
                'from_login', so its own close returns here. */}
            {isRejection && (
              <Pressable
                style={g.linkRow}
                onPress={() => navigation.push(ENavigation.ADD_PHOTO_INTERMEDIATE, {
                  page: 'showguidelines', frm_page: 'from_login',
                })}
                accessibilityRole="link"
              >
                <Text style={g.linkText}>{guidelines?.linkCta || 'View all guidelines'}</Text>
                <Text style={g.linkChevron}>{'›'}</Text>
              </Pressable>
            )}
          </ScrollView>
        )}

        {/* Angular: <ion-footer> — `primary-cta-jodii primary-btn-ht` (44px)
            on a row with `mt-6 mb-12` and the standard 24 side padding. */}
        <View style={[g.footer, { paddingBottom: insets.bottom + 12 }]}>
          <Pressable
            style={({ pressed }) => [g.cta, pressed && g.ctaPressed]}
            onPress={continueToUpload}
            accessibilityRole="button"
          >
            <Text style={g.ctaText}>{guidelines?.cta || 'Continue to upload photo'}</Text>
          </Pressable>
        </View>
        <WebPhotoInput inputRef={addPhoto.webInputRef} onChange={addPhoto.handleWebFiles} />
        <AddPhotoVerdictSheets addPhoto={addPhoto} />
      </View>
    )
  }

  // ─── ADDPHOTO ─────────────────────────────────────────────────────────────
  // Angular: addphoto-intermediate.page.html:134-222 — a full-bleed background
  // illustration behind a vertically-centred column: a three-card fan of the
  // member's top matches, the ADDPHOTOPROMOTION copy, and one upload CTA.
  if (page === 'ADDPHOTO') {
    // Angular: skipPhotoPopup() → signzyFailureNavigation(), a long frm_page
    // dispatch. Every entry point this port has reaches here with 'notify' or
    // 'login', both of which land on Matches in that dispatch's own default
    // branch; the remaining branches (myProfilePreview/managePrivacy/viewprofile/
    // payment/registration) are unreachable from here and are not replicated.
    const first = promoMatches[0]

    // Angular: content1.replace('#COUNT',totalCount).replace('#NAME'/'#Name',
    // matchesValue[0]?.NAME) — both spellings, the server sends either.
    const headline = String(promoCopy?.content1 ?? '')
      .replace('#COUNT', String(promoTotal))
      .replace('#NAME', first?.name ?? '')
      .replace('#Name', first?.name ?? '')

    return (
      <View style={p.screen}>
        <Image source={{ uri: BG_IMG }} style={p.bg} resizeMode="contain" />

        {/* Angular `.close-btn-revamp`: absolute right 24 / top 24, z-index 999. */}
        <Pressable
          style={[p.closeBtn, { top: insets.top + 24 }]}
          onPress={resetToMatches}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Close"
        >
          <CdnSvg uri={ICON_CLOSE_PW} width={24} height={24} />
        </Pressable>

        {promoLoading ? (
          <View style={g.loading}><ActivityIndicator color={Colors.primaryDark} size="large" /></View>
        ) : (
          <ScrollView
            contentContainerStyle={[p.body, { paddingTop: insets.top + 72, paddingBottom: insets.bottom + 24 }]}
            showsVerticalScrollIndicator={false}
          >
            {promoMatches.length > 0 && (
              /* Angular: the centre card sits in flow; the two half cards are
                 absolutely positioned at left/right -35%, so each shows only a
                 sliver behind it. Rendered in Angular's own DOM order (left,
                 centre, right) so the centre card paints last and on top. */
              <View style={p.fan}>
                {promoMatches[1] && <PromoCard item={promoMatches[1]} style={p.fanLeft} />}
                {promoMatches[2] && <PromoCard item={promoMatches[2]} style={p.fanRight} />}
                {first && <PromoCard item={first} style={p.fanCentre} />}
              </View>
            )}

            {promoMatches.length > 0 && !!headline && (
              /* Angular: `heading2-semibold-18 black-color`, centred, mt-32/mt-8. */
              <Text style={p.headline}>{headline}</Text>
            )}

            {/* Angular: `body2-regular-14 color-1f1e1b pl-16 pr-16 mt-24`. The
                copy embeds a <span class="heading3-semibold-16"> around "Add
                your photo"; RN <Text> has no markup, so the tags are stripped
                — the emphasis is lost, the wording is not. */}
            {!!promoCopy?.content2 && (
              <Text style={p.subCopy}>{stripTags(String(promoCopy.content2))}</Text>
            )}

            {/* Angular: `primary-cta-jodii primary-btn-ht body1-medium-14` with
                the upload icon and a 6px gap. */}
            <Pressable
              style={({ pressed }) => [p.cta, pressed && g.ctaPressed]}
              onPress={() => addPhoto.openAddPhoto(navigation)}
              accessibilityRole="button"
            >
              <CdnSvg uri={ICON_UPLOAD} width={20} height={20} />
              <Text style={p.ctaText}>
                {promoCopy?.upladPhoto ? String(promoCopy.upladPhoto) : 'Upload your photo'}
              </Text>
            </Pressable>
          </ScrollView>
        )}
        <WebPhotoInput inputRef={addPhoto.webInputRef} onChange={addPhoto.handleWebFiles} />
        <AddPhotoVerdictSheets addPhoto={addPhoto} />
      </View>
    )
  }

  // ─── ADDPHOTOPUBLISH ──────────────────────────────────────────────────────
  // Angular renders the shared <app-add-photo> component here rather than any
  // markup of its own (addphoto-intermediate.page.html:270-272), so this hands
  // over to this port's equivalent of that component — the onboarding
  // AddPhotoScreen, reached the same way drService.ts's own cases 20/24 reach
  // it. Angular's `showIcon` / `showSkipBtn` / `promotype` inputs have no
  // counterpart on AddPhotoScreen, which renders one fixed layout.
  if (page === 'ADDPHOTOPUBLISH') {
    navigation.replace(ENavigation.ONBOARDING, { pageNo: '20', standalone: true })
    return null
  }

  // Not a variant this screen renders — see SCOPE note above.
  if (page !== 'CONGRATS') {
    navigation.replace('Gallery')
    return null
  }

  const body = t('PHOTO_PROMO.CONTACT_CONGRATS_CONT',
    `You have received ${freeContactCnt} FREE contacts. Use it within ${freeContactDays} days to Call/WhatsApp matches you like`)
    .replace('#VAR#', freeContactCnt)
    .replace('#DAYS#', freeContactDays)

  return (
    <View style={[s.screen, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
      <Image source={{ uri: GIFT_IMG }} style={s.giftImg} resizeMode="contain" />
      <Text style={s.title}>{t('VERIFY_ID.CONGRATS', 'Congratulations!')}</Text>
      <Text style={s.body}>{body}</Text>
      <ButtonRevamp
        label={t('GENERAL.VIEW_MATCHES', 'Contact Matches For Free')}
        variant="secondary"
        onPress={() => navigation.replace(ENavigation.MATCHES)}
        style={s.cta}
      />
    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.white, paddingHorizontal: 24 },
  giftImg: { width: 160, height: 160, alignSelf: 'center', marginBottom: 24 },
  title: { fontSize: FontSize.font18, fontWeight: '600', color: Colors.black, marginBottom: 12 },
  body: { fontSize: FontSize.font14, color: Colors.textPrimary, lineHeight: 20, marginBottom: 24 },
  cta: { alignSelf: 'flex-start' },
})

// ─── showguidelines styles ────────────────────────────────────────────────────
// Every value below is from addphoto-intermediate.page.html/.scss + global.scss:
// side padding is `ion-cust-padding-start/end` (var(--ion-cust-padding) = 24).
const g = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.white },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // Angular: `ion-cust-padding-start pr-16 pt-12 pb-0` + `ion-justify-content-end`.
  closeRow: { paddingLeft: 24, paddingRight: 16, paddingTop: 12, alignItems: 'flex-end' },

  body: { paddingHorizontal: 24, paddingBottom: 24 },
  // Angular: `heading3-semibold-16` (global.scss:2204) = var(--font16) +
  // --english-semibold-poppins (Poppins-SemiBold); `black-color` = #000000.
  title: { fontSize: FontSize.font16, fontFamily: Fonts.poppinsSemiBold, color: Colors.black },
  // Angular: `body2-regular-14 color-585858` (global.scss:2258 / 2011) =
  // var(--font14) + Poppins-Regular + #585858, on a `mt-8` column.
  note: { fontSize: FontSize.font14, fontFamily: Fonts.poppinsRegular, color: '#585858', marginTop: 8 },

  // `size="4"` = 4/12 of the row, i.e. three cells per row.
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  // `mt-12` on each column — every cell, not just the second row, matching
  // Angular (the first row therefore also sits 12 below the note).
  cell: { width: '33.333%', marginTop: 12, alignItems: 'center' },

  // Angular `.photo-rejected-img`: 57x57 ion-avatar → fully rounded, bg #E7D6E4.
  // The cross badge overflows this box (right: -6), so nothing here clips.
  avatarWrap: { width: AVATAR_SIZE, height: AVATAR_SIZE },
  avatar: {
    width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: AVATAR_SIZE / 2,
    backgroundColor: '#E7D6E4',
  },
  // Angular `.photo-rejected-cross`: right -6, bottom 2, padding 4, white,
  // border-radius 50% — 16 of image + 4+4 of padding = a 24px circle.
  crossBadge: {
    position: 'absolute', right: -6, bottom: 2, padding: 4,
    backgroundColor: Colors.white, borderRadius: (CROSS_SIZE + 8) / 2,
  },
  crossImg: { width: CROSS_SIZE, height: CROSS_SIZE },

  // Angular: `pl-8 pr-8 text-align-center` wrapper + `body3-regular-12
  // color-333333` (global.scss:2264 / 2019) = var(--font12) + Poppins-Regular
  // + #333333.
  caption: {
    fontSize: FontSize.font12, fontFamily: Fonts.poppinsRegular, color: Colors.textDark,
    textAlign: 'center', paddingHorizontal: 8, marginTop: 4,
  },

  // Angular: <ion-footer class="ion-no-border bg-white"> with a `mt-6 mb-12` row.
  footer: { paddingHorizontal: 24, paddingTop: 6, backgroundColor: Colors.white },
  // Angular: `primary-cta-jodii` (bg #B50033, border-radius 8, width 100%,
  // --box-shadow none) + `primary-btn-ht` (height 44px, global.scss:26878).
  cta: {
    height: 44, borderRadius: 8, backgroundColor: Colors.primaryDark,
    alignItems: 'center', justifyContent: 'center',
  },
  ctaPressed: { opacity: 0.8 },
  // Angular: `<span class="body1-medium-14 white-color">` = var(--font14) +
  // --english-medium-poppins (Poppins-Medium) + #ffffff.
  ctaText: { fontSize: FontSize.font14, fontFamily: Fonts.poppinsMedium, color: Colors.white },

  // ── photorejection additions ──
  // Angular: `heading2-semibold-18 black-color` on TITLE2, in a `mmt-12` row.
  rejectTitle: {
    fontSize: FontSize.font18, fontFamily: Fonts.poppinsSemiBold, color: Colors.black,
    marginTop: 12,
  },
  // Angular `.photo-rejected-reason` + its `mt-16 mb-16 height-55` row. The
  // 55% is of the ion-grid's full height; expressed here as a fixed ratio of
  // the window, since this sits inside a ScrollView with no fixed-height parent.
  rejectHero: {
    height: Math.round(Dimensions.get('window').height * 0.4),
    marginTop: 16, marginBottom: 16,
    backgroundColor: '#E9F2FB', borderRadius: 16, overflow: 'hidden',
  },
  // Angular: `width/height 100%, object-fit: contain`.
  rejectPhoto: { width: '100%', height: '100%' },
  // Angular `.photo-rejected-reason-block`: absolute full-cover, 60% black,
  // centred content with 24 of side padding.
  rejectOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 24,
  },
  // Angular `.red-cross-img`: 5px padding, fully rounded, rgba(249,64,106,1).
  rejectCrossCircle: {
    padding: 5, borderRadius: 999, backgroundColor: 'rgba(249, 64, 106, 1)',
    marginBottom: 6,
  },
  // Angular: `heading3-semibold-16 white-color`, centred.
  rejectReason: {
    fontSize: FontSize.font16, fontFamily: Fonts.poppinsSemiBold, color: Colors.white,
    textAlign: 'center',
  },
  // Angular: `body1-medium-14 black-color` in a `mb-12` row.
  rejectGuidelinesLabel: {
    fontSize: FontSize.font14, fontFamily: Fonts.poppinsMedium, color: Colors.black,
    marginBottom: 12,
  },
  // Angular: a `pt-12` row, centred, `color-29339B body2-regular-14` with an
  // underline and a chevron-forward icon.
  linkRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingTop: 12,
  },
  linkText: {
    fontSize: FontSize.font14, fontFamily: Fonts.poppinsRegular, color: '#29339B',
    textDecorationLine: 'underline',
  },
  linkChevron: { fontSize: FontSize.font16, color: '#29339B', marginLeft: 2 },
})

// ─── ADDPHOTO styles ──────────────────────────────────────────────────────────
// From addphoto-intermediate.page.scss's `.add-photointermediate-center`,
// `.close-btn-revamp`, `.addphoto-intermediate-swiper-photo*` and
// `.addphoto-intermediate-information`.
const p = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.white },
  // Angular puts this on the column as a `background-size: contain`,
  // no-repeat background image — an absolutely-positioned contain Image is the
  // RN equivalent, behind everything and ignoring touches.
  bg: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%' },
  // Angular `.close-btn-revamp`: right 24, top 24, z-index 999.
  closeBtn: { position: 'absolute', right: 24, zIndex: 999 },

  body: { flexGrow: 1, justifyContent: 'center' },

  // The fan row, full screen width — the same box Angular's <ion-col> is.
  //
  // All three cards are absolutely placed with an explicit `left` rather than
  // letting the centre one sit in flow: Android clips absolutely-positioned
  // children that overflow their parent regardless of `overflow: 'visible'`,
  // so the half cards must be positioned inside a box that is already wide
  // enough to hold their visible part.
  //
  // Height is CARD_H + 20, not CARD_H: the info chip hangs 15 below each card
  // (`bottom: -15`) and would otherwise be cut off by the clip below. The clip
  // itself is intentional and matches the browser — ion-content hides the
  // horizontal overflow of the two half cards there too.
  fan: {
    width: SCREEN_W,
    height: CARD_H + 20,
    marginTop: 32,
    alignSelf: 'center',
    overflow: 'hidden',
  },
  card: {
    position: 'absolute', top: 0,
    width: CARD_W, height: CARD_H,
    borderRadius: 16, backgroundColor: '#E1E1E1',
  },
  cardImg: { width: '100%', height: '100%', borderRadius: 16 },
  // Angular: the centre card is centred in the column by `ion-justify-content-center`.
  fanCentre: { left: Math.round((SCREEN_W - CARD_W) / 2) },
  // Angular: `position: absolute; left: -35%` / `right: -35%` of the column —
  // resolved here against SCREEN_W, which is that column's width.
  fanLeft:  { left: -CARD_PEEK },
  fanRight: { left: SCREEN_W - CARD_W + CARD_PEEK },

  // Angular `.addphoto-intermediate-information`: bottom -15, white, 75% wide,
  // padding 8, radius 8, soft drop shadow.
  cardInfo: {
    position: 'absolute', bottom: -15, alignSelf: 'center',
    width: '75%', padding: 8,
    backgroundColor: Colors.white, borderRadius: 8,
    shadowColor: '#000', shadowOpacity: 0.09, shadowRadius: 14,
    shadowOffset: { width: 0, height: 10 }, elevation: 4,
  },
  cardNameRow: { flexDirection: 'row', alignItems: 'center' },
  cardName: {
    fontSize: FontSize.font16, fontFamily: Fonts.poppinsSemiBold, color: Colors.black,
    marginRight: 12, flexShrink: 1,
  },
  cardCity: {
    fontSize: FontSize.font14, fontFamily: Fonts.poppinsRegular, color: '#7F7F7F',
  },

  // Angular: `pt-0 pl-24 pr-24 mt-32` row, `mt-8` column, centred text.
  headline: {
    marginTop: 40, paddingHorizontal: 24,
    fontSize: FontSize.font18, fontFamily: Fonts.poppinsSemiBold, color: Colors.black,
    textAlign: 'center',
  },
  // Angular: `mt-24` column with `pl-16 pr-16` on top of the row's own 24.
  subCopy: {
    marginTop: 24, paddingHorizontal: 40,
    fontSize: FontSize.font14, fontFamily: Fonts.poppinsRegular, color: '#1F1E1B',
    textAlign: 'center',
  },
  // Angular: `mt-24 pl-24 pr-24` row holding `primary-cta-jodii primary-btn-ht`
  // (44px, radius 8, #B50033) with the icon and a `ml-6` label.
  cta: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    height: 44, borderRadius: 8, backgroundColor: Colors.primaryDark,
    marginTop: 24, marginHorizontal: 24,
  },
  ctaText: {
    fontSize: FontSize.font14, fontFamily: Fonts.poppinsMedium, color: Colors.white,
    marginLeft: 6,
  },
})
