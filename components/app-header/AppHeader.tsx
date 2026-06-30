import { Image, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
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

  // ── header1 (home page) ─────────────────────────────────────────────────
  userImg?:         string  | undefined
  userName?:        string  | undefined
  hasPaidBatch?:    boolean | undefined
  homeToolBar?:     ToolbarItem[] | undefined

  // ── header2 (title bar) ──────────────────────────────────────────────────
  title?:           string  | undefined
  showBackIcon?:    boolean | undefined   // default true for header2

  // ── registration / signIn ───────────────────────────────────────────────
  showBackBtn?:     boolean | undefined
  languageLabel?:   string  | undefined   // auto-computed from i18n.language if omitted

  // ── Callbacks ────────────────────────────────────────────────────────────
  onMenuPress?:      (() => void) | undefined
  onAvatarPress?:    (() => void) | undefined
  onEditProfilePress?: (() => void) | undefined
  onToolbarItemPress?: ((toolType: string) => void) | undefined
  onBackPress?:      (() => void) | undefined
  onLanguagePress?:  (() => void) | undefined

  style?: StyleProp<ViewStyle> | undefined
}

// ─── CDN ─────────────────────────────────────────────────────────────────────

const CDN = CDN_SVG

const ICONS = {
  menu:       CDN + 'revamp/menu-home.svg',
  lang:       CDN + 'revamp/lang-change-img.svg',
  chevDown:   CDN + 'revamp/chevron-down.svg',
  paidTag:    CDN + 'revamp/paid-tag-revamp.svg',
  fwdLink:    CDN + 'revamp/forward-icon-link.svg',
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
  hasPaidBatch = false,
  homeToolBar,
  title,
  showBackIcon = true,
  showBackBtn = true,
  languageLabel,
  onMenuPress,
  onAvatarPress,
  onEditProfilePress,
  onToolbarItemPress,
  onBackPress,
  onLanguagePress,
  style,
}: AppHeaderProps) {
  const insets = useSafeAreaInsets()

  if (type === 'header1') {
    return (
      <View style={[styles.wrapper, { paddingTop: insets.top }, style]}>
        {/* ── Row 1: menu | language dropdown | toolbar icons ── */}
        <View style={styles.row}>
          <Pressable style={styles.iconBtn32} onPress={onMenuPress}>
            <Image source={{ uri: ICONS.menu }} style={styles.icon32} resizeMode="contain" />
          </Pressable>

          {/* Language selector — centred in remaining space */}
          <View style={styles.flex1} />

          {/* Toolbar icons (notification, chat, etc.) */}
          {homeToolBar?.map(item => (
            <Pressable
              key={item.toolType}
              style={styles.iconBtn32}
              onPress={() => onToolbarItemPress?.(item.toolType)}
            >
              <Image source={{ uri: item.toolImg }} style={styles.icon32} resizeMode="contain" />
              {!!(item.showNotification && item.notifyCount && item.notifyCount !== '0') && (
                <BadgeCount count={item.notifyCount!} />
              )}
            </Pressable>
          ))}
        </View>

        {/* ── Row 2: avatar | name + edit-profile link ── */}
        <View style={[styles.row, styles.row2]}>
          <Pressable onPress={onAvatarPress}>
            <View style={styles.avatarWrap}>
              <Image
                source={{ uri: userImg ?? CDN + 'revamp/default-avatar.svg' }}
                style={styles.avatar}
                resizeMode="cover"
              />
            </View>
          </Pressable>

          <View style={styles.nameBlock}>
            <Text style={styles.userName} numberOfLines={1}>{userName ?? ''}</Text>
            <Pressable style={styles.editRow} onPress={onEditProfilePress}>
              <Text style={styles.editText}>Edit Profile</Text>
              <Image source={{ uri: ICONS.fwdLink }} style={styles.editIcon} resizeMode="contain" />
            </Pressable>
          </View>
        </View>

        {/* ── Row 3: paid badge (conditional) ── */}
        {hasPaidBatch && (
          <View style={styles.paidRow}>
            <View style={styles.paidBadge}>
              <Image source={{ uri: ICONS.paidTag }} style={styles.paidTagIcon} resizeMode="contain" />
              <Text style={styles.paidText}>Paid Member</Text>
            </View>
          </View>
        )}
      </View>
    )
  }

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

  // registration / signIn
  const resolvedLangLabel = languageLabel ?? LANG_LABEL[i18n.language] ?? 'Eng'

  return (
    <View style={[styles.wrapperAuth, { paddingTop: insets.top }, style]}>
      <View style={styles.authRow}>
        {showBackBtn && (
          <Pressable style={styles.backBtn} onPress={onBackPress}>
            <Text style={styles.backChevron}>{'‹'}</Text>
          </Pressable>
        )}

        <View style={styles.flex1} />

        <Pressable style={styles.langBtn} onPress={onLanguagePress}>
          <Image source={{ uri: ICONS.lang }} style={styles.langIcon} resizeMode="contain" />
          <Text style={styles.langText}>{resolvedLangLabel}</Text>
          <Image source={{ uri: ICONS.chevDown }} style={styles.chevIcon} resizeMode="contain" />
        </Pressable>
      </View>
    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // ── header1 ────────────────────────────────────────────────────────────────
  wrapper: {
    backgroundColor: Colors.white,
    paddingHorizontal: 24,
    paddingBottom: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems:    'center',
    paddingTop:    16,
  },
  row2: {
    paddingTop:    16,
    paddingBottom: 4,
  },
  flex1: { flex: 1 },
  iconBtn32: {
    width:  32,
    height: 32,
    marginLeft: 8,
    alignItems:     'center',
    justifyContent: 'center',
  },
  icon32: {
    width:  32,
    height: 32,
  },
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
  },
  badgeText: {
    color:      Colors.white,
    fontSize:   8,
    fontWeight: '600',
    lineHeight: 12,
  },
  avatarWrap: {
    width:        48,
    height:       48,
    borderRadius: 24,
    overflow:     'hidden',
    backgroundColor: Colors.border,
  },
  avatar: {
    width:  48,
    height: 48,
  },
  nameBlock: {
    flex:       1,
    marginLeft: 12,
  },
  userName: {
    fontSize:   16,
    fontWeight: '500',
    color:      Colors.textDark,
  },
  editRow: {
    flexDirection: 'row',
    alignItems:    'center',
    marginTop:     2,
  },
  editText: {
    fontSize:   12,
    color:      Colors.link,
    fontWeight: '500',
  },
  editIcon: {
    width:      12,
    height:     12,
    marginLeft: 2,
  },
  paidRow: {
    paddingTop:    4,
    paddingBottom: 4,
    paddingLeft:   60,  // offset by avatar width (48) + margin (12)
  },
  paidBadge: {
    flexDirection:   'row',
    alignItems:      'center',
    backgroundColor: Colors.badgePaidBg,
    borderRadius:    12,
    paddingVertical:   4,
    paddingHorizontal: 8,
    alignSelf:       'flex-start',
  },
  paidTagIcon: {
    width:  14,
    height: 14,
    marginRight: 4,
  },
  paidText: {
    fontSize:   11,
    fontWeight: '600',
    color:      Colors.badgePaidText,
  },

  // ── header2 ────────────────────────────────────────────────────────────────
  wrapper2: {
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  titleRow: {
    flexDirection:  'row',
    alignItems:     'center',
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
    flex:       1,
    fontSize:   16,
    fontWeight: '500',
    color:      Colors.textDark,
  },

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
    fontSize:   12,
    fontWeight: '500',
    color:      Colors.textPrimary,
  },
  chevIcon: {
    width:  12,
    height: 12,
  },
})
