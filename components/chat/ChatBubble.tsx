// A single one-to-one chat message — Angular: messages.component.html's
// per-message markup (lines 158-256 sent / 337-447 received). Composes text
// (kind='text'), image/video/audio attachments, and the phone-view system
// card (kind='viewed_number'); real history that already has pdf messages
// (kind='other') renders as a plain "Attachment" placeholder rather than the
// rich player Angular has for those — not sendable yet in this port, but
// existing ones must still render, not crash.
import { memo, useEffect, useRef } from 'react'
import { Image, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio'
import { LinearGradient } from 'expo-linear-gradient'
import CdnSvg, { CdnImage } from '../cdn-svg/CdnSvg'
import { WhatsAppIcon, getAvatarFallbackUri } from '../matches/matchesCard.shared'
import { Colors } from '../../constants/colors'
import { CDN_SVG } from '../../constants/cdn'
import { FontSize, SemanticFontsEnglish } from '../../src/theme/fonts'
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

// Angular: messages.component.ts ngAfterViewInit's global capture-phase
// 'play' listener — pauses every other <audio> element the instant one
// starts, fixing a real multi-playback bug. Each AudioBubble below is its own
// independent player instance with no shared parent state, so this module-
// level pub-sub stands in for the DOM-wide listener Angular relies on.
const audioStopListeners = new Set<() => void>()

// Angular: app-audio-wave — play/pause (revamp/play-pink.svg + pause-pink.svg,
// unchanged for both sent/received bubbles) driving a wavesurfer.js waveform.
// wavesurfer isn't ported here (no RN equivalent); a plain progress bar
// stands in for the waveform, showing the same play position.
function AudioBubble({ item, isOwnMessage, readStatus, avatarUri, avatarFallbackGender, avatarSize }: { item: ChatMessageItem; isOwnMessage: boolean; readStatus: number; avatarUri?: string | undefined; avatarFallbackGender: 'M' | 'F'; avatarSize: number }) {
  const player = useAudioPlayer(item.text)
  const status = useAudioPlayerStatus(player)

  useEffect(() => {
    if (status.didJustFinish) {
      player.pause()
      player.seekTo(0)
    }
  }, [status.didJustFinish, player])

  // See audioStopListeners above — pauseRef always calls the current
  // player.pause, so a stale closure inside the Set is never an issue.
  const pauseRef = useRef(() => player.pause())
  pauseRef.current = () => player.pause()

  useEffect(() => {
    const listener = () => pauseRef.current()
    audioStopListeners.add(listener)
    return () => { audioStopListeners.delete(listener) }
  }, [])

  const toggle = () => {
    if (status.playing) {
      player.pause()
      return
    }
    // Pausing every bubble (including this one) right before play() is a
    // harmless no-op for this player specifically — it's about to start
    // anyway — and correctly stops any other bubble that was mid-playback.
    audioStopListeners.forEach(listener => listener())
    player.play()
  }
  const totalSeconds = status.duration || 0
  const progress = totalSeconds > 0 ? Math.min(1, status.currentTime / totalSeconds) : 0
  const label = status.playing || status.currentTime > 0 ? formatSeconds(status.currentTime) : (item.duration ?? formatSeconds(totalSeconds))

  return (
    <View style={[styles.row, isOwnMessage ? styles.rowOwn : styles.rowPartner]}>
      {!isOwnMessage && <Avatar uri={avatarUri} fallbackGender={avatarFallbackGender} size={avatarSize} />}
      <View style={[styles.audioBubble, isOwnMessage ? styles.bubbleOwn : styles.bubblePartner]}>
        <Pressable onPress={toggle} hitSlop={8}>
          <CdnSvg uri={CDN + (status.playing ? 'revamp/pause-pink.svg' : 'revamp/play-pink.svg')} width={28} height={28} />
        </Pressable>
        <View style={styles.audioTrack}>
          <View style={[styles.audioProgress, { width: `${progress * 100}%` }]} />
        </View>
        <Text style={styles.audioTime}>{label}</Text>
        {isOwnMessage && <ReadTick readStatus={readStatus} />}
      </View>
      {isOwnMessage && <Avatar uri={avatarUri} fallbackGender={avatarFallbackGender} size={avatarSize} />}
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
function Avatar({ uri, fallbackGender, size }: { uri?: string | undefined; fallbackGender: 'M' | 'F'; size: number }) {
  const src = uri || getAvatarFallbackUri(fallbackGender)
  // The fallback silhouette is a remote .svg — native <Image> can't decode
  // that (see CdnSvg.tsx), so this needs CdnImage's format detection.
  return (
    <CdnImage
      uri={src}
      width={size}
      height={size}
      resizeMode="cover"
      style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}
    />
  )
}

// memo() — ChatScreen.tsx now renders this inside a FlatList (was a plain
// ScrollView+.map()); wrapping it means an unrelated ChatScreen re-render
// (typing state, menu toggles, etc.) doesn't force every visible bubble to
// re-render.
const ChatBubble = memo(function ChatBubble({ item, onPressMedia, oppGender = 'M', onCallPress, onWhatsAppPress, ownPhoto, partnerPhoto }: Props) {
  const { t } = useTranslation()
  // Angular's ion-col[size=auto] + width:90% chain renders narrower than a
  // plain 90%-of-available-space would in RN (Ionic's auto column doesn't
  // grow to fill the row) — narrow enough that "You viewed his mobile
  // number" wraps to 2 lines. A literal 90%-of-remaining-space in RN leaves
  // too much room and the heading stays on 1 line, so this targets a width
  // that reproduces Angular's actual visual result (2-line wrap) directly,
  // rather than the exact (unreproducible) CSS percentage chain.
  const { width: winW, height: winH } = useWindowDimensions()
  const systemCardWidth = winW * 0.62
  // Angular: ion-avatar.chat-avatar-profile { width/height: 11.12vmin } —
  // same formula ChatScreen.tsx's own header avatar uses; ChatBubble's Avatar
  // was previously a fixed 45x45, only coincidentally close at a ~400pt-wide
  // reference device.
  const avatarSize = (Math.min(winW, winH) * 11.12) / 100
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
            {!item.isOwnMessage && <Avatar uri={avatarUri} fallbackGender={avatarFallbackGender} size={avatarSize} />}
            {/* Angular: linear-gradient(251deg, #EAEBF5 0%, #FFF 100%) — CSS
                angles run clockwise from north (pointing toward the 100%/white
                end); 251deg's direction vector is (-0.946, 0.326) in screen
                space, so the light lavender (0%) sits near the top-right
                corner and fades to white toward the bottom-left, not a plain
                diagonal corner-to-corner (0,0)->(1,1). */}
            <LinearGradient
              colors={['#EAEBF5', '#FFFFFF']}
              start={{ x: 0.973, y: 0.337 }}
              end={{ x: 0.027, y: 0.663 }}
              style={[styles.systemCard, { width: systemCardWidth }, item.isOwnMessage ? styles.systemCardOwn : styles.systemCardPartner]}
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
            {item.isOwnMessage && <Avatar uri={avatarUri} fallbackGender={avatarFallbackGender} size={avatarSize} />}
          </View>
          <View style={[
            styles.systemTimeRow,
            { width: systemCardWidth },
            item.isOwnMessage ? styles.systemTimeRowOwn : styles.systemTimeRowPartner,
            item.isOwnMessage ? { marginRight: avatarSize + 6 } : { marginLeft: avatarSize + 6 },
          ]}>
            <Text style={styles.systemTime}>{formatClockTime(item.timestamp)}</Text>
            {item.isOwnMessage && <ReadTick readStatus={item.readStatus} />}
          </View>
        </View>
      </View>
    )
  }

  if (item.kind === 'audio') {
    return <AudioBubble item={item} isOwnMessage={item.isOwnMessage} readStatus={item.readStatus} avatarUri={avatarUri} avatarFallbackGender={avatarFallbackGender} avatarSize={avatarSize} />
  }

  if (item.kind === 'image' || item.kind === 'video') {
    // Angular: image/video shares the exact same `.send-msg-block`/
    // `.received-msg-block` wrapper + `.send-msg-time-block`/`.received-msg-
    // time-block` sibling row as the plain text bubble below — the per-type
    // `.send-msg-image-time` in-bubble overlay is dead/commented-out markup,
    // not what actually renders. Reusing the exact same row/col/meta
    // structure as the text branch instead of a separate in-bubble overlay.
    return (
      <View style={[styles.row, item.isOwnMessage ? styles.rowOwn : styles.rowPartner]}>
        <View style={item.isOwnMessage ? styles.systemColOwn : styles.systemColPartner}>
          <View style={[styles.bubbleRow, item.isOwnMessage && styles.bubbleRowOwn]}>
            {!item.isOwnMessage && <Avatar uri={avatarUri} fallbackGender={avatarFallbackGender} size={avatarSize} />}
            <Pressable
              style={[styles.mediaBubble, item.isOwnMessage ? styles.bubbleOwn : styles.bubblePartner]}
              onPress={() => onPressMedia?.(item.kind as 'image' | 'video', item.text)}
            >
              {item.kind === 'image' ? (
                <Image source={{ uri: item.text }} style={styles.mediaThumb} resizeMode="cover" />
              ) : (
                // Angular: poster="rectangle_bg.svg" — a generic placeholder
                // rectangle, not an extracted video frame; the play icon is a
                // small circular badge (`.download-img-block`), not a full-
                // thumbnail dark tint with a large centered icon.
                <View style={styles.mediaThumb}>
                  <View style={styles.videoPlayBadge}>
                    <CdnSvg uri={CDN + 'play-btn-chat-img.svg'} width={24} height={24} />
                  </View>
                </View>
              )}
            </Pressable>
            {item.isOwnMessage && <Avatar uri={avatarUri} fallbackGender={avatarFallbackGender} size={avatarSize} />}
          </View>
          <View style={[styles.meta, item.isOwnMessage ? styles.metaOwn : styles.metaPartner, item.isOwnMessage && { marginRight: avatarSize + 6 }]}>
            <Text style={[styles.time, item.isOwnMessage ? styles.timeOwn : styles.timePartner]}>
              {formatClockTime(item.timestamp)}
            </Text>
            {item.isOwnMessage && <ReadTick readStatus={item.readStatus} />}
          </View>
        </View>
      </View>
    )
  }

  const bodyText = item.kind === 'other' ? t('MESSAGES.ATTACHMENT') : item.text

  // Angular: .send-msg-time-block/.received-msg-time-block (messages.component.
  // html:278/456) is a SIBLING of the bubble+avatar row, not a child inside the
  // bubble — it sits below and outside the bubble's border/background, offset
  // by margin-right/margin-left: calc(11.12vmin + 6px) (the avatar's own width
  // + 6px gap), not nested inside the bubble's padding box. Same outer
  // row→column→(content row + timestamp row) shape as the viewed_number
  // branch above: `row` is the true per-message wrapper (marginTop:16,
  // paddingHorizontal:12), `systemColOwn/Partner` stacks the content row and
  // the timestamp row, `bubbleRow` is just the bubble+avatar horizontal pair.
  return (
    <View style={[styles.row, item.isOwnMessage ? styles.rowOwn : styles.rowPartner]}>
      <View style={item.isOwnMessage ? styles.systemColOwn : styles.systemColPartner}>
        <View style={[styles.bubbleRow, item.isOwnMessage && styles.bubbleRowOwn]}>
          {!item.isOwnMessage && <Avatar uri={avatarUri} fallbackGender={avatarFallbackGender} size={avatarSize} />}
          <View style={[styles.bubble, item.isOwnMessage ? styles.bubbleOwn : styles.bubblePartner]}>
            <Text style={[styles.text, item.isOwnMessage ? styles.textOwn : styles.textPartner]}>{bodyText}</Text>
          </View>
          {item.isOwnMessage && <Avatar uri={avatarUri} fallbackGender={avatarFallbackGender} size={avatarSize} />}
        </View>
        <View style={[styles.meta, item.isOwnMessage ? styles.metaOwn : styles.metaPartner, item.isOwnMessage && { marginRight: avatarSize + 6 }]}>
          <Text style={[styles.time, item.isOwnMessage ? styles.timeOwn : styles.timePartner]}>
            {formatClockTime(item.timestamp)}
          </Text>
          {item.isOwnMessage && <ReadTick readStatus={item.readStatus} />}
        </View>
      </View>
    </View>
  )
})

