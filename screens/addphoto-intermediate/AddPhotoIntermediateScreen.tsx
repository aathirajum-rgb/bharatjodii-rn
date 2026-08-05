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
// The OTHER page variants (ADDPHOTO/ADDPHOTOPUBLISH) are real Angular targets
// of drService.ts's handleAfterDr() (cases 27/59/60) but were, until this
// screen existed, dangling references to an unregistered route name (would
// throw at runtime, not silently no-op). Registering this screen closes that
// crash risk with a safe fallback (redirect to the existing Gallery screen)
// rather than a full port — building the real native photo-upload flow for
// those two variants is separate, larger work not covered by this pass.

import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Image, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import ButtonRevamp from '../../components/button-revamp/ButtonRevamp'
import { Colors } from '../../constants/colors'
import { CDN_IMG } from '../../constants/cdn'
import { getSessionValue } from '../../service/registrationService'
import { ENavigation } from '../../types/enums/navigation.enum'

const GIFT_IMG = CDN_IMG + 'png/gift-conrats.png'

type Props = { navigation: any; route: any }

export default function AddPhotoIntermediateScreen({ navigation, route }: Props) {
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()
  const page = route?.params?.page ?? 'ADDPHOTO'

  const [freeContactCnt, setFreeContactCnt] = useState('10')
  const [freeContactDays, setFreeContactDays] = useState('30')

  useEffect(() => {
    if (page !== 'CONGRATS') return
    getSessionValue('FEMALEFREECONACT').then((data: any) => {
      if (data?.AllowedContacts) setFreeContactCnt(String(data.AllowedContacts))
      if (data?.Expirydays)      setFreeContactDays(String(data.Expirydays))
    })
  }, [page])

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
  title: { fontSize: 18, fontWeight: '600', color: Colors.black, marginBottom: 12 },
  body: { fontSize: 14, color: Colors.textPrimary, lineHeight: 20, marginBottom: 24 },
  cta: { alignSelf: 'flex-start' },
})
