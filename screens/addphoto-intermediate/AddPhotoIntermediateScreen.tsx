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
// The OTHER page variants (ADDPHOTO/ADDPHOTOPUBLISH/photorejection) are real
// Angular targets of drService.ts's handleAfterDr() (cases 27/59/60) and
// inAppNotificationService.ts, but were, until this screen existed, dangling
// references to an unregistered route name (would throw at runtime, not
// silently no-op). Registering this screen closes that crash risk with a safe
// fallback (redirect to the existing Gallery screen) rather than a full port.
// 'photorejection' in particular shares most of this layout but additionally
// needs the rejected-photo hero + PHOTOSTATUSARRAY reason lookup — still
// unported, still falling through to the Gallery fallback, unchanged here.

import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import ButtonRevamp from '../../components/button-revamp/ButtonRevamp'
import CdnSvg from '../../components/cdn-svg/CdnSvg'
import { Colors } from '../../constants/colors'
import { CDN_IMG, CDN_SVG } from '../../constants/cdn'
import { StorageKeys as SK } from '../../constants/storage.keys'
import { getItem } from '../../service/storageService'
import { getSessionValue } from '../../service/registrationService'
import { fetchPhotoGuidelines, type PhotoGuidelines } from '../../service/photoValidationService'
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

type Props = { navigation: any; route: any }

export default function AddPhotoIntermediateScreen({ navigation, route }: Props) {
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()
  const page = route?.params?.page ?? 'ADDPHOTO'
  // Angular's own `frm_page` query param (guidelinePageRedirection()).
  const frmPage = route?.params?.frm_page ?? 'edit-profile'

  const [freeContactCnt, setFreeContactCnt] = useState('10')
  const [freeContactDays, setFreeContactDays] = useState('30')

  // ── showguidelines state ──
  const [guidelines, setGuidelines] = useState<PhotoGuidelines | null>(null)
  const [guidelinesLoading, setGuidelinesLoading] = useState(page === 'showguidelines')
  // Angular: `LOGINGENDER == 'M' ? guidelines?.MIMG : guidelines?.FIMG` — the
  // illustration grid is gendered. Stored as 'M'/'F' (see utils/avatar.ts).
  const [isMale, setIsMale] = useState(true)

  useEffect(() => {
    if (page !== 'showguidelines') return
    let cancelled = false
    Promise.all([fetchPhotoGuidelines(), getItem(SK.User.LOGIN_GENDER)]).then(([data, gender]) => {
      if (cancelled) return
      setGuidelines(data)
      setIsMale(gender !== 'F')
      setGuidelinesLoading(false)
    })
    return () => { cancelled = true }
  }, [page])

  useEffect(() => {
    if (page !== 'CONGRATS') return
    getSessionValue('FEMALEFREECONACT').then((data: any) => {
      if (data?.AllowedContacts) setFreeContactCnt(String(data.AllowedContacts))
      if (data?.Expirydays)      setFreeContactDays(String(data.Expirydays))
    })
  }, [page])

  // ─── showguidelines ───────────────────────────────────────────────────────
  // Angular: addphoto-intermediate.page.html:290-377, the
  // `['photorejection','showguidelines'].includes(showPageType)` grid plus its
  // own <ion-footer>. Scrolling body + pinned footer CTA, same as there.
  if (page === 'showguidelines') {
    // Angular's photoRejectionClose() routes by frm_page and defaults to
    // /edit-profile; goBack() is the same destination for every caller we have.
    const close = () => navigation.goBack()
    // Angular: callNative('registrationAddPhoto') — hands off to the native
    // photo picker. Here the picker lives on the screen the user came from, so
    // the flag is passed back to Edit Profile, which opens it on focus.
    const continueToUpload = () => {
      if (frmPage === 'edit-profile') navigation.navigate('EditProfile', { openPhotoPicker: true })
      else navigation.goBack()
    }

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
            {/* Angular: `heading3-semibold-16 black-color` */}
            <Text style={g.title}>{guidelines?.title || 'Photo Guidelines'}</Text>
            {/* Angular: `body2-regular-14 color-585858 mt-8` */}
            <Text style={g.note}>
              {guidelines?.note || 'The following types of photos will be rejected'}
            </Text>

            {/* Angular: `<ion-col size="4" class="padd0 mt-12" *ngFor=…>` —
                a 3-up grid, each cell 12px above its row. */}
            <View style={g.grid}>
              {(guidelines?.items ?? []).map((item, i) => (
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
      </View>
    )
  }

  // Not the CONGRATS variant — see SCOPE note above.
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
})
