import { Pressable, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { SvgUri } from 'react-native-svg'
import MenuIcon from '../../assets/icons/MenuIcon'
import NotificationIcon from '../../assets/icons/NotificationIcon'
import SearchIcon from '../../assets/icons/SearchIcon'
import { Colors } from '../../constants/colors'
import { CDN_SVG } from '../../constants/cdn'
import i18n from '../../i18n'

const CDN = CDN_SVG

const LANG_LABEL: Record<string, string> = {
  en: 'Eng', tm: 'Tamil', tl: 'Telugu', ml: 'Malay', kn: 'Kanna',
  hi: 'Hindi', bn: 'Bangla', mt: 'Marathi', or: 'Odia', gj: 'Gujarati', pa: 'Punjabi',
}

const ICONS = {
  lang:     CDN + 'revamp/lang-change-img.svg',
  chevDown: 'https://stgmobile.jodii.app/jodiiapp/svg/chevron-down-outline.svg',
  fwdLink:  CDN + 'revamp/forward-icon-link.svg',
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ToolbarItem {
  toolType:          string
  toolImg:           string
  notifyCount?:      string
  showNotification?: boolean
}

export interface HomeHeaderProps {
  userName?:           string
  userImg?:            string
  completionPct?:      number
  languageLabel?:      string
  homeToolBar?:        ToolbarItem[]
  onAvatarPress?:      () => void
  onEditProfilePress?: () => void
  onToolbarItemPress?: (toolType: string) => void
  onLanguagePress?:    () => void
}

// ─── HomeHeader ───────────────────────────────────────────────────────────────

export default function HomeHeader({
  userName,
  userImg,
  completionPct,
  languageLabel,
  homeToolBar,
  onAvatarPress,
  onEditProfilePress,
  onToolbarItemPress,
  onLanguagePress,
}: HomeHeaderProps) {
  const resolvedLangLabel = languageLabel ?? LANG_LABEL[i18n.language] ?? 'Eng'

  return (
    // SafeAreaView edges={['top']} — same pattern as Love project CustomHeader
    // Status bar zone is handled here; HomeScreen ScrollView needs no extra paddingTop
    <SafeAreaView edges={['top']} style={s.bg}>

      {/* ── Row 1: App bar — menu | flex | language | notification + chat ── */}
      <View style={s.appBar}>
        <Pressable style={s.iconBtn} onPress={() => onToolbarItemPress?.('menu')}>
          <MenuIcon size={18} color={Colors.textPrimary} />
        </Pressable>

        <View style={s.flex1} />

        <Pressable style={s.langBtn} onPress={onLanguagePress}>
          <SvgUri uri={ICONS.lang} width={20} height={20} />
          <Text style={s.langText}>{resolvedLangLabel}</Text>
          <SvgUri uri={ICONS.chevDown} width={12} height={12} />
        </Pressable>

        {homeToolBar?.filter(t => t.toolType !== 'menu').map(item => (
          <Pressable
            key={item.toolType}
            style={s.iconBtn}
            onPress={() => onToolbarItemPress?.(item.toolType)}
          >
            {item.toolType === 'notification'
              ? <NotificationIcon size={18} color={Colors.textPrimary} />
              : item.toolType === 'chat'
              ? <SearchIcon size={18} color={Colors.textPrimary} />
              : <SvgUri uri={item.toolImg} width={19} height={19} />
            }
            {!!(item.showNotification && item.notifyCount && item.notifyCount !== '0') && (
              <View style={s.badgeWrap}>
                <Text style={s.badgeText} numberOfLines={1}>{item.notifyCount}</Text>
              </View>
            )}
          </Pressable>
        ))}
      </View>

      {/* ── Row 2: User bar — avatar + completion % | name + edit profile ── */}
      <View style={s.userBar}>
        <Pressable style={s.avatarWrap} onPress={onAvatarPress}>
          <SvgUri
            uri={userImg ?? CDN + 'revamp/default-avatar.svg'}
            width={48}
            height={48}
            style={s.avatarRadius}
          />
          {completionPct !== undefined && (
            <View style={s.completionBadge}>
              <Text style={s.completionText}>{completionPct}%</Text>
            </View>
          )}
        </Pressable>

        <Pressable style={s.nameBlock} onPress={onEditProfilePress}>
          <Text style={s.userName} numberOfLines={1}>{userName ?? ''}</Text>
          <View style={s.editRow}>
            <Text style={s.editLabel}>Edit profile</Text>
            <SvgUri uri={ICONS.fwdLink} width={12} height={12} />
          </View>
        </Pressable>
      </View>

    </SafeAreaView>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  bg: {
    backgroundColor:   '#EBF0FF',
    paddingHorizontal: 16,
    paddingBottom:     14,
  },

  // Row 1
  appBar: {
    flexDirection: 'row',
    alignItems:    'center',
    paddingTop:    10,
    gap:           8,
  },
  flex1: { flex: 1 },

  langBtn: {
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
  langIcon:  { width: 20, height: 20 },
  langText:  { fontFamily: 'Poppins-Medium', fontSize: 11, color: Colors.textPrimary },
  chevIcon:  { width: 12, height: 12 },

  iconBtn: {
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
  icon: { width: 19, height: 19 },

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
  badgeText: { fontFamily: 'Poppins-SemiBold', color: Colors.white, fontSize: 8, lineHeight: 12 },

  // Row 2
  userBar: {
    flexDirection: 'row',
    alignItems:    'center',
    marginTop:     10,
  },
  avatarWrap: {
    width:          52,
    height:         52,
    borderRadius:   26,
    borderWidth:    2,
    borderColor:    Colors.primary,
    alignItems:     'center',
    justifyContent: 'center',
    position:       'relative',
  },
  avatarRadius: { borderRadius: 24 },
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
  completionText: { fontFamily: 'Poppins-SemiBold', color: Colors.white, fontSize: 9, lineHeight: 12 },

  nameBlock: { flex: 1, marginLeft: 12 },
  userName:  { fontFamily: 'Poppins-SemiBold', fontSize: 15, color: Colors.textPrimary, lineHeight: 22 },
  editRow:   { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 1 },
  editLabel: { fontFamily: 'Poppins-Regular', fontSize: 12, color: Colors.primary },
  editIcon:  { width: 12, height: 12, tintColor: Colors.primary },
})
