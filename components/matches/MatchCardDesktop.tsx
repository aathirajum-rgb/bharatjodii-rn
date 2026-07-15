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

// Figma node 606:6239's photo frame (606:6240) is a 248×248 SQUARE, not the
// 220×260 rectangle this previously guessed at.
const PHOTO_W = 248
const PHOTO_H = 248

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
        {/* Grouped into one block so `info`'s space-between only opens a gap
            AFTER this (between it and the CTA row below) — badges/name/details
            stay tightly stacked together, only the CTA gets pushed to the
            card's bottom edge. */}
        <View>
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
              {/* Figma node 606:6276: the call icon sits inside its own white
                  circular button (24×24, #006C48 border) — unlike WhatsApp,
                  which is just its own icon graphic with no extra wrapper. */}
              <Pressable style={c.callIconBtn} onPress={onCall} hitSlop={8}>
                <CallIcon width={20} height={20} />
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
        </View>

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
    // Figma node 606:2243: 16px radius (this used 12 — a plausible-looking guess
    // made before the design context was actually pulled).
    borderRadius:      16,
    borderWidth:       1,
    borderColor:       Colors.borderSubtle,
    padding:           16,
    gap:               16,
    marginBottom:      16,
  },
  photoBox: {
    width:            PHOTO_W,
    height:           PHOTO_H,
    // Figma node 606:6240: 8px radius (this used 10 — a plausible-looking guess).
    borderRadius:     8,
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
  // Confirmed via get_design_context on node 606:6239: the info column really
  // is `height:248px, justify-between` in Figma's own generated code — the
  // fixed-28px-gap version tried the turn before was a guess that happened to
  // match ONE mock's incidental leftover space, not the actual design intent.
  // Shorter real profiles will show a bigger gap above the CTA row than this
  // mock does — that's the design as specified, not a bug.
  info: { flex: 1, justifyContent: 'space-between' },

  badgeRow: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    marginBottom:   12,
  },
  badges: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           8,
  },
  contactIcons: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           24,
  },
  callIconBtn: {
    width:           24,
    height:          24,
    borderRadius:    12,
    borderWidth:     1,
    borderColor:     '#006C48',
    backgroundColor: Colors.white,
    alignItems:      'center',
    justifyContent:  'center',
  },

  name: {
    fontFamily: 'Poppins-SemiBold',
    fontSize:   18,
    color:      Colors.black,
  },
  jodiId: {
    fontFamily: 'Poppins-Regular',
    fontSize:   14,
    color:      Colors.black,
    marginTop:  2,
  },
  basicView: {
    fontFamily: 'Poppins-Regular',
    fontSize:   14,
    color:      Colors.black,
    lineHeight: 20,
    marginTop:  12,
  },
  viewProfileRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           2,
    marginTop:     12,
  },
  viewProfile: {
    fontFamily: 'Poppins-Regular',
    fontSize:   14,
    color:      Colors.link,
  },
  viewProfileArrow: { width: 18, height: 15 },

  // Figma node 606:6258's "Frame 1707482322": no marginTop needed — `info`'s
  // own justify-between now positions this row at the card's bottom edge. The
  // 16px gap between each button (160−144) is still correct.
  ctaRow: {
    flexDirection: 'row',
    gap:           16,
  },
  // Figma node 606:6258's "Frame 1707482322" CTA row: Don't-show 144 / View-later
  // 144 / Like 194 out of a 514-wide row (144+16+144+16+194=514) — three buttons
  // sharing the row proportionally, not two content-hugged buttons plus a third
  // stretched to consume whatever's left (which is what `ctaLike: {flex:1}` did
  // here before — on a wide desktop card that made Like enormous compared to its
  // siblings, vs. Figma's fairly modest, similarly-sized three-up row).
  //
  // borderColor/text color '#545454' and gap:4 (not Colors.borderLight/6) —
  // Figma's own generated code for both Tertiary CTAs: `border-[#545454]`,
  // `text-[#545454]`, `gap-[4px]`, height 40, font Poppins-Regular (not Medium).
  ctaDontShow: {
    flex:              144,
    height:            40,
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'center',
    gap:               4,
    borderWidth:       1,
    borderColor:       '#545454',
    borderRadius:      8,
    paddingHorizontal: 14,
  },
  ctaDontShowText: { fontFamily: 'Poppins-Regular', fontSize: 14, color: '#545454' },
  ctaViewLater: {
    flex:              144,
    height:            40,
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'center',
    gap:               4,
    borderWidth:       1,
    borderColor:       '#545454',
    borderRadius:      8,
    paddingHorizontal: 14,
  },
  ctaViewLaterText: { fontFamily: 'Poppins-Regular', fontSize: 14, color: '#545454' },
  ctaDisabled: { opacity: 0.4 },
  ctaLike: {
    flex:              194,
    height:            40,
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'center',
    // Angular/Figma: Like CTA uses primaryBg (#B50033 = Colors.primaryDark), matching
    // the mobile card's ctaLike (MatchesScreen.tsx) — was inconsistent with it here.
    backgroundColor:   Colors.primaryDark,
    borderRadius:      8,
    paddingHorizontal: 14,
    gap:               4,
  },
  // Figma: "Like" text is Poppins-SemiBold (not Medium), 14px (not 13).
  ctaLikeText: { fontFamily: 'Poppins-SemiBold', fontSize: 14, color: Colors.white },

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
