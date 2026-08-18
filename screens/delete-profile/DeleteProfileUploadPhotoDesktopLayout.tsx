// Desktop layout for "Upload your photo with your life partner (Optional)"
// (Figma "Jodii Desktop - Registration", UaPAN9aG6MfZf6CRpwXf1L, node
// 665:106163 — a 5-tile grid). Purely presentational —
// DeleteProfileUploadPhotoScreen.tsx owns state/handlers.
//
// Known simplification vs Figma: the backend (Endpoints.media.deleteProfile)
// only accepts a single UPLOADIMAGE file, same as mobile's own one-photo
// picker — so only the first (dashed, primary) tile is interactive; the
// other 4 are decorative, matching the grid's visual proportions without
// implying multi-photo upload the API doesn't support.
import { useRef } from 'react'
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { Image } from 'expo-image'
import DesktopPageShell from '../../components/desktop-page-shell/DesktopPageShell'
import ButtonRevamp from '../../components/button-revamp/ButtonRevamp'
import { Colors } from '../../constants/colors'
import type { FooterTab } from '../../components/app-footer/AppFooter'
import { Fonts, SemanticFontsEnglish } from '../../src/theme/fonts'

export interface DeleteProfileUploadPhotoDesktopLayoutProps {
  navigation: any
  userName:   string
  onTabPress: (tab: FooterTab) => void

  photoUri:       string | null
  onPickPhotoWeb: (file: File) => void
  address:        string
  onChangeAddress: (text: string) => void
  submitting:     boolean
  onSkip:         () => void
  onSubmit:       () => void
}

export default function DeleteProfileUploadPhotoDesktopLayout({
  navigation, userName, onTabPress,
  photoUri, onPickPhotoWeb, address, onChangeAddress, submitting, onSkip, onSubmit,
}: DeleteProfileUploadPhotoDesktopLayoutProps) {
  const { t } = useTranslation()
  const inputRef = useRef<HTMLInputElement | null>(null)

  function handleFileChange(e: any) {
    const file: File | undefined = e.target.files?.[0]
    if (file) onPickPhotoWeb(file)
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <DesktopPageShell navigation={navigation} userName={userName} activeItem="settings" onTabPress={onTabPress}>
      {Platform.OS === 'web' && (
        // display:none silently blocks Safari's file dialog on a
        // programmatic .click() — see EditProfileDesktopScreen.tsx's fix
        // for the same bug.
        <input ref={inputRef as any} type="file" accept="image/*" onChange={handleFileChange}
          style={{ position: 'absolute', width: 1, height: 1, opacity: 0, overflow: 'hidden' }} />
      )}

      <View style={s.header}>
        <Pressable onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel="Back" hitSlop={8}>
          <Text style={s.backArrow}>←</Text>
        </Pressable>
        <Text style={s.title}>{t('DELETE_PROFILE.HEADER')}</Text>
        <Pressable style={s.skipBtn} onPress={onSkip} disabled={submitting} accessibilityRole="button" accessibilityLabel="Skip">
          <Text style={s.skipText}>{t('DELETE_PROFILE.SKIP')}</Text>
        </Pressable>
      </View>

      <View style={s.card}>
        <Text style={s.cardTitle}>
          {t('DELETE_PROFILE.UPLOAD_CONTENT')} <Text style={s.optional}>{t('DELETE_PROFILE.OPTIONAL_LABEL')}</Text>
        </Text>

        <View style={s.grid}>
          <Pressable style={[s.tile, s.tilePrimary]} onPress={() => inputRef.current?.click()} accessibilityRole="button">
            {photoUri ? (
              <Image source={{ uri: photoUri }} style={s.tilePhoto} contentFit="cover" />
            ) : (
              <Text style={s.plus}>+</Text>
            )}
          </Pressable>
          {[0, 1, 2, 3].map(i => (
            <View key={i} style={s.tile}>
              <Text style={s.plus}>+</Text>
            </View>
          ))}
        </View>

        <View style={s.addressWrap}>
          <TextInput
            style={s.addressInput}
            value={address}
            onChangeText={onChangeAddress}
            placeholder={t('DELETE_PROFILE.GIFT_DELIVERY_ADDRESS')}
            placeholderTextColor="#8a8a8a"
            maxLength={200}
          />
        </View>

        {submitting ? (
          <View style={s.submitBtnLoading}><ActivityIndicator color={Colors.white} size="small" /></View>
        ) : (
          <ButtonRevamp label={t('DELETE_PROFILE.SUBMIT_CTA')} variant="primary" onPress={onSubmit} style={s.submitBtn} />
        )}
      </View>
    </DesktopPageShell>
  )
}

const TILE = 148

const s = StyleSheet.create({
  header: { width: 810, flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 24 },
  backArrow: { fontSize: 22, color: Colors.black },
  title: { flex: 1, fontFamily: Fonts.poppinsSemiBold, fontSize: 22, color: Colors.black },
  skipBtn: { paddingHorizontal: 12, paddingVertical: 8 },
  skipText: { fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: 14, color: Colors.black },

  card: {
    width: 810, backgroundColor: Colors.white, borderRadius: 24, padding: 40,
    shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.12, shadowRadius: 8,
    elevation: 4, alignItems: 'center',
  },
  cardTitle: { alignSelf: 'stretch', fontFamily: Fonts.poppinsSemiBold, fontSize: 18, color: Colors.black, marginBottom: 24, textAlign: 'center' },
  optional: { fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontWeight: '400', color: 'rgba(0,0,0,0.4)' },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, width: TILE * 3 + 24, marginBottom: 24 },
  tile: {
    width: TILE, height: TILE, borderRadius: 8, borderWidth: 1, borderColor: '#e6e6e6', borderStyle: 'dashed',
    backgroundColor: 'rgba(230,230,230,0.3)', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  tilePrimary: { borderColor: '#b50033' },
  tilePhoto: { width: '100%', height: '100%' },
  plus: { fontSize: 28, fontWeight: '300', color: '#666' },

  addressWrap: {
    alignSelf: 'stretch', height: 48, borderRadius: 8, borderWidth: 1, borderColor: '#b0b0b0',
    paddingHorizontal: 16, justifyContent: 'center', backgroundColor: Colors.white, marginBottom: 24,
  },
  addressInput: { fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: 14, color: Colors.black, padding: 0, margin: 0 },

  submitBtn: { width: 312 },
  submitBtnLoading: { width: 312, height: 44, borderRadius: 8, backgroundColor: '#b50033', alignItems: 'center', justifyContent: 'center' },
})
