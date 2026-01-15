import { safeStorage } from 'electron'

export function encrypt(text: string): string {
  if (!text) return ''

  if (safeStorage.isEncryptionAvailable()) {
    try {
      const buffer = safeStorage.encryptString(text)
      return buffer.toString('base64')
    } catch (error) {
      console.error('Encryption failed:', error)
      return text // Fallback (should ideally throw)
    }
  } else {
    console.warn('safeStorage is not available. Saving in plain text (INSECURE).')
    return text
  }
}

export function decrypt(encryptedBase64: string): string {
  if (!encryptedBase64) return ''

  if (safeStorage.isEncryptionAvailable()) {
    try {
      const buffer = Buffer.from(encryptedBase64, 'base64')
      const decrypted = safeStorage.decryptString(buffer)
      return decrypted
    } catch {
      // It might be plain text if saved before encryption was enabled,
      // or if it's not actually encrypted.
      // Try returning regex match or just return original if failed.
      // console.error('Decryption failed:', error);
      return encryptedBase64
    }
  } else {
    return encryptedBase64
  }
}
