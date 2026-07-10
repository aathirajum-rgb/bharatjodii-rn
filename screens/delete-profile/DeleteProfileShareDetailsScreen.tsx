import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Colors } from '../../constants/colors'
import { CDN_REACT } from '../../constants/cdn'
import CdnSvg from '../../components/cdn-svg/CdnSvg'
import ButtonRevamp from '../../components/button-revamp/ButtonRevamp'

// ─── CDN ──────────────────────────────────────────────────────────────────────

const R = CDN_REACT + '/'

const ICON = {
  back: R + 'menu_back_arrow.svg',
  gift: R + 'share_marrige_details_img.svg',
}

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = { navigation: any; route: any }
type DateChip = 'fixed' | 'not_fixed' | null

// ─── DateChipButton ───────────────────────────────────────────────────────────

interface ChipProps {
  label:    string
  selected: boolean
  onPress:  () => void
}

function DateChipButton({ label, selected, onPress }: ChipProps) {
  return (
    <Pressable
      style={[chip.base, selected ? chip.selected : chip.unselected]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
    >
      <Text style={[chip.label, selected && chip.labelSelected]}>{label}</Text>
    </Pressable>
  )
}

// ─── DeleteProfileShareDetailsScreen ─────────────────────────────────────────

export default function DeleteProfileShareDetailsScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets()
  const { t }  = useTranslation()

  const [partnerName, setPartnerName]   = useState('')
  const [dateChip,    setDateChip]      = useState<DateChip>(null)

  // Next enabled when name ≥ 3 chars AND a chip is selected
  const nextEnabled = partnerName.trim().length >= 3 && dateChip !== null

  const handleNext = useCallback(() => {
    if (!nextEnabled) return
    if (dateChip === 'fixed') {
      // Angular: DATEFIX '1' → navigate to marriage date picker (page 14, then page 3→6)
      Alert.alert('Marriage date fixed', 'Date picker coming soon')
    } else {
      // Angular: DATEFIX '2' → navigate to "Getting married in X months" dropdown
      Alert.alert('Date not yet fixed', 'Month selector coming soon')
    }
  }, [nextEnabled, dateChip])

  return (
    <View style={[s.screen, { paddingTop: insets.top }]}>

      {/* Header */}
      <View style={s.header}>
        <Pressable
          style={s.backBtn}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <CdnSvg uri={ICON.back} width={24} height={24} />
        </Pressable>
        <Text style={s.headerTitle}>{t('DELETE_PROFILE.HEADER')}</Text>
      </View>

      <ScrollView
        style={s.flex1}
        contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >

        {/* ── Gift banner with gradient ── */}
        <LinearGradient
          colors={['#FCEDFF', '#FFFFFF']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={s.banner}
        >
          {/* Text block */}
          <View style={s.bannerText}>
            <Text style={s.bannerLine}>{t('DELETE_PROFILE.SHARE_GIFT_PRE')}</Text>
            <Text>
              <Text style={s.bannerHighlight}>{t('DELETE_PROFILE.SHARE_GIFT_HIGHLIGHT')}</Text>
            </Text>
            <Text style={s.bannerLine}>{t('DELETE_PROFILE.SHARE_GIFT_POST')}</Text>
          </View>

          {/* Gift icon */}
          <View style={s.bannerIcon}>
            <CdnSvg uri={ICON.gift} width={120} height={110} />
          </View>
        </LinearGradient>

        {/* ── Partner name input ── */}
        <View style={s.inputWrap}>
          <TextInput
            style={s.input}
            placeholder={t('DELETE_PROFILE.PARTNER_NAME_PLACEHOLDER')}
            placeholderTextColor="#8a8a8a"
            value={partnerName}
            onChangeText={setPartnerName}
            maxLength={60}
            returnKeyType="done"
          />
          {/* Asterisk overlay in placeholder is handled via placeholder text;
              red asterisk shown separately when input is empty */}
          {!partnerName && (
            <Text style={s.asterisk}> *</Text>
          )}
        </View>

        {/* ── Date chips ── */}
        <View style={s.chipRow}>
          <DateChipButton
            label={t('DELETE_PROFILE.DATE_FIXED_CHIP')}
            selected={dateChip === 'fixed'}
            onPress={() => setDateChip('fixed')}
          />
          <DateChipButton
            label={t('DELETE_PROFILE.DATE_NOT_FIXED_CHIP')}
            selected={dateChip === 'not_fixed'}
            onPress={() => setDateChip('not_fixed')}
          />
        </View>

        {/* ── Date fixed sub-section (stub) ── */}
        {dateChip === 'fixed' && (
          <Pressable
            style={s.datePickerStub}
            onPress={() => Alert.alert('Marriage date', 'Date picker coming soon')}
          >
            <Text style={s.datePickerPlaceholder}>
              {t('DELETE_PROFILE.MARRIAGE_DATE')} <Text style={s.dateAsterisk}>*</Text>
            </Text>
          </Pressable>
        )}

        {/* ── Date not fixed sub-section (stub) ── */}
        {dateChip === 'not_fixed' && (
          <Pressable
            style={s.datePickerStub}
            onPress={() => Alert.alert('Getting married in', 'Month selector coming soon')}
          >
            <Text style={s.datePickerPlaceholder}>{t('DELETE_PROFILE.SELECT_TEXT')}</Text>
          </Pressable>
        )}

      </ScrollView>

      {/* ── Next CTA ── */}
      <View style={[s.footer, { paddingBottom: insets.bottom + 16 }]}>
        <ButtonRevamp
          label={t('DELETE_PROFILE.NEXT_CTA')}
          variant="primary"
          fullWidth
          disabled={!nextEnabled}
          onPress={handleNext}
        />
      </View>

    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const PRIMARY = '#b50033'

const s = StyleSheet.create({
  screen: {
    flex:            1,
    backgroundColor: Colors.white,
  },
  flex1: { flex: 1 },

  // ── Header ──
  header: {
    height:          56,
    flexDirection:   'row',
    alignItems:      'center',
    backgroundColor: Colors.white,
    shadowColor:     '#000',
    shadowOffset:    { width: 0, height: 4 },
    shadowOpacity:   0.08,
    shadowRadius:    8,
    elevation:       4,
  },
  backBtn: {
    width:          44,
    height:         44,
    alignItems:     'center',
    justifyContent: 'center',
    marginLeft:     14,
  },
  headerTitle: {
    fontSize:   16,
    fontWeight: '500',
    color:      '#333333',
    marginLeft: 6,
  },

  // ── Scroll ──
  scroll: {
    paddingHorizontal: 24,
    paddingTop:        0,
  },

  // ── Gift banner ──
  banner: {
    marginHorizontal: -24,
    paddingHorizontal: 24,
    paddingVertical:   24,
    flexDirection:    'row',
    alignItems:       'center',
    minHeight:        150,
  },
  bannerText: {
    flex: 1,
    gap:  2,
  },
  bannerLine: {
    fontSize:   16,
    fontWeight: '400',
    color:      '#000000',
    lineHeight: 24,
  },
  bannerHighlight: {
    fontSize:   16,
    fontWeight: '600',
    color:      '#c9050b',
    lineHeight: 24,
  },
  bannerIcon: {
    width:          130,
    height:         120,
    alignItems:     'center',
    justifyContent: 'center',
    flexShrink:     0,
  },

  // ── Input ──
  inputWrap: {
    marginTop:    24,
    height:       48,
    borderRadius: 8,
    borderWidth:  1,
    borderColor:  '#b0b0b0',
    flexDirection:'row',
    alignItems:   'center',
    paddingHorizontal: 16,
    backgroundColor: Colors.white,
  },
  input: {
    flex:       1,
    fontSize:   14,
    fontWeight: '400',
    color:      '#000000',
    padding:    0,
  },
  asterisk: {
    fontSize:  14,
    color:     '#f11b37',
    lineHeight: 20,
  },

  // ── Chip row ──
  chipRow: {
    flexDirection: 'row',
    gap:           12,
    marginTop:     16,
    flexWrap:      'wrap',
  },

  // ── Date picker stub ──
  datePickerStub: {
    marginTop:    12,
    height:       48,
    borderRadius: 8,
    borderWidth:  1,
    borderColor:  '#b0b0b0',
    paddingHorizontal: 16,
    justifyContent:    'center',
    backgroundColor:   Colors.white,
  },
  datePickerPlaceholder: {
    fontSize:  14,
    color:     '#8a8a8a',
  },
  dateAsterisk: {
    color: '#f11b37',
  },

  // ── Footer ──
  footer: {
    paddingHorizontal: 24,
    paddingTop:        16,
    backgroundColor:   Colors.white,
    shadowColor:       '#000',
    shadowOffset:      { width: 0, height: -2 },
    shadowOpacity:     0.04,
    shadowRadius:      4,
    elevation:         4,
  },
})

// ─── Chip styles ──────────────────────────────────────────────────────────────

const chip = StyleSheet.create({
  base: {
    height:          40,
    paddingHorizontal: 16,
    borderRadius:    20,
    borderWidth:     1,
    alignItems:      'center',
    justifyContent:  'center',
  },
  unselected: {
    borderColor:     '#b0b0b0',
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  selected: {
    borderColor:     PRIMARY,
    backgroundColor: 'rgba(181,0,51,0.06)',
  },
  label: {
    fontSize:   14,
    fontWeight: '400',
    color:      '#000000',
  },
  labelSelected: {
    fontWeight: '600',
    color:      PRIMARY,
  },
})
