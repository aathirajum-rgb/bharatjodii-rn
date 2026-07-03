// UI model for a single match profile card — produced by MatchProfileAdapter
export interface MatchProfile {
  profileId:        string
  name:             string
  age:              string                       // "27" (stripped of "yrs")
  location:         string                       // "Chennai, Tamil Nadu"
  height?:          string
  education?:       string
  occupation?:      string
  income?:          string
  caste?:           string
  profileImg?:      string
  isPaidMember:     boolean
  isIdVerified:     boolean
  isPhotoAvailable: boolean                      // PHOTOSTATUS=1
  isPhotoProtect:   boolean                      // PHOTOPRIVACY=1
  likedStatus:      '0' | '1' | '2' | '3'       // 0=none 1=liked 2=shortlisted 3=declined
  isNewlyJoined:    boolean
  isNewLabel:       boolean                      // activity label row visible
  labelContent:     string                       // "Viewed on 15 Jan" / "Shortlisted on …"
  likedDateText?:   string                       // "You liked this profile on 16-Jan-2026"
}

// STATUS=599 banner items injected by the API (e.g. membership upsell)
export interface BannerItem {
  _isBanner: true
  bannerSlot: string
  uid:        string
}

// Union used in the merged FlatList data array
export type MatchListItem = MatchProfile | BannerItem
