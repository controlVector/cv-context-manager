import crypto from 'crypto'
import { EncryptedValue } from '../types'

export class EncryptionService {
  private algorithm: string = 'aes-256-gcm'
  private key: Buffer
  private keyVersion: string

  constructor(encryptionKey: string, keyVersion: string = '1') {
    // Ensure the key is exactly 32 bytes for AES-256
    this.key = crypto.scryptSync(encryptionKey, 'controlvector-salt', 32)
    this.keyVersion = keyVersion
  }

  /**
   * Encrypt sensitive data
   */
  encrypt(plaintext: string, expiresAt?: Date): EncryptedValue {
    const iv = crypto.randomBytes(12) // 96-bit IV for GCM
    const cipher = crypto.createCipheriv(this.algorithm, this.key, iv) as crypto.CipherGCM
    
    let encrypted = cipher.update(plaintext, 'utf8', 'hex')
    encrypted += cipher.final('hex')

    const authTag = cipher.getAuthTag()

    const result: EncryptedValue = {
      encrypted_data: encrypted,
      algorithm: this.algorithm,
      iv: iv.toString('hex'),
      created_at: new Date().toISOString(),
      auth_tag: authTag.toString('hex'),
      key_version: this.keyVersion
    }

    if (expiresAt) {
      result.expires_at = expiresAt.toISOString()
    }

    return result
  }

  /**
   * Decrypt sensitive data
   */
  decrypt(encryptedValue: EncryptedValue): string {
    // Check if expired
    if (encryptedValue.expires_at && new Date(encryptedValue.expires_at) < new Date()) {
      throw new Error('Encrypted data has expired')
    }

    const iv = Buffer.from(encryptedValue.iv, 'hex')
    const authTag = encryptedValue.auth_tag ? Buffer.from(encryptedValue.auth_tag, 'hex') : Buffer.alloc(0)
    
    const decipher = crypto.createDecipheriv(encryptedValue.algorithm, this.key, iv) as crypto.DecipherGCM
    
    if (authTag.length > 0) {
      decipher.setAuthTag(authTag)
    }

    let decrypted = decipher.update(encryptedValue.encrypted_data, 'hex', 'utf8')
    decrypted += decipher.final('utf8')

    return decrypted
  }

  /**
   * Hash data for audit purposes (non-reversible)
   */
  hash(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex')
  }

  /**
   * Generate secure random key
   */
  static generateKey(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex')
  }

  /**
   * Rotate encryption key (for future key rotation feature)
   */
  rotateKey(newKey: string, newVersion: string): EncryptionService {
    return new EncryptionService(newKey, newVersion)
  }

  /**
   * Verify encrypted data integrity
   */
  verify(encryptedValue: EncryptedValue): boolean {
    try {
      this.decrypt(encryptedValue)
      return true
    } catch (error) {
      return false
    }
  }

  /**
   * Encrypt object with multiple fields
   */
  encryptObject<T extends Record<string, any>>(
    obj: T, 
    fieldsToEncrypt: (keyof T)[],
    expiresAt?: Date
  ): T & { _encrypted_fields: string[] } {
    const result = { ...obj, _encrypted_fields: [] as string[] }
    
    for (const field of fieldsToEncrypt) {
      if (obj[field] !== undefined && obj[field] !== null) {
        const plaintext = typeof obj[field] === 'string' ? obj[field] : JSON.stringify(obj[field])
        ;(result as any)[field] = this.encrypt(plaintext, expiresAt)
        result._encrypted_fields.push(field as string)
      }
    }
    
    return result
  }

  /**
   * Decrypt object with multiple fields
   */
  decryptObject<T extends Record<string, any>>(
    obj: T & { _encrypted_fields?: string[] }
  ): T {
    const result = { ...obj } as any
    const encryptedFields = obj._encrypted_fields || []
    
    for (const field of encryptedFields) {
      if (result[field] && typeof result[field] === 'object' && 'encrypted_data' in result[field]) {
        try {
          const decrypted = this.decrypt(result[field] as EncryptedValue)
          // Try to parse as JSON, fallback to string
          try {
            result[field] = JSON.parse(decrypted)
          } catch {
            result[field] = decrypted
          }
        } catch (error) {
          console.error(`Failed to decrypt field ${field}:`, error)
          // Keep encrypted value if decryption fails
        }
      }
    }
    
    // Remove metadata
    delete result._encrypted_fields
    
    return result as T
  }
}

// Utility functions
export function generateSecurePassword(length: number = 32): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=[]{}|;:,.<>?'
  let result = ''
  const randomArray = crypto.randomBytes(length)
  
  for (let i = 0; i < length; i++) {
    result += chars[randomArray[i]! % chars.length]
  }
  
  return result
}

export function isExpired(expiresAt?: string): boolean {
  if (!expiresAt) return false
  return new Date(expiresAt) < new Date()
}

export function timeUntilExpiry(expiresAt?: string): number | null {
  if (!expiresAt) return null
  const expiryDate = new Date(expiresAt)
  const now = new Date()
  return expiryDate.getTime() - now.getTime()
}

// Add auth_tag and key_version to EncryptedValue interface
declare module '../types' {
  interface EncryptedValue {
    auth_tag?: string
    key_version?: string
  }
}