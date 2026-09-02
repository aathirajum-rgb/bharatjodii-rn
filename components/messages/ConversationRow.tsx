// A single Messages-screen row — Angular: messager-list.component.html's
// per-record markup (ion-avatar + name + last-message summary + time + unread
// badge). Shared by BOTH "All Messages" (TAPTYPE 5) and "Phone number views"
// (TAPTYPE 6/7) rows — Angular renders both from the same RECORDLIST shape and
// the same template; the phoneviews caption is just the 'viewed_number' kind
// below (msgType 11/12/13), not a separate row design.
import { Image, StyleSheet, Text, View, Pressable } from 'react-native'
import { useTranslation } from 'react-i18next'
import CdnSvg from '../cdn-svg/CdnSvg'
import { Colors } from '../../constants/colors'
import { CDN_SVG } from '../../constants/cdn'
import { Fonts, SemanticFontsEnglish } from '../../src/theme/fonts'
import { formatChatTime } from '../../utils/chatTime'
import type { ChatListItem } from '../../types/interfaces/chatList.interface'

const CDN = CDN_SVG

function ReadTickIcon({ item }: { item: ChatListItem }) {
  if (item.kind === 'none') {
    return <CdnSvg uri={CDN + 'undo-message.svg'} width={14} height={14} />
  }
  if (item.kind !== 'text' || !item.isOwnMessage) return null
  if (item.readStatus === 3) return <CdnSvg uri={CDN + 'seen-green-tick.svg'} width={14} height={14} />
  if (item.readStatus === 2) return <CdnSvg uri={CDN + 'double-tick-jodii-chat-img.svg'} width={14} height={14} />
  if (item.readStatus === 1) return <CdnSvg uri={CDN + 'single-tick-jodii-chat-img.svg'} width={14} height={14} />
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
        <CdnSvg uri={CDN + 'viewed-eye-message.svg'} width={14} height={14} />
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
        <CdnSvg uri={CDN + 'jodii-chat-attachment-img.svg'} width={14} height={14} />
        <Text style={[styles.msgText, greyed && styles.msgTextGreyed]} numberOfLines={1}>{t('MESSAGES.ATTACHMENT')}</Text>
      </View>
    )
  }

  if (item.kind === 'audio') {
    return (
      <View style={styles.msgRow}>
        <CdnSvg
          uri={CDN + (item.readStatus === 3 || item.isOwnMessage ? 'mic-grey-fill.svg' : 'mic-pink-fill.svg')}
          width={14}
          height={14}
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

  return (
    <Pressable
      style={({ pressed }) => [styles.row, showUnread && styles.rowUnread, pressed && styles.rowPressed]}
      onPress={() => onPress(item)}
    >
      <View style={styles.avatarWrap}>
        <Image source={{ uri: item.photoUrl }} style={styles.avatar} />
        {item.isPaidMember && (
          <View style={styles.paidBadge}>
            <CdnSvg uri={CDN + 'paid-member-img-white.svg'} width={9} height={9} />
          </View>
        )}
        {item.isOnline && <View style={styles.onlineDot} />}
      </View>

      <View style={styles.info}>
        <Text style={[styles.name, greyed && styles.nameGreyed]} numberOfLines={1}>{item.name}</Text>
        {item.isDeleted ? (
          <Text style={styles.msgTextGreyed} numberOfLines={1}>{t('LIKE_LIST.DELETED_PROFILE_TXT')}</Text>
        ) : (
          <LastMessageLine item={item} oppGender={oppGender} />
        )}
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
    gap: 12,
  },
  rowUnread: { backgroundColor: Colors.primarySurface },
  rowPressed: { opacity: 0.85 },

  avatarWrap: { width: 52, height: 52 },
  avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: Colors.surfaceAlt },
  // Angular: .jodii-chat-online — 10x10 green dot, white border, bottom-right of avatar.
  onlineDot: {
    position: 'absolute', right: -1, bottom: -1,
    width: 12, height: 12, borderRadius: 6,
    backgroundColor: Colors.iOSGreen, borderWidth: 2, borderColor: Colors.surface,
  },
  // Angular: .paid-member-jodii-chat-block — top-left of avatar, dark magenta
  // #96286e, ~25% radius (a rounded square, not a circle).
  paidBadge: {
    position: 'absolute', left: -3, top: -3,
    width: 18, height: 18, borderRadius: 5,
    backgroundColor: '#96286e', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: Colors.surface,
  },

  // minWidth: 0 for the same reason as msgRow below — lets this flex child
  // actually shrink so the name/caption Text's numberOfLines={1} can truncate
  // on web instead of the row just growing wider than its allotted space.
  info: { flex: 1, gap: 3, justifyContent: 'center', minWidth: 0 },
  name: { fontFamily: Fonts.poppinsMedium, fontSize: 14, color: Colors.textPrimary },
  nameGreyed: { color: Colors.textMuted },

  // minWidth: 0 — flexbox default is min-width: auto, which on web keeps a row
  // wide enough to fit its text unbroken instead of letting it shrink and
  // truncate; without this the ellipsis below never actually triggers on web.
  msgRow: { flexDirection: 'row', alignItems: 'center', gap: 4, minWidth: 0 },
  msgText: {
    fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: 12, color: Colors.textSecondary,
    flexShrink: 1, overflow: 'hidden',
  },
  msgTextGreyed: { fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: 12, color: Colors.textMuted },
  // "Viewed your/his/her mobile number" caption — matches Angular's own row,
  // which leaves this plain black (no pink/primary color rule exists there).
  viewedNumberText: {
    fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: 13, color: Colors.textPrimary,
    flexShrink: 1, overflow: 'hidden',
  },

  // Angular: ion-col offset="0.2" size="2.2" of a 12-col row — a fixed ~18%
  // share, so a long date stamp ("19/8/2026") never steals width from the
  // name/message column the way an unbounded flex-basis would (it was cutting
  // the caption off early — e.g. "...viewed your mobile nu..." — since this
  // column had only a floor, not a ceiling, on its width).
  trailing: { alignItems: 'flex-end', gap: 6, minWidth: 44, maxWidth: 72, flexShrink: 0 },
  time: {
    fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: 11, color: Colors.textPrimary,
    textAlign: 'right',
  },
  unreadBadge: {
    minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4,
    backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center',
  },
  unreadBadgeText: { fontFamily: Fonts.poppinsSemiBold, fontSize: 11, color: Colors.white },
})
