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
import CdnSvg from '../cdn-svg/CdnSvg'
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
function AudioBubble({ item, isOwnMessage, readStatus }: { item: ChatMessageItem; isOwnMessage: boolean; readStatus: number }) {
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
    </View>
  )
}

interface Props {
  item: ChatMessageItem
  // Angular: clickedImage()/showSelfVideoPopUp() — tapping an already-sent
  // image/video bubble opens it full-screen. Omitted (never called) for
  // kinds that aren't media.
  onPressMedia?: ((kind: 'image' | 'video', uri: string) => void) | undefined
}

export default function ChatBubble({ item, onPressMedia }: Props) {
  const { t } = useTranslation()

  if (item.kind === 'viewed_number') {
    return (
      <View style={styles.systemRow}>
        <View style={styles.systemCard}>
          <CdnSvg uri={CDN + 'viewed-eye-message.svg'} width={14} height={14} />
          <Text style={styles.systemText}>
            {item.isOwnMessage ? t('MESSAGES.YOUVIEWEDNUMBER').replace(/##[A-Z_]+##/g, '') : t('MESSAGES.VIEWEDYOURNUMBER_SUBTITLE')}
          </Text>
        </View>
      </View>
    )
  }

  if (item.kind === 'audio') {
    return <AudioBubble item={item} isOwnMessage={item.isOwnMessage} readStatus={item.readStatus} />
  }

  if (item.kind === 'image' || item.kind === 'video') {
    return (
      <View style={[styles.row, item.isOwnMessage ? styles.rowOwn : styles.rowPartner]}>
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
      </View>
    )
  }

  const bodyText = item.kind === 'other' ? t('MESSAGES.ATTACHMENT') : item.text

  return (
    <View style={[styles.row, item.isOwnMessage ? styles.rowOwn : styles.rowPartner]}>
      <View style={[styles.bubble, item.isOwnMessage ? styles.bubbleOwn : styles.bubblePartner]}>
        <Text style={[styles.text, item.isOwnMessage ? styles.textOwn : styles.textPartner]}>{bodyText}</Text>
        <View style={styles.meta}>
          <Text style={[styles.time, item.isOwnMessage ? styles.timeOwn : styles.timePartner]}>
            {formatClockTime(item.timestamp)}
          </Text>
          {item.isOwnMessage && <ReadTick readStatus={item.readStatus} />}
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', paddingHorizontal: 12, marginVertical: 3 },
  rowOwn: { justifyContent: 'flex-end' },
  rowPartner: { justifyContent: 'flex-start' },

  bubble: { maxWidth: '78%', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8 },
  bubbleOwn: { backgroundColor: Colors.primary, borderBottomRightRadius: 4 },
  bubblePartner: { backgroundColor: Colors.surfaceAlt, borderBottomLeftRadius: 4 },

  text: { fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: 14, lineHeight: 19 },
  textOwn: { color: Colors.white },
  textPartner: { color: Colors.textPrimary },

  meta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4, alignSelf: 'flex-end' },
  time: { fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: 10 },
  timeOwn: { color: 'rgba(255,255,255,0.8)' },
  timePartner: { color: Colors.textTertiary },

  systemRow: { alignItems: 'center', paddingHorizontal: 12, marginVertical: 6 },
  systemCard: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.surfaceAlt, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 8, maxWidth: '90%',
  },
  systemText: { fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: 12, color: Colors.textSecondary, flexShrink: 1 },

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
