// Button variation identifiers.
// Angular version used CSS class name strings — replaced with clean identifiers
// that map to StyleSheet objects in the Button component.

export enum EButtonType {
  regular = 'regular',
  rounded = 'rounded',
  onlyText = 'onlyText',
  linkBtn = 'linkBtn',
  greyBtn = 'greyBtn',
}

export enum EButtonBorder {
  none = 'none',
  gradient = 'gradient',
  dark = 'dark',
  primary = 'primary',
  grey = 'grey',
}

export enum EButtonBackground {
  gradient = 'gradient',
  white = 'white',
  transparent = 'transparent',
  translucent = 'translucent',
  primary = 'primary',
  whatsApp = 'whatsApp',
}

export enum EButtonTextColor {
  primary = 'primary',
  white = 'white',
  dark = 'dark',
  darkGrey = 'darkGrey',
  black = 'black',
  grey = 'grey',
  link = 'link',
  purple = 'purple',
  green = 'green',
  lightBlack = 'lightBlack',
}

export enum EIconPosition {
  start = 'start',
  end = 'end',
}

// i18n translation keys for button labels
export enum EButtonText {
  seeAllCta = 'HOME.SEE_ALL_CTA',
  dontShow = 'GENERAL.DONTSHOWCTA',
  voiceMsg = 'GENERAL.VOICE_MESSAGE',
  whatsApp = 'GENERAL.WHATSAPP',
  like = 'GENERAL.LIKECTA',
  liked = 'GENERAL.LIKEDCTA',
  viewProfile = 'MATCHES.VIEW_PROFILE_CTA',
  listviewcardvp = 'CTATXT.VIEWDETAILS',
  exploreMatches = 'MESSAGES.EXPLORE_MATCHES',
  viewProfiles = 'MATCHES.VIEW_PROFILE',
  requestPhoto = 'HOME.REQUEST_ADD_PHOTO',
  contacthim = 'GENERAL.CALL_CTA',
  free = 'GENERAL.FREE',
  message = 'GENERAL.MESSAGE_CTA',
  seeAll = 'GENERAL.SEE_ALL',
  discoverAll = 'HOME.DISCOVER_VIEW_ALL',
  like_her_him = 'GENERAL.LIKE_CTA',
  skip = 'DAILYRECOMMENDATIONS.SKIP',
  select = 'GENERAL.SELECT_CTA',
  selected = 'GENERAL.SELECTED_CTA',
  next = 'GENERAL.NEXT',
  callHim = 'GENERAL.CALL_HIM',
  callHer = 'GENERAL.CALL_HER',
  shortlist = 'GENERAL.SHORTLIST',
  shortlisted = 'GENERAL.SHORTLISTED',
  no = 'GENERAL.DONTSHOWCTA',
  yesShortlist = 'GENERAL.YES_SHORTLIST',
  viewPhoneNumber = 'VIEWPROFILE.VIEW_PHONE',
  paynow = 'GENERAL.PAY_NOW',
  viewlater = 'GENERAL.VIEWLATER',
}

// Icon asset name identifiers — resolved to actual images in the asset layer
export enum EButtonIcons {
  liked = 'liked-img',
  dontShow = 'dont-show-img',
  like = 'like-img',
  call = 'call-img',
  messageIcon = 'message-primary-img',
  whatsAppIcon = 'whatsapp-img',
  forwardIconLink = 'forward-icon-link',
  iconForwardGrey = 'icon-forward-grey',
  forwardIconWhite = 'forward-icon-white',
  callIconWhite = 'call-img-white',
  forwardAnimation = 'forward-animation-link',
  callIconPink = 'call-icon-pink',
  forwardIconPink = 'forward-icon-pink',
  skipIcon = 'button-skip',
  forwardBoldIconWhite = 'forward-bold-icon-white',
  whatsAppIconWhite = 'whatsapp-white-img',
  voiceMsgIcon = 'mic-grey',
  forwardIconGreen = 'forward-icon-green',
  forwardIconGrey = 'forward-icon-grey',
  callIconBlue = 'call-icon-blue',
  shortlistWhite = 'shortlist-white-revamp',
  shortlistedWhite = 'shortlisted-white-img',
  tick = 'tick-img',
  starShortListWhiteImg = 'star-shortlist-white',
  callPrimary = 'call-primary',
  paidMembership = 'paid-membership',
  whiteCrownIcon = 'white-crown-icon',
  viewlater = 'view-later',
  galleryPink = 'icon-gallery-pink',
  callPink = 'icon-phone-pink',
  rightArrowforward = 'right-arrow-forward',
}

export enum EButtonSize {
  standard = 'standard',
  standardSemibold = 'standardSemibold',
  standardBold = 'standardBold',
  link = 'link',
  linkSmall = 'linkSmall',
  large = 'large',
  callWhatsapp = 'callWhatsapp',
  medium = 'medium',
  msgBtn = 'msgBtn',
  medium30 = 'medium30',
  mediumSemibold = 'mediumSemibold',
  small = 'small',
  largeMedium = 'largeMedium',
  linkMedium = 'linkMedium',
  promotion = 'promotion',
  paddingLess = 'paddingLess',
}

export enum EIconSize {
  small = 'small',
  large = 'large',
}

export enum EActionCTAType {
  onClickLike = 'onClickLike',
  swipeLike = 'swipeLike',
  voiceMsgCta = 'voiceMsgCta',
  onClickViewLater = 'onClickViewLater',
  onClickDontShow = 'onClickDontShow',
  onClickShortlist = 'onClickShortlist',
  onClickSkip = 'onClickSkip',
  swipeViewLater = 'swipeViewLater',
}

export enum EButtonFontSize {
  regular12 = 'regular12',
  regular14 = 'regular14',
  semibold16 = 'semibold16',
  semibold12 = 'semibold12',
}
