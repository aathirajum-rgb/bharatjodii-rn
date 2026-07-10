// Desktop match card (Figma "Jodii Desktop", node 225:2522) — horizontal
// photo-left/info-right layout. Same props as the mobile MatchCard
// (screens/matches/MatchesScreen.tsx) so MatchesDesktopLayout can pass the
// exact same profile/handlers with zero adaptation.
import { useTranslation } from 'react-i18next'
import { Image, Pressable, StyleSheet, Text, View } from 'react-native'
import CdnSvg from '../cdn-svg/CdnSvg'
import {
  WhatsAppIcon, WhatsAppUnlockButton, CallIcon, CloseIcon, ViewLaterIcon, LikeIcon,
  buildBasicView, showLikeCTA, showAfterLikeCTA,
  getBlurPhotoUri, NEWLY_JOINED_STAR_URI, RIGHT_ARROW_ANIMATION_URI, ProfileBadge, PhotoSwiper,
  getAfterLikeCtaLabel, getAfterLikeCtaIcon, getAfterLikeContentText, showContactsLeftBanner, showFreeBadge,
  disableDontShow, disableViewLater,
  type AfterLikeCtx,
} from './matchesCard.shared'
import { Colors } from '../../constants/colors'
import type { MatchProfile } from '../../types/interfaces/matches.interface'

const PHOTO_W = 220
const PHOTO_H = 260

