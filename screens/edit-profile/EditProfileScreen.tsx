// Angular equivalent: pages/edit-profile/edit-profile.page.ts + .html — a pure
// read-only summary/list page. Nothing is edited inline here; every row exists
// to show the current value and navigate somewhere else. This port follows the
// new Figma design's 3-level flow (see node 2192-9135): this hub screen →
// a per-section "group screen" (Basic/Professional/Religious/etc., each with
// its own Submit) → a picker reusing onboarding's SearchablePicker/
// MultiSelectPicker components.
//
// Scope of THIS file: layout + read-only display only. Row taps currently stub
// with "Coming soon" (matching MenuScreen's established convention for
// not-yet-built destinations) — the group screens are being built one at a
// time as a follow-up, per plan.
//
// Known gaps, flagged rather than silently worked around:
//  - Jodii ID / "Profile created by" / Mobile number rows exist in Angular but
//    were not visible in the Figma frame — omitted until confirmed.
//  - Drinking/Smoking habits have no option-fetching function anywhere in this
//    app yet (only Eating habits does) — their raw stored value is shown as-is
//    rather than resolved to a label, since there's nothing to resolve against.
//  - Photo grid is display-only here — add/reorder/privacy interactions are a
//    separate, later step.

import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Image } from 'expo-image'
import { Colors } from '../../constants/colors'
import { CDN_REACT } from '../../constants/cdn'
import { StorageKeys as SK } from '../../constants/storage.keys'
import { getItem } from '../../service/storageService'
import { managePhotos } from '../../service/profileService'
import { fetchEditProfileInfo, type EditProfileInfo } from '../../service/editProfileService'
import {
  fetchReligionOptions, fetchCasteOptions, fetchOccupationOptions,
  fetchQualificationOptions, fetchMotherTongueOptions,
  fetchEatingHabitOptions, fetchRaasiOptions,
  fetchStarOptions, fetchMonthlyIncomeOptions, fetchPropertyOptions,
  fetchStates, fetchCities,
} from '../../service/registrationService'
import CdnSvg from '../../components/cdn-svg/CdnSvg'
import { useIsDesktopWeb } from '../../hooks/useIsDesktopWeb'
import EditProfileDesktopScreen from './EditProfileDesktopScreen'

const ICON_BACK  = CDN_REACT + '/menu_back_arrow.svg'
const ICON_ARROW = CDN_REACT + '/menu_right_arrow.svg'

type Props = { navigation: any }

type Opt = { key: string; label: string }

function labelFor(list: Opt[], code: string | undefined): string | undefined {
  if (!code) return undefined
  return list.find(o => o.key === code)?.label
}

function labelsFor(list: Opt[], codes: string[] | undefined): string | undefined {
  if (!codes || codes.length === 0) return undefined
  const labels = codes.map(c => labelFor(list, c)).filter(Boolean) as string[]
  return labels.length > 0 ? labels.join(', ') : undefined
}

// ─── Row ──────────────────────────────────────────────────────────────────────

function FieldRow({
  label, value, missingText, onPress, showDivider,
}: {
  label: string
  value?: string | undefined
  missingText?: string | undefined
  onPress: () => void
  showDivider?: boolean | undefined
}) {
  const isMissing = !value && !!missingText
  return (
    <>
      <Pressable style={({ pressed }) => [r.row, pressed && r.rowPressed]} onPress={onPress} accessibilityRole="button">
        <View style={r.rowText}>
          <Text style={r.rowLabel}>{label}</Text>
          {isMissing ? (
            <View style={r.missingRow}>
              <Text style={r.missingBang}>!</Text>
              <Text style={r.missingText}>{missingText}</Text>
            </View>
          ) : (
            <Text style={r.rowValue} numberOfLines={2}>{value ?? '—'}</Text>
          )}
        </View>
        <CdnSvg uri={ICON_ARROW} width={16} height={16} />
      </Pressable>
      {showDivider && <View style={r.rowDivider} />}
    </>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={s.section}>
      <Text style={s.sectionTitle}>{title}</Text>
      <View>{children}</View>
    </View>
  )
}

// ─── EditProfileScreen ────────────────────────────────────────────────────────

