import AsyncStorage from '@react-native-async-storage/async-storage'
import * as SecureStore from 'expo-secure-store'

// ─────────────────────────────────────────────────────────────
//  SECURE KEYS
//  ATN/RTN (access/refresh token — constants/storage.keys.ts's
//  Auth.TOKEN/Auth.REFRESH_TOKEN) are the two values whose compromise means
//  full account takeover, so they're routed through the OS's encrypted
//  Keychain (iOS) / Keystore (Android) instead of AsyncStorage's plain
//  unencrypted file. Every getItem/setItem/removeItem/*Multiple call below
//  checks this set, so the ~20 existing call sites across the app (login,
//  token refresh, logout, socket auth, biodata link, ...) don't need to
//  change at all — the routing is transparent.
//  WHEN_UNLOCKED_THIS_DEVICE_ONLY additionally keeps the iOS Keychain entry
//  out of iCloud/iTunes backups (the default WHEN_UNLOCKED does migrate to a
//  new device on backup restore) — see app.config.js's expo-secure-store
//  plugin entry for the equivalent Android backup-exclusion config.
// ─────────────────────────────────────────────────────────────

const SECURE_KEYS = new Set(['ATN', 'RTN'])

const secureStoreOptions: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
}

// ─────────────────────────────────────────────────────────────
//  SINGLE VALUE
// ─────────────────────────────────────────────────────────────

/** Save a plain string value */
export async function setItem(key: string, value: string): Promise<void> {
  if (SECURE_KEYS.has(key)) {
    await SecureStore.setItemAsync(key, value, secureStoreOptions)
    return
  }
  await AsyncStorage.setItem(key, value)
}

/** Get a plain string value — returns null if not found */
export async function getItem(key: string): Promise<string | null> {
  if (SECURE_KEYS.has(key)) return SecureStore.getItemAsync(key, secureStoreOptions)
  return AsyncStorage.getItem(key)
}

/** Get value or return a default if key is missing */
export async function getItemOrDefault<T>(key: string, defaultValue: T): Promise<string | T> {
  const value = await getItem(key)
  return value ?? defaultValue
}

/** Remove a single key */
export async function removeItem(key: string): Promise<void> {
  if (SECURE_KEYS.has(key)) {
    await SecureStore.deleteItemAsync(key, secureStoreOptions)
    return
  }
  await AsyncStorage.removeItem(key)
}

/** Check if a key exists */
export async function hasKey(key: string): Promise<boolean> {
  const value = await getItem(key)
  return value !== null
}

// ─────────────────────────────────────────────────────────────
//  JSON VALUE
// ─────────────────────────────────────────────────────────────

/** Save any object/array as JSON string */
export async function setJson<T>(key: string, value: T): Promise<void> {
  await setItem(key, JSON.stringify(value))
}

/** Get and parse a JSON value — returns null if not found or parse fails */
export async function getJson<T>(key: string): Promise<T | null> {
  const raw = await getItem(key)
  if (raw === null) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

// ─────────────────────────────────────────────────────────────
//  MULTIPLE VALUES  (more efficient than calling one-by-one)
// ─────────────────────────────────────────────────────────────

/** Save multiple key-value pairs in parallel */
export async function setMultiple(pairs: Record<string, string>): Promise<void> {
  await Promise.all(Object.entries(pairs).map(([key, value]) => setItem(key, value)))
}

/** Get multiple keys in parallel — returns a key→value map */
export async function getMultiple(keys: string[]): Promise<Record<string, string | null>> {
  const values = await Promise.all(keys.map(key => getItem(key)))
  return Object.fromEntries(keys.map((key, i) => [key, values[i]]))
}

/** Remove multiple keys in parallel */
export async function removeMultiple(keys: string[]): Promise<void> {
  await Promise.all(keys.map(key => removeItem(key)))
}

// ─────────────────────────────────────────────────────────────
//  CLEAR
// ─────────────────────────────────────────────────────────────

/** Clear all storage — use with caution (logout flow only) */
export async function clearAll(): Promise<void> {
  await Promise.all([
    AsyncStorage.clear(),
    ...Array.from(SECURE_KEYS).map(key => removeItem(key)),
  ])
}
