import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Pressable,
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

type Props = { navigation: any }

// Reason KEY maps to Angular's REASON field (1-5)
const REASON_KEYS = ['1', '2', '3', '4', '5'] as const
type ReasonKey = typeof REASON_KEYS[number]

// ─── RadioCard ────────────────────────────────────────────────────────────────

interface RadioCardProps {
  label: string
  selected: boolean
  onPress: () => void
}

function RadioCard({ label, selected, onPress }: RadioCardProps) {
  return (
    <Pressable
      style={[s.card, selected ? s.cardSelected : s.cardUnselected]}
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
    >
      <Text style={[s.cardLabel, selected && s.cardLabelSelected]}>{label}</Text>
      <View style={s.radioOuter}>
        <View style={[s.radioRing, selected ? s.radioRingSelected : s.radioRingUnselected]}>
          {selected && <View style={s.radioDot} />}
        </View>
      </View>
    </Pressable>
  )
}

// ─── DeleteProfileScreen ──────────────────────────────────────────────────────

export default function DeleteProfileScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets()
  const { t } = useTranslation()

  const [selectedReason, setSelectedReason] = useState<ReasonKey>('1')

  function handleNext() {
    // Angular landingDetails.REASON maps:
    //   1 (Marriage fixed)       → page 2 (MRGFIXEDREASON) — same for 5 (Other reasons)
    //   2 (Already married)      → page 4 (HIDDENDAYS)
    //   3 (Want to take a break) → page 5 (UNSATISFACTORYREASON)
    //   4 (Unsatisfactory)       → page 7 (OTHERREASONTXT)
    if (selectedReason === '1' || selectedReason === '5') {
      navigation.navigate('DeleteProfileMrgReason', { reason: selectedReason })
    } else {
      // TODO: wire remaining flows one by one
      navigation.navigate('DeleteProfileMrgReason', { reason: selectedReason })
    }
  }

  const reasons: { key: ReasonKey; label: string }[] = REASON_KEYS.map(k => ({
    key: k,
    label: t(`DELETE_PROFILE.REASON_${k}`),
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

      {/* Radio option list */}
      <View style={s.list}>
        {reasons.map(({ key, label }) => (
          <RadioCard
            key={key}
            label={label}
            selected={selectedReason === key}
            onPress={() => setSelectedReason(key)}
          />
        ))}
      </View>

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

  // ── List ──
  list: {
    flex:              1,
    paddingHorizontal: 24,
    paddingTop:        24,
    gap:               12,
  },

  // ── Radio cards ──
  card: {
    height:         64,
    borderRadius:   8,
    borderWidth:    1,
    flexDirection:  'row',
    alignItems:     'center',
    paddingLeft:    16,
    paddingRight:   4,
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
  },
})
