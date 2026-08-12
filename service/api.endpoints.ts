// All API endpoints organized by domain.
// Migrated from httpservice constructor — was one flat object of 80+ mixed URLs.
// Usage: Endpoints.auth.login, Endpoints.listing.matches etc.

import { EnvConfig } from '../constants/env.config'

const api     = EnvConfig.api
const pay     = EnvConfig.payment
const payNg   = EnvConfig.paymentNg
const img     = EnvConfig.image

export const Endpoints = {

  auth: {
    login:               `${api}login/loginapi/v1`,
    verifyOtp:           `${api}login/verifyotp/v1`,
    resendOtp:           `${api}login/resendotp/v1`,
    logout:              `${api}login/logout/v1`,
    autoLogin:           `${api}login/autologin/v1`,
    loginTrueCall:       `${api}login/logintruecall/v1`,
    loginTruecaller:     `${api}login/logintruecall/v1`, // alias — consistent camelCase
    switchLanguage:      `${api}login/switchlanguage/v1`,
    deleteProfile:       `${api}login/deleteprofile/v1`,
    missedCallVerify:    `${api}login/missedcallverified/v1`,
    impUpdate:           `${api}login/IMPUpdate/v1`,
    payWallUpdate:       `${api}login/paywallupd/v1`,
    autoRenewalUpdate:   `${api}login/autorenewupd/v1`,
  },

  registration: {
    initialFetch:        `${api}registrationform/v1`,
    listData:            `${api}registrationform/v1`,            // same endpoint, TYPE param varies
    partial:             `${api}registration/partialreg/v1`,
    partialUpdate:       `${api}registration/partialreg/v1`,     // alias
    insert:              `${api}registration/insert/v1`,
    update:              `${api}registration/registrationupdate/v1`,
    intermediateUpdate:  `${api}registration/intermediatepage/v1`,
    updateFamily:        `${api}registration/familyinfo/v1`,
    updateReligious:     `${api}registration/zodiacinfo/v1`,
    generateHoro:        `${api}registration/gethoroscope/v1`,
    updateHoroInfo:      `${api}registration/updatehoroinfo/v1`,
    verifyIdProof:       `${api}registration/verifyidproof/v1`,
    editMobileNo:        `${api}registration/editnum/v1`,
    getHoroState:        `${api}registration/gethorostate/v1`,
    getHoroCity:         `${api}registration/gethorocity/v1`,
    signzyGenerateOtp:   `${api}registration/signzgenerateotp/v1`,
    signzyVerifyOtp:     `${api}registration/signzotpverify/v1`,
    successStory:        `${api}registration/successstory/v1`,
    monthlyIncome:       `${api}registrationform/v1`,
  },

  profile: {
    view:                `${api}view/profile/v1`,
    viewProfile:         `${api}view/profile/v1`,                // alias — explicit name
    similar:             `${api}view/similarprofile/v1`,
    viewedTrack:         `${api}view/viewedtrack/v1`,
    starMatch:           `${api}view/starmatch/v1`,
    getPreference:       `${api}editprofile/getpreference/v1`,
    managePhoto:         `${api}editprofile/managepicture/v1`,
    setMainPhoto:        `${api}editprofile/setmainpicture/v1`,
    privacySetting:      `${api}editprofile/privacysetting/v1`,
    deletePhoto:         `${api}editprofile/deletepicture/v1`,
    editInfo:            `${api}editprofile/editmemberinfo/v1`,
    updateInfo:          `${api}editprofile/updatememberinfo/v1`,
    aiValidation:        `${api}editprofile/aiprfvalidation/v1`,
    viewHoro:            `${api}editprofile/viewhoroscope/v1`,
    paymentFailure:      `${api}editprofile/paymentfailure/v1`,
    reportProfileForm:   `${api}editprofile/reportprofileform/v1`,
    bioData:             `${api}biodata/v1`,
  },

  search: {
    byId:                `${api}search/searchbyid/v1`,
    form:                `${api}search/searchform/v1`,
  },

  listing: {
    matches:             `${api}listing/matches/v1`,
    likedYou:            `${api}listing/likedyou/v1`,
    likedByMe:           `${api}listing/likedbyme/v1`,
    removedByMe:         `${api}listing/removedbyme/v1`,
    viewedByMe:          `${api}listing/viewedbyme/v1`,
    viewedYou:           `${api}listing/viewedyou/v1`,
    whoseViewedNumber:   `${api}listing/whoseviewednumber/v1`,
    whomSharedNumber:    `${api}listing/whomsharednumber/v1`,
    whoSharedNumber:     `${api}listing/whosharednumber/v1`,
    whoViewedNumber:     `${api}listing/whoviewednumber/v1`,
    requestedMoreDet:    `${api}listing/requestedmoredet/v1`,
    addYourPhotoList:    `${api}listing/photoreqmeminfo/v1`,
    addYourHoroList:     `${api}listing/hororeqmeminfo/v1`,
    addTheirPhotoList:   `${api}listing/photoaddedbasedonreq/v1`,
    addTheirHoroList:    `${api}listing/horoaddedbasedonreq/v1`,
    prefProfCount:       `${api}listing/prefprofcount/v1`,
    preferenceProfiles:  `${api}listing/preferenceprofiles/v1`,
    extendedMatches:     `${api}listing/extendedmatches/v1`,
    dailyRecommendations:`${api}listing/dailyrecommendations/v1`,
    starMatches:         `${api}listing/starmatches/v1`,
    nearbyMatches:       `${api}listing/nearbymatches/v1`,
    explore:             `${api}listing/explore/v1`,
    exploreCount:        `${api}listing/explorecount/v1`,
    photoHorosReq:       `${api}listing/photohorosreq/v1`,
    blockedByMe:         `${api}listing/blockedbyme/v1`,
    bulkLike:            `${api}listing/bulklike/v1`,
    viewLater:           `${api}listing/viewlater/v1`,
  },

  communication: {
    phoneViewed:         `${api}communication/phoneviewed/v1`,
    viewContact:         `${api}communication/phoneviewed/v1`,   // alias — intent-based name
    like:                `${api}communication/like/v1`,
    dislike:             `${api}communication/dislike/v1`,
    dontShow:            `${api}communication/dontshow/v1`,
    skipProfile:         `${api}communication/dontshow/v1`,      // alias
    enlargePhoto:        `${api}communication/enlargephoto/v1`,
    requestPhoto:        `${api}communication/request/photo/v1`,
    reportProfile:       `${api}communication/report/profile/v1`,
    requestHoro:         `${api}communication/request/horoscope/v1`,
    notificationCount:   `${api}communication/newcount/v1`,
    idProofData:         `${api}communication/idproofdata/v1`,
    appRatingUpdate:     `${api}communication/rating/v1`,
    faqVideo:            `${api}communication/faq/v1`,
    faqHelp:             `${api}communication/faqhelp/v1`,
    blockProfile:        `${api}communication/block/v1`,
    unblock:             `${api}communication/unblock/v1`,
    chatCount:           `${api}communication/chat/v1`,
    viewLater:           `${api}communication/viewlater/v1`,
    sendBulkLike:        `${api}communication/bulklike/v1`,
  },

  payment: {
    recharge:             `${pay}payment/nbrecharge/v1`,
    customer:            `${pay}payment/nbcustomer/v1`,
    applicationPay:      `${pay}payment/nbapplicationpay`,
    checkout:            `${payNg}payment/nbpaymentcheckout`,
    menu:                `${pay}payment/nbmenu/v1`,
    nbMenu:              `${pay}payment/nbmenu/v1`,              // alias
    freeTrial:           `${pay}payment/nbfreetrial/v1`,
    doorstepCollection:  `${pay}payment/nbdoorstepcollection/v1`,
    contacts:            `${pay}payment/nbcontacts/v1`,
    bannerRechargeValent:`${api}payment/nbpaybannerrechargevalent/v1`,
    bannerRecharge:      `${api}payment/nbpaybannerrecharge/v1`,
    banner:              `${api}payment/nbpaybanner/v1`,
    payBanner:           `${api}payment/nbpaybanner/v1`,         // alias
    track:               `${api}payment/nbtrack/v1`,
    payAtBankList:       `${pay}payment/nbpayatbanklist/v1`,
    netBankingList:      `${pay}payment/nbnetbankinglist/v1`,
    stateList:           `${pay}payment/nbstatelist/v1`,
    cityList:            `${pay}payment/nbcitylist/v1`,
    storeList:           `${pay}payment/nbbmaddresslist/v1`,
    payAtStore:          `${pay}payment/nbpayatretailstore/v1`,
    payWall:             `${api}payment/nbpaywall/v1`,
    checkoutQR:          `${api}payment/CheckoutQR/v1`,
    promotion:           `${api}payment/nbpromotion/v1`,
    nbPromotion:         `${api}payment/nbpromotion/v1`,         // alias
    offerCheck:          `${api}payment/payoffercheck/v1`,
    payOfferCheck:       `${api}payment/payoffercheck/v1`,       // alias
    paymentFailed:       `${api}notify/paymentfailed/v1`,        // maps to notify domain
    paywallUpdate:       `${api}login/paywallupd/v1`,            // maps to auth domain
    phonePayCheckout:    `${api}payment/nbphonepaycheckout/v1`,
    pendingPayment:      `${pay}payment/nbpaymentprocess`,
    failedDetails:       `${api}payment/nbpaymentfaileddet/v1`,
    upiAutoPay:          `${payNg}payment/nbupiautopay`,
    upiPayLink:          `${api}payment/nbupipaylink/v1`,
    autopayRefund:       `${api}payment/autopayrefund/v1`,
  },

  notify: {
    femaleFree:          `${api}notify/femalefree/v1`,
    paymentFailed:       `${api}notify/paymentfailed/v1`,
    registerToken:       `${api}notify/registertoken/v1`,
  },

  aadhaar: {
    getCaptcha:          `${api}aadharapi/getcaptcha/v1`,
    getOtp:              `${api}aadharapi/getadharotp/v1`,
    getXml:              `${api}aadharapi/getadharxml/v1`,
  },

  support: {
    surveyPopup:         `${api}support/surveypopup/v1`,
    surveySubmit:        `${api}support/surveysubmit/v1`,
    faq:                 `${api}faq/support`,
  },

  // These hit the image CDN directly (PHP scripts for file uploads)
  media: {
    reportProfile:       `${img}nbphoto/reportprofile.php`,
    deleteProfile:       `${img}nbphoto/deleteprofile.php`,
    chatAudioUpdate:     `${img}nbphoto/chataudioupd.php`,
    addTrustBadge:       `${img}nbphoto/addtrustbadge.php`,
    faqPayment:          `${img}nbphoto/faqpayment.php`,
    addProfilePic:       `${img}nbphoto/addprofilepic.php`,
    uploadHoroscope:     `${img}nbphoto/uploadhoroscope.php`,
  },

} as const

// Media endpoints don't support ID injection in URL
export const MEDIA_ENDPOINTS = Object.values(Endpoints.media) as string[]

// These endpoints use APPTYPE+LANG but no ATN/RTN (login/OTP flows)
export const AUTH_ONLY_ENDPOINTS = [
  Endpoints.auth.verifyOtp,
  Endpoints.auth.resendOtp,
  Endpoints.auth.loginTrueCall,
  Endpoints.auth.login,
  Endpoints.auth.autoLogin,   // autologin re-establishes session; server uses ID not ATN/RTN
] as string[]

// These endpoints add APPTYPE only — LANG is already in the params string, no ATN/RTN needed
// Matches Angular httpservice: ["initialfetch","registrationupdate"] → params += `&APPTYPE=${APPTYPE}`
// Angular "registrationupdate" module maps to registration/insert/v1 (same as initialfetch pattern)
export const APPTYPE_ONLY_ENDPOINTS = [
  Endpoints.registration.initialFetch,
  Endpoints.registration.insert,
] as string[]
