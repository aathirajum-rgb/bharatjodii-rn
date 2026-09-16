// ButtonComponent — business logic from Angular button.component.
// UI for button-shaped cases uses ButtonRevamp (from button-revamp.component).
// Icon-only and text-row cases render lightweight Pressable + Image directly.
// Business logic (API calls) is delegated to buttonService.
// Parent receives results via onAction(action, updatedData).

import { useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import CdnSvg from '../cdn-svg/CdnSvg'
import { Colors } from '../../constants/colors'
import ButtonRevamp from '../button-revamp/ButtonRevamp'
import { clickingOnBtn } from '../../service/buttonService'
import { getItem } from '../../service/storageService'
import { CDN_SVG } from '../../constants/cdn'
import { FontSize } from '../../src/theme/fonts'

// ─── Types ────────────────────────────────────────────────────────────────────

export type ButtonType =
  | 'ContactVerticalBtn'
  | 'ViewProfileFooterBtn'
  | 'ViewProfileThreeDotBtn'
  | 'GalleryBtn'
  | 'NeedHelpRecharge'
  | 'reportProfileBtn'
  | 'phoneViewBtn'
  | 'blockProfileBtn'
  | 'unblockProfileBtn'
  | 'safetyTipBtn'
  | 'vpCallBtn'
  | 'vpmessageBtn'
  | 'vpmessageBtnHdr'
  | 'viewProfileCallBtn'
  | 'viewProfileCallBtnHdr'
  | 'vpCallWhatsApp'
  | 'messageCallBtn'
  | 'vpCallWhatsAppBtn'

export interface ButtonData {
  TYPE:       ButtonType
  PAGE:       string
  PROFILE?:   any
  COMMINFO?:  any
  SHOWLIKE?:  boolean
  INDEX?:     number
  ONLOAD?:    boolean
  PHOTO?:     any
  PHOTOURL?:  string
  BTNTEXT?:   string
  CTAWA?:     string   // WhatsApp CTA label
  CTACL?:     string   // Call CTA label
  PAGETRACK?: any
}

interface Props {
  data:          ButtonData
  onAction?:     (action: string, data: any) => void
  onHelpPress?:  () => void
  previewMode?:  boolean   // skips API calls — use in component showcase
}

// ─── CDN base ─────────────────────────────────────────────────────────────────
const IMG = CDN_SVG

// ─── Like state helpers ───────────────────────────────────────────────────────
function isLiked(liked: any): boolean {
  return ['1', '3', 1, 3].includes(liked)
}
function isNotLiked(liked: any): boolean {
  return ['0', '2', '5', 0, 2, 5].includes(liked)
}

// ─── ButtonComponent ──────────────────────────────────────────────────────────

export default function ButtonComponent({
  data,
  onAction,
  onHelpPress,
  previewMode = false,
}: Props) {
  const [loading,      setLoading]      = useState(false)
  const [saveType,     setSaveType]     = useState(0)
  const [showWhatsapp, setShowWhatsapp] = useState(true)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    getItem('ACTIONTYPE').then(v => {
      if (mountedRef.current) setSaveType(v ? parseInt(v) : 0)
    })
    getItem('NRIWHATSAPP').then(v => {
      if (mountedRef.current) setShowWhatsapp(v !== '0')
    })
    return () => { mountedRef.current = false }
  }, [])

  async function handleAction(action: string) {
    if (loading) return
    if (previewMode) { onAction?.(action, data); return }
    if (!data?.PROFILE?.MATRIID) return
    setLoading(true)
    try {
      const result = await clickingOnBtn(action as any, data.PROFILE, data.PROFILE.MATRIID, data.PAGE)
      onAction?.(action, { ...data, result })
    } finally {
      if (mountedRef.current) setLoading(false)
    }
  }

  const liked = data?.COMMINFO?.LIKED ?? data?.PROFILE?.LIKED

  // ─── TYPE switch ─────────────────────────────────────────────────────────────

  switch (data?.TYPE) {

    // ── ContactVerticalBtn: icon-only row (Like / Call / WhatsApp) ────────────
    // Not a button-revamp case — these are plain icon tappables on match cards.
    case 'ContactVerticalBtn': {
      if (data?.PROFILE?.STATUS == 1) return null
      return (
        <View style={styles.iconRow}>
          {data?.SHOWLIKE && (
            <Pressable
              style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
              onPress={() => handleAction(isLiked(data?.PROFILE?.LIKED) ? 'dislike' : 'like')}
            >
              <CdnSvg
                uri={IMG + (isLiked(data?.PROFILE?.LIKED) ? 'liked-icon.svg' : 'like-icon.svg')}
                width={28}
                height={28}
              />
            </Pressable>
          )}
          <Pressable
            style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
            onPress={() => handleAction('call')}
          >
            <CdnSvg uri={IMG + 'contact.svg'} width={28} height={28} />
          </Pressable>
          {showWhatsapp && (
            <Pressable
              style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
              onPress={() => handleAction('whatsapp')}
            >
              <CdnSvg uri={IMG + 'whatsapp-icon.svg'} width={28} height={28} />
            </Pressable>
          )}
          {loading && <ActivityIndicator size="small" color={Colors.primary} style={{ marginLeft: 8 }} />}
        </View>
      )
    }

    // ── ViewProfileFooterBtn: primary / secondary / tertiary row ──────────────
    // Angular: primary-cta-jodii (primary), dont-show-btn (clear), call row
    case 'ViewProfileFooterBtn': {
      const profileLiked = liked?.toString() ?? '0'
      return (
        <View>
          {/* Not liked: tertiary (Don't Show, left) + primary (Call, right) */}
          {isNotLiked(profileLiked) && (
            <View style={styles.vpRow}>
              <ButtonRevamp
                label="Don't Show"
                variant="clear"
                size="large"
                icon="dont-show-img"
                iconPosition="start"
                disabled={data?.COMMINFO?.SKIPPED != '0'}
                onPress={() => handleAction('skip')}
                style={styles.vpHalf}
              />
              <ButtonRevamp
                label="Call Now"
                variant="primary"
                size="large"
                icon="call-img-white"
                iconPosition="start"
                onPress={() => handleAction('call')}
                style={styles.vpHalfPrimary}
              />
            </View>
          )}

          {/* Bottom row */}
          <View style={styles.vpBottomRow}>
            {/* Liked: full-width Call primary button */}
            {isLiked(profileLiked) && (
              <ButtonRevamp
                label="Call Now"
                variant="primary"
                size="large"
                icon="call-img-white"
                iconPosition="start"
                fullWidth
                loading={loading}
                onPress={() => handleAction('call')}
              />
            )}
            {/* Not liked: full-width Message (clear style) */}
            {isNotLiked(profileLiked) && (
              <ButtonRevamp
                label="Message"
                variant="clear"
                size="large"
                icon="message-primary-img"
                iconPosition="start"
                fullWidth
                onPress={() => handleAction('jodimessages')}
              />
            )}
          </View>

          {loading && !isLiked(profileLiked) && (
            <ActivityIndicator size="small" color={Colors.primary} style={styles.loader} />
          )}
        </View>
      )
    }

    // ── ViewProfileThreeDotBtn: report menu (not a button-revamp button) ──────
    case 'ViewProfileThreeDotBtn': {
      return (
        <View style={styles.menuList}>
          <Pressable
            style={({ pressed }) => [styles.menuItem, pressed && styles.pressed]}
            onPress={() => handleAction('moreOption')}
          >
            <CdnSvg uri={IMG + 'viewprofile/report-profile-img.svg'} width={20} height={20} />
            <Text style={styles.menuText}>Report this Profile</Text>
          </Pressable>
        </View>
      )
    }

    // ── GalleryBtn: like / save / message full-width CTA ─────────────────────
    // Angular: ion-button.primary-cta-jodii (like/save) or dont-show-btn (message)
    case 'GalleryBtn': {
      return (
        <View style={styles.fullWidth}>
          {saveType === 0 && (
            isLiked(liked)
              ? <ButtonRevamp
                  label="Liked"
                  variant="primary"
                  size="large"
                  icon="liked-img"
                  fullWidth
                  loading={loading}
                  onPress={() => handleAction('dislike')}
                />
              : <ButtonRevamp
                  label="Like Her"
                  variant="primary"
                  size="large"
                  icon="like-img"
                  fullWidth
                  loading={loading}
                  onPress={() => handleAction('like')}
                />
          )}
          {saveType === 1 && (
            isLiked(liked)
              ? <ButtonRevamp
                  label="Saved"
                  variant="primary"
                  size="large"
                  fullWidth
                  loading={loading}
                  onPress={() => handleAction('dislike')}
                />
              : <ButtonRevamp
                  label="Save"
                  variant="primary"
                  size="large"
                  fullWidth
                  loading={loading}
                  onPress={() => handleAction('like')}
                />
          )}
          {saveType === 2 && (
            // Angular: dont-show-btn class = fill="clear" equivalent
            <ButtonRevamp
              label="Message"
              variant="clear"
              size="large"
              icon="message-primary-img"
              fullWidth
              onPress={() => handleAction('jodimessages')}
            />
          )}
        </View>
      )
    }

    // ── NeedHelpRecharge: small pill outlined button ───────────────────────────
    // Angular: size="small" shape="round" fill="outline" color="dark"
    // Closest ButtonRevamp: ghost + medium (height 32, borderRadius 94 = pill)
    case 'NeedHelpRecharge': {
      return (
        <ButtonRevamp
          label="Need Help"
          variant="ghost"
          size="medium"
          icon="call-img"
          iconPosition="end"
          onPress={onHelpPress}
        />
      )
    }

    // ── Text-row buttons (icon + label, not button-revamp shaped) ─────────────
    case 'reportProfileBtn': {
      return (
        <Pressable
          style={({ pressed }) => [styles.textRow, pressed && styles.pressed]}
          onPress={() => handleAction('moreOption')}
        >
          <CdnSvg uri={IMG + 'viewprofile/report-profile-img.svg'} width={20} height={20} />
          <Text style={styles.textRowLabel}>{data?.BTNTEXT ?? 'Report profile'}</Text>
        </Pressable>
      )
    }

    case 'phoneViewBtn': {
      return (
        <Pressable
          style={({ pressed }) => [styles.textRow, pressed && styles.pressed]}
          onPress={() => handleAction('call')}
        >
          <CdnSvg uri={IMG + 'view-profile-message.svg'} width={20} height={20} />
          <Text style={styles.textRowLabel}>{data?.BTNTEXT ?? 'View Phone'}</Text>
        </Pressable>
      )
    }

    case 'blockProfileBtn': {
      return (
        <Pressable
          style={({ pressed }) => [styles.textRow, pressed && styles.pressed]}
          onPress={() => onAction?.('block', data)}
        >
          <CdnSvg uri={IMG + 'revamp/close-icon.svg'} width={20} height={20} />
          <Text style={styles.textRowLabel}>{data?.BTNTEXT ?? 'Block profile'}</Text>
        </Pressable>
      )
    }

    case 'unblockProfileBtn': {
      return (
        <Pressable
          style={({ pressed }) => [styles.textRow, pressed && styles.pressed]}
          onPress={() => onAction?.('unblock', data)}
        >
          <CdnSvg uri={IMG + 'unblock-jodii-chat-img.svg'} width={20} height={20} />
          <Text style={styles.textRowLabel}>{data?.BTNTEXT ?? 'UnBlock profile'}</Text>
        </Pressable>
      )
    }

    case 'safetyTipBtn': {
      return (
        <Pressable
          style={({ pressed }) => [styles.textRow, pressed && styles.pressed]}
          onPress={() => onAction?.('safetyTip', data)}
        >
          <CdnSvg uri={IMG + 'safety-tips-message.svg'} width={20} height={20} />
          <Text style={styles.textRowLabel}>{data?.BTNTEXT ?? 'Safety Tips'}</Text>
        </Pressable>
      )
    }

    // ── Icon-only call / message buttons (not button-revamp shaped) ───────────
    case 'vpCallBtn': {
      return (
        <Pressable
          style={({ pressed }) => pressed && styles.pressed}
          onPress={() => handleAction('call')}
        >
          <CdnSvg uri={IMG + 'matches-call-icon.svg'} width={28} height={28} />
        </Pressable>
      )
    }

    case 'vpmessageBtn': {
      return (
        <Pressable
          style={({ pressed }) => [styles.centeredIcon, pressed && styles.pressed]}
          onPress={() => handleAction('jodimessages')}
        >
          <CdnSvg uri={IMG + 'message-matches.svg'} width={28} height={28} />
        </Pressable>
      )
    }

    case 'vpmessageBtnHdr': {
      return (
        <Pressable
          style={({ pressed }) => [styles.iconHdr, pressed && styles.pressed]}
          onPress={() => handleAction('jodimessages')}
        >
          <CdnSvg uri={IMG + 'message-matches.svg'} width={18} height={18} />
        </Pressable>
      )
    }

    case 'viewProfileCallBtn': {
      return (
        <Pressable
          style={({ pressed }) => [styles.centeredIcon, pressed && styles.pressed]}
          onPress={() => handleAction('call')}
        >
          <CdnSvg uri={IMG + 'revamp/call-revamp.svg'} width={28} height={28} />
        </Pressable>
      )
    }

    case 'viewProfileCallBtnHdr': {
      return (
        <Pressable
          style={({ pressed }) => [styles.iconHdr, pressed && styles.pressed]}
          onPress={() => handleAction('call')}
        >
          <CdnSvg uri={IMG + 'revamp/call-revamp.svg'} width={18} height={18} />
        </Pressable>
      )
    }

    // ── vpCallWhatsApp: side-by-side pill buttons ─────────────────────────────
    // Angular: ion-button.contact-details-call-whatsapp-btn (callwhatsapp size)
    case 'vpCallWhatsApp': {
      return (
        <View style={styles.waRow}>
          {showWhatsapp && (
            <ButtonRevamp
              label={data?.CTAWA ?? 'WhatsApp'}
              variant="callwhatsapp"
              size="callwhatsapp"
              icon="whatsapp-img"
              iconPosition="start"
              onPress={() => handleAction('whatsapp')}
              style={styles.waBtn}
            />
          )}
          <ButtonRevamp
            label={data?.CTACL ?? 'Call Now'}
            variant="callwhatsapp"
            size="callwhatsapp"
            icon="call-img"
            iconPosition="start"
            loading={loading}
            onPress={() => handleAction('call')}
            style={[styles.waBtn, showWhatsapp ? { marginLeft: 8 } : undefined]}
          />
        </View>
      )
    }

    case 'messageCallBtn': {
      return (
        <Pressable
          style={({ pressed }) => pressed && styles.pressed}
          onPress={() => handleAction('call')}
        >
          <CdnSvg uri={IMG + 'call-message.svg'} width={20} height={20} />
        </Pressable>
      )
    }

    case 'vpCallWhatsAppBtn': {
      return (
        <Pressable
          style={({ pressed }) => pressed && styles.pressed}
          onPress={() => handleAction('whatsapp')}
        >
          <CdnSvg uri={IMG + 'whatsapp-revamp.svg'} width={28} height={28} />
        </Pressable>
      )
    }

    default:
      return null
  }
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  pressed: { opacity: 0.75 },

  // ContactVerticalBtn
  iconRow: {
    flexDirection: 'row',
    alignItems:    'center',
    paddingTop:    12,
  },
  iconBtn: {
    marginRight: 12,
  },
  // ViewProfileFooterBtn
  vpRow: {
    flexDirection: 'row',
    gap:           8,
    marginBottom:  8,
  },
  vpHalf: {
    flex: 5,
  },
  vpHalfPrimary: {
    flex: 6,
  },
  vpBottomRow: {
    marginTop: 4,
  },
  loader: {
    marginTop: 4,
  },

  // Three-dot menu
  menuList: {
    borderRadius:  6,
    shadowColor:   Colors.shadow,
    shadowOpacity: 0.12,
    shadowRadius:  8,
    shadowOffset:  { width: 0, height: 2 },
    elevation:     3,
    backgroundColor: Colors.white,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems:    'center',
    padding:       16,
    gap:           8,
  },
  menuText: {
    fontSize: FontSize.font14,
    color:    Colors.textPrimary,
  },

  // Text-row buttons
  textRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           8,
  },
  textRowLabel: {
    fontSize: FontSize.font14,
    color:    Colors.textPrimary,
  },

  // Icon-only
  centeredIcon: {
    alignItems:     'center',
    justifyContent: 'center',
    width:          '100%',
  },
  iconHdr: {
    width:  18,
    height: 18,
  },
  // vpCallWhatsApp
  waRow: {
    flexDirection:   'row',
    paddingHorizontal: 8,
    paddingBottom:   12,
    marginTop:       4,
  },
  waBtn: {
    flex: 1,
  },

  fullWidth: {
    width: '100%',
  },
})
