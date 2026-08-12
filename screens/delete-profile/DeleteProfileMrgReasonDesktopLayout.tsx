// Desktop layout for "How did you find your partner?" (Figma "Jodii Desktop
// - Registration", UaPAN9aG6MfZf6CRpwXf1L, node 665:95412). Purely
// presentational — DeleteProfileMrgReasonScreen.tsx owns all state/handlers.
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import DesktopPageShell from '../../components/desktop-page-shell/DesktopPageShell'
import ButtonRevamp from '../../components/button-revamp/ButtonRevamp'
import { Colors } from '../../constants/colors'
import type { FooterTab } from '../../components/app-footer/AppFooter'

export interface DeleteProfileMrgReasonDesktopLayoutProps {
  navigation: any
  userName:   string
  onTabPress: (tab: FooterTab) => void

  options:        Array<{ key: string; label: string }>
  selectedOption: string
  onSelectOption: (key: string) => void
  isDeleting:     boolean
  onNext:         () => void
  nextLabel:      string
}

export default function DeleteProfileMrgReasonDesktopLayout({
  navigation, userName, onTabPress,
  options, selectedOption, onSelectOption, isDeleting, onNext, nextLabel,
}: DeleteProfileMrgReasonDesktopLayoutProps) {
  const { t } = useTranslation()

  return (
    <DesktopPageShell navigation={navigation} userName={userName} activeItem="settings" onTabPress={onTabPress}>
      <View style={s.header}>
        <Pressable onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel="Back" hitSlop={8}>
          <Text style={s.backArrow}>←</Text>
        </Pressable>
        <Text style={s.title}>{t('DELETE_PROFILE.HEADER')}</Text>
      </View>

      <View style={s.card}>
        <Text style={s.congratsTitle}>{t('DELETE_PROFILE.CONGRAT_HEADER')}</Text>
        <Text style={s.congratsSub}>{t('DELETE_PROFILE.CONGRAT_CONTENT')}</Text>

        <Text style={s.sectionTitle}>{t('DELETE_PROFILE.CONGRAT_SUB_HEADER')}</Text>

        <View style={s.rowsWrap}>
          {options.map(opt => {
            const isSelected = selectedOption === opt.key
            return (
              <Pressable
                key={opt.key}
                style={[s.row, isSelected && s.rowSelected]}
                onPress={() => onSelectOption(opt.key)}
                accessibilityRole="radio"
                accessibilityState={{ selected: isSelected }}
              >
                <Text style={[s.rowLabel, isSelected && s.rowLabelSelected]}>{opt.label}</Text>
                <View style={[s.radio, isSelected && s.radioSelected]}>
                  {isSelected && <View style={s.radioDot} />}
                </View>
              </Pressable>
            )
          })}
        </View>

        {isDeleting ? (
          <View style={s.nextBtnLoading}><ActivityIndicator color={Colors.white} size="small" /></View>
        ) : (
          <ButtonRevamp label={nextLabel} variant="primary" onPress={onNext} style={s.nextBtn} />
        )}
      </View>
    </DesktopPageShell>
  )
}

const PRIMARY = '#b50033'

const s = StyleSheet.create({
  header: { width: 810, flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 24 },
  backArrow: { fontSize: 22, color: Colors.black },
  title: { fontFamily: 'Poppins-SemiBold', fontSize: 22, color: Colors.black },

  card: {
    width: 810, backgroundColor: Colors.white, borderRadius: 24, padding: 40,
    shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.12, shadowRadius: 8,
    elevation: 4,
  },
  congratsTitle: { fontFamily: 'Poppins-SemiBold', fontSize: 24, color: Colors.black },
  congratsSub: { fontFamily: 'Poppins-Regular', fontSize: 14, lineHeight: 20, color: Colors.black, marginTop: 8 },
  sectionTitle: { fontFamily: 'Poppins-SemiBold', fontSize: 18, color: Colors.black, marginTop: 24, marginBottom: 16 },

  rowsWrap: { gap: 12 },
  row: {
    minHeight: 64, borderRadius: 8, borderWidth: 1, borderColor: '#b0b0b0',
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 16,
  },
  rowSelected: { borderColor: PRIMARY, backgroundColor: 'rgba(181,0,51,0.02)' },
  rowLabel: { flex: 1, fontFamily: 'Poppins-Regular', fontSize: 14, color: Colors.black },
  rowLabelSelected: { fontFamily: 'Poppins-Medium' },
  radio: {
    width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, borderColor: '#8a8a8a',
    alignItems: 'center', justifyContent: 'center',
  },
  radioSelected: { borderColor: PRIMARY },
  radioDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: PRIMARY },

  nextBtn: { width: 312, alignSelf: 'center', marginTop: 32 },
  nextBtnLoading: {
    width: 312, alignSelf: 'center', marginTop: 32, height: 44, borderRadius: 8,
    backgroundColor: PRIMARY, alignItems: 'center', justifyContent: 'center',
  },
})
