import { Image } from 'expo-image'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { matchProfileAdapter } from '../../adapters/matches.adapter'
import { Colors } from '../../constants/colors'
import { CDN_SVG } from '../../constants/cdn'
import { StorageKeys } from '../../constants/storage.keys'
import { callActivityApi } from '../../service/activityService'
import { getItem } from '../../service/storageService'
import type { MatchProfile } from '../../types/interfaces/matches.interface'

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = { navigation: any; route?: any }

type LikedProfile = MatchProfile & { isDeleted: boolean }

// ─── Constants ────────────────────────────────────────────────────────────────

const SCREEN_W    = Dimensions.get('window').width
const H_PAD       = 16
const PHOTO_W     = Math.floor((SCREEN_W - H_PAD * 2) * 0.36)
const PHOTO_H     = Math.floor(PHOTO_W * 1.35)
const LIMIT       = 20
const AVATAR_MALE = CDN_SVG + 'avatar-male.svg'

// ─── Raw API → adapter shim ───────────────────────────────────────────────────

function rawToSwiperItem(raw: any) {
  return {
    profileId:          raw.MATRIID         ?? '',
    name:               raw.PROFILENAME     ?? raw.NAME        ?? '',
    age:                raw.AGE             ?? '',
    height:             raw.HEIGHT          ?? '',
    education:          raw.EDUCATION       ?? '',
    location:           raw.CITY            ?? raw.LOCATION    ?? '',
    profileImg:         raw.THUMBIMG        ?? '',
    isPhotoAvailable:   raw.PHOTOSTATUS == 1 || raw.PHOTOSTATUS === '1',
    isPhotoProtect:     raw.PHOTOPRIVACY == 1 || raw.PHOTOPRIVACY === '1',
    likedStatus:        raw.LIKESTATUS      ?? '0',
    likedViewedDateText:raw.LIKEDON         ?? raw.LIKEDDATE   ?? raw.LIKEDATE ?? '',
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function LikedByMeScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets()

  const [profiles,     setProfiles]     = useState<LikedProfile[]>([])
  const [totalCount,   setTotalCount]   = useState(0)
  const [loading,      setLoading]      = useState(true)
  const [loadingMore,  setLoadingMore]  = useState(false)
  const [hasMore,      setHasMore]      = useState(true)

  const startRef  = useRef(0)
  const userIdRef = useRef('')

  // ── Initial load ────────────────────────────────────────────────────────────

  useEffect(() => {
    getItem(StorageKeys.Auth.USER_ID).then(id => {
      userIdRef.current = id ?? ''
      loadPage(0, true)
    })
  }, [])

  // ── API call ────────────────────────────────────────────────────────────────

  async function loadPage(start: number, isFirst: boolean) {
    if (isFirst) setLoading(true)
    else         setLoadingMore(true)

    try {
      const res = await callActivityApi('likesent', userIdRef.current, start, LIMIT)

      if (res?.RESPONSECODE == 1 && res?.ERRCODE == 0) {
        const raw: any[] = res.RESPONSE ?? []

        if (isFirst) {
          const total = parseInt(res.TOTAL ?? '0', 10)
          setTotalCount(total)
        }

        const adapted: LikedProfile[] = raw
          .filter(r => r && r.MATRIID)
          .map(r => ({
            ...matchProfileAdapter.adapt(rawToSwiperItem(r)),
            isDeleted: r.STATUS == 1 || r.STATUS === '1',
          }))

        setProfiles(prev => isFirst ? adapted : [...prev, ...adapted])
        startRef.current = start + LIMIT

        if (raw.length < LIMIT) setHasMore(false)
      } else if (res?.ERRCODE == 1) {
        setHasMore(false)
      }
    } catch {
      // silently ignore — show whatever we have
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }

  // ── Pagination ──────────────────────────────────────────────────────────────

  const handleEndReached = useCallback(() => {
    if (!loadingMore && hasMore && !loading) {
      loadPage(startRef.current, false)
    }
  }, [loadingMore, hasMore, loading])

  // ── Title ───────────────────────────────────────────────────────────────────

  function titleText() {
    if (totalCount === 1) return '1 profile liked by you'
    return `${totalCount} profiles liked by you`
  }

  // ── Render helpers ──────────────────────────────────────────────────────────

  function renderCard({ item }: { item: LikedProfile }) {
    const detailParts = [item.age, item.height, item.education].filter(Boolean).join(', ')

    return (
      <Pressable
        style={[styles.card, item.isDeleted && styles.cardDeleted]}
        onPress={() => {/* navigate to profile */}}
        disabled={item.isDeleted}
      >
        {/* Photo */}
        <View style={styles.photoWrap}>
          <Image
            source={{ uri: item.profileImg || AVATAR_MALE }}
            style={styles.photo}
            contentFit="cover"
          />
          {item.isDeleted && (
            <View style={styles.deletedOverlay}>
              <Text style={styles.deletedText}>Profile deleted</Text>
            </View>
          )}
        </View>

        {/* Details */}
        <View style={styles.details}>
          {!!item.name     && <Text style={styles.name} numberOfLines={1}>{item.name}</Text>}
          {!!detailParts   && <Text style={styles.detailText} numberOfLines={2}>{detailParts}</Text>}
          {!!item.location && (
            <Text style={styles.location} numberOfLines={1}>{item.location}</Text>
          )}

          {!!item.likedDateText && (
            <View style={styles.likedBadge}>
              <Text style={styles.likedBadgeText} numberOfLines={1}>{item.likedDateText}</Text>
            </View>
          )}
        </View>
      </Pressable>
    )
  }

  function renderFooter() {
    if (!loadingMore) return null
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={Colors.primary} />
      </View>
    )
  }

  function renderEmpty() {
    if (loading) return null
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyIcon}>💌</Text>
        <Text style={styles.emptyTitle}>No liked profiles yet</Text>
        <Text style={styles.emptySubtitle}>
          Profiles you like will appear here
        </Text>
      </View>
    )
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>

      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => navigation.goBack()} hitSlop={12}>
          <Text style={styles.backArrow}>‹</Text>
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {loading ? 'Liked profiles' : titleText()}
        </Text>
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <FlatList
          data={profiles}
          keyExtractor={item => item.profileId}
          renderItem={renderCard}
          ListEmptyComponent={renderEmpty}
          ListFooterComponent={renderFooter}
          onEndReached={handleEndReached}
          onEndReachedThreshold={0.4}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}
    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({

  screen: {
    flex:            1,
    backgroundColor: Colors.background,
  },

  // ── Header ──────────────────────────────────────────────────────────────────
  header: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: H_PAD,
    paddingVertical:   14,
    backgroundColor:   Colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.divider,
    gap:               8,
  },
  backBtn: {
    width:   32,
    height:  32,
    alignItems:  'center',
    justifyContent: 'center',
  },
  backArrow: {
    fontSize:   26,
    color:      Colors.textPrimary,
    lineHeight: 32,
  },
  headerTitle: {
    flex:       1,
    fontSize:   18,
    fontWeight: '600',
    color:      Colors.textPrimary,
  },

  // ── List ────────────────────────────────────────────────────────────────────
  listContent: {
    paddingHorizontal: H_PAD,
    paddingTop:        12,
    paddingBottom:     24,
    flexGrow:          1,
  },
  separator: {
    height:          12,
  },

  // ── Card ────────────────────────────────────────────────────────────────────
  card: {
    flexDirection:   'row',
    backgroundColor: Colors.surface,
    borderRadius:    12,
    overflow:        'hidden',
    shadowColor:     Colors.shadow,
    shadowOpacity:   0.08,
    shadowRadius:    8,
    shadowOffset:    { width: 0, height: 2 },
    elevation:       2,
  },
  cardDeleted: {
    opacity: 0.55,
  },

  // ── Photo column ────────────────────────────────────────────────────────────
  photoWrap: {
    width:  PHOTO_W,
    height: PHOTO_H,
  },
  photo: {
    width:  '100%',
    height: '100%',
  },
  deletedOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems:      'center',
    justifyContent:  'flex-end',
    paddingBottom:   8,
  },
  deletedText: {
    fontSize:   11,
    color:      Colors.white,
    fontWeight: '600',
  },

  // ── Details column ──────────────────────────────────────────────────────────
  details: {
    flex:              1,
    paddingHorizontal: 12,
    paddingVertical:   14,
    justifyContent:    'center',
    gap:               4,
  },
  name: {
    fontSize:     16,
    fontWeight:   '700',
    color:        Colors.textPrimary,
    marginBottom: 2,
  },
  detailText: {
    fontSize:   13,
    color:      Colors.textSecondary,
    lineHeight: 18,
  },
  location: {
    fontSize:   13,
    color:      Colors.textTertiary,
    lineHeight: 18,
  },
  likedBadge: {
    marginTop:         8,
    backgroundColor:   Colors.primarySurface,
    borderRadius:      6,
    paddingHorizontal: 8,
    paddingVertical:   4,
    alignSelf:         'flex-start',
  },
  likedBadgeText: {
    fontSize:   11,
    color:      Colors.primary,
    fontWeight: '600',
  },

  // ── States ──────────────────────────────────────────────────────────────────
  loadingWrap: {
    flex:           1,
    alignItems:     'center',
    justifyContent: 'center',
  },
  footerLoader: {
    paddingVertical: 20,
    alignItems:      'center',
  },
  emptyState: {
    flex:           1,
    alignItems:     'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingTop:     80,
    gap:            12,
  },
  emptyIcon: {
    fontSize: 56,
  },
  emptyTitle: {
    fontSize:   20,
    fontWeight: '700',
    color:      Colors.textPrimary,
    textAlign:  'center',
  },
  emptySubtitle: {
    fontSize:   14,
    color:      Colors.textSecondary,
    textAlign:  'center',
    lineHeight: 20,
  },
})
