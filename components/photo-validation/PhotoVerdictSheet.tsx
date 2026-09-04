// AI photo-validation verdict bottom sheet — shown after CustomGalleryScreen's
// upload finishes and pollPhotoValidation() returns. Covers the "uploading",
// "all/some rejected" and "mixed" states; a pure "all approved" verdict reuses
// the existing VerificationSuccessSheet (same success-new.json Lottie, same
// auto-dismiss behavior) instead of duplicating that sheet here.
//
// Android reference: PhotoUploadProcessFragment's Pending/Rejected states —
// this only ports the visual result screen, not the WorkManager timeout/retry
// machinery (that lives in the polling call site, CustomGalleryScreen.tsx).
import { Image } from 'expo-image'
import { useState } from 'react'
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import Svg, { Circle, Line } from 'react-native-svg'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import { Colors } from '../../constants/colors'
import { CDN_LOTTIE } from '../../constants/cdn'
import CdnLottie from '../CdnLottie'

// ─── Types ────────────────────────────────────────────────────────────────────

export type VerdictPhoto = {
  photoId:        string
  photoUrl:       string
  reasonTitle?:   string
  reasonSubtitle?: string
}

type Props = {
  visible:       boolean
  // 'uploading' has no buttons and ignores approved/rejected — it's shown
  // while the upload + verdict poll are still in flight.
  phase:         'uploading' | 'rejected' | 'mixed'
  approved?:     VerdictPhoto[]
  rejected?:     VerdictPhoto[]
  onAddNewPhoto: () => void
  onDismiss:     () => void
}

// ─── Icon ─────────────────────────────────────────────────────────────────────
// Figma's "alert-circle" badge has no matching asset anywhere in the Angular
// repo (it's rendered there via an Ionicons glyph, not a bundled SVG) — hand
// drawn here to match the existing per-screen inline-SVG convention (see
// ManagePhotosScreen.tsx's TrashIcon/InfoIcon).

function AlertCircleIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={10} fill={Colors.inputError} />
      <Line x1={12} y1={7} x2={12} y2={13} stroke="#fff" strokeWidth={2} strokeLinecap="round" />
      <Circle cx={12} cy={16.4} r={1.15} fill="#fff" />
    </Svg>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function PhotoVerdictSheet({
  visible, phase, approved = [], rejected = [], onAddNewPhoto, onDismiss,
}: Props) {
  const insets = useSafeAreaInsets()
  const { t } = useTranslation()

  // A photo can 404/expire between upload and this verdict render (deleted
  // server-side, CDN miss) — track failures per photoId and swap in a plain
  // placeholder box instead of leaving expo-image's blank box on error.
  const [failedPhotoIds, setFailedPhotoIds] = useState<Set<string>>(new Set())
  function markPhotoFailed(photoId: string) {
    setFailedPhotoIds(prev => (prev.has(photoId) ? prev : new Set(prev).add(photoId)))
  }

  const title =
    phase === 'mixed'
      ? t('AI_PHOTO_VALIDATION.UPLOAD_RESULTS_TITLE', 'Photo upload results')
      : rejected.length > 1
        ? t('AI_PHOTO_VALIDATION.PHOTOS_REJECTED_MULTI', '#COUNT Photos were not approved').replace('#COUNT', String(rejected.length))
        : t('AI_PHOTO_VALIDATION.PHOTO_REJECTED_SINGLE', 'Photo not approved!')

  const approvedHeader = approved.length > 1
    ? t('AI_PHOTO_VALIDATION.PHOTOS_APPROVED_COUNT', '#COUNT photos approved').replace('#COUNT', String(approved.length))
    : t('AI_PHOTO_VALIDATION.PHOTO_APPROVED_COUNT', '#COUNT photo approved').replace('#COUNT', String(approved.length))

  const rejectedHeader = rejected.length > 1
    ? t('AI_PHOTO_VALIDATION.PHOTOS_REJECTED_COUNT', '#COUNT photos rejected').replace('#COUNT', String(rejected.length))
    : t('AI_PHOTO_VALIDATION.PHOTO_REJECTED_COUNT', '#COUNT photo rejected').replace('#COUNT', String(rejected.length))

  const scrollableList = rejected.length > 2

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={() => {}}
    >
      <View style={styles.overlay}>
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 24) }]}>
          {phase === 'uploading' ? (
            <View style={styles.uploadingBlock}>
              {/* Angular: bottom-sheet.component.html action==='aiPhotoValidation'
                  uses loader-new.json specifically, not the generic loader.json. */}
              <CdnLottie uri={CDN_LOTTIE + 'loader-new.json'} width={56} height={56} loop />
              <Text style={styles.uploadingText}>{t('AI_PHOTO_VALIDATION.UPLOAD_IN_PROGRESS', 'Upload in Progress')}</Text>
            </View>
          ) : (
            <>
              <Text style={styles.title}>{title}</Text>

              {phase === 'mixed' && (
                <View style={[styles.card, styles.approvedCard]}>
                  <Text style={styles.approvedHeader}>{approvedHeader}</Text>
                  <View style={styles.facepileRow}>
                    {approved.slice(0, 6).map((p, i) => (
                      failedPhotoIds.has(p.photoId) ? (
                        <View
                          key={p.photoId}
                          style={[styles.facepileImg, styles.imgPlaceholder, i > 0 && styles.facepileOverlap]}
                        />
                      ) : (
                        <Image
                          key={p.photoId}
                          source={{ uri: p.photoUrl }}
                          style={[styles.facepileImg, i > 0 && styles.facepileOverlap]}
                          contentFit="cover"
                          onError={() => markPhotoFailed(p.photoId)}
                        />
                      )
                    ))}
                  </View>
                </View>
              )}

              <View style={styles.card}>
                {phase === 'mixed' && (
                  <Text style={styles.rejectedHeader}>{rejectedHeader}</Text>
                )}
                <ScrollView
                  style={scrollableList ? styles.scrollList : undefined}
                  showsVerticalScrollIndicator={scrollableList}
                  nestedScrollEnabled
                >
                  {rejected.map((p, i) => (
                    <View key={p.photoId} style={[styles.rejectRow, i > 0 && styles.rejectRowDivider]}>
                      <View style={styles.thumbWrap}>
                        {failedPhotoIds.has(p.photoId) ? (
                          <View style={[styles.thumb, styles.imgPlaceholder]} />
                        ) : (
                          <Image
                            source={{ uri: p.photoUrl }}
                            style={styles.thumb}
                            contentFit="cover"
                            onError={() => markPhotoFailed(p.photoId)}
                          />
                        )}
                        <View style={styles.alertBadge}>
                          <AlertCircleIcon />
                        </View>
                      </View>
                      <View style={styles.reasonBlock}>
                        <Text style={styles.reasonTitle}>{p.reasonTitle ?? t('AI_PHOTO_VALIDATION.DEFAULT_REJECTION_REASON', 'Photo not approved')}</Text>
                        {!!p.reasonSubtitle && (
                          <Text style={styles.reasonSubtitle}>{p.reasonSubtitle}</Text>
                        )}
                      </View>
                    </View>
                  ))}
                </ScrollView>
              </View>

              <Pressable style={styles.primaryBtn} onPress={onAddNewPhoto}>
                <Text style={styles.primaryBtnLabel}>{t('AI_PHOTO_VALIDATION.ADD_NEW_PHOTO', 'Add new photo')}</Text>
              </Pressable>
              <Pressable style={styles.laterBtn} onPress={onDismiss} hitSlop={10}>
                <Text style={styles.laterText}>{t('VERIFY_ID.LBL_DO_LATER', "I'll do this later")}</Text>
              </Pressable>
            </>
          )}
        </View>
      </View>
    </Modal>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // Figma: bg-black opacity-80 behind the sheet.
  overlay: {
    flex:            1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent:  'flex-end',
  },
  sheet: {
    backgroundColor:      Colors.surface,
    borderTopLeftRadius:  24,
    borderTopRightRadius: 24,
    paddingTop:           24,
    paddingHorizontal:    24,
  },

  uploadingBlock: {
    alignItems:    'center',
    paddingVertical: 16,
    gap:           16,
  },
  uploadingText: {
    fontSize:   18,
    fontWeight: '600',
    color:      Colors.textPrimary,
  },

  title: {
    fontSize:     18,
    fontWeight:   '600',
    color:        Colors.textPrimary,
    marginBottom: 16,
  },

  card: {
    borderWidth:       1,
    borderColor:       Colors.borderSubtle,
    borderRadius:      12,
    padding:           16,
    marginBottom:      16,
  },
  approvedCard: {
    paddingBottom: 20,
  },
  approvedHeader: {
    fontSize:      14,
    fontWeight:    '600',
    color:         Colors.discountGreen,
    marginBottom:  16,
    letterSpacing: 0.3,
  },
  facepileRow: {
    flexDirection: 'row',
  },
  facepileImg: {
    width:        48,
    height:       48,
    borderRadius: 24,
    borderWidth:  1,
    borderColor:  Colors.white,
    backgroundColor: Colors.surfaceDim,
  },
  facepileOverlap: {
    marginLeft: -12,
  },
  imgPlaceholder: {
    backgroundColor: Colors.surfaceDim,
  },

  rejectedHeader: {
    fontSize:      14,
    fontWeight:    '600',
    color:         Colors.inputError,
    marginBottom:  12,
    letterSpacing: 0.3,
  },

  scrollList: {
    maxHeight: 350,
  },

  rejectRow: {
    flexDirection: 'row',
    gap:           12,
    paddingVertical: 12,
  },
  rejectRowDivider: {
    borderTopWidth: 1,
    borderTopColor: Colors.borderSubtle,
  },
  thumbWrap: {
    width:  72,
    height: 72,
    position: 'relative',
  },
  thumb: {
    width:        72,
    height:       72,
    borderRadius: 8,
  },
  alertBadge: {
    position: 'absolute',
    top:      -6,
    right:    -6,
  },
  reasonBlock: {
    flex: 1,
    justifyContent: 'center',
    gap:  2,
  },
  reasonTitle: {
    fontSize:   13,
    fontWeight: '600',
    color:      Colors.inputError,
  },
  reasonSubtitle: {
    fontSize:   12,
    color:      Colors.textPrimary,
    lineHeight: 16,
  },

  primaryBtn: {
    height:          44,
    backgroundColor: Colors.primaryDark,
    borderRadius:    8,
    alignItems:      'center',
    justifyContent:  'center',
    marginBottom:    16,
  },
  primaryBtnLabel: {
    fontSize:   14,
    fontWeight: '600',
    color:      Colors.white,
  },
  laterBtn: {
    alignItems: 'center',
  },
  laterText: {
    fontSize: 14,
    color:    Colors.textDark,
  },
})
