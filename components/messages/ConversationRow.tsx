// A single Messages-screen row — Angular: messager-list.component.html's
// per-record markup (ion-avatar + name + last-message summary + time + unread
// badge). Shared by BOTH "All Messages" (TAPTYPE 5) and "Phone number views"
// (TAPTYPE 6/7) rows — Angular renders both from the same RECORDLIST shape and
// the same template; the phoneviews caption is just the 'viewed_number' kind
// below (msgType 11/12/13), not a separate row design.
import { useEffect, useState } from 'react'
import { StyleSheet, Text, View, Pressable } from 'react-native'
import { useTranslation } from 'react-i18next'
import CdnSvg, { CdnImage } from '../cdn-svg/CdnSvg'
import { Colors } from '../../constants/colors'
import { CDN_SVG } from '../../constants/cdn'
import { Fonts, FontSize, SemanticFontsEnglish } from '../../src/theme/fonts'
import { formatChatTime } from '../../utils/chatTime'
import { getOppGenderAvatarUrl, FEMALE_AVATAR_URL } from '../../utils/avatar'
import type { ChatListItem } from '../../types/interfaces/chatList.interface'

const CDN = CDN_SVG

// Angular: `.width-height-2vh { width: 2vh; height: 2vh }` — every status/
// type icon in this row (tick icons, viewed-eye, attachment, mic) is 2vh,
// which at this project's 800px reference height is 16px, not 14.

// Angular: this whole tick column is gated on `[1,2,3].includes(ReadStatus)
// && SenderId == loginMatriId && (msgType == '1' || msgType == '')` — the
// "undone" icon (msgType=='') needs the SAME own-message + read-status gate
// as the three real tick icons (msgType=='1'), not an unconditional render.
function ReadTickIcon({ item }: { item: ChatListItem }) {
  if ((item.kind !== 'text' && item.kind !== 'none') || !item.isOwnMessage) return null
  if (![1, 2, 3].includes(item.readStatus)) return null
  if (item.kind === 'none') return <CdnSvg uri={CDN + 'undo-message.svg'} width={16} height={16} />
  if (item.readStatus === 3) return <CdnSvg uri={CDN + 'seen-green-tick.svg'} width={16} height={16} />
  if (item.readStatus === 2) return <CdnSvg uri={CDN + 'double-tick-jodii-chat-img.svg'} width={16} height={16} />
  if (item.readStatus === 1) return <CdnSvg uri={CDN + 'single-tick-jodii-chat-img.svg'} width={16} height={16} />
  return null
}

