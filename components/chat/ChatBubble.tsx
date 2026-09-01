// A single one-to-one chat message — Angular: messages.component.html's
// per-message markup (lines 158-256 sent / 337-447 received). Composes text
// (kind='text'), image/video/audio attachments, and the phone-view system
// card (kind='viewed_number'); real history that already has pdf messages
// (kind='other') renders as a plain "Attachment" placeholder rather than the
// rich player Angular has for those — not sendable yet in this port, but
// existing ones must still render, not crash.
import { useEffect } from 'react'
import { Image, Pressable, StyleSheet, Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio'
import { LinearGradient } from 'expo-linear-gradient'
import CdnSvg from '../cdn-svg/CdnSvg'
import { WhatsAppIcon, getAvatarFallbackUri } from '../matches/matchesCard.shared'
import { Colors } from '../../constants/colors'
import { CDN_SVG } from '../../constants/cdn'
import { SemanticFontsEnglish } from '../../src/theme/fonts'
import { formatClockTime } from '../../utils/chatTime'
import type { ChatMessageItem } from '../../types/interfaces/chatMessage.interface'

const CDN = CDN_SVG

function ReadTick({ readStatus }: { readStatus: number }) {
  if (readStatus === 3) return <CdnSvg uri={CDN + 'seen-green-tick.svg'} width={14} height={14} />
  if (readStatus === 2) return <CdnSvg uri={CDN + 'double-tick-jodii-chat-img.svg'} width={14} height={14} />
  return <CdnSvg uri={CDN + 'single-tick-jodii-chat-img.svg'} width={14} height={14} />
}

function formatSeconds(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds))
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`
}

// Angular: app-audio-wave — play/pause (revamp/play-pink.svg + pause-pink.svg,
// unchanged for both sent/received bubbles) driving a wavesurfer.js waveform.
// wavesurfer isn't ported here (no RN equivalent); a plain progress bar
// stands in for the waveform, showing the same play position.
function AudioBubble({ item, isOwnMessage, readStatus, avatarUri, avatarFallbackGender }: { item: ChatMessageItem; isOwnMessage: boolean; readStatus: number; avatarUri?: string | undefined; avatarFallbackGender: 'M' | 'F' }) {
  const player = useAudioPlayer(item.text)
  const status = useAudioPlayerStatus(player)

  useEffect(() => {
    if (status.didJustFinish) {
      player.pause()
      player.seekTo(0)
    }
  }, [status.didJustFinish, player])

  const toggle = () => (status.playing ? player.pause() : player.play())
  const totalSeconds = status.duration || 0
  const progress = totalSeconds > 0 ? Math.min(1, status.currentTime / totalSeconds) : 0
  const label = status.playing || status.currentTime > 0 ? formatSeconds(status.currentTime) : (item.duration ?? formatSeconds(totalSeconds))

  return (
    <View style={[styles.row, isOwnMessage ? styles.rowOwn : styles.rowPartner]}>
      {!isOwnMessage && <Avatar uri={avatarUri} fallbackGender={avatarFallbackGender} />}
      <View style={[styles.audioBubble, isOwnMessage ? styles.bubbleOwn : styles.bubblePartner]}>
        <Pressable onPress={toggle} hitSlop={8}>
          <CdnSvg uri={CDN + (status.playing ? 'revamp/pause-pink.svg' : 'revamp/play-pink.svg')} width={28} height={28} />
        </Pressable>
        <View style={styles.audioTrack}>
          <View style={[styles.audioProgress, { width: `${progress * 100}%` }]} />
        </View>
        <Text style={[styles.audioTime, isOwnMessage ? styles.textOwn : styles.textPartner]}>{label}</Text>
        {isOwnMessage && <ReadTick readStatus={readStatus} />}
      </View>
      {isOwnMessage && <Avatar uri={avatarUri} fallbackGender={avatarFallbackGender} />}
    </View>
  )
}

interface Props {
  item: ChatMessageItem
  // Angular: clickedImage()/showSelfVideoPopUp() — tapping an already-sent
  // image/video bubble opens it full-screen. Omitted (never called) for
  // kinds that aren't media.
  onPressMedia?: ((kind: 'image' | 'video', uri: string) => void) | undefined
  // Angular: getGenderPrefix_His_Her() — opposite-gender pronoun for
  // YOUVIEWEDNUMBER's ##HIS_HER## placeholder, same convention MessagerList's
  // ConversationRow.tsx uses.
  oppGender?: 'M' | 'F'
  // Angular: messages.component.ts's callWhatsApp('call'/'whatsapp', 'opposite')
  // — only used by kind==='viewed_number'.
  onCallPress?: (() => void) | undefined
  onWhatsAppPress?: (() => void) | undefined
  // Angular: ion-avatar.chat-avatar-profile — every row (send or received)
  // shows the sender's photo beside the bubble: loginUserPhoto on the sent
  // side, oppositeIdDetails.Photourl on the received side.
  ownPhoto?: string | undefined
  partnerPhoto?: string | undefined
}

// Angular: ion-avatar.chat-avatar-profile — 11.12vmin circle, sits as a
// sibling of the bubble/card, not inside it. Angular: messages.component.ts:186
// — loginUserPhoto falls back to common.getAvatarImg() (a default silhouette)
// when localStorage's PHOTOURL is empty/missing, rather than leaving the
// avatar blank; same onImgErrorHandler() fallback applies to the partner's
// photo too. This had no such fallback at all — an empty/failed uri rendered
// as a flat, imageless grey circle.
function Avatar({ uri, fallbackGender }: { uri?: string | undefined; fallbackGender: 'M' | 'F' }) {
  const src = uri || getAvatarFallbackUri(fallbackGender)
  return <Image source={{ uri: src }} style={styles.avatar} />
}

export default function ChatBubble({ item, onPressMedia, oppGender = 'M', onCallPress, onWhatsAppPress, ownPhoto, partnerPhoto }: Props) {
  const { t } = useTranslation()
  const avatarUri = item.isOwnMessage ? ownPhoto : partnerPhoto
  // getAvatarFallbackUri's param is "which gender's avatar to show" — for the
  // own-message side that's the LOGGED-IN user's own gender (opposite of
  // oppGender, which is the partner's gender); for the received side it's
  // oppGender directly.
  const ownGender: 'M' | 'F' = oppGender === 'F' ? 'M' : 'F'
  const avatarFallbackGender = item.isOwnMessage ? ownGender : oppGender

  // Angular: messages.component.html:137-158 (sent side, MessageType 11/13)
  // and 316-337 (received side, MessageType 12/13) — a real headline plus two
  // full-width outlined Call Now/WhatsApp buttons, inside the SAME avatar+
  // bubble+timestamp row shell every other message uses — not a small grey
  // caption pill (that pill design is MessagerListScreen's own thread-list
  // ConversationRow summary line, a different screen/component entirely).
  if (item.kind === 'viewed_number') {
    // Angular: .viewed-number-send/.viewed-number-received — a light purple-
    // tinted gradient card with a hairline border, not a flat grey fill; and
    // the timestamp+tick sit in a separate row BELOW the card (.send-msg-time-
    // block/.received-msg-time-block), not inside it.
    return (
      <View style={[styles.row, item.isOwnMessage ? styles.rowOwn : styles.rowPartner]}>
        <View style={item.isOwnMessage ? styles.systemColOwn : styles.systemColPartner}>
          <View style={[styles.systemRow, item.isOwnMessage && styles.systemRowOwn]}>
            {!item.isOwnMessage && <Avatar uri={avatarUri} fallbackGender={avatarFallbackGender} />}
            <LinearGradient
              colors={['#EAEBF5', '#FFFFFF']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.systemCard, item.isOwnMessage ? styles.systemCardOwn : styles.systemCardPartner]}
            >
              <Text style={styles.systemTitle}>
                {item.youViewedThem
                  ? t('MESSAGES.YOUVIEWEDNUMBER').replace(/##HIS_HER##/gi, t(`PRONOUN.${oppGender}.hisher`))
                  : t('MESSAGES.VIEWEDYOURNUMBER').replace(/##HE_SHE##/gi, t(`PRONOUN.${oppGender}.heshe`))}
              </Text>
              {/* Angular: EButtonIcons.callPrimary = 'call-primary.svg' — a
                  DIFFERENT call icon from the shared CallIcon (call-revamp.svg)
                  used elsewhere, specific to this msgBtn variant. iconSize
                  'small' = 16x16 (button-revamp.component.scss:391-394). */}
              <Pressable style={styles.systemBtn} onPress={onCallPress}>
                <CdnSvg uri={CDN + 'call-primary.svg'} width={16} height={16} />
                <Text style={styles.systemBtnText}>{t('HOME.CALL_NOW_CTA')}</Text>
              </Pressable>
              <Pressable style={[styles.systemBtn, styles.systemBtnSpaced]} onPress={onWhatsAppPress}>
                <WhatsAppIcon width={16} height={16} />
                <Text style={styles.systemBtnText}>{t('GENERAL.WHATSAPP')}</Text>
              </Pressable>
            </LinearGradient>
            {item.isOwnMessage && <Avatar uri={avatarUri} fallbackGender={avatarFallbackGender} />}
          </View>
          <View style={[styles.systemTimeRow, item.isOwnMessage ? styles.systemTimeRowOwn : styles.systemTimeRowPartner]}>
            <Text style={styles.systemTime}>{formatClockTime(item.timestamp)}</Text>
            {item.isOwnMessage && <ReadTick readStatus={item.readStatus} />}
          </View>
        </View>
      </View>
    )
  }

  if (item.kind === 'audio') {
    return <AudioBubble item={item} isOwnMessage={item.isOwnMessage} readStatus={item.readStatus} avatarUri={avatarUri} avatarFallbackGender={avatarFallbackGender} />
  }

  if (item.kind === 'image' || item.kind === 'video') {
    return (
      <View style={[styles.row, item.isOwnMessage ? styles.rowOwn : styles.rowPartner]}>
        {!item.isOwnMessage && <Avatar uri={avatarUri} fallbackGender={avatarFallbackGender} />}
        <Pressable
          style={[styles.mediaBubble, item.isOwnMessage ? styles.bubbleOwn : styles.bubblePartner]}
          onPress={() => onPressMedia?.(item.kind as 'image' | 'video', item.text)}
        >
          {item.kind === 'image' ? (
            <Image source={{ uri: item.text }} style={styles.mediaThumb} resizeMode="cover" />
          ) : (
            // Angular: poster="rectangle_bg.svg" — a generic placeholder
            // rectangle, not an extracted video frame; the play icon overlay
            // is the only visual cue this is a video.
            <View style={[styles.mediaThumb, styles.videoPlaceholder]}>
              <CdnSvg uri={CDN + 'play-btn-chat-img.svg'} width={36} height={36} />
            </View>
          )}
          <View style={styles.mediaMeta}>
            <Text style={styles.mediaTime}>{formatClockTime(item.timestamp)}</Text>
            {item.isOwnMessage && <ReadTick readStatus={item.readStatus} />}
          </View>
        </Pressable>
        {item.isOwnMessage && <Avatar uri={avatarUri} fallbackGender={avatarFallbackGender} />}
      </View>
    )
  }

  const bodyText = item.kind === 'other' ? t('MESSAGES.ATTACHMENT') : item.text

  return (
    <View style={[styles.row, item.isOwnMessage ? styles.rowOwn : styles.rowPartner]}>
      {!item.isOwnMessage && <Avatar uri={avatarUri} fallbackGender={avatarFallbackGender} />}
      <View style={[styles.bubble, item.isOwnMessage ? styles.bubbleOwn : styles.bubblePartner]}>
        <Text style={[styles.text, item.isOwnMessage ? styles.textOwn : styles.textPartner]}>{bodyText}</Text>
        <View style={styles.meta}>
          <Text style={[styles.time, item.isOwnMessage ? styles.timeOwn : styles.timePartner]}>
            {formatClockTime(item.timestamp)}
          </Text>
          {item.isOwnMessage && <ReadTick readStatus={item.readStatus} />}
        </View>
      </View>
      {item.isOwnMessage && <Avatar uri={avatarUri} fallbackGender={avatarFallbackGender} />}
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 12, marginVertical: 3, gap: 6 },
  rowOwn: { justifyContent: 'flex-end' },
  rowPartner: { justifyContent: 'flex-start' },

  // Angular: ion-avatar.chat-avatar-profile — 11.12vmin (~42px on a common
  // 375pt-wide phone) circle beside every bubble/card.
  avatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.surfaceAlt },

  bubble: { maxWidth: '72%', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8 },
  bubbleOwn: { backgroundColor: Colors.primary, borderBottomRightRadius: 4 },
  bubblePartner: { backgroundColor: Colors.surfaceAlt, borderBottomLeftRadius: 4 },

  text: { fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: 14, lineHeight: 19 },
  textOwn: { color: Colors.white },
  textPartner: { color: Colors.textPrimary },

  meta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4, alignSelf: 'flex-end' },
  time: { fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: 10 },
  timeOwn: { color: 'rgba(255,255,255,0.8)' },
  timePartner: { color: Colors.textTertiary },

  // Angular: the viewed-number row's outer column — bubble/avatar row plus
  // the timestamp row stacked underneath, each end-aligned to their side.
  systemColOwn: { alignItems: 'flex-end', maxWidth: '82%' },
  systemColPartner: { alignItems: 'flex-start', maxWidth: '82%' },
  systemRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 6 },
  systemRowOwn: { justifyContent: 'flex-end' },

  // Angular: .viewed-number-send/.viewed-number-received — a light purple-
  // tinted gradient card (linear-gradient(251deg, #EAEBF5 0%, #FFF 100%))
  // with a hairline #BDC0E0 border and an asymmetric "notch" corner facing
  // the avatar, not a flat grey fill with uniform corners.
  systemCard: {
    flexShrink: 1, borderWidth: 1, borderColor: '#BDC0E0',
    paddingHorizontal: 14, paddingVertical: 12, gap: 4,
  },
  systemCardOwn: { borderRadius: 14, borderTopRightRadius: 0 },
  systemCardPartner: { borderRadius: 14, borderTopLeftRadius: 0 },
  systemTitle: {
    fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: 14, lineHeight: 19,
    color: Colors.textPrimary, marginBottom: 8,
  },
  // Angular: app-button-revamp [buttonSize]='msgBtn' [border]='primaryBorder'
  // [background]='whiteBg' [textColor]='lightBlack' — white fill, outlined,
  // full width, stacked. .msgBtn: height 32px (not 40), border-radius 4px
  // (not 8) (button-revamp.component.scss:100-103,159-165).
  systemBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3,
    height: 32, borderRadius: 4, borderWidth: 1, borderColor: Colors.primary,
    backgroundColor: Colors.white,
  },
  systemBtnSpaced: { marginTop: 8 },
  // Angular: no ctaFontSize passed → falls back to body2-regular-14, then the
  // .msgBtn size variant overrides it to 12px/weight 400 (still Poppins-
  // Regular) — NOT medium/14 as this had before.
  systemBtnText: { fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontWeight: '400', fontSize: 12, color: Colors.textPrimary },
  // Angular: .send-msg-time-block/.received-msg-time-block — the timestamp
  // (+ read tick, sent side only) sits BELOW the card, not inside it.
  systemTimeRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  systemTimeRowOwn: { alignSelf: 'flex-end' },
  systemTimeRowPartner: { alignSelf: 'flex-start', marginLeft: 38 },
  systemTime: { fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: 10, color: Colors.textTertiary },

  // Angular: .image-video-send-receive — a borderless media box; kept inside
  // the same colored bubble shell as text messages here for visual
  // consistency with the rest of this chat UI, rather than a bare image.
  mediaBubble: { maxWidth: '65%', borderRadius: 14, padding: 4, overflow: 'hidden' },
  mediaThumb: { width: 200, height: 200, borderRadius: 10, backgroundColor: Colors.surfaceAlt },
  videoPlaceholder: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#00000022' },
  mediaMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4, alignSelf: 'flex-end', paddingRight: 4 },
  mediaTime: { fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: 10, color: Colors.textTertiary },

  audioBubble: {
    flexDirection: 'row', alignItems: 'center', gap: 8, maxWidth: '78%',
    borderRadius: 14, paddingHorizontal: 10, paddingVertical: 8,
  },
  audioTrack: { flex: 1, height: 3, borderRadius: 2, backgroundColor: 'rgba(128,128,128,0.35)', overflow: 'hidden' },
  audioProgress: { height: '100%', backgroundColor: Colors.primary },
  audioTime: { fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: 11 },
})
