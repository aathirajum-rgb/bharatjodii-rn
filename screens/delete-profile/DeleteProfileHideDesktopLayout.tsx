// Desktop layout for "How long would you like to keep your profile hidden?"
// (Figma "Jodii Desktop - Registration", UaPAN9aG6MfZf6CRpwXf1L, node
// 665:102107). Purely presentational — DeleteProfileHideScreen.tsx owns all
// state/handlers.
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import DesktopPageShell from '../../components/desktop-page-shell/DesktopPageShell'
import ButtonRevamp from '../../components/button-revamp/ButtonRevamp'
import { Colors } from '../../constants/colors'
import type { FooterTab } from '../../components/app-footer/AppFooter'
import { Fonts, SemanticFontsEnglish } from '../../src/theme/fonts'

export interface DeleteProfileHideDesktopLayoutProps {
  navigation: any
  userName:   string
  onTabPress: (tab: FooterTab) => void

  options:        Array<{ KEY: string; VALUE: string }>
  selectedKey:    string
  onSelectKey:    (key: string) => void
  hidingProfile:  boolean
  deletingDirect: boolean
  onHideProfile:  () => void
  onDirectDelete: () => void
}

export default function DeleteProfileHideDesktopLayout({
  navigation, userName, onTabPress,
  options, selectedKey, onSelectKey, hidingProfile, deletingDirect, onHideProfile, onDirectDelete,
}: DeleteProfileHideDesktopLayoutProps) {
  const { t } = useTranslation()
  const isLoading = hidingProfile || deletingDirect

  return (
    <DesktopPageShell navigation={navigation} userName={userName} activeItem="settings" onTabPress={onTabPress}>
      <View style={s.header}>
        <Pressable onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel="Back" hitSlop={8}>
          <Text style={s.backArrow}>←</Text>
        </Pressable>
        <Text style={s.title}>{t('DELETE_PROFILE.HEADER')}</Text>
      </View>

      <View style={s.card}>
        <Text style={s.cardTitle}>{t('DELETE_PROFILE.HIDE_CONTENT')}</Text>

        <View style={s.rowsWrap}>
          {options.map(opt => {
            const isSelected = selectedKey === opt.KEY
            return (
              <Pressable
                key={opt.KEY}
                style={[s.row, isSelected && s.rowSelected]}
                onPress={() => onSelectKey(opt.KEY)}
                accessibilityRole="radio"
                accessibilityState={{ selected: isSelected }}
              >
                <Text style={[s.rowLabel, isSelected && s.rowLabelSelected]}>{opt.VALUE}</Text>
                <View style={[s.radio, isSelected && s.radioSelected]}>
                  {isSelected && <View style={s.radioDot} />}
                </View>
              </Pressable>
            )
          })}
        </View>

        <Pressable style={s.deleteLink} onPress={onDirectDelete} disabled={isLoading} accessibilityRole="button">
          {deletingDirect ? (
            <ActivityIndicator color="#b50033" size="small" />
          ) : (
            <Text style={s.deleteLinkText}>
              {t('DELETE_PROFILE.HIDE_CTA1')}
              <Text style={s.deleteLinkUnderline}>{t('DELETE_PROFILE.HIDE_CTA2')}</Text>
            </Text>
          )}
        </Pressable>

        {hidingProfile ? (
          <View style={s.nextBtnLoading}><ActivityIndicator color={Colors.white} size="small" /></View>
        ) : (
          <ButtonRevamp
            label={t('DELETE_PROFILE.NEXT_CTA')} variant="primary" disabled={!selectedKey || isLoading}
            onPress={onHideProfile} style={s.nextBtn}
          />
        )}
      </View>
    </DesktopPageShell>
  )
}

const PRIMARY = '#b50033'

const s = StyleSheet.create({
  header: { width: 810, flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 24 },
  backArrow: { fontSize: 22, color: Colors.black },
  title: { fontFamily: Fonts.poppinsSemiBold, fontSize: 22, color: Colors.black },

  card: {
    width: 810, backgroundColor: Colors.white, borderRadius: 24, padding: 40,
    shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.12, shadowRadius: 8,
    elevation: 4, alignItems: 'center',
  },
  cardTitle: { alignSelf: 'stretch', fontFamily: Fonts.poppinsSemiBold, fontSize: 18, color: Colors.black, marginBottom: 24 },

  rowsWrap: { alignSelf: 'stretch', gap: 12 },
  row: {
    height: 64, borderRadius: 8, borderWidth: 1, borderColor: '#b0b0b0',
    flexDirection: 'row', alignItems: 'center', paddingLeft: 16, paddingRight: 4, gap: 16,
  },
  rowSelected: { borderColor: PRIMARY, backgroundColor: 'rgba(181,0,51,0.02)' },
  rowLabel: { flex: 1, fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: 14, color: Colors.black },
  rowLabelSelected: { fontFamily: Fonts.poppinsMedium },
  radio: {
    width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, borderColor: '#8a8a8a',
    alignItems: 'center', justifyContent: 'center',
  },
  radioSelected: { borderColor: PRIMARY },
  radioDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: PRIMARY },

  deleteLink: { marginTop: 16, alignItems: 'center', justifyContent: 'center', paddingVertical: 8 },
  deleteLinkText: { fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: 12, color: Colors.black, textAlign: 'center' },
  deleteLinkUnderline: { fontFamily: SemanticFontsEnglish.buttonEnglishMedium, fontSize: 12, color: Colors.link },

  nextBtn: { width: 312, marginTop: 16 },
  nextBtnLoading: {
    width: 312, marginTop: 16, height: 44, borderRadius: 8, backgroundColor: PRIMARY,
    alignItems: 'center', justifyContent: 'center',
  },
})
