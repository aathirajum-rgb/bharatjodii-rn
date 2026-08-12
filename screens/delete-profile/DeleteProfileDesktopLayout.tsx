// Desktop layout for the Delete Profile reason list (Figma "Jodii Desktop -
// Registration", UaPAN9aG6MfZf6CRpwXf1L, node 665:91401) plus the "want a
// break" hide-or-delete offer (node 665:90024, a centered popup here instead
// of mobile's bottom sheet). Purely presentational — DeleteProfileScreen.tsx
// owns all state/handlers, same split every other desktop layout in this app
// uses.
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import DesktopPageShell from '../../components/desktop-page-shell/DesktopPageShell'
import ButtonRevamp from '../../components/button-revamp/ButtonRevamp'
import { Colors } from '../../constants/colors'
import type { FooterTab } from '../../components/app-footer/AppFooter'

export interface DeleteProfileDesktopLayoutProps {
  navigation: any
  userName:   string
  onTabPress: (tab: FooterTab) => void

  reasons:        Array<{ key: string; label: string }>
  selectedReason: string
  onSelectReason: (key: string) => void
  isOtherSelected: boolean
  otherReasonText: string
  onChangeOtherReasonText: (text: string) => void
  submittingOther: boolean
  onNext: () => void

  showBreakOffer:    boolean
  onCloseBreakOffer: () => void
  onHideFromBreak:   () => void
  onDeleteFromBreak: () => void
  deleting:          boolean
}

export default function DeleteProfileDesktopLayout({
  navigation, userName, onTabPress,
  reasons, selectedReason, onSelectReason, isOtherSelected, otherReasonText, onChangeOtherReasonText,
  submittingOther, onNext,
  showBreakOffer, onCloseBreakOffer, onHideFromBreak, onDeleteFromBreak, deleting,
}: DeleteProfileDesktopLayoutProps) {
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
        <Text style={s.cardTitle}>{t('DELETE_PROFILE.REASON_TITLE', 'Please select a reason to delete profile')}</Text>

        <View style={s.rowsWrap}>
          {reasons.map(reason => {
            const isSelected = selectedReason === reason.key
            return (
              <Pressable
                key={reason.key}
                style={[s.row, isSelected && s.rowSelected]}
                onPress={() => onSelectReason(reason.key)}
                accessibilityRole="radio"
                accessibilityState={{ selected: isSelected }}
              >
                <Text style={[s.rowLabel, isSelected && s.rowLabelSelected]}>{reason.label}</Text>
                <View style={[s.radio, isSelected && s.radioSelected]}>
                  {isSelected && <View style={s.radioDot} />}
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
              value={otherReasonText}
              onChangeText={onChangeOtherReasonText}
              placeholder={t('DELETE_PROFILE.TYPE_CONCERN') + '...'}
              placeholderTextColor="#b0b0b0"
              multiline
              numberOfLines={5}
              textAlignVertical="top"
              maxLength={140}
            />
          </View>
        )}

        {submittingOther ? (
          <View style={s.nextBtnLoading}><ActivityIndicator color={Colors.white} size="small" /></View>
        ) : (
          <ButtonRevamp label={t('DELETE_PROFILE.NEXT_CTA')} variant="primary" onPress={onNext} style={s.nextBtn} />
        )}
      </View>

      {/* "Want to take a break" hide-or-delete offer — Figma node 665:90024 */}
      <Modal visible={showBreakOffer} transparent animationType="fade" onRequestClose={onCloseBreakOffer}>
        <Pressable style={s.overlay} onPress={onCloseBreakOffer}>
          <Pressable style={s.offerCard} onPress={() => {}}>
            <Pressable style={s.offerClose} onPress={onCloseBreakOffer} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close">
              <Text style={s.offerCloseX}>✕</Text>
            </Pressable>
            <Text style={s.offerTitle}>{t('DELETE_PROFILE.HEADER')}</Text>
            <Text style={s.offerBody}>{t('DELETE_PROFILE.HIDE_HEADER')}</Text>
            <ButtonRevamp label={t('DELETE_PROFILE.HIDE_CTA')} variant="primary" fullWidth onPress={onHideFromBreak} />
            <Pressable style={s.offerDeleteBtn} onPress={onDeleteFromBreak} disabled={deleting} accessibilityRole="button">
              {deleting ? (
                <ActivityIndicator color="#545454" size="small" />
              ) : (
                <Text style={s.offerDeleteText}>{t('DELETE_PROFILE.NO_DELETE_CTA')}</Text>
              )}
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
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
  cardTitle: { fontFamily: 'Poppins-SemiBold', fontSize: 18, color: Colors.black, marginBottom: 24 },

  rowsWrap: { gap: 12 },
  row: {
    height: 64, borderRadius: 8, borderWidth: 1, borderColor: '#b0b0b0',
    flexDirection: 'row', alignItems: 'center', paddingLeft: 16, paddingRight: 4, gap: 16,
  },
  rowSelected: { borderColor: PRIMARY, backgroundColor: 'rgba(181,0,51,0.02)' },
  rowLabel: { flex: 1, fontFamily: 'Poppins-Regular', fontSize: 14, color: Colors.black },
  rowLabelSelected: { fontFamily: 'Poppins-Medium' },
  radio: {
    width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, borderColor: '#8a8a8a',
    alignItems: 'center', justifyContent: 'center', marginRight: 10,
  },
  radioSelected: { borderColor: PRIMARY },
  radioDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: PRIMARY },

  concernSection: { marginTop: 24 },
  concernTitle: { fontFamily: 'Poppins-SemiBold', fontSize: 18, color: Colors.black, marginBottom: 12 },
  concernInput: {
    minHeight: 120, borderRadius: 8, borderWidth: 1, borderColor: '#e6e6e6',
    paddingHorizontal: 16, paddingVertical: 12, fontFamily: 'Poppins-Regular', fontSize: 14, color: Colors.black,
    backgroundColor: Colors.white,
  },

  nextBtn: { width: 312, alignSelf: 'center', marginTop: 32 },
  nextBtnLoading: {
    width: 312, alignSelf: 'center', marginTop: 32, height: 44, borderRadius: 8,
    backgroundColor: PRIMARY, alignItems: 'center', justifyContent: 'center',
  },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  offerCard: {
    width: 408, backgroundColor: Colors.white, borderRadius: 24, padding: 24, gap: 16, alignItems: 'flex-end',
  },
  offerClose: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  offerCloseX: { fontSize: 16, color: Colors.black },
  offerTitle: {
    alignSelf: 'stretch', fontFamily: 'Poppins-SemiBold', fontSize: 16, color: Colors.black,
  },
  offerBody: {
    alignSelf: 'stretch', fontFamily: 'Poppins-Regular', fontSize: 14, lineHeight: 20, color: '#333333', marginBottom: 8,
  },
  offerDeleteBtn: {
    alignSelf: 'stretch', height: 48, borderRadius: 8, borderWidth: 1, borderColor: '#545454',
    alignItems: 'center', justifyContent: 'center',
  },
  offerDeleteText: { fontFamily: 'Poppins-Regular', fontSize: 14, color: '#545454' },
})
