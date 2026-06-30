import { Image, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import MenuIcon from '../../assets/icons/MenuIcon'
import NotificationIcon from '../../assets/icons/NotificationIcon'
import SearchIcon from '../../assets/icons/SearchIcon'
import { Colors } from '../../constants/colors'

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
  languageLabel?:     string  | undefined   // e.g. "Eng"

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

const CDN = 'https://imgs.jodii.app/assets/images/svg/'

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
  const insets = useSafeAreaInsets()

  // ── header1: home screen header (Figma node 15859:14389 top area) ───────────
  // Row 1 (app bar): hamburger | [flex] | language selector | toolbar icons
  // Row 2 (user bar): avatar + completion % | name | edit profile link
  // Background: light periwinkle blue #EBF0FF
  if (type === 'header1') {
    return (
      <View style={[styles.h1Bg, { paddingTop: insets.top }, style]}>

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

          {/* Language selector pill */}
          {languageLabel && (
            <Pressable style={styles.h1LangBtn} onPress={onLanguagePress}>
              <Image source={{ uri: ICONS.lang }} style={styles.h1LangIcon} resizeMode="contain" />
              <Text style={styles.h1LangText}>{languageLabel}</Text>
              <Image source={{ uri: ICONS.chevDown }} style={styles.h1ChevIcon} resizeMode="contain" />
            </Pressable>
          )}

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
                : <Image source={{ uri: item.toolImg }} style={styles.h1Icon} resizeMode="contain" />
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
            <Image
              source={{ uri: userImg ?? CDN + 'revamp/default-avatar.svg' }}
              style={styles.h1Avatar}
              resizeMode="cover"
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
              <Image source={{ uri: ICONS.fwdLink }} style={styles.h1EditIcon} resizeMode="contain" />
            </View>
          </Pressable>
        </View>

      </View>
    )
  }

  // ── header2: title bar ────────────────────────────────────────────────────
  if (type === 'header2') {
    return (
      <View style={[styles.wrapper2, { paddingTop: insets.top }, style]}>
        <View style={styles.titleRow}>
          {showBackIcon && (
            <Pressable style={styles.backBtn} onPress={onBackPress}>
              <Text style={styles.backChevron}>{'‹'}</Text>
            </Pressable>
          )}
          <Text style={styles.titleText} numberOfLines={1}>{title ?? ''}</Text>
        </View>
      </View>
    )
  }

  // ── registration / signIn ──────────────────────────────────────────────────
  return (
    <View style={[styles.wrapperAuth, { paddingTop: insets.top }, style]}>
      <View style={styles.authRow}>
        {showBackBtn && (
          <Pressable style={styles.backBtn} onPress={onBackPress}>
            <Text style={styles.backChevron}>{'‹'}</Text>
          </Pressable>
        )}

        <View style={styles.flex1} />

        {languageLabel && (
          <Pressable style={styles.langBtn} onPress={onLanguagePress}>
            <Image source={{ uri: ICONS.lang }} style={styles.langIcon} resizeMode="contain" />
            <Text style={styles.langText}>{languageLabel}</Text>
            <Image source={{ uri: ICONS.chevDown }} style={styles.chevIcon} resizeMode="contain" />
          </Pressable>
        )}
      </View>
    </View>
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
  h1Avatar: {
    width:        48,
    height:       48,
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
    width:  12,
    height: 12,
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
    position:        'absolute',
    top:             -4,
    right:           -4,
    backgroundColor: Colors.primary,
    borderRadius:    10,
    minWidth:        16,
    height:          16,
    alignItems:      'center',
    justifyContent:  'center',
    paddingHorizontal: 3,
    borderWidth:     1,
    borderColor:     Colors.white,
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
    borderColor:       'rgba(138,138,138,1)',
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
