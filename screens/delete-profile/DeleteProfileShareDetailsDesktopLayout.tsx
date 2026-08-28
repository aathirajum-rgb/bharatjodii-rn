// Desktop layout for "Share your details to receive a special gift" (Figma
// "Jodii Desktop - Registration", UaPAN9aG6MfZf6CRpwXf1L, node 665:103445 —
// marriage-date-fixed state — and node 665:104812 — date-not-fixed state).
// Purely presentational — DeleteProfileShareDetailsScreen.tsx owns all
// state/handlers. Reuses DesktopSelectField (already established for this
// exact "small outlined dropdown" look elsewhere in the app) instead of
// mobile's own measureInWindow-positioned inline dropdown — much simpler on
// web, where there's no keyboard/viewport-clipping concern to route around.
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import DesktopPageShell from '../../components/desktop-page-shell/DesktopPageShell'
import DesktopSelectField from '../../components/desktop-select-field/DesktopSelectField'
import ButtonRevamp from '../../components/button-revamp/ButtonRevamp'
import { Colors } from '../../constants/colors'
import { CDN_REACT } from '../../constants/cdn'
import { Fonts, SemanticFontsEnglish } from '../../src/theme/fonts'
import { MONTHS, MONTHS_OPTIONS, buildMarriageYears, type DateChip } from './DeleteProfileShareDetailsScreen'
import type { FooterTab } from '../../components/app-footer/AppFooter'
import { handleBack } from '../../utils/navigationRef'

const GIFT_GIF = CDN_REACT + '/marriage_gift.gif'
const MARRIAGE_YEARS = buildMarriageYears()
const DAY_OPTIONS = Array.from({ length: 31 }, (_, i) => ({ key: String(i + 1), label: String(i + 1).padStart(2, '0') }))

export interface DeleteProfileShareDetailsDesktopLayoutProps {
  navigation: any
  userName:   string
  onTabPress: (tab: FooterTab) => void

  partnerName:         string
  onChangePartnerName: (text: string) => void
  nameError:           boolean

  dateChip:     DateChip
  onSelectChip: (chip: DateChip) => void

  selDate:  string
  selMonth: string
  selYear:  string
  onSelectMrgField: (field: 'date' | 'month' | 'year', key: string) => void

  marriedInKey:       string
  onSelectMarriedIn:  (key: string, value: string) => void

  nextEnabled: boolean
  onNext:      () => void
}