export default ChatBubble

const styles = StyleSheet.create({
  // Angular: ion-row's own mt-16 (messages.component.html:126/300) — 16px
  // TOP-only margin per message row, giving 16px between consecutive
  // same-day messages. Used two ways: as the sole row for audio/media
  // messages (bubble+avatar, timestamp still inside those bubbles — not
  // restructured, unconfirmed against Angular for those two kinds), and as
  // the OUTER wrapper for text/viewed_number messages (which nest a further
  // `bubbleRow`/`systemRow` inside for the bubble+avatar pairing, with the
  // timestamp as a separate sibling below) — `gap:6` only matters for the
  // former case since the latter's inner rows carry their own gap.
  row: { flexDirection: 'row', paddingHorizontal: 12, marginTop: 16, gap: 6 },
  rowOwn: { justifyContent: 'flex-end' },
  rowPartner: { justifyContent: 'flex-start' },

  // Angular: neither .d-flex row wrapper (html:135 sent / html:308 received)
  // sets align-items, so it's flexbox's default `stretch` — the avatar sits
  // flush with the TOP of the row, not bottom-anchored. This is the inner
  // bubble+avatar pairing (was called `row` before the timestamp got moved
  // out to its own sibling row below).
  bubbleRow: { flexDirection: 'row', gap: 6 },
  bubbleRowOwn: { justifyContent: 'flex-end' },

  // Angular: ion-avatar.chat-avatar-profile — 11.12vmin (~42px on a common
  // 375pt-wide phone) circle beside every bubble/card.
  avatar: { width: 45, height: 45, borderRadius: 22.5, backgroundColor: Colors.surfaceAlt },

  // Angular: .send-msg-block/.received-msg-block (messages.component.scss:379-
  // 384/486-491) — BOTH sides are white with a #E6E6E6 border; they're
  // distinguished only by which corner is squared off (the "tail"), not by
  // background color. padding: 14px all sides (not 12h/8v). bubbleOwn/
  // bubblePartner carry background+border directly (not just on `bubble`) so
  // they still apply when combined with mediaBubble/audioBubble instead.
  bubble: { maxWidth: '72%', paddingHorizontal: 14, paddingVertical: 14 },
  bubbleOwn: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E6E6E6', borderRadius: 12, borderTopRightRadius: 0 },
  bubblePartner: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E6E6E6', borderRadius: 12, borderTopLeftRadius: 0 },

  // Angular: sent side's ion-label carries `body2-regular-14` directly
  // (html:160), whose `!important` font-size (--font14) wins the cascade
  // over the less-specific-but-non-important `.send-msg-block ion-label`
  // rule's font12 — so despite that rule's own font-size, the sent text
  // actually renders at 14px, same as the received side's own (unclassed)
  // `.received-msg-block ion-label` rule. Both Poppins-Regular, color #000
  // on both sides (no white-on-color text since neither bubble is colored
  // anymore).
  // Angular: neither `.send-msg-block ion-label`/`.received-msg-block
  // ion-label` nor body2-regular-14 sets an explicit line-height — no
  // lineHeight here, let it fall back to the font's natural metric.
  text: { fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: FontSize.font14, color: Colors.black },
  textOwn: {},
  textPartner: {},

  // Angular: .send-msg-time-block p / .received-msg-time-block p — both sides
  // use the same #777777, since neither bubble is colored anymore. This row
  // is now a SIBLING of `bubbleRow`, inside the systemColOwn/Partner wrapper.
  // That wrapper shrink-wraps to its widest child, which for the OWN side is
  // avatar+gap+bubble (avatar comes AFTER the bubble there) — so plain
  // `alignItems: flex-end` right-aligns this row to the wrapper's full edge,
  // past the avatar, not to the bubble's own edge. The actual marginRight
  // (avatarSize + 6, dynamic) is applied inline where this is used — same
  // fix as systemTimeRowOwn above; the received side has no such offset
  // since its avatar comes first, already outside this row's own box.
  // Angular: `.send-msg-time-block`/`.received-msg-time-block` set no
  // margin-top at all — only normal block flow, not a fixed 4px gap.
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaOwn: {},
  metaPartner: {},
  // Angular: `.send-msg-time-block`/`.received-msg-time-block` wraps its `<p>`
  // in `body3-regular-12` (font12, not font10) — the scss rule's own
  // color:#777777 is the only one set for this element (body3-regular-12
  // itself carries no color).
  time: { fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: FontSize.font12, color: Colors.chatTimestampMuted },
  timeOwn: {},
  timePartner: {},

  // Angular: the viewed-number row's outer column — bubble/avatar row plus
  // the timestamp row stacked underneath, each end-aligned to their side.
  // No width cap needed here — systemCardWidth (computed per-instance from
  // window width) already sizes the card itself in real pixels.
  systemColOwn: { alignItems: 'flex-end' },
  systemColPartner: { alignItems: 'flex-start' },
  // Angular: same shared .d-flex/.d-flex.float-right wrapper as plain text
  // rows — no align-items set, so the avatar is top-aligned here too, not
  // bottom (this was still flex-end, missed in the earlier avatar-position fix).
  systemRow: { flexDirection: 'row', gap: 6 },
  systemRowOwn: { justifyContent: 'flex-end' },

  // Angular: .viewed-number-send/.viewed-number-received — width:90% (applied
  // as a real pixel value via systemCardWidth above, not this percentage,
  // since RN can't resolve a percentage against a shrink-wrapped parent),
  // padding:16px 20px (not 14h/12v) — this larger padding plus the narrower
  // width is what forces the heading to wrap onto 2 lines, matching Angular.
  // A light purple-tinted gradient card (linear-gradient(251deg, #EAEBF5 0%,
  // #FFF 100%)) with a hairline #BDC0E0 border and an asymmetric "notch"
  // corner facing the avatar, not a flat grey fill with uniform corners.
  systemCard: {
    borderWidth: 1, borderColor: '#BDC0E0',
    paddingHorizontal: 20, paddingVertical: 16,
  },
  systemCardOwn: { borderRadius: 12, borderTopRightRadius: 0 },
  systemCardPartner: { borderRadius: 12, borderTopLeftRadius: 0 },
  // Angular: heading has no explicit line-height (browser default); mt-12
  // (12px) gap to the first button below, not 8.
  // Angular: `.body2-regular-14.black-color` — pure black, not textPrimary.
  systemTitle: {
    fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: FontSize.font14,
    color: Colors.black, marginBottom: 12,
  },
  // Angular: app-button-revamp [buttonSize]='msgBtn' [border]='primaryBorder'
  // [background]='whiteBg' [textColor]='lightBlack' [hasFullWidth]='true' —
  // white fill, outlined, FULL WIDTH of the card's content box, stacked.
  // .msgBtn: height 32px (not 40), border-radius 4px (not 8)
  // (button-revamp.component.scss:100-103,159-165).
  systemBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3,
    height: 32, borderRadius: 4, borderWidth: 1, borderColor: Colors.primary,
    backgroundColor: Colors.white, width: '100%',
  },
  // Angular: mt-8 (8px) gap between the two stacked buttons.
  systemBtnSpaced: { marginTop: 8 },
  // Angular: no ctaFontSize passed → falls back to body2-regular-14, then the
  // .msgBtn size variant overrides it to 12px/weight 400 (still Poppins-
  // Regular) — NOT medium/14 as this had before.
  // Angular: [textColor]="'lightBlack'" -> --ion-color-light-black (#333333),
  // not textPrimary.
  systemBtnText: { fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontWeight: '400', fontSize: FontSize.font12, color: Colors.textDark },
  // Angular: .send-msg-time-block/.received-msg-time-block — the timestamp
  // (+ read tick, sent side only) sits BELOW the card, not inside it. This
  // row is given the SAME fixed width as the card itself (systemCardWidth,
  // passed inline) so the time can align to the card's own right/left edge
  // via justifyContent, rather than relying on flex shrink-wrap alignSelf —
  // which doesn't reliably size against a sibling on RN Web, and was pinning
  // the timestamp to the screen edge instead of the card edge.
  // Angular: same as `meta` above — no explicit margin-top on this row.
  systemTimeRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  // Angular: sent side's card ends avatarSize + 6px gap BEFORE the column's
  // true right edge (the avatar sits after the card on that side) — without
  // this offset the timestamp row (width:systemCardWidth, justify:flex-end)
  // right-aligns to the column's full edge, past the avatar, landing outside
  // the card's actual right border instead of flush with it. The actual
  // marginRight/marginLeft is applied inline (avatarSize + 6, dynamic — see
  // the avatarSize computation above), not a fixed 45 here.
  systemTimeRowOwn: { justifyContent: 'flex-end' },
  // Angular: received side's card starts right after the avatar + 6px gap
  // (same as systemRow's own avatar+card layout) — offset to match, since
  // this row is a separate sibling below the avatar+card row, not nested
  // inside it.
  systemTimeRowPartner: { justifyContent: 'flex-start' },
  // Angular: same `.send-msg-time-block`/`.received-msg-time-block` +
  // body3-regular-12 source as `time` above — font12, #777777, not font10/
  // textTertiary.
  systemTime: { fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: FontSize.font12, color: Colors.chatTimestampMuted },

  // Angular: image/video lives inside the SAME `.send-msg-block`/`.received-
  // msg-block` wrapper as text (14px padding all around, not 4) — the
  // border/background/notch-radius come from bubbleOwn/bubblePartner
  // applied alongside this in the JSX.
  mediaBubble: { maxWidth: '65%', padding: 14 },
  // Angular: `.image-video-send-receive { height:65vmin; width:45vmin }` —
  // at this project's 400x800 reference viewport, 180x260 (a tall
  // rectangle), not a 200x200 square.
  mediaThumb: { width: 180, height: 260, borderRadius: 10, backgroundColor: Colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  // Angular: `.download-img-block` (messages.component.scss:468-480) — a
  // small circular badge (24px icon + 12px padding = 48px), not a large
  // centered icon over a dark full-thumbnail tint.
  videoPlayBadge: {
    width: 48, height: 48, borderRadius: 24, padding: 12,
    backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center',
  },

  // Angular: audio lives inside the same `.send-msg-block`/`.received-msg-
  // block` wrapper as text/media (14px padding all around, not 10h/8v) —
  // border/background/notch-radius come from bubbleOwn/bubblePartner
  // applied alongside this in the JSX.
  audioBubble: {
    flexDirection: 'row', alignItems: 'center', gap: 8, maxWidth: '78%',
    padding: 14,
  },
  audioTrack: { flex: 1, height: 3, borderRadius: 2, backgroundColor: 'rgba(128,128,128,0.35)', overflow: 'hidden' },
  audioProgress: { height: '100%', backgroundColor: Colors.primary },
  // No Angular equivalent — app-audio-wave (wavesurfer.js) isn't ported, so
  // this scrubber's elapsed/duration readout has no source class to check
  // against; left as-is.
  audioTime: { fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: FontSize.font11, color: Colors.textPrimary },
})
