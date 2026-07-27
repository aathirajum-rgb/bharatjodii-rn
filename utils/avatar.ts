// Gender-based default/placeholder avatar images — Angular: common.ts's
// getAvatarImg(isOppositeProfile, size) and common-funtions.ts's
// getAvatarImg(avatarType)/getAvatarImage(profile)/getOppGenderType().
//
// Two distinct use cases, confirmed against the real CDN (both verified 200,
// unlike every "default-profile.svg"/"default-avatar.svg"/"default-profile.jpg"
// guess previously used across this codebase, which all 404):
// - The logged-in user's OWN avatar placeholder (header, own-photo blocks) uses
//   their OWN gender.
// - A partner/match PROFILE CARD's placeholder (no photo uploaded) uses the
//   OPPOSITE gender — Angular shows a male silhouette on a female user's match
//   cards, and vice versa.
import { CDN_SVG } from '../constants/cdn'
import { getItem } from '../service/storageService'
import { StorageKeys } from '../constants/storage.keys'

export const FEMALE_AVATAR_URL = `${CDN_SVG}female_avatar_new.svg`
export const MALE_AVATAR_URL   = `${CDN_SVG}male_avatar_new.svg`

export async function getOwnGenderAvatarUrl(): Promise<string> {
  const gender = await getItem(StorageKeys.User.LOGIN_GENDER)
  return gender === 'F' ? FEMALE_AVATAR_URL : MALE_AVATAR_URL
}

export async function getOppGenderAvatarUrl(): Promise<string> {
  const gender = await getItem(StorageKeys.User.LOGIN_GENDER)
  return gender === 'F' ? MALE_AVATAR_URL : FEMALE_AVATAR_URL
}