export default function EditProfileScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets()
  const { t } = useTranslation()
  const isDesktop = useIsDesktopWeb()

  const [loading, setLoading]   = useState(true)
  const [profile, setProfile]   = useState<EditProfileInfo | null>(null)
  const [photos,  setPhotos]    = useState<any[]>([])
  const [labels,  setLabels]    = useState<Record<string, Opt[]>>({})
  const [ownId,   setOwnId]     = useState('')

  const load = useCallback(async () => {
    const [id, info, photoData] = await Promise.all([
      getItem(SK.Auth.USER_ID),
      fetchEditProfileInfo(),
      managePhotos(),
    ])
    setOwnId(id ?? '')
    setProfile(info)
    setPhotos(photoData.photos)

    if (!info) { setLoading(false); return }

    const [
      religion, occupation, education, motherTongue,
      eatingHabit, raasi, income, property, states,
    ] = await Promise.all([
      fetchReligionOptions(),
      fetchOccupationOptions(),
      fetchQualificationOptions(),
      fetchMotherTongueOptions(),
      fetchEatingHabitOptions(),
      fetchRaasiOptions(),
      fetchMonthlyIncomeOptions(),
      fetchPropertyOptions(),
      fetchStates(),
    ])

    const [caste, star, cities, homeCities] = await Promise.all([
      info.religion ? fetchCasteOptions(info.religion, info.motherTongue ?? '') : Promise.resolve([]),
      info.raasi ? fetchStarOptions(info.raasi) : Promise.resolve([]),
      info.state ? fetchCities(info.state) : Promise.resolve([]),
      info.homeState ? fetchCities(info.homeState) : Promise.resolve([]),
    ])

    setLabels({
      religion, occupation, education, motherTongue,
      eatingHabit, raasi, income, property, states,
      caste, star, cities, homeCities,
    })
    setLoading(false)
  }, [])

  useFocusEffect(useCallback(() => { load() }, [load]))

  function stub(label: string) {
    Alert.alert(label, 'Coming soon')
  }

  function openPreview() {
    navigation.navigate('viewProfile', { matriId: ownId, fromPage: 'menu' })
  }

  if (isDesktop) {
    return <EditProfileDesktopScreen navigation={navigation} />
  }

  if (loading || !profile) {
    return (
      <View style={[s.screen, s.center, { paddingTop: insets.top }]}>
        <ActivityIndicator color={Colors.primaryDark} size="large" />
      </View>
    )
  }

  const cityLabel     = labelFor(labels.cities ?? [], profile.city) ?? labelFor(labels.states ?? [], profile.state)
  const homeCityLabel = labelFor(labels.homeCities ?? [], profile.homeCity) ?? labelFor(labels.states ?? [], profile.homeState)
  const propertiesLabel = labelsFor(labels.property ?? [], profile.properties)
  const vehiclesLabel   = labelsFor(labels.property ?? [], profile.vehicles)

  return (
    <View style={[s.screen, { paddingTop: insets.top }]}>
      <View style={s.header}>
        <Pressable style={s.backBtn} onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel="Back">
          <CdnSvg uri={ICON_BACK} width={24} height={24} />
        </Pressable>
        <Text style={s.headerTitle} numberOfLines={1}>{t('EDITPROFILE.EDIT_PROFILE')}</Text>
      </View>

      <ScrollView contentContainerStyle={[s.scrollContent, { paddingBottom: insets.bottom + 24 }]} showsVerticalScrollIndicator={false}>

        {/* ── Photo ── */}
        <View style={s.photoHeaderRow}>
          <Text style={s.sectionTitle}>{t('EDITPROFILE.PHOTOS')}</Text>
          <Pressable onPress={() => stub('Photo privacy')} hitSlop={8}>
            <Text style={s.photoPrivacyLink}>{t('EDITPROFILE.PHOTO_PRIVACY')}</Text>
          </Pressable>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.photoRow} contentContainerStyle={{ gap: 8 }}>
          {photos.map((p, i) => (
            <Pressable key={i} onPress={() => stub('Manage photo')}>
              <Image source={{ uri: p.PHOTOTHUMB || p.PHOTOURL }} style={s.photoThumb} contentFit="cover" />
            </Pressable>
          ))}
          <Pressable style={s.photoAddSlot} onPress={() => stub('Add photo')}>
            <Text style={s.photoAddPlus}>+</Text>
          </Pressable>
        </ScrollView>
        <Text style={s.photoHint}>{t('EDITPROFILE.DRAG_PHOTO')}</Text>

        {/* ── Basic details ── */}
        <Section title={t('EDITPROFILE.BASIC_DETAILS')}>
          <FieldRow label={t('EDITPROFILE.NAME')} value={profile.name} onPress={() => navigation.navigate('EditProfileBasic')} showDivider />
          <FieldRow label={t('EDITPROFILE.AGE')} value={profile.age ? `${profile.age} years old` : undefined} onPress={() => stub('Age')} showDivider />
          <FieldRow label={t('EDITPROFILE.HEIGHT')} value={profile.heightCategory ?? profile.height} onPress={() => stub('Height')} showDivider />
          <FieldRow label={t('EDITPROFILE.MOTHERTONGUE')} value={labelFor(labels.motherTongue ?? [], profile.motherTongue)} onPress={() => navigation.navigate('EditProfileBasic')} showDivider />
          <FieldRow label={t('EDITPROFILE.CURRENT_LOCATION')} value={cityLabel} onPress={() => navigation.navigate('EditProfileBasic')} showDivider />
          <FieldRow label={t('EDITPROFILE.NATIVE_PLACE')} value={homeCityLabel} onPress={() => navigation.navigate('EditProfileBasic')} />
        </Section>

        {/* ── Professional details ── */}
        <Section title="Professional details">
          <FieldRow label={t('EDITPROFILE.EDUCATION')} value={labelFor(labels.education ?? [], profile.education)} onPress={() => navigation.navigate('EditProfileProfessional')} showDivider />
          <FieldRow label={t('EDITPROFILE.OCCUPATION')} value={labelFor(labels.occupation ?? [], profile.occupation)} onPress={() => navigation.navigate('EditProfileProfessional')} showDivider />
          <FieldRow label={t('EDITPROFILE.INCOME')} value={labelFor(labels.income ?? [], profile.income) ?? profile.income} onPress={() => navigation.navigate('EditProfileProfessional')} />
        </Section>

        {/* ── Religious details ── */}
        <Section title={t('EDITPROFILE.RELIGIOUSDETAIL')}>
          <FieldRow label={t('EDITPROFILE.RELIGION')} value={labelFor(labels.religion ?? [], profile.religion)} onPress={() => navigation.navigate('EditProfileReligious')} showDivider />
          <FieldRow label={t('EDITPROFILE.CASTESUB')} value={labelFor(labels.caste ?? [], profile.caste)} onPress={() => navigation.navigate('EditProfileReligious')} showDivider />
          <FieldRow
            label={t('EDITPROFILE.RAASI')}
            value={labelFor(labels.raasi ?? [], profile.raasi)}
            missingText={t('EDITPROFILE.ADDYOURRAASI')}
            onPress={() => navigation.navigate('EditProfileReligious')}
            showDivider
          />
          <FieldRow
            label={t('EDITPROFILE.STAR')}
            value={labelFor(labels.star ?? [], profile.star)}
            missingText={t('EDITPROFILE.ADDYOURSTAR')}
            onPress={() => navigation.navigate('EditProfileReligious')}
            showDivider
          />
          <FieldRow
            label={t('EDITPROFILE.DOSHAM')}
            value={profile.dosham === '1' ? 'Yes' : profile.dosham === '2' ? 'No' : undefined}
            missingText={t('EDITPROFILE.ADDYOURDOSHAM')}
            onPress={() => navigation.navigate('EditProfileReligious')}
            showDivider
          />
          <FieldRow
            label={t('EDITPROFILE.HOROSCOPE')}
            value={profile.horoscopeAvailable ? t('EDITPROFILE.ADDEDON') : undefined}
            missingText={t('EDITPROFILE.ADDYOURHORO')}
            onPress={() => stub('Horoscope')}
          />
        </Section>

        {/* ── Life style details ── */}
        <Section title="Life style details">
          <FieldRow label={t('EDITPROFILE.DRINKING')} value={profile.drinkingHabits} onPress={() => navigation.navigate('EditProfileLifestyle')} showDivider />
          <FieldRow label="Smoking habits" value={profile.smokingHabits} onPress={() => navigation.navigate('EditProfileLifestyle')} showDivider />
          <FieldRow label={t('EDITPROFILE.EATING')} value={labelFor(labels.eatingHabit ?? [], profile.eatingHabits)} onPress={() => navigation.navigate('EditProfileLifestyle')} />
        </Section>

        {/* ── Family details ── */}
        <Section title={t('EDITPROFILE.FAMILYDETAILS')}>
          <FieldRow
            label={t('EDITPROFILE.BROTHERS')}
            value={profile.brothers ? `${profile.brothers} brother${profile.brothers === '1' ? '' : 's'}` : undefined}
            onPress={() => navigation.navigate('EditProfileFamily')}
            showDivider
          />
          <FieldRow
            label={t('EDITPROFILE.SISTERS')}
            value={profile.sisters ? `${profile.sisters} sister${profile.sisters === '1' ? '' : 's'}` : undefined}
            onPress={() => navigation.navigate('EditProfileFamily')}
          />
        </Section>

        {/* ── Property details ── */}
        <Section title="Property details">
          <FieldRow label="Properties owned" value={propertiesLabel} onPress={() => navigation.navigate('EditProfileProperty')} showDivider />
          <FieldRow label="Own Vehicle" value={vehiclesLabel} onPress={() => navigation.navigate('EditProfileProperty')} />
        </Section>

      </ScrollView>

      <View style={[s.footer, { paddingBottom: insets.bottom + 12 }]}>
        <Pressable style={s.previewBtn} onPress={openPreview}>
          <Text style={s.previewBtnText}>{t('EDITPROFILE.PREVIEW')}</Text>
        </Pressable>
      </View>
    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.white },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: {
    height: 56, flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.white,
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 4,
  },
  backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginLeft: 14 },
  headerTitle: { flex: 1, fontSize: 16, fontWeight: '500', color: '#333333', marginLeft: 6, marginRight: 16 },

  scrollContent: { paddingHorizontal: 24, paddingTop: 24 },

  photoHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  photoPrivacyLink: { fontSize: 14, color: Colors.link, textDecorationLine: 'underline' },
  photoRow: { marginTop: 16 },
  photoThumb: { width: 98, height: 98, borderRadius: 8, backgroundColor: Colors.surfaceDim },
  photoAddSlot: {
    width: 98, height: 98, borderRadius: 8, borderWidth: 1, borderStyle: 'dashed', borderColor: Colors.borderSubtle,
    backgroundColor: 'rgba(230,230,230,0.3)', alignItems: 'center', justifyContent: 'center',
  },
  photoAddPlus: { fontSize: 28, color: Colors.textTertiary },
  photoHint: { fontSize: 12, color: '#585858', marginTop: 8 },

  section: { marginTop: 24 },
  sectionTitle: { fontSize: 20, fontWeight: '600', color: Colors.black },

  footer: {
    paddingHorizontal: 24, paddingTop: 12, backgroundColor: Colors.white,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(204,204,204,0.5)',
  },
  previewBtn: { height: 44, borderRadius: 8, backgroundColor: Colors.primaryDark, alignItems: 'center', justifyContent: 'center' },
  previewBtnText: { color: Colors.white, fontSize: 14, fontWeight: '500' },
})

const r = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 20 },
  rowPressed: { opacity: 0.6 },
  rowText: { flex: 1, gap: 8 },
  rowLabel: { fontSize: 14, color: Colors.black },
  rowValue: { fontSize: 14, fontWeight: '500', color: Colors.black },
  rowDivider: { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(204,204,204,0.5)' },

  missingRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  missingBang: {
    width: 16, height: 16, borderRadius: 8, backgroundColor: Colors.primaryDark, color: Colors.white,
    fontSize: 11, fontWeight: '700', textAlign: 'center', lineHeight: 16, overflow: 'hidden',
  },
  missingText: { fontSize: 14, color: Colors.link },
})
