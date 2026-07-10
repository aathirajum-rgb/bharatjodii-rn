import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Colors } from '../../constants/colors'
import { CDN_REACT } from '../../constants/cdn'
import CdnSvg from '../../components/cdn-svg/CdnSvg'
import ButtonRevamp from '../../components/button-revamp/ButtonRevamp'

// ─── CDN ──────────────────────────────────────────────────────────────────────

const R = CDN_REACT + '/'

const ICON = {
  back: R + 'menu_back_arrow.svg',
}

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = { navigation: any; route: any }

// MRGFIXEDREASON KEYs (Angular page 2)
const MRG_KEYS = ['1', '2', '3'] as const
type MrgKey = typeof MRG_KEYS[number]

// ─── RadioCard ────────────────────────────────────────────────────────────────

interface RadioCardProps {
  label:    string
  selected: boolean
  onPress:  () => void
}

function RadioCard({ label, selected, onPress }: RadioCardProps) {
  return (
    <Pressable
      style={[s.card, selected ? s.cardSelected : s.cardUnselected]}
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
    >
      <Text style={[s.cardLabel, selected && s.cardLabelSelected]} numberOfLines={2}>
        {label}
      </Text>
      <View style={s.radioOuter}>
        <View style={[s.radioRing, selected ? s.radioRingSelected : s.radioRingUnselected]}>
          {selected && <View style={s.radioDot} />}
        </View>
      </View>
    </Pressable>
  )
}

// ─── DeleteProfileMrgReasonScreen ─────────────────────────────────────────────

export default function DeleteProfileMrgReasonScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets()
  const { t }  = useTranslation()

  const [selectedMrgReason, setSelectedMrgReason] = useState<MrgKey>('1')

  function handleNext() {
    // Angular landingDetails.MRGFIXEDREASON maps:
    //   '1' (Found on Jodii)           → page 3 (partner name + marriage date)
    //   '2' (Found on another website) → page 10 (enter website/app name)
    //   '3' (Found from other sources) → callDeleteAPI('2') — directly deletes profile
    if (selectedMrgReason === '1') {
      navigation.navigate('DeleteProfileShareDetails', {
        reason:    route.params?.reason ?? '1',
        mrgReason: '1',
      })
    } else if (selectedMrgReason === '3') {
      // Angular: callDeleteAPI('2') — directly deletes with TYPE=2
      Alert.alert('Delete Profile', 'Direct delete — coming soon')
    } else {
      // option '2': website/app name screen — TODO
      Alert.alert('Next', 'Website/app name screen — coming soon')
    }
  }

  const options: { key: MrgKey; label: string }[] = MRG_KEYS.map(k => ({
    key:   k,
    label: t(`DELETE_PROFILE.MRG_REASON_${k}`),
  }))

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

      {/* Content */}
      <ScrollView
        style={s.flex1}
        contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Congratulations! */}
        <Text style={s.congratsTitle}>{t('DELETE_PROFILE.CONGRAT_HEADER')}</Text>

        {/* Sub-text */}
        <Text style={s.congratsSub}>{t('DELETE_PROFILE.CONGRAT_CONTENT')}</Text>

        {/* "How did you find your partner?" */}
        <Text style={s.sectionTitle}>{t('DELETE_PROFILE.CONGRAT_SUB_HEADER')}</Text>

        {/* Radio cards */}
        <View style={s.radioList}>
          {options.map(({ key, label }) => (
            <RadioCard
              key={key}
              label={label}
              selected={selectedMrgReason === key}
              onPress={() => setSelectedMrgReason(key)}
            />
          ))}
        </View>
      </ScrollView>

      {/* Next CTA — fixed at bottom */}
      <View style={[s.footer, { paddingBottom: insets.bottom + 16 }]}>
        <ButtonRevamp
          label={t('DELETE_PROFILE.NEXT_CTA')}
          variant="primary"
          fullWidth
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

  // ── Content ──
  content: {
    paddingHorizontal: 24,
    paddingTop:        24,
  },

  congratsTitle: {
    fontSize:   24,
    fontWeight: '600',
    color:      '#000000',
  },
  congratsSub: {
    fontSize:   14,
    fontWeight: '400',
    color:      '#000000',
    marginTop:  8,
    lineHeight: 20,
  },
  sectionTitle: {
    fontSize:   18,
    fontWeight: '600',
    color:      '#000000',
    marginTop:  24,
  },

  // ── Radio list ──
  radioList: {
    marginTop: 16,
    gap:       12,
  },

  // ── Radio cards ──
  card: {
    minHeight:      64,
    borderRadius:   8,
    borderWidth:    1,
    flexDirection:  'row',
    alignItems:     'center',
    paddingLeft:    16,
    paddingRight:   4,
    paddingVertical: 12,
    gap:            16,
  },
  cardUnselected: {
    borderColor:     '#b0b0b0',
    backgroundColor: Colors.white,
  },
  cardSelected: {
    borderColor:     PRIMARY,
    backgroundColor: 'rgba(181,0,51,0.02)',
  },
  cardLabel: {
    flex:       1,
    fontSize:   14,
    fontWeight: '400',
    color:      '#000000',
    lineHeight: 20,
  },
  cardLabelSelected: {
    fontWeight: '500',
  },

  // ── Radio button ──
  radioOuter: {
    width:          44,
    height:         44,
    alignItems:     'center',
    justifyContent: 'center',
    flexShrink:     0,
  },
  radioRing: {
    width:          24,
    height:         24,
    borderRadius:   12,
    borderWidth:    1.5,
    alignItems:     'center',
    justifyContent: 'center',
  },
  radioRingUnselected: {
    borderColor: '#8a8a8a',
  },
  radioRingSelected: {
    borderColor: PRIMARY,
  },
  radioDot: {
    width:           12,
    height:          12,
    borderRadius:    6,
    backgroundColor: PRIMARY,
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
