import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import CdnSvg from '../cdn-svg/CdnSvg'
import MenuIcon from '../../assets/icons/MenuIcon'
import NotificationIcon from '../../assets/icons/NotificationIcon'
import SearchIcon from '../../assets/icons/SearchIcon'
import { Colors } from '../../constants/colors'
import { CDN_SVG } from '../../constants/cdn'
import i18n from '../../i18n'

// Maps i18n language codes to their short display labels shown in the header button
const LANG_LABEL: Record<string, string> = {
  en: 'Eng', tm: 'Tamil', tl: 'Telugu', ml: 'Malay', kn: 'Kanna',
  hi: 'Hindi', bn: 'Bangla', mt: 'Marathi', or: 'Odia', gj: 'Gujarati', pa: 'Punjabi',
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type HeaderType = 'header1' | 'header2' | 'registration' | 'signIn'

export interface ToolbarItem {
  toolType:          string
  toolImg:           string
  notifyCount?:      string | undefined
  showNotification?: boolean | undefined
}

export interface AppHeaderProps {
  type: HeaderType

  // ── header1 (home page) ──────────────────────────────────────────────────
  userImg?:           string  | undefined
  userName?:          string  | undefined
  completionPct?:     number  | undefined   // e.g. 70  → shows "70%" red badge on avatar
  hasPaidBatch?:      boolean | undefined
  homeToolBar?:       ToolbarItem[] | undefined

  // ── header2 (title bar) ──────────────────────────────────────────────────
  title?:             string  | undefined
  showBackIcon?:      boolean | undefined   // default true for header2

  // ── registration / signIn ───────────────────────────────────────────────
  showBackBtn?:       boolean | undefined
  languageLabel?:     string  | undefined   // auto-computed from i18n.language if omitted

  // ── Callbacks ────────────────────────────────────────────────────────────
  onMenuPress?:        (() => void) | undefined
  onAvatarPress?:      (() => void) | undefined
  onEditProfilePress?: (() => void) | undefined
  onToolbarItemPress?: ((toolType: string) => void) | undefined
  onBackPress?:        (() => void) | undefined
  onLanguagePress?:    (() => void) | undefined

  style?: StyleProp<ViewStyle> | undefined
}

// ─── CDN ─────────────────────────────────────────────────────────────────────

const CDN = CDN_SVG

const ICONS = {
  lang:     CDN + 'revamp/lang-change-img.svg',
  chevDown: CDN + 'revamp/chevron-down.svg',
  fwdLink:  CDN + 'revamp/forward-icon-link.svg',
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function BadgeCount({ count }: { count: string }) {
  return (
    <View style={styles.badgeWrap}>
      <Text style={styles.badgeText} numberOfLines={1}>{count}</Text>
    </View>
  )
}

// ─── AppHeader ────────────────────────────────────────────────────────────────

export default function AppHeader({
  type,
  userImg,
  userName,
  completionPct,
  hasPaidBatch = false,
  homeToolBar,
  title,
  showBackIcon = true,
  showBackBtn  = true,
  languageLabel,
  onAvatarPress,
  onEditProfilePress,
  onToolbarItemPress,
  onBackPress,
  onLanguagePress,
  style,
}: AppHeaderProps) {
  // Resolve language label — use explicit prop, else auto-detect from i18n
  const resolvedLangLabel = languageLabel ?? LANG_LABEL[i18n.language] ?? 'Eng'

  // ── header1: home screen header (Figma node 15859:14389 top area) ───────────
  // Row 1 (app bar): hamburger | [flex] | language selector | toolbar icons
  // Row 2 (user bar): avatar + completion % | name | edit profile link
  // Background: light periwinkle blue #EBF0FF
  if (type === 'header1') {
    return (
      <SafeAreaView edges={['top']} style={[styles.h1Bg, style]}>

        {/* ── Row 1: App bar ── */}
        <View style={styles.h1AppBar}>
          {/* Hamburger / menu */}
          <Pressable
            style={styles.h1IconBtn}
            onPress={() => onToolbarItemPress?.('menu')}
          >
            <MenuIcon size={18} color={Colors.textPrimary} />
          </Pressable>

          <View style={styles.flex1} />

          {/* Language selector pill — always visible, auto-detects language */}
          <Pressable style={styles.h1LangBtn} onPress={onLanguagePress}>
            <CdnSvg uri={ICONS.lang} width={20} height={20} />
            <Text style={styles.h1LangText}>{resolvedLangLabel}</Text>
            <CdnSvg uri={ICONS.chevDown} width={12} height={12} />
          </Pressable>

          {/* Notification + chat icon buttons */}
          {homeToolBar?.filter(t => t.toolType !== 'menu').map(item => (
            <Pressable
              key={item.toolType}
              style={styles.h1IconBtn}
              onPress={() => onToolbarItemPress?.(item.toolType)}
            >
              {item.toolType === 'notification'
                ? <NotificationIcon size={18} color={Colors.textPrimary} />
                : item.toolType === 'chat'
                ? <SearchIcon size={18} color={Colors.textPrimary} />
                : <CdnSvg uri={item.toolImg} width={19} height={19} />
              }
              {!!(item.showNotification && item.notifyCount && item.notifyCount !== '0') && (
                <BadgeCount count={item.notifyCount!} />
              )}
            </Pressable>
          ))}
        </View>

        {/* ── Row 2: User profile bar ── */}
        <View style={styles.h1UserBar}>
          <Pressable style={styles.h1AvatarWrap} onPress={onAvatarPress}>
            <CdnSvg
              uri={userImg ?? CDN + 'revamp/default-avatar.svg'}
              width={48}
              height={48}
              style={styles.h1AvatarRadius}
            />
            {completionPct !== undefined && (
              <View style={styles.completionBadge}>
                <Text style={styles.completionText}>{completionPct}%</Text>
              </View>
            )}
          </Pressable>

          <Pressable style={styles.h1NameBlock} onPress={onEditProfilePress}>
            <Text style={styles.h1UserName} numberOfLines={1}>{userName ?? ''}</Text>
            <View style={styles.h1EditRow}>
              <Text style={styles.h1EditLabel}>Edit profile</Text>
              <CdnSvg uri={ICONS.fwdLink} width={12} height={12} />
            </View>
          </Pressable>
        </View>

      </SafeAreaView>
    )
  }

  // ── header2: title bar ────────────────────────────────────────────────────
  if (type === 'header2') {
    return (
      <SafeAreaView edges={['top']} style={[styles.wrapper2, style]}>
        <View style={styles.titleRow}>
          {showBackIcon && (
            <Pressable style={styles.backBtn} onPress={onBackPress}>
              <Text style={styles.backChevron}>{'‹'}</Text>
            </Pressable>
          )}
          <Text style={styles.titleText} numberOfLines={1}>{title ?? ''}</Text>
        </View>
      </SafeAreaView>
    )
  }

  // ── registration / signIn ──────────────────────────────────────────────────
  return (
    <SafeAreaView edges={['top']} style={[styles.wrapperAuth, style]}>
      <View style={styles.authRow}>
        {showBackBtn && (
          <Pressable style={styles.backBtn} onPress={onBackPress}>
            <Text style={styles.backChevron}>{'‹'}</Text>
          </Pressable>
        )}

        <View style={styles.flex1} />

        <Pressable style={styles.langBtn} onPress={onLanguagePress}>
          <CdnSvg uri={ICONS.lang} width={24} height={24} />
          <Text style={styles.langText}>{resolvedLangLabel}</Text>
          <CdnSvg uri={ICONS.chevDown} width={12} height={12} />
        </Pressable>
      </View>
    </SafeAreaView>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({

  // ── header1 — Figma light-blue header ──────────────────────────────────────
  h1Bg: {
    backgroundColor:   '#EBF0FF',
    paddingHorizontal: 16,
    paddingBottom:     14,
  },

  // Row 1: hamburger | language | icons
  h1AppBar: {
    flexDirection:  'row',
    alignItems:     'center',
    paddingTop:     10,
    gap:            8,
  },

  // Row 2: avatar | name + edit
  h1UserBar: {
    flexDirection: 'row',
    alignItems:    'center',
    marginTop:     10,
  },

  // Avatar with completion % badge
  h1AvatarWrap: {
    width:          52,
    height:         52,
    borderRadius:   26,
    borderWidth:    2,
    borderColor:    Colors.primary,
    overflow:       'visible',
    alignItems:     'center',
    justifyContent: 'center',
    position:       'relative',
  },
  h1AvatarRadius: {
    borderRadius: 24,
  },
  completionBadge: {
    position:          'absolute',
    bottom:            -6,
    left:              '50%',
    transform:         [{ translateX: -16 }],
    backgroundColor:   Colors.primary,
    borderRadius:      20,
    paddingVertical:   2,
    paddingHorizontal: 6,
    borderWidth:       1.5,
    borderColor:       Colors.white,
    minWidth:          32,
    alignItems:        'center',
  },
  completionText: {
    fontFamily: 'Poppins-SemiBold',
    color:      Colors.white,
    fontSize:   9,
    lineHeight: 12,
  },

  // Name + edit profile block
  h1NameBlock: {
    flex:       1,
    marginLeft: 12,
  },
  h1UserName: {
    fontFamily: 'Poppins-SemiBold',
    fontSize:   15,
    color:      Colors.textPrimary,
    lineHeight: 22,
  },
  h1EditRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           4,
    marginTop:     1,
  },
  h1EditLabel: {
    fontFamily: 'Poppins-Regular',
    fontSize:   12,
    color:      Colors.primary,
  },
  h1EditIcon: {
    width:     12,
    height:    12,
    tintColor: Colors.primary,
  },

  // Language selector pill
  h1LangBtn: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               4,
    borderWidth:       1,
    borderColor:       'rgba(138,138,138,0.6)',
    borderRadius:      8,
    paddingVertical:   4,
    paddingHorizontal: 8,
    height:            32,
  },
  h1LangIcon: {
    width:  20,
    height: 20,
  },
  h1LangText: {
    fontFamily: 'Poppins-Medium',
    fontSize:   11,
    color:      Colors.textPrimary,
  },
  h1ChevIcon: {
    width:  12,
    height: 12,
  },

  // Icon buttons — blue bordered squares
  h1IconBtn: {
    width:           32,
    height:          32,
    borderRadius:    10,
    backgroundColor: '#D5E5FF',
    borderWidth:     0.8,
    borderColor:     '#81A0DD',
    alignItems:      'center',
    justifyContent:  'center',
    position:        'relative',
  },
  h1Icon: {
    width:  19,
    height: 19,
  },

  // Badge on toolbar icon
  badgeWrap: {
    position:          'absolute',
    top:               -4,
    right:             -4,
    backgroundColor:   Colors.primary,
    borderRadius:      10,
    minWidth:          16,
    height:            16,
    alignItems:        'center',
    justifyContent:    'center',
    paddingHorizontal: 3,
    borderWidth:       1,
    borderColor:       Colors.white,
  },
  badgeText: {
    fontFamily: 'Poppins-SemiBold',
    color:      Colors.white,
    fontSize:   8,
    lineHeight: 12,
  },

  // ── header2 ────────────────────────────────────────────────────────────────
  wrapper2: {
    backgroundColor:   Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  titleRow: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: 16,
    height:            52,
  },
  backBtn: {
    width:           40,
    height:          40,
    alignItems:      'center',
    justifyContent:  'center',
    marginRight:     4,
  },
  backChevron: {
    fontSize:   28,
    color:      Colors.textDark,
    lineHeight: 32,
  },
  titleText: {
    fontFamily: 'Poppins-Medium',
    flex:       1,
    fontSize:   16,
    color:      Colors.textDark,
  },
  flex1: { flex: 1 },

  // ── registration / signIn ─────────────────────────────────────────────────
  wrapperAuth: {
    backgroundColor: Colors.white,
    paddingBottom:   8,
  },
  authRow: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: 24,
    paddingTop:        24,
  },
  langBtn: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               4,
    borderWidth:       1,
    borderColor:       Colors.borderNeutral,
    borderRadius:      8,
    paddingVertical:   4,
    paddingHorizontal: 8,
    height:            36,
    marginTop:         4,
  },
  langIcon: {
    width:  24,
    height: 24,
  },
  langText: {
    fontFamily: 'Poppins-Medium',
    fontSize:   12,
    color:      Colors.textPrimary,
  },
  chevIcon: {
    width:  12,
    height: 12,
  },
})
