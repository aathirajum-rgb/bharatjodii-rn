// Desktop match card (Figma "Jodii Desktop", node 225:2522) — horizontal
// photo-left/info-right layout. Same props as the mobile MatchCard
// (screens/matches/MatchesScreen.tsx) so MatchesDesktopLayout can pass the
// exact same profile/handlers with zero adaptation.
import { useTranslation } from 'react-i18next'
import { Image, Pressable, StyleSheet, Text, View } from 'react-native'
import { SvgUri } from 'react-native-svg'
import {
  WhatsAppIcon, CallIcon, CloseIcon, ViewLaterIcon, LikeIcon,
  buildBasicView, showLikeCTA, showAfterLikeCTA,
  getBlurPhotoUri, NEWLY_JOINED_STAR_URI, PAID_TAG_URI, VERIFIED_TAG_URI,
} from './matchesCard.shared'
import { Colors } from '../../constants/colors'
import type { MatchProfile } from '../../types/interfaces/matches.interface'

const PHOTO_W = 220
const PHOTO_H = 260

export default function MatchCardDesktop({
  profile, oppGender, onPress, onLike, onDontShow, onViewLater, onCall, onWhatsApp,
}: {
  profile:     MatchProfile
  oppGender:   'M' | 'F'
  onPress:     () => void
  onLike:      () => void
  onDontShow:  () => void
  onViewLater: () => void
  onCall:      () => void
  onWhatsApp:  () => void
}) {
  const { t } = useTranslation()

  return (
    <View style={c.card}>
      {/* ── Photo (left) ──────────────────────────────────────────────────── */}
      <Pressable style={c.photoBox} onPress={onPress}>
        {profile.isPhotoAvailable && !profile.isPhotoProtect && profile.profileImg ? (
          <Image source={{ uri: profile.profileImg }} style={c.photo} resizeMode="cover" />
        ) : (
          <>
            <SvgUri
              uri={getBlurPhotoUri(oppGender)}
              width="100%" height="100%"
              style={StyleSheet.absoluteFill}
            />
            <View style={c.photoOverlay}>
              <View style={c.overlayCard}>
                <Text style={c.overlayText}>
                  {t('GENERAL.REQUEST_ADD_PHOTO_WHATSAPP').replace('#HER_HIS#', oppGender === 'F' ? 'her' : 'his')}
                </Text>
                <Pressable style={c.waBtn} onPress={onWhatsApp}>
                  <WhatsAppIcon width={16} height={16} />
                  <Text style={c.waBtnText}>{t('GENERAL.WHATSAPP')}</Text>
                </Pressable>
              </View>
            </View>
          </>
        )}

        {profile.isNewlyJoined && (
          <View style={c.newBadge} pointerEvents="none">
            <SvgUri uri={NEWLY_JOINED_STAR_URI} width={12} height={12} />
            <Text style={c.newBadgeText}>{t('MATCHES.NEW')}</Text>
          </View>
        )}
      </Pressable>

      {/* ── Info (right) ──────────────────────────────────────────────────── */}
      <View style={c.info}>
        <View style={c.badgeRow}>
          <View style={c.badges}>
            {profile.isPaidMember && (
              <SvgUri uri={PAID_TAG_URI} width={72} height={20} />
            )}
            {profile.isIdVerified && (
              <SvgUri uri={VERIFIED_TAG_URI} width={90} height={20} />
            )}
          </View>
          <View style={c.contactIcons}>
            <Pressable onPress={onCall} hitSlop={8}>
              <CallIcon width={22} height={22} />
            </Pressable>
            <Pressable onPress={onWhatsApp} hitSlop={8}>
              <WhatsAppIcon width={24} height={24} />
            </Pressable>
          </View>
        </View>

        <Pressable onPress={onPress}>
          <Text style={c.name} numberOfLines={1}>{profile.name}</Text>
          <Text style={c.jodiId}>{t('MATCHES.JODI_ID').replace('#ID#', profile.profileId)}</Text>
          <Text style={c.basicView} numberOfLines={2}>{buildBasicView(profile)}</Text>
          <Text style={c.viewProfile}>{t('MATCHES.VIEW_PROFILE_CTA')} {'›'}</Text>
        </Pressable>

        {showLikeCTA(profile.likedStatus) && (
          <View style={c.ctaRow}>
            <Pressable style={c.ctaDontShow} onPress={onDontShow}>
              <CloseIcon width={14} height={14} />
              <Text style={c.ctaDontShowText}>{t('GENERAL.DONTSHOWCTA')}</Text>
            </Pressable>
            <Pressable style={c.ctaViewLater} onPress={onViewLater}>
              <ViewLaterIcon width={14} height={14} />
              <Text style={c.ctaViewLaterText}>{t('GENERAL.VIEWLATER')}</Text>
            </Pressable>
            <Pressable style={c.ctaLike} onPress={onLike}>
              <LikeIcon width={16} height={17} />
              <Text style={c.ctaLikeText}>{t('GENERAL.LIKE_CTA').replace('#HER_HIM#', '').trim()}</Text>
            </Pressable>
          </View>
        )}

        {showAfterLikeCTA(profile.likedStatus) && (
          <View style={c.afterLikeRow}>
            <Text style={c.afterLikeText}>{t('GENERAL.CONTACT')}</Text>
            <Pressable style={c.ctaSendInterest} onPress={onPress}>
              <Text style={c.ctaSendInterestText}>{t('GENERAL.SEND_INTEREST_CTA')}</Text>
            </Pressable>
          </View>
        )}
      </View>
    </View>
  )
}

