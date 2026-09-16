// Angular: pages/notification/notification.page.ts(+.html+.scss) — the
// in-app notification list (NOT push notifications — that's a separate,
// later task). Socket wiring reuses service/socketService.ts's existing
// emitNotificationDetails()/onNotificationList()/emitReadNotification(),
// which already mirror Angular's callNotifyDetailEmit()/getNotificationList()/
// readNotification() 1:1 — nothing new needed on the socket side itself.
//
// SCOPE: getUrl()'s ~90-case redirect router is deferred to a follow-up pass
// — see service/inAppNotificationService.ts's getNotificationRedirect() for
// what's implemented now vs falling back to Matches (same fallback Angular's
// own switch uses for every case it doesn't handle either).
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Dimensions, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import AppHeader from '../../components/app-header/AppHeader'
import CdnSvg, { CdnImage } from '../../components/cdn-svg/CdnSvg'
import CdnLottie from '../../components/CdnLottie'
import { Colors } from '../../constants/colors'
import { CDN, CDN_REVAMP } from '../../constants/cdn'
import { EnvConfig } from '../../constants/env'
import { getOppGenderAvatarUrl } from '../../utils/avatar'
import { handleBack } from '../../utils/navigationRef'
import {
  socketConnection, emitNotificationDetails,
  onNotificationList, isConnected,
} from '../../service/socketService'
import {
  groupNotifications, getOverlayIcon, handleNotificationPress, parseRichNotificationText,
  NOTIFICATION_EMPTY_ANIM, NOTIFICATION_LOADING_ANIM,
  type NotificationItem, type GroupedNotifications, type RichTextSegment,
} from '../../service/inAppNotificationService'
import { Fonts, FontSize, SemanticFontsEnglish } from '../../src/theme/fonts'

const FWD_ICON = `${CDN_REVAMP}filter_right_arrow.svg`
// Angular: onImgErrorHandler() — the [1,2,3,6,7] avatar-broken-image
// fallback (personal, opposite-profile notifications get the Jodii mark
// instead of a gendered silhouette).
const JODII_LOGO_ICON = `${CDN}assets/images/png/logo-icon.png`
const AVATAR_ERROR_TYPES = [1, 2, 3, 6, 7]
const { height: SH } = Dimensions.get('window')

type Props = { navigation: any }

export default function NotificationScreen({ navigation: _navigation }: Props) {
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()

  const [hasContentLoaded, setHasContentLoaded] = useState(false)
  const [grouped, setGrouped] = useState<GroupedNotifications | null>(null)

  useFocusEffect(
    useCallback(() => {
      let cancelled = false

      async function start() {
        if (!isConnected()) await socketConnection(EnvConfig.notify)
        emitNotificationDetails()
      }
      start()

      const unsubscribe = onNotificationList((data: any) => {
        if (cancelled) return
        const list: Record<string, any>[] = data?.['DETAILS'] ?? []
        groupNotifications(list, t).then(result => {
          if (cancelled) return
          setGrouped(result)
          // Angular: setTimeout(..., 500) before flipping hasContentLoaded.
          setTimeout(() => { if (!cancelled) setHasContentLoaded(true) }, 500)
        })
      })

      return () => { cancelled = true; unsubscribe() }
    }, [t])
  )

  function handlePress(item: NotificationItem) {
    handleNotificationPress(item)
  }

  function renderSection(title: string, items: NotificationItem[]) {
    if (items.length === 0) return null
    return (
      <View key={title}>
        <View style={s.sectionHeader}>
          <Text style={s.sectionHeaderText}>{title}</Text>
        </View>
        {items.map(item => (
          <NotificationRow key={item.ngrpid} item={item} onPress={() => handlePress(item)} />
        ))}
      </View>
    )
  }

  const isReady = hasContentLoaded && !!grouped

  return (
    <View style={s.screen}>
      <View style={s.contentWrap}>
        {/* Angular: notification.page.html has its OWN inline header, not
            <app-header> — title is `heading1-semibold-20 black-color`
            (20px Poppins-SemiBold, pure black), not AppHeader's generic
            header2 default (16px Poppins-Medium, #333333 — correct for
            menu-contacts.page.html, the screen that default IS modeled on). */}
        <AppHeader
          type="header2"
          title={t('NOTIFICATION.TITLE')}
          titleStyle={s.headerTitle}
          onBackPress={() => handleBack()}
        />

        {!isReady ? (
          <View style={s.center}>
            <CdnLottie uri={NOTIFICATION_LOADING_ANIM} width={160} height={160} />
          </View>
        ) : grouped!.isEmpty ? (
          <View style={s.center}>
            <CdnLottie uri={NOTIFICATION_EMPTY_ANIM} width={200} height={200} />
            <Text style={s.emptyText}>{t('NOTIFICATION.LOADINGCONTENT')}</Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 16 }} showsVerticalScrollIndicator={false}>
            {renderSection(t('NOTIFICATION.TODAY_TXT'),        grouped!.today)}
            {renderSection(t('NOTIFICATION.YESTERDAY_TXT'),    grouped!.yesterday)}
            {renderSection(t('NOTIFICATION.PRESESTWEEK_TXT'),  grouped!.thisWeek)}
            {renderSection(t('NOTIFICATION.LASTWEEK_TXT'),     grouped!.lastWeek)}
          </ScrollView>
        )}
      </View>
    </View>
  )
}

