// Full reasons-picker report form — Angular: pages/report-profile/report-profile
// .component.ts/.html (a routed page there; a modal here). Replaces ViewProfileScreen's
// previous direct confirm+"Report and Block" 3-dot action with the real reasons list,
// a comment box, and an optional photo attachment — audio recording is Angular-only
// complexity with no RN audio infra in this codebase yet, dropped (text+photo only).
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ActivityIndicator, Alert, Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import CdnSvg from '../cdn-svg/CdnSvg'
import ButtonRevamp from '../button-revamp/ButtonRevamp'
import { Colors } from '../../constants/colors'
import { CDN_SVG } from '../../constants/cdn'
import { fetchReportReasons, submitReport, type ReportReason } from '../../service/reportProfileService'

const CLOSE_ICON_URI = CDN_SVG + 'revamp/close-icon.svg'

export interface ReportProfileModalProps {
  visible:       boolean
  partnerId:     string
  partnerName?:  string | undefined
  onClose:       () => void
  onSubmitted:   () => void
}

export default function ReportProfileModal({
  visible, partnerId, partnerName, onClose, onSubmitted,
}: ReportProfileModalProps) {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(true)
  const [reasons, setReasons] = useState<ReportReason[]>([])
  const [disabledKeys, setDisabledKeys] = useState<string[]>([])
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [comments, setComments] = useState('')
  const [photoUri, setPhotoUri] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!visible) return
    let cancelled = false
    setLoading(true)
    setSelectedKey(null)
    setComments('')
    setPhotoUri(null)
    fetchReportReasons(partnerId).then(({ reasons: r, disabledKeys: d }) => {
      if (cancelled) return
      setReasons(r)
      setDisabledKeys(d)
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [visible, partnerId])

  const selectedReason = reasons.find(r => r.key === selectedKey) ?? null

  async function handleAttachPhoto() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Allow photo library access in Settings to attach proof.')
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85 })
    if (!result.canceled && result.assets[0]) setPhotoUri(result.assets[0].uri)
  }

  async function handleSubmit() {
    if (!selectedReason) return
    // Angular: submitReport() validation — a needs-evidence reason requires the
    // comment box filled in (photo stays optional either way).
    if (selectedReason.needsEvidence && !comments.trim()) {
      Alert.alert('', t('GENERAL.REPORT_TEXT_TOAST'))
      return
    }
    setSubmitting(true)
    try {
      const ok = await submitReport(partnerId, {
        key: selectedReason.key,
        title: selectedReason.title,
        comments: selectedReason.needsEvidence ? comments.trim() : undefined,
        photoUri: selectedReason.needsEvidence ? (photoUri ?? undefined) : undefined,
      })
      if (ok) onSubmitted()
    } finally {
      setSubmitting(false)
    }
  }

  const reportLabel = t('GENERAL.REPORT')
    .replace(/<[^>]+>/g, '')
    .replace('#NAME#', partnerName ?? '')

  return (
    // `transparent` — same fix as BulkLikeModal.tsx: this was the only other
    // Modal in the app missing it, the same known react-native-web pitfall
    // (content renders fine, pointer events silently stop reaching it).
    // `m.screen`'s own opaque white background already covers the full screen.
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={m.screen}>
        <View style={m.header}>
          <Text style={m.headerTitle}>{t('MESSAGES.REPORT_PROFILE')}</Text>
          <Pressable onPress={onClose} hitSlop={10}>
            <CdnSvg uri={CLOSE_ICON_URI} width={22} height={22} />
          </Pressable>
        </View>

        {loading ? (
          <View style={m.loaderBox}>
            <ActivityIndicator size="large" color={Colors.primary} />
          </View>
        ) : (
          <ScrollView style={m.body} contentContainerStyle={m.bodyContent}>
            <Text style={m.subtitle}>{t('GENERAL.REPORTING_REASON')}</Text>

            {reasons.map(reason => {
              const disabled = disabledKeys.includes(reason.key)
              const selected = selectedKey === reason.key
              return (
                <Pressable
                  key={reason.key}
                  style={[m.reasonRow, disabled && m.reasonRowDisabled]}
                  onPress={() => !disabled && setSelectedKey(reason.key)}
                  disabled={disabled}
                >
                  <View style={[m.radioOuter, selected && m.radioOuterActive]}>
                    {selected && <View style={m.radioInner} />}
                  </View>
                  <View style={m.reasonTextCol}>
                    <Text style={[m.reasonTitle, disabled && m.reasonTitleDisabled]}>{reason.title}</Text>
                    {disabled ? (
                      <Text style={m.alreadyReported}>{t('GENERAL.ALREADY_REPORTED')}</Text>
                    ) : (
                      !!reason.body && <Text style={m.reasonBody}>{reason.body}</Text>
                    )}
                  </View>
                </Pressable>
              )
            })}

            {selectedReason?.needsEvidence && (
              <View style={m.evidenceBlock}>
                <Text style={m.evidenceLabel}>{t('GENERAL.TYPE_COMPLAINT')}</Text>
                <TextInput
                  style={m.textArea}
                  value={comments}
                  onChangeText={setComments}
                  placeholder={t('GENERAL.TYPE_COMPLAINT_HERE')}
                  placeholderTextColor={Colors.textSecondary}
                  multiline
                  maxLength={140}
                />
                <Text style={m.evidenceLabel}>{t('GENERAL.ATTACH_DOCUMENT')}</Text>
                {photoUri ? (
                  <Pressable onPress={handleAttachPhoto}>
                    <Image source={{ uri: photoUri }} style={m.attachedPhoto} />
                  </Pressable>
                ) : (
                  <Pressable style={m.attachBtn} onPress={handleAttachPhoto}>
                    <Text style={m.attachBtnText}>{t('GENERAL.ATTACH_FILE')}</Text>
                  </Pressable>
                )}
              </View>
            )}
          </ScrollView>
        )}

        <View style={m.footer}>
          <ButtonRevamp
            label={reportLabel}
            variant="primary"
            size="standard"
            fullWidth
            disabled={!selectedReason}
            loading={submitting}
            onPress={handleSubmit}
          />
        </View>
      </View>
    </Modal>
  )
}