const c = StyleSheet.create({
  card: {
    flexDirection:     'row',
    backgroundColor:   Colors.white,
    borderRadius:      12,
    borderWidth:       1,
    borderColor:       Colors.borderSubtle,
    padding:           16,
    gap:               16,
    marginBottom:      16,
  },
  photoBox: {
    width:            PHOTO_W,
    height:           PHOTO_H,
    borderRadius:     10,
    overflow:         'hidden',
    backgroundColor:  Colors.divider,
    flexShrink:       0,
  },
  photo: { width: '100%', height: '100%' },

  newBadge: {
    position:      'absolute',
    top:           0,
    left:          0,
    flexDirection: 'row',
    alignItems:    'center',
    backgroundColor: Colors.primaryDark,
    paddingVertical:   3,
    paddingLeft:       8,
    paddingRight:      12,
    borderBottomRightRadius: 10,
    gap: 3,
  },
  newBadgeText: {
    fontFamily: 'Poppins-Medium',
    fontSize:   10,
    color:      Colors.white,
  },

  photoOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems:     'center',
    justifyContent: 'center',
  },
  overlayCard: {
    backgroundColor:   Colors.scrimStrong,
    marginHorizontal:  12,
    paddingVertical:   8,
    paddingHorizontal: 12,
    borderRadius:      10,
    borderWidth:       1,
    borderColor:       Colors.overlayBorder,
    alignItems:        'center',
  },
  overlayText: {
    fontFamily: 'Poppins-Regular',
    fontSize:   11,
    color:      Colors.white,
    textAlign:  'center',
    lineHeight: 16,
  },
  waBtn: {
    flexDirection:     'row',
    alignItems:        'center',
    backgroundColor:   Colors.whatsappGreen,
    borderRadius:      6,
    paddingVertical:   6,
    paddingHorizontal: 12,
    marginTop:         6,
    gap:               4,
  },
  waBtnText: {
    fontFamily: 'Poppins-Medium',
    fontSize:   11,
    color:      Colors.white,
  },

  info: { flex: 1, justifyContent: 'flex-start' },

  badgeRow: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    marginBottom:   8,
  },
  badges: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           6,
  },
  contactIcons: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           12,
  },

  name: {
    fontFamily: 'Poppins-SemiBold',
    fontSize:   18,
    color:      Colors.textDark,
  },
  jodiId: {
    fontFamily: 'Poppins-Regular',
    fontSize:   13,
    color:      Colors.textSecondary,
    marginTop:  2,
  },
  basicView: {
    fontFamily: 'Poppins-Regular',
    fontSize:   13,
    color:      Colors.textDark,
    lineHeight: 20,
    marginTop:  8,
  },
  viewProfile: {
    fontFamily: 'Poppins-Medium',
    fontSize:   13,
    color:      Colors.link,
    marginTop:  8,
  },

  ctaRow: {
    flexDirection: 'row',
    gap:           8,
    marginTop:     16,
  },
  ctaDontShow: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'center',
    gap:               6,
    borderWidth:       1,
    borderColor:       Colors.borderLight,
    borderRadius:      8,
    paddingVertical:   10,
    paddingHorizontal: 14,
  },
  ctaDontShowText: { fontFamily: 'Poppins-Medium', fontSize: 13, color: Colors.textDark },
  ctaViewLater: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'center',
    gap:               6,
    borderWidth:       1,
    borderColor:       Colors.borderLight,
    borderRadius:      8,
    paddingVertical:   10,
    paddingHorizontal: 14,
  },
  ctaViewLaterText: { fontFamily: 'Poppins-Medium', fontSize: 13, color: Colors.textDark },
  ctaLike: {
    flex:              1,
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'center',
    backgroundColor:   Colors.primary,
    borderRadius:      8,
    paddingVertical:   10,
    gap:               6,
  },
  ctaLikeText: { fontFamily: 'Poppins-Medium', fontSize: 13, color: Colors.white },

  afterLikeRow: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    backgroundColor:   Colors.afterLikeBg,
    borderRadius:      8,
    borderWidth:       1,
    borderColor:       Colors.afterLikeBorder,
    paddingHorizontal: 14,
    paddingVertical:   10,
    marginTop:         16,
  },
  afterLikeText: {
    fontFamily: 'Poppins-Medium',
    fontSize:   13,
    color:      Colors.black,
  },
  ctaSendInterest: {
    backgroundColor:   Colors.primary,
    borderRadius:      8,
    paddingVertical:   8,
    paddingHorizontal: 16,
  },
  ctaSendInterestText: { fontFamily: 'Poppins-Medium', fontSize: 13, color: Colors.white },
})
