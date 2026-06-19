// AES-256-CBC decrypt used by payment service to unpack Razorpay/PayU keys.
// The Angular encrypt() was never implemented (always returned ''), so only decrypt is needed.
// Package: crypto-js  →  npm i crypto-js @types/crypto-js
import CryptoJS from 'crypto-js'

const AES_KEY = CryptoJS.enc.Utf8.parse('S8098sathrak351914durai@jodiicom')

export function decrypt(payload: string): string {
  try {
    const parts = payload.split(':')
    if (parts.length !== 2) return ''
    const [ivHex, encryptedHex] = parts
    const iv        = CryptoJS.enc.Hex.parse(ivHex)
    const encrypted = CryptoJS.enc.Hex.parse(encryptedHex)
    const base64    = CryptoJS.enc.Base64.stringify(encrypted)
    const decrypted = CryptoJS.AES.decrypt(base64, AES_KEY, {
      iv,
      mode:    CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7,
    })
    return decrypted.toString(CryptoJS.enc.Utf8)
  } catch {
    return ''
  }
}
