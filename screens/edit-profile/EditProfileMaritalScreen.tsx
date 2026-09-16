// New screen — Marital status, Children, Physical status. None of these
// three fields exist in any current Edit Profile group screen, even though
// the save plumbing (FIELD_TYPE_CODE + EditProfileInfo) already supports
// them. Modeled on ProfessionalDetailsScreen.tsx's "three independent
// SelectField rows, one Submit" shape — no cascading dependency between
// these fields beyond Children's visibility rule.
//
// Children only shown when maritalStatus != '1' ("Never married") — mirrors
// Angular and the existing desktop-onboarding precedent
// (PersonalReligiousDesktopStep.tsx's showChildren). If the user switches to
// "Never married" after previously having a children value on file, Submit
// sends an explicit empty value to clear it server-side rather than silently
// keeping a stale hidden selection.

import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Colors } from '../../constants/colors'
import { Fonts, FontSize } from '../../src/theme/fonts'
import { CDN_REACT } from '../../constants/cdn'
import { StorageKeys as SK } from '../../constants/storage.keys'
import { getItem } from '../../service/storageService'
import { fetchEditProfileInfo, submitFieldChanges, type FieldChange } from '../../service/editProfileService'
import { CHILDREN_OPTIONS, fetchMaritalStatusOptions, fetchPhysicalStatusOptions } from '../../service/registrationService'
import CdnSvg from '../../components/cdn-svg/CdnSvg'
import SelectField from '../../components/input/SelectField'
import SearchablePicker, { type PickerOption } from '../../components/searchable-picker/SearchablePicker'
import { handleBack } from '../../utils/navigationRef'

const ICON_BACK = CDN_REACT + '/menu_back_arrow.svg'

type Props = { navigation: any }
type Picker = 'marital' | 'children' | 'physicalStatus' | null

export default function EditProfileMaritalScreen({ navigation: _navigation }: Props) {
  const insets = useSafeAreaInsets()
  const { t } = useTranslation()

  const [loading, setLoading]       = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const [maritalStatus, setMaritalStatus]   = useState<PickerOption | null>(null)
  const [noOfChildren, setNoOfChildren]     = useState<PickerOption | null>(null)
  const [physicalStatus, setPhysicalStatus] = useState<PickerOption | null>(null)

  const [original, setOriginal] = useState<{
    maritalStatus?: string | undefined
    noOfChildren?:  string | undefined
    physicalStatus?: string | undefined
  }>({})

  const [maritalStatusOptions, setMaritalStatusOptions]   = useState<PickerOption[]>([])
  const [physicalStatusOptions, setPhysicalStatusOptions] = useState<PickerOption[]>([])

  const [activePicker, setActivePicker] = useState<Picker>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const info = await fetchEditProfileInfo()
    if (!info) { setLoading(false); return }

    setOriginal({
      maritalStatus: info.maritalStatus, noOfChildren: info.noOfChildren, physicalStatus: info.physicalStatus,
    })

    const gender = info.gender ?? (await getItem(SK.User.LOGIN_GENDER)) ?? '1'
    const [maritalList, physicalList] = await Promise.all([
      fetchMaritalStatusOptions(gender),
      fetchPhysicalStatusOptions(),
    ])
    setMaritalStatusOptions(maritalList)
    setPhysicalStatusOptions(physicalList)
    setMaritalStatus(maritalList.find(o => o.key === info.maritalStatus) ?? null)
    setNoOfChildren(CHILDREN_OPTIONS.find(o => o.key === info.noOfChildren) ?? null)
    setPhysicalStatus(physicalList.find(o => o.key === info.physicalStatus) ?? null)

    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  function handleSelectMaritalStatus(opt: PickerOption) {
    setMaritalStatus(opt)
    setActivePicker(null)
    if (opt.key === '1') setNoOfChildren(null)
  }

  const showChildren = !!maritalStatus && maritalStatus.key !== '1'

  async function handleSubmit() {
    if (submitting) return
    setSubmitting(true)

    const changes: FieldChange[] = []
    if (maritalStatus && maritalStatus.key !== original.maritalStatus) {
      changes.push({ field: 'MARITALSTATUS', value: maritalStatus.key, existingValue: original.maritalStatus })
    }
    if (showChildren) {
      if (noOfChildren && noOfChildren.key !== original.noOfChildren) {
        changes.push({ field: 'NOOFCHILDREN', value: noOfChildren.key, existingValue: original.noOfChildren })
      }
    } else if (original.noOfChildren) {
      changes.push({ field: 'NOOFCHILDREN', value: '', existingValue: original.noOfChildren })
    }
    if (physicalStatus && physicalStatus.key !== original.physicalStatus) {
      changes.push({ field: 'PHYSICALSTATUS', value: physicalStatus.key, existingValue: original.physicalStatus })
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
        <Text style={s.heading}>{t('EDITPROFILE.BASIC_DETAILS')}</Text>

        <SelectField
          label={t('EDITPROFILE.MARITALSTATUS')}
          value={maritalStatus?.label}
          placeholder={t('EDITPROFILE.ADD_DETAILS_TXT')}
          onPress={() => setActivePicker('marital')}
        />
        {showChildren && (
          <SelectField
            label={t('EDITPROFILE.CHILDREN')}
            value={noOfChildren?.label}
            placeholder={t('EDITPROFILE.ADD_DETAILS_TXT')}
            onPress={() => setActivePicker('children')}
          />
        )}
        <SelectField
          label={t('EDITPROFILE.PHYSICALSTATUS')}
          value={physicalStatus?.label}
          placeholder={t('EDITPROFILE.ADD_DETAILS_TXT')}
          onPress={() => setActivePicker('physicalStatus')}
        />

        <Pressable style={s.submitBtn} onPress={handleSubmit} disabled={submitting}>
          {submitting ? <ActivityIndicator color={Colors.white} /> : <Text style={s.submitBtnText}>{t('GENERAL.SUBMIT')}</Text>}
        </Pressable>
      </ScrollView>

      <SearchablePicker
        visible={activePicker === 'marital'}
        title={t('EDITPROFILE.MARITALSTATUS')}
        placeholder="Search..."
        options={maritalStatusOptions}
        selectedKey={maritalStatus?.key}
        onSelect={handleSelectMaritalStatus}
        onClose={() => setActivePicker(null)}
      />
      <SearchablePicker
        visible={activePicker === 'children'}
        title={t('EDITPROFILE.CHILDREN')}
        placeholder=""
        options={CHILDREN_OPTIONS}
        selectedKey={noOfChildren?.key}
        onSelect={opt => { setNoOfChildren(opt); setActivePicker(null) }}
        onClose={() => setActivePicker(null)}
      />
      <SearchablePicker
        visible={activePicker === 'physicalStatus'}
        title={t('EDITPROFILE.PHYSICALSTATUS')}
        placeholder="Search..."
        options={physicalStatusOptions}
        selectedKey={physicalStatus?.key}
        onSelect={opt => { setPhysicalStatus(opt); setActivePicker(null) }}
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
