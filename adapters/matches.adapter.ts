// Transforms a raw SwiperItem (from homeService API layer) into the MatchProfile
// UI model consumed by MatchesScreen and MatchCard.
// Pattern mirrors Love project src/core/adapters/discover.adapter.ts

import type { Adapter } from '../core/base/base.adapter'
import type { SwiperItem } from '../components/swiper-card/SwiperCard'
import type { MatchProfile } from '../types/interfaces/matches.interface'

export class MatchProfileAdapter implements Adapter<MatchProfile> {

  adapt = (item: SwiperItem): MatchProfile => {
    const profile: MatchProfile = {
      profileId:        item.profileId        ?? '',
      name:             item.name             ?? '',
      // Strip trailing "yrs"/"years" — API returns "27 Yrs", UI only needs "27".
      // Global flag: some sources double up the unit (see homeService.ts's toProfile),
      // and a non-global replace here would leave one occurrence behind uncaught.
      age:              item.age?.replace(/\s*(yrs|years)/gi, '').trim() ?? '',
      location:         item.location         ?? '',
      isPaidMember:     item.isPaidMember      ?? false,
      isIdVerified:     item.isIdVerified      ?? false,
      isPhotoAvailable: item.isPhotoAvailable  ?? false,
      isPhotoProtect:   item.isPhotoProtect    ?? false,
      likedStatus:      item.likedStatus       ?? '0',
      isNewlyJoined:    item.isNewlyJoined     ?? false,
      isNewLabel:       item.isNewLabel        ?? false,
      labelContent:     item.labelContent      ?? '',
      photos:           item.photos            ?? [],
      phoneViewed:      item.phoneViewed        ?? '0',
      dontShowStatus:   item.dontShowStatus     ?? '0',
      viewLaterStatus:  item.viewLaterStatus    ?? '0',
    }

    // Optional fields — only set when present so strictNullChecks stays happy
    if (item.height)              profile.height       = item.height
    if (item.education)           profile.education    = item.education
    if (item.occupation)          profile.occupation   = item.occupation
    if (item.income)              profile.income       = item.income
    if (item.caste)               profile.caste        = item.caste
    if (item.profileImg)          profile.profileImg   = item.profileImg
    if (item.likedViewedDateText) profile.likedDateText = item.likedViewedDateText

    this.onAdapt?.(profile)
    return profile
  }

  // Optional post-adapt hook (e.g. analytics, logging)
  onAdapt?: (result: MatchProfile) => void
}

// Singleton — reuse one instance across all card renders (no per-item allocation)
export const matchProfileAdapter = new MatchProfileAdapter()