export default function DeleteProfileShareDetailsDesktopLayout({
  navigation, userName, onTabPress,
  partnerName, onChangePartnerName, nameError,
  dateChip, onSelectChip,
  selDate, selMonth, selYear, onSelectMrgField,
  marriedInKey, onSelectMarriedIn,
  nextEnabled, onNext,
}: DeleteProfileShareDetailsDesktopLayoutProps) {
  const { t } = useTranslation()

  return (
    <DesktopPageShell navigation={navigation} userName={userName} activeItem="settings" onTabPress={onTabPress}>
      <View style={s.header}>
        <Pressable onPress={() => handleBack()} accessibilityRole="button" accessibilityLabel="Back" hitSlop={8}>
          <Text style={s.backArrow}>←</Text>
        </Pressable>
        <Text style={s.title}>{t('DELETE_PROFILE.HEADER')}</Text>
      </View>

      <View style={s.card}>
        <LinearGradient colors={['#FCEDFF', '#FFFFFF']} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={s.banner}>
          <View style={s.bannerText}>
            <Text style={s.bannerLine}>{t('DELETE_PROFILE.SHARE_GIFT_PRE')}</Text>
            <Text style={s.bannerHighlight}>{t('DELETE_PROFILE.SHARE_GIFT_HIGHLIGHT')}</Text>
            <Text style={s.bannerLine}>{t('DELETE_PROFILE.SHARE_GIFT_POST')}</Text>
          </View>
          <Image source={{ uri: GIFT_GIF }} style={{ width: 120, height: 110 }} contentFit="contain" />
        </LinearGradient>

        <View style={[s.inputWrap, nameError && s.inputWrapError]}>
          <TextInput
            style={s.textInput}
            value={partnerName}
            onChangeText={onChangePartnerName}
            placeholder={t('DELETE_PROFILE.PARTNER_NAME_PLACEHOLDER') + ' *'}
            placeholderTextColor="#8a8a8a"
            maxLength={60}
          />
        </View>
        {nameError && <Text style={s.nameError}>{t('DELETE_PROFILE.PARTNER_NAME_ERROR')}</Text>}

        <View style={s.chipRow}>
          <Pressable
            style={[s.chip, dateChip === 'fixed' ? s.chipSelected : s.chipUnselected]}
            onPress={() => onSelectChip('fixed')}
            accessibilityRole="radio"
            accessibilityState={{ selected: dateChip === 'fixed' }}
          >
            <Text style={[s.chipLabel, dateChip === 'fixed' && s.chipLabelSelected]}>{t('DELETE_PROFILE.DATE_FIXED_CHIP')}</Text>
          </Pressable>
          <Pressable
            style={[s.chip, dateChip === 'not_fixed' ? s.chipSelected : s.chipUnselected]}
            onPress={() => onSelectChip('not_fixed')}
            accessibilityRole="radio"
            accessibilityState={{ selected: dateChip === 'not_fixed' }}
          >
            <Text style={[s.chipLabel, dateChip === 'not_fixed' && s.chipLabelSelected]}>{t('DELETE_PROFILE.DATE_NOT_FIXED_CHIP')}</Text>
          </Pressable>
        </View>

        {dateChip === 'fixed' && (
          <View style={s.dateFieldsRow}>
            <View style={s.dateField}>
              <DesktopSelectField
                label="Date"
                placeholder="Date"
                options={DAY_OPTIONS}
                selectedKey={selDate || null}
                onSelect={opt => onSelectMrgField('date', opt.key)}
              />
            </View>
            <View style={s.dateField}>
              <DesktopSelectField
                label="Month"
                placeholder="Month"
                options={MONTHS}
                selectedKey={selMonth || null}
                onSelect={opt => onSelectMrgField('month', opt.key)}
              />
            </View>
            <View style={s.dateField}>
              <DesktopSelectField
                label="Year"
                placeholder="Year"
                options={MARRIAGE_YEARS}
                selectedKey={selYear || null}
                onSelect={opt => onSelectMrgField('year', opt.key)}
              />
            </View>
          </View>
        )}

        {dateChip === 'not_fixed' && (
          <View style={s.marriedInField}>
            <DesktopSelectField
              label={t('DELETE_PROFILE.MARRIED_IN_LABEL')}
              options={MONTHS_OPTIONS.map(o => ({ key: o.key, label: o.value }))}
              selectedKey={marriedInKey || null}
              onSelect={opt => onSelectMarriedIn(opt.key, opt.label)}
            />
          </View>
        )}

        <ButtonRevamp label={t('DELETE_PROFILE.NEXT_CTA')} variant="primary" disabled={!nextEnabled} onPress={onNext} style={s.nextBtn} />
      </View>
    </DesktopPageShell>
  )
}

const s = StyleSheet.create({
  header: { width: 810, flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 24 },
  backArrow: { fontSize: 22, color: Colors.black },
  title: { fontFamily: Fonts.poppinsSemiBold, fontSize: 22, color: Colors.black },

  card: {
    width: 810, backgroundColor: Colors.white, borderRadius: 24, padding: 40,
    shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.12, shadowRadius: 8,
    elevation: 4,
  },

  banner: {
    marginHorizontal: -40, marginTop: -40, paddingHorizontal: 40, paddingVertical: 28,
    flexDirection: 'row', alignItems: 'center', minHeight: 155, marginBottom: 24, borderTopLeftRadius: 24, borderTopRightRadius: 24,
  },
  bannerText: { flex: 1 },
  bannerLine: { fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: 16, lineHeight: 24, color: Colors.black },
  bannerHighlight: { fontFamily: Fonts.poppinsSemiBold, fontSize: 16, lineHeight: 24, color: '#c9050b' },

  inputWrap: {
    height: 48, borderRadius: 8, borderWidth: 1, borderColor: '#b0b0b0',
    paddingHorizontal: 16, backgroundColor: Colors.white, justifyContent: 'center', width: 400,
  },
  inputWrapError: { borderColor: '#de2a68' },
  textInput: { fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: 14, color: Colors.black, padding: 0, margin: 0 },
  nameError: { fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: 12, color: '#de2a68', marginTop: 4 },

  chipRow: { flexDirection: 'row', gap: 12, marginTop: 16 },
  chip: { height: 40, paddingHorizontal: 16, borderRadius: 20, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  chipUnselected: { borderColor: '#b0b0b0', backgroundColor: 'rgba(255,255,255,0.2)' },
  chipSelected: { borderColor: 'rgba(181,0,51,0.4)', backgroundColor: 'rgba(181,0,51,0.02)' },
  chipLabel: { fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: 14, color: Colors.black },
  chipLabelSelected: { fontFamily: Fonts.poppinsSemiBold, color: '#b50033' },

  dateFieldsRow: { flexDirection: 'row', gap: 12, marginTop: 20, width: 400 },
  dateField: { flex: 1 },
  marriedInField: { marginTop: 20, width: 400 },

  nextBtn: { width: 312, marginTop: 32 },
})
