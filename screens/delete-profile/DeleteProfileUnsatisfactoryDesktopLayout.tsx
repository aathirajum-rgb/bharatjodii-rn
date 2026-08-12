// Desktop layout for "Please select the reasons for your unsatisfactory
// experience" (Figma "Jodii Desktop - Registration",
// UaPAN9aG6MfZf6CRpwXf1L, node 665:99420 — checkbox list — and node
// 665:100756 — "Other reasons" checked, showing the textarea + support
// phone). Purely presentational — DeleteProfileUnsatisfactoryScreen.tsx
// owns all state/handlers.
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import DesktopPageShell from '../../components/desktop-page-shell/DesktopPageShell'
import CdnSvg from '../../components/cdn-svg/CdnSvg'
import ButtonRevamp from '../../components/button-revamp/ButtonRevamp'
import { Colors } from '../../constants/colors'
import { CDN_REACT } from '../../constants/cdn'
import type { FooterTab } from '../../components/app-footer/AppFooter'

const ICON_PHONE = CDN_REACT + '/call_icon.svg'

export interface DeleteProfileUnsatisfactoryDesktopLayoutProps {
  navigation: any
  userName:   string
  onTabPress: (tab: FooterTab) => void

  options:           Array<{ KEY: string; VALUE: string; checked?: boolean }>
  onToggleOption:    (key: string) => void
  isOtherSelected:   boolean
  concernText:       string
  onChangeConcernText: (text: string) => void
  customerCare:      string
  canSubmit:         boolean
  submitting:        boolean
  onSubmit:          () => void
}

export default function DeleteProfileUnsatisfactoryDesktopLayout({
  navigation, userName, onTabPress,
  options, onToggleOption, isOtherSelected, concernText, onChangeConcernText,
  customerCare, canSubmit, submitting, onSubmit,
}: DeleteProfileUnsatisfactoryDesktopLayoutProps) {
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
        <Text style={s.cardTitle}>{t('DELETE_PROFILE.UNSATISFACTION_HEADER')}</Text>

        <View style={s.rowsWrap}>
          {options.map(opt => {
            const checked = !!opt.checked
            return (
              <Pressable
                key={opt.KEY}
                style={[s.row, checked && s.rowSelected]}
                onPress={() => onToggleOption(opt.KEY)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked }}
              >
                <Text style={[s.rowLabel, checked && s.rowLabelSelected]}>{opt.VALUE}</Text>
                <View style={[s.checkbox, checked && s.checkboxSelected]}>
                  {checked && <Text style={s.checkmark}>✓</Text>}
                </View>
              </Pressable>
            )
          })}
        </View>

        {isOtherSelected && (
          <View style={s.concernSection}>
            <Text style={s.concernTitle}>{t('DELETE_PROFILE.CONCERN_TITLE')}</Text>
            <TextInput
              style={s.concernInput}
              value={concernText}
              onChangeText={onChangeConcernText}
              placeholder={t('DELETE_PROFILE.TYPE_CONCERN')}
              placeholderTextColor="#b0b0b0"
              multiline
              numberOfLines={5}
              textAlignVertical="top"
              maxLength={500}
            />
          </View>
        )}

        {!!customerCare && (
          <View style={s.supportSection}>
            <Text style={s.supportText}>{t('DELETE_PROFILE.CONTACT_SUPPORT_MSG')}</Text>
            <Pressable style={s.phoneRow} onPress={() => Linking.openURL(`tel:${customerCare}`)} accessibilityRole="link">
              <CdnSvg uri={ICON_PHONE} width={16} height={16} />
              <Text style={s.phoneText}>{customerCare}</Text>
            </Pressable>
          </View>
        )}

        {submitting ? (
          <View style={s.submitBtnLoading}><ActivityIndicator color={Colors.white} size="small" /></View>
        ) : (
          <ButtonRevamp label={t('DELETE_PROFILE.SUBMIT_CTA')} variant="primary" disabled={!canSubmit} onPress={onSubmit} style={s.submitBtn} />
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
    elevation: 4, alignItems: 'center',
  },
  cardTitle: { alignSelf: 'stretch', fontFamily: 'Poppins-SemiBold', fontSize: 18, color: Colors.black, marginBottom: 24 },

  rowsWrap: { alignSelf: 'stretch', gap: 12 },
  row: {
    minHeight: 64, borderRadius: 8, borderWidth: 1, borderColor: '#e6e6e6',
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 16,
  },
  rowSelected: { borderColor: PRIMARY, backgroundColor: 'rgba(181,0,51,0.02)' },
  rowLabel: { flex: 1, fontFamily: 'Poppins-Regular', fontSize: 14, color: Colors.black },
  rowLabelSelected: { fontFamily: 'Poppins-Medium' },
  checkbox: {
    width: 24, height: 24, borderRadius: 4, borderWidth: 1.5, borderColor: '#8a8a8a',
    alignItems: 'center', justifyContent: 'center',
  },
  checkboxSelected: { borderColor: PRIMARY, backgroundColor: PRIMARY },
  checkmark: { fontSize: 13, fontWeight: '700', color: Colors.white },

  concernSection: { alignSelf: 'stretch', marginTop: 24 },
  concernTitle: { fontFamily: 'Poppins-SemiBold', fontSize: 18, color: Colors.black, marginBottom: 12 },
  concernInput: {
    height: 140, borderRadius: 8, borderWidth: 1, borderColor: '#e6e6e6',
    paddingHorizontal: 16, paddingVertical: 12, fontFamily: 'Poppins-Regular', fontSize: 14, color: Colors.black,
    backgroundColor: Colors.white,
  },

  supportSection: { alignItems: 'center', gap: 12, marginTop: 24 },
  supportText: { fontFamily: 'Poppins-Regular', fontSize: 14, color: Colors.black, textAlign: 'center' },
  phoneRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  phoneText: { fontFamily: 'Poppins-Medium', fontSize: 12, color: Colors.link, textDecorationLine: 'underline' },

  submitBtn: { width: 312, marginTop: 24 },
  submitBtnLoading: {
    width: 312, marginTop: 24, height: 44, borderRadius: 8, backgroundColor: PRIMARY,
    alignItems: 'center', justifyContent: 'center',
  },
})
