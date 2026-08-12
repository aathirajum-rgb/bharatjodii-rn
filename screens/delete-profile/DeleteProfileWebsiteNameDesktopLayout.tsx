// Desktop layout for "Please share the below detail" (website/app name)
// (Figma "Jodii Desktop - Registration", UaPAN9aG6MfZf6CRpwXf1L, node
// 665:88650 — a small popup over Settings in the mockup). Rendered as its
// own DesktopPageShell page rather than a floating modal, same call as
// LanguageSelectionDesktopLayout.tsx (reached via navigation.navigate, and
// react-navigation's stack unmounts the previous screen either way).
// Purely presentational — DeleteProfileWebsiteNameScreen.tsx owns state/handlers.
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import DesktopPageShell from '../../components/desktop-page-shell/DesktopPageShell'
import ButtonRevamp from '../../components/button-revamp/ButtonRevamp'
import { Colors } from '../../constants/colors'
import type { FooterTab } from '../../components/app-footer/AppFooter'

export interface DeleteProfileWebsiteNameDesktopLayoutProps {
  navigation: any
  userName:   string
  onTabPress: (tab: FooterTab) => void

  websiteName:        string
  onChangeWebsiteName: (text: string) => void
  canSubmit:          boolean
  submitting:         boolean
  onSubmit:           () => void
}

export default function DeleteProfileWebsiteNameDesktopLayout({
  navigation, userName, onTabPress,
  websiteName, onChangeWebsiteName, canSubmit, submitting, onSubmit,
}: DeleteProfileWebsiteNameDesktopLayoutProps) {
  const { t } = useTranslation()

  return (
    <DesktopPageShell navigation={navigation} userName={userName} activeItem="settings" onTabPress={onTabPress}>
      <View style={s.main}>
        <View style={s.card}>
          <Pressable style={s.closeBtn} onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel="Close" hitSlop={10}>
            <Text style={s.closeX}>✕</Text>
          </Pressable>

          <Text style={s.title}>{t('DELETE_PROFILE.SHARE_DTL_HEADER')}</Text>

          <View style={s.inputWrap}>
            <TextInput
              style={s.input}
              value={websiteName}
              onChangeText={onChangeWebsiteName}
              placeholder={t('DELETE_PROFILE.APP_WEBSITE_NAME')}
              placeholderTextColor="#8a8a8a"
              maxLength={200}
              autoFocus
            />
          </View>

          {submitting ? (
            <View style={s.submitBtnLoading}><ActivityIndicator color={Colors.white} size="small" /></View>
          ) : (
            <ButtonRevamp label={t('DELETE_PROFILE.DELETE_CTA')} variant="primary" fullWidth disabled={!canSubmit} onPress={onSubmit} />
          )}
        </View>
      </View>
    </DesktopPageShell>
  )
}

const s = StyleSheet.create({
  main: { width: 408 },
  card: {
    backgroundColor: Colors.white, borderRadius: 24, padding: 24, gap: 20, alignItems: 'flex-end',
    shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.12, shadowRadius: 8,
    elevation: 4,
  },
  closeBtn: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  closeX: { fontSize: 16, color: Colors.black },
  title: { alignSelf: 'stretch', fontFamily: 'Poppins-SemiBold', fontSize: 18, color: Colors.black },
  inputWrap: {
    alignSelf: 'stretch', height: 48, borderRadius: 8, borderWidth: 1, borderColor: '#b0b0b0',
    paddingHorizontal: 16, justifyContent: 'center', backgroundColor: Colors.white,
  },
  input: { fontFamily: 'Poppins-Regular', fontSize: 14, color: Colors.black, padding: 0, margin: 0 },
  submitBtnLoading: {
    alignSelf: 'stretch', height: 44, borderRadius: 8, backgroundColor: '#b50033',
    alignItems: 'center', justifyContent: 'center',
  },
})
