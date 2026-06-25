import AsyncStorage from '@react-native-async-storage/async-storage'

// ─────────────────────────────────────────────────────────────
//  SINGLE VALUE
// ─────────────────────────────────────────────────────────────

/** Save a plain string value */
export async function setItem(key: string, value: string): Promise<void> {
  await AsyncStorage.setItem(key, value)
}

/** Get a plain string value — returns null if not found */
export async function getItem(key: string): Promise<string | null> {
  return AsyncStorage.getItem(key)
}

/** Get value or return a default if key is missing */
export async function getItemOrDefault<T>(key: string, defaultValue: T): Promise<string | T> {
  const value = await AsyncStorage.getItem(key)
  return value ?? defaultValue
}

/** Remove a single key */
export async function removeItem(key: string): Promise<void> {
  await AsyncStorage.removeItem(key)
}

/** Check if a key exists */
export async function hasKey(key: string): Promise<boolean> {
  const value = await AsyncStorage.getItem(key)
  return value !== null
}

// ─────────────────────────────────────────────────────────────
//  JSON VALUE
// ─────────────────────────────────────────────────────────────

/** Save any object/array as JSON string */
export async function setJson<T>(key: string, value: T): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify(value))
}

/** Get and parse a JSON value — returns null if not found or parse fails */
export async function getJson<T>(key: string): Promise<T | null> {
  const raw = await AsyncStorage.getItem(key)
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
  await Promise.all(Object.entries(pairs).map(([key, value]) => AsyncStorage.setItem(key, value)))
}

/** Get multiple keys in parallel — returns a key→value map */
export async function getMultiple(keys: string[]): Promise<Record<string, string | null>> {
  const values = await Promise.all(keys.map(key => AsyncStorage.getItem(key)))
  return Object.fromEntries(keys.map((key, i) => [key, values[i]]))
}

/** Remove multiple keys in parallel */
export async function removeMultiple(keys: string[]): Promise<void> {
  await Promise.all(keys.map(key => AsyncStorage.removeItem(key)))
}

// ─────────────────────────────────────────────────────────────
//  CLEAR
// ─────────────────────────────────────────────────────────────

/** Clear all storage — use with caution (logout flow only) */
export async function clearAll(): Promise<void> {
  await AsyncStorage.clear()
}
