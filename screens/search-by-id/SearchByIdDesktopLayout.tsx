// Desktop layout for Search Profile by ID (Figma "Jodii Desktop -
// Registration", node 659:15598). Purely presentational — SearchByIdScreen.tsx
// owns all state/handlers (id, error, loading, handleSubmit) and passes them
// down, same split as every other desktop layout in this app.
import { useTranslation } from 'react-i18next'
import { StyleSheet, Text, View } from 'react-native'
import DesktopPageShell from '../../components/desktop-page-shell/DesktopPageShell'
import FloatingLabelInput from '../../components/input/FloatingLabelInput'
import ButtonRevamp from '../../components/button-revamp/ButtonRevamp'
import { Colors } from '../../constants/colors'
import type { FooterTab } from '../../components/app-footer/AppFooter'

export interface SearchByIdDesktopLayoutProps {
  navigation:  any
  userName:    string
  id:          string
  error?:      string | undefined
  loading:     boolean
  canSubmit:   boolean
  onChangeId:  (text: string) => void
  onSubmit:    () => void
  onTabPress:  (tab: FooterTab) => void
}

export default function SearchByIdDesktopLayout({
  navigation, userName, id, error, loading, canSubmit, onChangeId, onSubmit, onTabPress,
}: SearchByIdDesktopLayoutProps) {
  const { t } = useTranslation()

  return (
    <DesktopPageShell navigation={navigation} userName={userName} activeItem="searchById" onTabPress={onTabPress}>
      <View style={s.main}>
        <Text style={s.pageTitle}>{t('SEARCH.SEARCH_BY_ID')}</Text>

        <View style={s.card}>
          <Text style={s.heading}>{t('SEARCH.SEARCH_ID_CONTENT')}</Text>

          <View style={s.row}>
            <FloatingLabelInput
              label={t('MENU.SUBMENU_2_4')}
              value={id}
              onChangeText={onChangeId}
              errorMessage={error}
              variant="id"
              style={s.input}
            />
            <ButtonRevamp
              label={t('SEARCH.SUBMIT')}
              variant="primary"
              disabled={!canSubmit}
              loading={loading}
              onPress={onSubmit}
              style={s.submitBtn}
            />
          </View>
        </View>
      </View>
    </DesktopPageShell>
  )
}

const s = StyleSheet.create({
  main: { width: 700 },
  pageTitle: { fontFamily: 'Poppins-SemiBold', fontSize: 20, color: Colors.textDark, marginBottom: 16 },

  card: {
    backgroundColor: Colors.surface, borderRadius: 12, borderWidth: 1, borderColor: Colors.borderSubtle,
    padding: 24,
  },
  heading: { fontFamily: 'Poppins-SemiBold', fontSize: 15, color: Colors.textDark, marginBottom: 16 },

  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 16 },
  input: { flex: 1, marginBottom: 0 },
  submitBtn: { width: 160 },
})