const m = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.white },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: Colors.divider,
  },
  headerTitle: { fontFamily: 'Poppins-SemiBold', fontSize: 16, color: Colors.black },
  loaderBox: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1 },
  bodyContent: { padding: 16, gap: 4 },
  subtitle: { fontFamily: 'Poppins-Regular', fontSize: 13, color: Colors.textSecondary, marginBottom: 12 },
  reasonRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 12 },
  reasonRowDisabled: { opacity: 0.5 },
  radioOuter: {
    width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, borderColor: Colors.divider,
    alignItems: 'center', justifyContent: 'center', marginTop: 2,
  },
  radioOuterActive: { borderColor: Colors.primaryDark },
  radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.primaryDark },
  reasonTextCol: { flex: 1, gap: 2 },
  reasonTitle: { fontFamily: 'Poppins-Medium', fontSize: 14, color: Colors.black },
  reasonTitleDisabled: { color: Colors.textSecondary },
  reasonBody: { fontFamily: 'Poppins-Regular', fontSize: 12, color: Colors.textSecondary },
  alreadyReported: { fontFamily: 'Poppins-Regular', fontSize: 12, color: Colors.inputError },
  evidenceBlock: { marginTop: 12, gap: 8 },
  evidenceLabel: { fontFamily: 'Poppins-Medium', fontSize: 13, color: Colors.black, marginTop: 8 },
  textArea: {
    borderWidth: 1, borderColor: Colors.divider, borderRadius: 8,
    padding: 12, minHeight: 80, fontFamily: 'Poppins-Regular', fontSize: 14, color: Colors.black,
    textAlignVertical: 'top',
  },
  attachBtn: {
    borderWidth: 1, borderColor: Colors.divider, borderRadius: 8,
    paddingVertical: 12, alignItems: 'center',
  },
  attachBtnText: { fontFamily: 'Poppins-Medium', fontSize: 14, color: Colors.link },
  attachedPhoto: { width: 80, height: 80, borderRadius: 8 },
  footer: { padding: 16, borderTopWidth: 1, borderTopColor: Colors.divider },
})
