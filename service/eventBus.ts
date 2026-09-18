// Local pub/sub for cross-screen events — port of Angular's IDVerifyStatusObserver
// (a Subject on the shared `common` service, common.ts:59,83). Built on React
// Native's built-in DeviceEventEmitter, so no new dependency is needed.
import { DeviceEventEmitter } from 'react-native'

const ID_VERIFIED_EVENT = 'jodii:idVerified'

// Angular: fired from the verify-id flow's completion points (verify-id.page.ts,
// congratulation.page.ts, selfie-verification.component.ts) once the user's own ID
// verification succeeds. No screen in this port calls this yet — there is no
// verify-id screen here yet — but Matches already subscribes to it (see
// subscribeIdVerified), so wiring the emit side up later is a one-line change.
export function emitIdVerified(): void {
  DeviceEventEmitter.emit(ID_VERIFIED_EVENT)
}

export function subscribeIdVerified(callback: () => void): () => void {
  const subscription = DeviceEventEmitter.addListener(ID_VERIFIED_EVENT, callback)
  return () => subscription.remove()
}

// ─── ViewProfile prev/next paging ─────────────────────────────────────────────
// Angular: common.ts's matriIdDBset() tags the profile at index 4, 8 and 17 of
// every 20-item page with VPNEXTHIT='1'; viewprofile.page.ts:1073 sees that flag
// while stepping onto it and fires emitVPNextProfileList({module, start}), which
// the LIST page answers by fetching the next page and rewriting the shared
// prev/next cache. That is why Angular's Next button never disappears at #20 —
// the list has already grown by the time the member gets there.
//
// RN equivalent: ViewProfileScreen has no list-fetching logic of its own (it is
// handed an id array as a nav param), and the list screen that pushed it stays
// mounted underneath, still owning the cursor, the active filters and the
// paywall limits. So it asks, and the list screen answers.

const VP_NEED_MORE_EVENT = 'jodii:vpNeedMoreProfiles'
const VP_LIST_UPDATED_EVENT = 'jodii:vpProfileListUpdated'

/** ViewProfile -> list screen: "I'm near the end of the ids you gave me." */
export function emitVpNeedMoreProfiles(): void {
  DeviceEventEmitter.emit(VP_NEED_MORE_EVENT)
}

export function subscribeVpNeedMoreProfiles(callback: () => void): () => void {
  const subscription = DeviceEventEmitter.addListener(VP_NEED_MORE_EVENT, callback)
  return () => subscription.remove()
}

/** List screen -> ViewProfile: the full id list, after any page is appended. */
export function emitVpProfileListUpdated(profileIds: string[]): void {
  DeviceEventEmitter.emit(VP_LIST_UPDATED_EVENT, profileIds)
}

export function subscribeVpProfileListUpdated(callback: (ids: string[]) => void): () => void {
  const subscription = DeviceEventEmitter.addListener(VP_LIST_UPDATED_EVENT, callback)
  return () => subscription.remove()
}
