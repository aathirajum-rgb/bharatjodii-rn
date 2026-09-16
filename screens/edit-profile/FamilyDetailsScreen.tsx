// New screen — same rationale as the other Edit Profile group screens.
// Simpler than most: Brothers and Sisters each have their own real TYPE code
// in Angular's editProfileUpdateObj (16 and 17), so — unlike Drinking/Smoking
// habits — both fields here have a genuine, working save path.

import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Colors } from '../../constants/colors'
import { Fonts, FontSize } from '../../src/theme/fonts'
import { CDN_REACT } from '../../constants/cdn'
import { fetchEditProfileInfo, submitFieldChanges, type FieldChange } from '../../service/editProfileService'
import { fetchFamilyOptions } from '../../service/registrationService'
import CdnSvg from '../../components/cdn-svg/CdnSvg'
import SelectField from '../../components/input/SelectField'
import SearchablePicker, { type PickerOption } from '../../components/searchable-picker/SearchablePicker'
import { handleBack } from '../../utils/navigationRef'

const ICON_BACK = CDN_REACT + '/menu_back_arrow.svg'

type Props = { navigation: any }
type Picker = 'brothers' | 'sisters' | null

export default function FamilyDetailsScreen({ navigation: _navigation }: Props) {
  const insets = useSafeAreaInsets()
  const { t } = useTranslation()

  const [loading, setLoading]       = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const [brothers, setBrothers] = useState<PickerOption | null>(null)
  const [sisters, setSisters]   = useState<PickerOption | null>(null)

  const [original, setOriginal] = useState<{
    brothers?: string | undefined
    sisters?:  string | undefined
  }>({})

  const [brothersOptions, setBrothersOptions] = useState<PickerOption[]>([])
  const [sistersOptions, setSistersOptions]   = useState<PickerOption[]>([])

  const [activePicker, setActivePicker] = useState<Picker>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const info = await fetchEditProfileInfo()
    if (!info) { setLoading(false); return }

    setOriginal({ brothers: info.brothers, sisters: info.sisters })

    const { brothers: brothersList, sisters: sistersList } = await fetchFamilyOptions()
    setBrothersOptions(brothersList)
    setSistersOptions(sistersList)
    setBrothers(brothersList.find(o => o.key === info.brothers) ?? null)
    setSisters(sistersList.find(o => o.key === info.sisters) ?? null)

    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function handleSubmit() {
    if (submitting) return
    setSubmitting(true)

    const changes: FieldChange[] = []
    if (brothers && brothers.key !== original.brothers) {
      changes.push({ field: 'BROTHERS', value: brothers.key, existingValue: original.brothers })
    }
    if (sisters && sisters.key !== original.sisters) {
      changes.push({ field: 'SISTERS', value: sisters.key, existingValue: original.sisters })
    }

    if (changes.length === 0) {
      setSubmitting(false)
      handleBack()
      return
    }

    const result = await submitFieldChanges(changes)
    setSubmitting(false)

    if (result.failed.length > 0) {
      Alert.alert(
        'Some changes could not be saved',
        `${result.succeeded.length} saved, ${result.failed.length} failed: ${result.failed.join(', ')}`,
      )
      return
    }
    handleBack()
  }

  if (loading) {
    return (
      <View style={[s.screen, s.center, { paddingTop: insets.top }]}>
        <ActivityIndicator color={Colors.primaryDark} size="large" />
      </View>
    )
  }

  return (
    <View style={[s.screen, { paddingTop: insets.top }]}>
      <View style={s.header}>
        <Pressable style={s.backBtn} onPress={() => handleBack()} accessibilityRole="button" accessibilityLabel="Back">
          <CdnSvg uri={ICON_BACK} width={24} height={24} />
        </Pressable>
        <Text style={s.headerTitle} numberOfLines={1}>{t('EDITPROFILE.EDIT_PROFILE')}</Text>
      </View>

      <ScrollView contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 16 }]} showsVerticalScrollIndicator={false}>
        <Text style={s.heading}>{t('EDITPROFILE.FAMILYDETAILS')}</Text>

        <SelectField label={t('EDITPROFILE.BROTHERS')} value={brothers?.label} onPress={() => setActivePicker('brothers')} />
        <SelectField label={t('EDITPROFILE.SISTERS')} value={sisters?.label} onPress={() => setActivePicker('sisters')} />

        <Pressable style={s.submitBtn} onPress={handleSubmit} disabled={submitting}>
          {submitting ? <ActivityIndicator color={Colors.white} /> : <Text style={s.submitBtnText}>{t('GENERAL.SUBMIT')}</Text>}
        </Pressable>
      </ScrollView>

      <SearchablePicker
        visible={activePicker === 'brothers'}
        title={t('EDITPROFILE.BROTHERS')}
        placeholder="Search..."
        options={brothersOptions}
        selectedKey={brothers?.key}
        onSelect={opt => { setBrothers(opt); setActivePicker(null) }}
        onClose={() => setActivePicker(null)}
      />
      <SearchablePicker
        visible={activePicker === 'sisters'}
        title={t('EDITPROFILE.SISTERS')}
        placeholder="Search..."
        options={sistersOptions}
        selectedKey={sisters?.key}
        onSelect={opt => { setSisters(opt); setActivePicker(null) }}
        onClose={() => setActivePicker(null)}
      />
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
  // App-wide screen-header convention (16/Medium/#333333), not Angular's own
  // edit-profile header (`heading1-semibold-20 black-color`) — kept so this
  // screen's header matches every other stack screen.
  headerTitle: {
    flex: 1, fontSize: FontSize.font16, fontFamily: Fonts.poppinsMedium,
    color: '#333333', marginLeft: 6, marginRight: 16,
  },

  content: { paddingHorizontal: 24, paddingTop: 32 },
  // Same section heading as the Edit Profile hub's section titles — Angular:
  // `heading-03-bold-20 color-333333` (edit-profile.page.html:335, 670, 896,
  // 971) = var(--font20) + var(--heading-03-*-Bold) (Poppins-Bold) + #333333.
  heading: {
    fontSize: FontSize.font20, fontFamily: Fonts.poppinsBold,
    color: Colors.textDark, marginBottom: 24,
  },

  submitBtn: {
    height: 44, borderRadius: 8, backgroundColor: Colors.primaryDark,
    alignItems: 'center', justifyContent: 'center', marginTop: 12,
  },
  // Angular primary CTA copy: `primary-cta-jodii body1-medium-14 white-color`
  // = var(--font14) + --english-medium-poppins (Poppins-Medium) + #ffffff.
  submitBtnText: { color: Colors.white, fontSize: FontSize.font14, fontFamily: Fonts.poppinsMedium },
})
