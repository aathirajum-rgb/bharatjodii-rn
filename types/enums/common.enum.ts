// Analytics event/module name identifiers
export enum EQueryModuleName {
  dontshow = 'dontshow',
  phoneviewed = 'phoneviewed',
  like = 'like',
  dislike = 'dislike',
  call = 'call',
  whatsapp = 'whatsapp',
  requestphoto = 'requestphoto',
  communication = 'communication',
  jodimessages = 'jodimessages',
  viewprofile = 'viewprofile',
  home = 'home',
  eating = 'EATING',
  property = 'PROPERTIES',
  physicalStatus = 'PHYSICALSTATUS',
  getmemberPreference = 'getmemberPreference',
  dailyRecommendation = 'dailyrecommendations',
  skip = 'skip',
  viewedtrack = 'viewedtrack',
  viewedtrackDR = 'viewedtrackDR',
  select = 'select',
  selected = 'selected',
  whatsappNudge = 'whatsappNudge',
  next = 'next',
  voiceMsg = 'voiceMsg',
  login = 'login',
  verifyotp = 'verifyotp',
  resendotp = 'resendotp',
  registration = 'registration',
  onboarding = 'onboarding',
  reportprofile = 'reportprofile',
  removeprofile = 'removeprofile',
  activity = 'activity',
  tick = 'tick',
  idverify = 'idVerify',
  payment = 'payment',
  paynow = 'paynow',
  viewlater = 'viewlater',
}

// i18n keys for end-of-list card text
export enum EEndCardText {
  contactNow = 'GENERAL.NO_MATCHES',
  noMatches = 'GENERAL.NO_MATCHES',
  modifyPreference = 'GENERAL.MODIFY_PREFERENCE',
  ctaModifyPreference = 'GENERAL.CTA_MODIFY_PREFERENCE',
  continueSee = 'MATCHES.CONTINUE_TITLE',
  viewMoreNote = 'MATCHES.CONTINUE_CONT',
  viewMore = 'HOME.VIEW_MORE',
  matches = 'GENERAL.ACTIVITY_CTA',
}

export enum ELoaderType {
  spinner = 'spinner',
  match = 'match',
  dashboardSkeleton = 'dashboardSkeleton',
}

// P = paid member, F = free member
export enum EEntryType {
  paidUser = 'P',
  freeUser = 'F',
}

export enum EBreatherType {
  pcs = 'PCS',
  payment = 'PAYMENT',
  assist = 'ASSIST',
  idverify = 'IDVERIFY',
  freeTrial = 'FREETRIAL',
  addPhoto = 'ADDPHOTO',
  addPhotoPaid = 'ADDPHOTOPAID',
}