// ─── RichText ───────────────────────────────────────────────────────────────
// Renders parseRichNotificationText()'s segments inline — RN <Text> nests
// fine for this, so the bolded name flows with the rest of the sentence
// exactly like Angular's [innerHTML]-rendered <span> did.

function RichText({ segments, regularStyle, boldStyle }: {
  segments: RichTextSegment[]; regularStyle: object; boldStyle: object
}) {
  return (
    <>
      {segments.map((seg, i) => (
        <Text key={i} style={seg.bold ? boldStyle : regularStyle}>{seg.text}</Text>
      ))}
    </>
  )
}

// ─── NotificationRow ────────────────────────────────────────────────────────

function NotificationRow({ item, onPress }: { item: NotificationItem; onPress: () => void }) {
  const overlayIcon = getOverlayIcon(item.notificationtype)
  const isUnread = item.readstatus === 0

  const [avatarSrc, setAvatarSrc] = useState(item.avatarUrl)
  useEffect(() => { setAvatarSrc(item.avatarUrl) }, [item.avatarUrl])

  // Angular: onImgErrorHandler() — types 1/2/3/6/7 fall back to the Jodii
  // logo mark; every other type falls back to the opposite-gender default
  // avatar (getOppGenderAvatarUrl(), the same fallback parseNotificationDetail()
  // already uses when the raw detail string has no avatar segment at all).
  function handleAvatarError() {
    if (AVATAR_ERROR_TYPES.includes(item.notificationtype)) {
      setAvatarSrc(JODII_LOGO_ICON)
    } else {
      getOppGenderAvatarUrl().then(setAvatarSrc)
    }
  }

  return (
    <Pressable
      style={[s.row, isUnread && s.rowUnread]}
      onPress={onPress}
    >
      <View style={s.avatarWrap}>
        <CdnImage uri={avatarSrc} width={44} height={44} style={s.avatarImg} onError={handleAvatarError} />
        {!!overlayIcon && (
          <CdnSvg uri={overlayIcon} width={16} height={16} style={s.overlayIcon} />
        )}
      </View>

      <View style={s.content}>
        {!!item.title1 && (
          <Text style={s.title} numberOfLines={2}>
            <RichText segments={parseRichNotificationText(item.title1)} regularStyle={s.title} boldStyle={s.title} />
          </Text>
        )}
        <Text style={s.subtitleRow} numberOfLines={2}>
          <RichText segments={parseRichNotificationText(item.detailText)} regularStyle={s.subtitle} boldStyle={s.subtitleBold} />
          {!!item.getTime && <Text style={s.time}>  {item.getTime}</Text>}
        </Text>

        {!!item.image && (
          <CdnImage uri={item.image} width="100%" height={SH * 0.265} style={s.notifImage} />
        )}
        {!!item.ctaLabel && (
          <Pressable style={[s.ctaBtn, !!item.image && s.ctaBtnWithImage]} onPress={onPress}>
            <Text style={s.ctaBtnText}>{item.ctaLabel}</Text>
          </Pressable>
        )}
      </View>

      <CdnSvg uri={FWD_ICON} width={6} height={12} style={s.chevron} />
    </Pressable>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.white },
  // Angular's own notification page has no desktop-specific design at all
  // (no @media rules in notification.page.scss) — this isn't a redesign,
  // just a width cap so the single-column row list doesn't stretch
  // edge-to-edge on a wide browser window; native/mobile-web are unaffected.
  contentWrap: Platform.OS === 'web'
    ? { flex: 1, width: '100%', maxWidth: 480, alignSelf: 'center' }
    : { flex: 1 },
  // Angular: `heading1-semibold-20 black-color` (global.scss) — 20px
  // Poppins-SemiBold, pure black.
  headerTitle: { fontFamily: Fonts.poppinsSemiBold, fontSize: FontSize.font20, color: Colors.black },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  emptyText: {
    fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: FontSize.font14, color: Colors.textSecondary,
    textAlign: 'center', marginTop: 12, lineHeight: 20,
  },

  // Angular: .days-text { font-family: Medium; font-size: 16px; color: #000 }
  sectionHeader: { paddingHorizontal: 24, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  sectionHeaderText: { fontFamily: SemanticFontsEnglish.headingEnglishMedium, fontSize: FontSize.font16, color: Colors.black },

  // Angular: ion-item padding pl-24 pt-16 pb-16 pr-16, .bottom-border-notification
  row: {
    flexDirection: 'row', alignItems: 'flex-start',
    paddingLeft: 24, paddingRight: 16, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: '#e2e8f0',
  },
  // Angular: .active-notification { background: #fef6db }
  rowUnread: { backgroundColor: '#fef6db' },

  avatarWrap: { width: 44, height: 44, position: 'relative' },
  avatarImg:  { borderRadius: 22 },
  // Angular: .liked-pink-notification { position:absolute; right:0; bottom:5px; width/height:1rem }
  overlayIcon: { position: 'absolute', right: 0, bottom: -5 },

  content: { flex: 1, marginLeft: 5 },
  // Angular: .name-notification { font-family: Bold; font-size: 12px }
  title: { fontFamily: Fonts.poppinsBold, fontSize: FontSize.font12, color: Colors.textPrimary },
  subtitleRow: { marginTop: 2 },
  // Angular: .name-subheading-notification { font-family: Regular; font-size: 12px; color: #333 }
  subtitle: { fontFamily: SemanticFontsEnglish.subheadingEnglishRegular, fontSize: FontSize.font12, color: '#333333' },
  // Angular: .name-notification — the bold <span> wrapping the sender's name
  // when it's embedded inline within notificationdetails[1] rather than title1.
  subtitleBold: { fontFamily: Fonts.poppinsBold, fontSize: FontSize.font12, color: '#333333' },
  // Angular: .time-notification { color: #808080 }
  time: { fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: FontSize.font12, color: '#808080' },

  // Angular: .notification-image-size { height: 26.5vh; width: 100%; border-radius: 16px }
  notifImage: { marginTop: 8, borderRadius: 16 },

  // Angular: .add-horoscope-notification — amber pill, 4px padding, 4px radius
  ctaBtn: {
    alignSelf: 'flex-start', backgroundColor: '#fcd34d', borderRadius: 4,
    paddingHorizontal: 8, paddingVertical: 4, marginTop: 8,
  },
  ctaBtnWithImage: { marginTop: 8 },
  ctaBtnText: { fontFamily: SemanticFontsEnglish.buttonEnglishMedium, fontSize: FontSize.font12, color: '#333333', textTransform: 'capitalize' },

  // Angular: .filter-forward-icon { width: 6px }
  chevron: { marginLeft: 8, marginTop: 4 },
})
