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