function LastMessageLine({ item, oppGender }: { item: ChatListItem; oppGender: 'M' | 'F' }) {
  const { t } = useTranslation()
  // Angular: messager-list.component.html (JODII-453 fix) — a reported chat is
  // opened and read like any other one now, so its row keeps its normal last-
  // message preview and unread badge; only a deleted profile is greyed out.
  const greyed = item.isDeleted

  if (item.kind === 'viewed_number') {
    // Angular: messages.component.ts:1321 — msgType 11/13 ("viewed by me" /
    // "both viewed") show YOUVIEWEDNUMBER; msgType 12 ("viewed your number")
    // shows VIEWEDYOURNUMBER_SUBTITLE. Keyed off msgType, not SenderId —
    // isOwnMessage is a different axis (who sent the record, not who viewed).
    //
    // Angular: update_His_Her()/getGenderPrefix_His_Her() — "##HIS_HER##"
    // resolves to the OPPOSITE gender's pronoun (matches are always opposite-
    // gender), same PRONOUN.{oppGender}.hisher convention MatchesScreen.tsx/
    // WhatsAppPaywallModal.tsx already use — not stripped to empty.
    return (
      <View style={styles.msgRow}>
        <CdnSvg uri={CDN + 'viewed-eye-message.svg'} width={16} height={16} />
        <Text style={[styles.viewedNumberText, greyed && styles.msgTextGreyed]} numberOfLines={1}>
          {item.youViewedThem
            ? t('MESSAGES.YOUVIEWEDNUMBER').replace(/##HIS_HER##/gi, t(`PRONOUN.${oppGender}.hisher`))
            : t('MESSAGES.VIEWEDYOURNUMBER_SUBTITLE')}
        </Text>
      </View>
    )
  }

  if (item.kind === 'file') {
    return (
      <View style={styles.msgRow}>
        <CdnSvg uri={CDN + 'jodii-chat-attachment-img.svg'} width={16} height={16} />
        <Text style={[styles.msgText, greyed && styles.msgTextGreyed]} numberOfLines={1}>{t('MESSAGES.ATTACHMENT')}</Text>
      </View>
    )
  }

  if (item.kind === 'audio') {
    return (
      <View style={styles.msgRow}>
        <CdnSvg
          uri={CDN + (item.readStatus === 3 || item.isOwnMessage ? 'mic-grey-fill.svg' : 'mic-pink-fill.svg')}
          width={16}
          height={16}
        />
        <Text style={[styles.msgText, greyed && styles.msgTextGreyed]} numberOfLines={1}>{item.text}</Text>
      </View>
    )
  }

  if (!item.text) return null

  return (
    <View style={styles.msgRow}>
      <ReadTickIcon item={item} />
      <Text style={[styles.msgText, greyed && styles.msgTextGreyed]} numberOfLines={1}>{item.text}</Text>
    </View>
  )
}

interface Props {
  item:    ChatListItem
  onPress: (item: ChatListItem) => void
  // Angular: getGenderPrefix_His_Her() — pronoun of the opposite gender, used
  // to fill YOUVIEWEDNUMBER's ##HIS_HER## placeholder. Defaults to 'M' (i.e.
  // "his") matching this component's own pre-existing default logged-in
  // gender assumption elsewhere in the app (MatchesScreen.tsx's 'F' state
  // default flips to oppGender 'M') — callers should always pass the real
  // value once known.
  oppGender?: 'M' | 'F'
}

export default function ConversationRow({ item, onPress, oppGender = 'M' }: Props) {
  const { t } = useTranslation()
  const greyed = item.isDeleted
  const showUnread = item.unreadCount > 0 && !greyed
  const timeLabel = item.timestamp ? formatChatTime(item.timestamp, t('MESSAGES.YESTERDAY')) : ''

  // Angular: `<img [src]="chatData?.Photourl" (error)="common.onImgErrorHandler($event,true)">`
  // — falls back to a gender-based silhouette (the chat partner is always the
  // opposite gender) whenever Photourl is missing/fails to load, which is
  // exactly what a deleted/reported profile's record commonly has (an empty
  // Photourl) — RN's Image had no such fallback, so those rows rendered blank.
  const [oppGenderAvatar, setOppGenderAvatar] = useState(FEMALE_AVATAR_URL)
  const [imgError, setImgError] = useState(false)
  useEffect(() => {
    let cancelled = false
    getOppGenderAvatarUrl().then(url => { if (!cancelled) setOppGenderAvatar(url) })
    return () => { cancelled = true }
  }, [])
  const showAvatarFallback = imgError || !item.photoUrl

  return (
    <Pressable
      style={({ pressed }) => [styles.row, showUnread && styles.rowUnread, pressed && styles.rowPressed]}
      onPress={() => onPress(item)}
    >
      <View style={styles.avatarWrap}>
        {/* CdnImage (not a plain RN Image) — the fallback silhouette is an
            .svg, which RN's Image can't decode on native. */}
        <CdnImage
          uri={showAvatarFallback ? oppGenderAvatar : item.photoUrl}
          width={48}
          height={48}
          style={styles.avatar}
          resizeMode="cover"
          onError={() => setImgError(true)}
        />
        {item.isPaidMember && (
          <View style={styles.paidBadge}>
            <CdnSvg uri={CDN + 'paid-member-img-white.svg'} width={8} height={8} />
          </View>
        )}
        {item.isOnline && <View style={styles.onlineDot} />}
      </View>

      <View style={styles.info}>
        <Text style={[styles.name, greyed && styles.nameGreyed]} numberOfLines={1}>{item.name}</Text>
        {/* Angular: `deleted == '1'` only swaps the ion-row's CSS class to
            `color-b3b3b3` (grey text) — it never replaces the row's real
            last-message content. This previously showed a static "Deleted
            profile" label instead, which silently dropped the real message
            (and with it, its tick mark / eye icon / attachment icon —
            LastMessageLine already greys itself out via `item.isDeleted`
            internally, so this row-level swap was never needed). */}
        <LastMessageLine item={item} oppGender={oppGender} />
      </View>

      <View style={styles.trailing}>
        {!!timeLabel && <Text style={styles.time}>{timeLabel}</Text>}
        {showUnread && (
          <View style={styles.unreadBadge}>
            <Text style={styles.unreadBadgeText}>{item.unreadCount > 9 ? '9+' : item.unreadCount}</Text>
          </View>
        )}
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  // Angular: per-row padding is `pt-20 pb-20` + `ion-cust-padding-start/end`
  // (24px each side) — the list container adds no padding of its own
  // (`ion-grid class="padd0"`), so this row alone carries the full inset.
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 24,
  },
  // Angular: `.jodii-chat-received-pink-bg { background: #FAFAFA }`.
  rowUnread: { backgroundColor: Colors.surfaceAlt },
  rowPressed: { opacity: 0.85 },

  // Angular: `.receeived-awaiting-block-img ion-avatar` — 48x48, placeholder
  // bg #e4e3e4 (not surfaceAlt/#fafafa).
  avatarWrap: { width: 48, height: 48 },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#e4e3e4' },
  // Angular: `.jodii-chat-online` — 10x10, background-color: green (the
  // literal CSS keyword, #008000 — not iOS system green), 1px white border,
  // sitting INSET within the avatar box (bottom:3px, left:36px), not poking
  // outside its bottom-right corner.
  onlineDot: {
    position: 'absolute', left: 36, bottom: 3,
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: 'green', borderWidth: 1, borderColor: Colors.surface,
  },
  // Angular: `.paid-member-jodii-chat-block` — flush at the avatar's top-left
  // corner (top:0, left:0, no border), dark magenta #96286e, 3px padding
  // around an 8px icon (≈14x14 total), 25% radius. No white border/outset
  // like RN previously drew.
  paidBadge: {
    position: 'absolute', left: 0, top: 0,
    width: 14, height: 14, borderRadius: 4,
    backgroundColor: '#96286e', alignItems: 'center', justifyContent: 'center',
  },

  // minWidth: 0 for the same reason as msgRow below — lets this flex child
  // actually shrink so the name/caption Text's numberOfLines={1} can truncate
  // on web instead of the row just growing wider than its allotted space.
  // marginLeft: Angular's `ion-col offset="0.3"` before this column, out of
  // a 12-col row — 0.3/12 = 2.5%.
  info: { flex: 1, gap: 3, justifyContent: 'center', minWidth: 0, marginLeft: '2.5%' },
  // Angular: `h2.body1-medium-14` — no color rule of its own; it inherits
  // #000000 from the wrapping ion-row's `reallyblack` class (or #b3b3b3 from
  // `color-b3b3b3` when deleted — see nameGreyed).
  name: { fontFamily: Fonts.poppinsMedium, fontSize: 14, color: Colors.black },
  nameGreyed: { color: Colors.chatDeletedRowText },

  // minWidth: 0 — flexbox default is min-width: auto, which on web keeps a row
  // wide enough to fit its text unbroken instead of letting it shrink and
  // truncate; without this the ellipsis below never actually triggers on web.
  msgRow: { flexDirection: 'row', alignItems: 'center', gap: 4, minWidth: 0 },
  // Angular: `span.body3-regular-12` — same inheritance as name above: plain
  // #000000 (not a muted grey) from the wrapping row's `reallyblack` class.
  msgText: {
    fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: FontSize.font12, color: Colors.black,
    flexShrink: 1, overflow: 'hidden',
  },
  // Angular: `.color-b3b3b3` (global.scss) — deleted profile's greyed row text.
  msgTextGreyed: { fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: FontSize.font12, color: Colors.chatDeletedRowText },
  // "Viewed your/his/her mobile number" caption — Angular: `span.body3-regular-12`
  // (12px, not 13), same #000000 inheritance as msgText above.
  viewedNumberText: {
    fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: FontSize.font12, color: Colors.black,
    flexShrink: 1, overflow: 'hidden',
  },

  // Angular: `ion-col offset="0.2" size="2.2"` of a 12-col row — offset
  // 0.2/12 = 1.67% margin before this column, width 2.2/12 = 18.33% of the
  // row, exactly (not the earlier fixed 44-72px approximation) — so a long
  // date stamp ("19/8/2026") never steals width from the name/message
  // column the way an unbounded flex-basis would.
  trailing: { alignItems: 'flex-end', gap: 6, marginLeft: '1.67%', width: '18.33%', flexShrink: 0 },
  // Angular: `.jodii-chat-time` — Poppins-Regular (--bottomnav-english-Regular),
  // 10px (--font10), #2d382f — this class sets its own color, so it wins over
  // the ancestor row's reallyblack/color-b3b3b3 regardless of deleted state.
  time: {
    fontFamily: SemanticFontsEnglish.bottomnavEnglishRegular, fontSize: FontSize.font10, color: Colors.chatTimeText,
    textAlign: 'right',
  },
  // Angular: `.jodii-chat-msg-badge { border-radius: 50%; padding: 5px 10px
  // 5px 10px; background-color: #DE2A68 }` — a content-hugging pill (wider
  // for 2-digit counts), not a fixed 18px circle.
  unreadBadge: {
    paddingVertical: 5, paddingHorizontal: 10, borderRadius: 999,
    backgroundColor: Colors.inputError, alignItems: 'center', justifyContent: 'center',
  },
  // Angular: `jodii-chat-msg-badge body3-regular-12 white-color` — Poppins-Regular
  // 12px (not semibold 11px), white.
  unreadBadgeText: { fontFamily: Fonts.poppinsRegular, fontSize: FontSize.font12, color: Colors.white },
})
