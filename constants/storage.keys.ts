// All AsyncStorage keys grouped by domain.
// Old Angular constants.ts had 104+ flat exports — grouped here for clarity.
export const StorageKeys = {

  Auth: {
    TOKEN:         'ATN',          // access token
    REFRESH_TOKEN: 'RTN',          // refresh token
    USER_ID:       'NBID',         // logged-in user ID
    LOGIN_COUNT:   'LOGINCOUNT',
    WEB_LOGIN:     'WEBLOGIN',
    APP_TYPE:      'APPTYPE',
    ENTRY_TYPE:    'ENTRYTYPE',
    LANG:          'LANG',
  },

  User: {
    NAME: 'NAME',
    GENDER: 'GENDER',
    LOGIN_GENDER: 'LOGINGENDER',
    PHOTO_URL: 'PHOTOURL',
    COUNTRY_CODE: 'CCODE',
    MEMBER_CODE: 'MCODE',
    MEMBERSHIP_TYPE: 'MEMBERSHIPTYPE',
    TIME_CREATED: 'TIMECREATED',
    DATE_OF_BIRTH: 'DATEOFBIRTH',
    LAST_LOGIN: 'LASTLOGIN',
    CREATED_BY: 'CREATEDBY',
    MOTHER_TONGUE: 'MOTHERTOUNGE',
    OCCUPATION: 'OCCUPATION',
    INCOME: 'INCOME',
    BROTHERS: 'BROTHERS',
    SISTERS: 'SISTERS',
    FAMILY_PROPERTY: 'FAMILYPROPERTY',
  },

  Profile: {
    PHOTO_PRIVACY: 'PHOTOPRIVACY',
    MOBILE_PRIVACY: 'MOBILEPRIVACY',
    PHOTO_STATUS_ARRAY: 'PHOTOSTATUSARRAY',
    PROFILE_VERIFIED: 'PROFILEVERIFIED',
    HOROSCOPE_AVAILABLE: 'HOROSCOPEAVAILABLE',
    STAR: 'STAR',
    RAASI: 'RAASI',
    DOSHAM: 'DOSHAM',
    NRI_WHATSAPP: 'NRIWHATSAPP',
    IP_COUNTRY_CODE: 'IPCOUNTRYCODE',
    NON_IDV_USER_TYPE: 'NONIDVUTYPE',
  },

  Verification: {
    EKYC_STATUS: 'EKYCSTATUS',
    PHONE_VERIFIED: 'PHONEVERIFIED',
    ID_PROOF_UPDATE: 'IDPROOFUPDATE',
    TRUECALL_VERIFY: 'TRUECALLVERIFY',
    ID_VERIFY_CS_NUMBER: 'IDVERIFYCSNUMBER',
    SIGNZY_KEY: 'SIGNZYKEY',
    DEFERRED_ID_USER: 'DEFERREDIDUSER',
  },

  Payment: {
    PAYMENT_WALL: 'PAYMENTWALL',
    PAY_PROMO: 'PAYPROMO',
    RENEWAL_DAY: 'RENEWALDAY',
    PAY_RENEWAL_FLAG: 'PAYRENEWALFLAG',
    RPAY_FLAG: 'RPAYFLAG',
    UPI_FLAG: 'UPIFLAG',
    UPI_APPS: 'UPIAPPS',
    PAY_API_TYPE: 'PAYAPITYPE',
    PAY_P_FLAG: 'PAYPFLAG',
    BP_KEY: 'BPK',
    BP_DATA: 'BPD',
    RP: 'RP',
    STT: 'STT',
    FUPI: 'FUPI',
    RECHARGE_HELPLINE: 'RECHARGEHELPLINE',
  },

  Promotions: {
    FREE_TRIAL_EXTEND: 'FREETRIALEXTEND',
    FREE_TRIAL_EXTEND_DAY: 'FREETRAILEXTENDAY',
    FREE_TRIAL_VALID_DAY: 'FREETRAILVALIDDAY',
    AADHAR_PROMO: 'AADHARPROMO',
    ADD_PHOTO_PROMO: 'ADDPHOTOPROMO',
    FEMALE_FREE_CONTACT: 'FEMALEFREECONACT',
    FEMALE_FREE_PROMO: 'FEMALEFREEPROMO',
    RENEWAL_PROMO_KEY: 'RENEWALPROMOKEY',
    RENEWAL_ENABLE_KEY: 'RENEWALENABLEKEY',
    SF_PROMOTION: 'S&FPROMOTION',
    CR_FLAG: 'CRFLAG',
    // Angular: explore.component.ts's local dismissal of the Home "assist" banner
    // (persisted once the user taps its CTA/close) — ASSISTEDPROMO=='1' means don't
    // show it again this session even if PPSET's ASSISTEDFLAG is still '1'.
    ASSISTED_PROMO: 'ASSISTEDPROMO',
  },

  Faq: {
    FAQ_AVAILABLE: 'FAQAVAILABLE',
    FAQ_TYPE: 'FAQTYPE',
    FAQ_VIDEO_TOUCHPOINT: 'FAQVIDEOTOUCHPOINT',
    FAQ_MATCHES_TOUCHPOINT: 'FAQMATCHESTOUCHPOINT',
  },

  // Bottom-nav notification badges. Angular keeps the counts on its `Nbcommon`
  // singleton and the "already seen this tab" flags in localStorage under these
  // exact names (footer.component.ts:152/160/186, common.ts:827/858).
  Notify: {
    // Written when the Home tab is tapped. Angular never READS it — the Home
    // badge is driven purely by the count — but the key is kept so the two
    // apps clear the same storage on logout.
    EXPLORE_CLICK: 'EXPLORENOTIFYCLICK',
    // Written when the Activity tab is tapped, and genuinely read back: it is
    // what suppresses the Activity badge (common.ts:827/858).
    ACTIVITY_CLICK: 'NOTIFICATIONCLICK',
    // Written when Messages is opened. Angular never reads this one either —
    // the live gate is an in-memory flag that resets each launch.
    CHAT_CLICK: 'CHATNOTIFYCLICK',
    // How many "viewed you" profiles have been opened since the count was
    // issued; subtracted from the Home badge. Angular: common.ts:136.
    REDUCED_COUNT: 'REDUCEDNOTIFYCOUNT',
    // Partner IDs already counted into REDUCED_COUNT, so re-opening the same
    // profile doesn't decrement twice (viewprofile.page.ts:766-777).
    VIEWED_IDS: 'VIEWEDID',
  },

  App: {
    DYNAMIC: 'DYNAMIC',
    PP_SET_DATA: 'PPSETDATA',
    // Angular: matches.page.ts's checkBharatJodiiRenameSheet() — 'BHARATJODIIRENAMESHOWN'
    // localStorage key, same name kept here. Set BEFORE showing the sheet, not
    // after dismiss, since the matches-focus check re-fires on every return to
    // the screen.
    BHARATJODII_RENAME_SHOWN: 'BHARATJODIIRENAMESHOWN',
    // Angular: common.ts's callNative() gallery/storage permission popup
    // escalation counter — see AddPhotoScreen.tsx's openGallery().
    STG_PERMISSION_COUNT: 'STG_PERMISSION_COUNT',
    APP_VERSION: 'APPVERSION',
    ACTION_TYPE: 'ACTIONTYPE',
    SURVEY_POPUP: 'SURVEYPOPUP',
    REFERRAL_TYPE: 'REFERRALTYPE',
    REFERRAL_FLAG: 'REFERRALFLAG',
    GLASSBOX_FLAG: 'GLASSBOXFLAG',
    SVK: 'SVK',
    IN_APP_MSG_TYPE: 'INAPPMSGTYPE',
    MSG_TYPE: 'MSGTYPE',
    BLOCKER: 'BLOCKER',
    NALLOW: 'NALLOW',
    ILV: 'ILV',
    PLC: 'PLC',
    L_REMOVE: 'LRemove',
    WA_PHOTO_FLAG: 'WAPHOTOFLAG',
    WA_DEPRI: 'WADEPRI',
    DR_NEXT: 'DRNEXT',
    EPR_FLAG: 'EPRFLAG',
    ID_UPLOAD_NUM: 'IDUPLOADNUM',
    RELIGION_KEY: 'RELIGIONKEY',
    CUSTOMER_CARE: 'CUSTOMER-CARE',
    BIODATA_THEME_ID: 'THEMEID',
    TEST: 'TEST',
    // A page_id captured from an inbound deep link (App Link / custom scheme /
    // AppsFlyer OneLink) tapped before the user was authenticated — consumed
    // once by AuthContext.tsx's post-auth landing calls. See deepLinkService.ts.
    PENDING_DEEPLINK_PAGE_ID: 'PENDINGDEEPLINKPAGEID',
    // Angular common.ts's checkLimitFlowStatus() — the free-match-limit paywall's
    // frozen "total profiles visible to this free user" ceiling, cached the first
    // time it's seen so it doesn't keep growing across subsequent matches pages.
    FREE_MATCHES_TOTAL_COUNT: 'FREEMATCHESTOTALCOUNT',
  },

  // Angular: services/app-rating.service.ts — the flat localStorage keys its
  // cooldown gate reads/writes, plus the two per-action counters that
  // activeRatingPopup() increments. Same key names kept.
  Rating: {
    // Star value the server reports in the login response's RATING field
    // ('0' = never rated). '4'/'5' permanently suppresses the popup.
    RATING_VALUE: 'APPRATINGVALUE',
    // Login response's RATINGDATE — when that rating was given.
    RATING_DATE:  'APPRATINGDATE',
    // When the popup was last PRESENTED, rated or not.
    SHOWN_DATE:   'SHOWAPPRATINGDATE',
    VP_COUNT:     'RATINGCOUNTVP',
    LIKE_COUNT:   'RATINGLIKESENT',
    // Which matri ID the three local values above were counted for. Angular has
    // no equivalent: it reads/writes them through getLocalStorageUserValue(),
    // whose name promises per-user scoping but whose body is a plain
    // localStorage.getItem (common-funtions.ts:883). So its counters and
    // "last shown" stamp outlive the account that earned them, and the next
    // member to log in on that device inherits them. This key is what lets
    // appRatingService detect that and start the new member at zero.
    OWNER:        'APPRATINGOWNER',
  },

} as const