export default function MatchCardDesktop({
  profile, oppGender, ownEntryType, femaleFreeEligible, indNumbersLeft,
  onPress, onLike, onDontShow, onViewLater, onCall, onWhatsApp,
}: {
  profile:            MatchProfile
  oppGender:          'M' | 'F'
  ownEntryType:       string
  femaleFreeEligible: boolean
  indNumbersLeft:     string
  onPress:     () => void
  onLike:      () => void
  onDontShow:  () => void
  onViewLater: () => void
  onCall:      () => void
  onWhatsApp:  () => void
}) {
  const { t } = useTranslation()

  // Same context mobile's MatchCard builds (MatchesScreen.tsx) — drives the after-like
  // CTA's dynamic content/label/icon/FREE-badge/contacts-left line below. Previously
  // this card just hardcoded static "Contact"/"Send Interest" text regardless of any
  // of this — a real, confirmed gap, not a design choice.
  const ctaCtx: AfterLikeCtx = {
    entryType:   ownEntryType,
    likedStatus: profile.likedStatus,
    phoneViewed: profile.phoneViewed,
    femaleFreeEligible,
    indNumbersLeft,
    oppGender,
  }

  return (
    <View style={c.card}>
      {/* ── Photo (left) ──────────────────────────────────────────────────── */}
      {/* Plain View, not Pressable — PhotoSwiper below owns its own tap/drag gesture
          handling (PanResponder); nesting it inside another Pressable would make the
          two compete for the same touch, breaking drag-to-swipe. */}
      <View style={c.photoBox}>
        {profile.isPhotoAvailable && !profile.isPhotoProtect && profile.photos.length > 0 ? (
          <PhotoSwiper
            images={profile.photos}
            width={PHOTO_W}
            height={PHOTO_H}
            onPress={onPress}
            showArrows
          />
        ) : (
          <Pressable style={c.singlePhotoPressable} onPress={onPress}>
            <CdnSvg
              uri={getBlurPhotoUri(oppGender)}
              width="100%" height="100%"
              style={StyleSheet.absoluteFill}
            />
            <View style={c.photoOverlay}>
              <View style={c.overlayCard}>
                <Text style={c.overlayText}>
                  {t('GENERAL.REQUEST_ADD_PHOTO_WHATSAPP').replace('#HER_HIS#', t(`PRONOUN.${oppGender}.hisher`))}
                </Text>
                <WhatsAppUnlockButton label={t('GENERAL.WHATSAPP')} onPress={onWhatsApp} />
              </View>
            </View>
          </Pressable>
        )}

        {profile.isNewlyJoined && (
          <View style={c.newBadge} pointerEvents="none">
            <CdnSvg uri={NEWLY_JOINED_STAR_URI} width={16} height={16} />
            {/* Figma "Jodii Desktop" node 783:54270 — full "Newly joined" text (desktop-only;
                mobile intentionally keeps the shorter Angular-matched "New"). */}
            <Text style={c.newBadgeText}>{t('HOME.NEWLY_JOINED_HEADER')}</Text>
          </View>
        )}
      </View>

      {/* ── Info (right) ──────────────────────────────────────────────────── */}
      <View style={c.info}>
        <View style={c.badgeRow}>
          <View style={c.badges}>
            {profile.isPaidMember && (
              <ProfileBadge variant="paid" text={t('MENU.PAID_BADGE')} />
            )}
            {/* Angular: FUNC.getLogInGender() == 'F' — oppGender === 'M' means the viewer is female */}
            {profile.isIdVerified && oppGender === 'M' && (
              <ProfileBadge variant="verified" text={t('MATCHES.VERIFIED_ID')} />
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
          <View style={c.viewProfileRow}>
            <Text style={c.viewProfile}>{t('MATCHES.VIEW_PROFILE_CTA')}</Text>
            {/* Angular: button-revamp.component.html's IsShowAnimation() branch — real
                Jodii swaps the plain chevron for this animated GIF, not a static arrow. */}
            <Image source={{ uri: RIGHT_ARROW_ANIMATION_URI }} style={c.viewProfileArrow} />
          </View>
        </Pressable>

        {showLikeCTA(profile.likedStatus) && (
          <View style={c.ctaRow}>
            <Pressable
              style={[c.ctaDontShow, disableDontShow(profile.dontShowStatus) && c.ctaDisabled]}
              onPress={onDontShow}
              disabled={disableDontShow(profile.dontShowStatus)}
            >
              <CloseIcon width={14} height={14} />
              <Text style={c.ctaDontShowText}>{t('GENERAL.DONTSHOWCTA')}</Text>
            </Pressable>
            <Pressable
              style={[c.ctaViewLater, disableViewLater(profile.viewLaterStatus) && c.ctaDisabled]}
              onPress={onViewLater}
              disabled={disableViewLater(profile.viewLaterStatus)}
            >
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
          // Angular: matches-cta-bg-color + getContentAfterLike() text + Call Now/Pay Now
          // CTA + FREE badge + contacts-left line — same content mobile's MatchCard shows
          // (MatchesScreen.tsx), previously hardcoded static text here instead.
          <View style={c.afterLikeRow}>
            <View style={c.afterLikeTopRow}>
              <Text style={c.afterLikeText}>{getAfterLikeContentText(ctaCtx, t)}</Text>
              <View style={c.ctaSendInterestWrap}>
                {showFreeBadge(ctaCtx) && (
                  <View style={c.freeBadge} pointerEvents="none">
                    <Text style={c.freeBadgeText}>{t('GENERAL.FREE')}</Text>
                  </View>
                )}
                <Pressable style={c.ctaSendInterest} onPress={onCall}>
                  <View style={c.ctaSendInterestIconBox}>
                    <CdnSvg uri={getAfterLikeCtaIcon(ctaCtx)} width={16} height={16} />
                  </View>
                  <Text style={c.ctaSendInterestText}>{getAfterLikeCtaLabel(ctaCtx, t)}</Text>
                </Pressable>
              </View>
            </View>
            {showContactsLeftBanner(ctaCtx) && (
              <Text style={c.contactsLeftText}>{t('VIEWPROFILE.CONTACT_SEEN_INFO')}</Text>
            )}
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
  singlePhotoPressable: { width: '100%', height: '100%' },

  newBadge: {
    position:      'absolute',
    top:           0,
    left:          0,
    flexDirection: 'row',
    alignItems:    'center',
    justifyContent: 'center',
    backgroundColor: Colors.primaryDark,
    height:        24,
    paddingLeft:       8,
    paddingRight:      12,
    borderTopLeftRadius: 10,
    borderBottomRightRadius: 10,
    gap: 4,
  },
  newBadgeText: {
    fontFamily: 'Poppins-Regular',
    fontSize:   12,
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
    padding:           16,
    borderRadius:      12,
    borderWidth:       1,
    borderColor:       Colors.overlayBorder,
    alignItems:        'center',
    gap:               16,
  },
  overlayText: {
    fontFamily: 'Poppins-Regular',
    fontSize:   11,
    color:      Colors.white,
    textAlign:  'center',
    lineHeight: 16,
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
  viewProfileRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           2,
    marginTop:     8,
  },
  viewProfile: {
    fontFamily: 'Poppins-Medium',
    fontSize:   13,
    color:      Colors.link,
  },
  viewProfileArrow: { width: 18, height: 15 },

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
  ctaDisabled: { opacity: 0.4 },
  ctaLike: {
    flex:              1,
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'center',
    // Angular/Figma: Like CTA uses primaryBg (#B50033 = Colors.primaryDark), matching
    // the mobile card's ctaLike (MatchesScreen.tsx) — was inconsistent with it here.
    backgroundColor:   Colors.primaryDark,
    borderRadius:      8,
    paddingVertical:   10,
    gap:               6,
  },
  ctaLikeText: { fontFamily: 'Poppins-Medium', fontSize: 13, color: Colors.white },

  afterLikeRow: {
    backgroundColor:   Colors.afterLikeBg,
    borderRadius:      8,
    borderWidth:       1,
    borderColor:       Colors.afterLikeBorder,
    paddingHorizontal: 14,
    paddingVertical:   10,
    marginTop:         16,
  },
  afterLikeTopRow: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    gap:            12,
  },
  afterLikeText: {
    flex:       1,
    fontFamily: 'Poppins-Medium',
    fontSize:   13,
    color:      Colors.black,
  },
  ctaSendInterestWrap: { position: 'relative', flexShrink: 0 },
  ctaSendInterest: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'center',
    gap:               6,
    // Angular: matches-card.component.html's after-like CTA also uses primaryBg (primaryDark)
    backgroundColor:   Colors.primaryDark,
    borderRadius:      8,
    paddingVertical:   8,
    paddingHorizontal: 16,
  },
  ctaSendInterestIconBox: {
    width: 16, height: 16, flexShrink: 0,
    alignItems: 'center', justifyContent: 'center',
  },
  ctaSendInterestText: { fontFamily: 'Poppins-Medium', fontSize: 13, color: Colors.white },
  freeBadge: {
    position: 'absolute', top: -10, right: 8, zIndex: 1,
    backgroundColor: Colors.badgeNewBg, borderRadius: 10,
    paddingHorizontal: 8, paddingVertical: 2,
  },
  freeBadgeText: { fontFamily: 'Poppins-SemiBold', fontSize: 10, color: Colors.badgeNewText },
  contactsLeftText: {
    fontFamily: 'Poppins-Regular',
    fontSize:   11,
    color:      Colors.textSecondary,
    textAlign:  'center',
    marginTop:  8,
  },
})
