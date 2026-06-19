// i18n keys for home section headers
export enum ESectionTitle {
  newlyJoined = 'HOME.NEWLY_JOINED_HEADER',
  dailyRecommendation = 'DAILYRECOMMENDATIONS.DAILY_RECOMMENDATIONS',
  exploreMatches = 'HOME.EXPLORE_MATCHES_TXT',
  exploreMatchesCta = 'HOME.DISCOVER_VIEW_ALL',
  successStory = 'HOME.HAPPILY_MARRIED_HEAD',
  allMatches = 'HOME.ALLMATCH_HEADER',
  selfHelpVideo = 'HOME.SELF_VIDEO_HEADER',
  faqSection = 'HOME.FAQ_CTA',
  profilesYouLiked = 'HOME.LIKED_BY_YOU_HEADER',
  profilesWhoLikedYou = 'HOME.WHO_LIKED_YOU_HEADER',
  profilesWhoViewedMyNumber = 'HOME.VIEWED_YOUR_NUMBER_HEADER',
  profilesWhoViewedYou = 'HOME.WHO_VIEWED_YOU_HEADER',
  profileWithPhotos = 'HOME.PROFILEWITHPHOTOS',
  viewedByMe = 'GENERAL.VIEWEDBYME',
  viewLater = 'HOME.VIEWLATER_TXT',
  likedProfile = 'GENERAL.ICON_3',
}

// API section type identifiers — used in API requests and section routing
export enum ESectionType {
  newlyJoined = 'newmatches',
  dailyRecommendation = 'dailyrecommendations',
  exploreMatches = 'exploreMatches',
  successStory = 'successStory',
  allMatches = 'matches',
  selfHelpVideo = 'selfHelpVideo',
  faqSection = 'faqSection',
  profilesYouLiked = 'likesent',
  profilesWhoLikedYou = 'likedyou',
  profilesWhoViewedMyNumber = 'whoviewednumber',
  profilesWhoViewedYou = 'viewedyou',
  viewedByMe = 'viewedbyme',
  similarProfiles = 'similarprofiles',
  profileWithPhotos = 'profileWithPhotos',
  viewLater = 'viewinglater',
  likedProfile = 'likedprofile',
}

// Card layout variant — determines which card component renders per section
export enum ECardType {
  standard = '1',
  active = '2',
  viewed = '3',
  successStory = '4',
  endCard = '5',
  withPhotos = '6',
  viewLater = '7',
  liked = '8',
}
