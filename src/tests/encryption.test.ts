import { EncryptionService } from '../utils/encryption'

describe('EncryptionService', () => {
  let encryptionService: EncryptionService

  beforeEach(() => {
    encryptionService = new EncryptionService('test-key-for-encryption-testing', '1')
  })

  describe('encrypt and decrypt', () => {
    it('should encrypt and decrypt a string correctly', () => {
      const plaintext = 'sensitive-api-key-12345'
      
      const encrypted = encryptionService.encrypt(plaintext)
      expect(encrypted.encrypted_data).toBeDefined()
      expect(encrypted.iv).toBeDefined()
      expect(encrypted.algorithm).toBe('aes-256-gcm')
      
      const decrypted = encryptionService.decrypt(encrypted)
      expect(decrypted).toBe(plaintext)
    })

    it('should encrypt with expiration date', () => {
      const plaintext = 'expiring-secret'
      const expiresAt = new Date(Date.now() + 1000 * 60 * 60) // 1 hour from now
      
      const encrypted = encryptionService.encrypt(plaintext, expiresAt)
      expect(encrypted.expires_at).toBe(expiresAt.toISOString())
      
      const decrypted = encryptionService.decrypt(encrypted)
      expect(decrypted).toBe(plaintext)
    })

    it('should throw error when decrypting expired data', () => {
      const plaintext = 'expired-secret'
      const expiresAt = new Date(Date.now() - 1000) // 1 second ago
      
      const encrypted = encryptionService.encrypt(plaintext, expiresAt)
      
      expect(() => {
        encryptionService.decrypt(encrypted)
      }).toThrow('Encrypted data has expired')
    })

    it('should handle empty strings', () => {
      const plaintext = ''
      
      const encrypted = encryptionService.encrypt(plaintext)
      const decrypted = encryptionService.decrypt(encrypted)
      
      expect(decrypted).toBe('')
    })

    it('should handle special characters and unicode', () => {
      const plaintext = '🔐 Special chars: !@#$%^&*()_+ 中文 español'
      
      const encrypted = encryptionService.encrypt(plaintext)
      const decrypted = encryptionService.decrypt(encrypted)
      
      expect(decrypted).toBe(plaintext)
    })
  })

  describe('hash', () => {
    it('should generate consistent hashes', () => {
      const data = 'test-data-to-hash'
      
      const hash1 = encryptionService.hash(data)
      const hash2 = encryptionService.hash(data)
      
      expect(hash1).toBe(hash2)
      expect(hash1).toHaveLength(64) // SHA-256 hex = 64 chars
    })

    it('should generate different hashes for different data', () => {
      const data1 = 'first-data'
      const data2 = 'second-data'
      
      const hash1 = encryptionService.hash(data1)
      const hash2 = encryptionService.hash(data2)
      
      expect(hash1).not.toBe(hash2)
    })
  })

  describe('encryptObject and decryptObject', () => {
    it('should encrypt and decrypt object fields', () => {
      const obj = {
        public_field: 'not-encrypted',
        secret_field: 'should-be-encrypted',
        another_secret: 'also-encrypted',
        number_field: 42
      }

      const encrypted = encryptionService.encryptObject(
        obj, 
        ['secret_field', 'another_secret']
      )

      expect(encrypted.public_field).toBe('not-encrypted')
      expect(encrypted.number_field).toBe(42)
      expect(encrypted.secret_field).not.toBe('should-be-encrypted')
      expect(encrypted.another_secret).not.toBe('also-encrypted')
      expect(encrypted._encrypted_fields).toEqual(['secret_field', 'another_secret'])

      const decrypted = encryptionService.decryptObject(encrypted)

      expect(decrypted.public_field).toBe('not-encrypted')
      expect(decrypted.secret_field).toBe('should-be-encrypted')
      expect(decrypted.another_secret).toBe('also-encrypted')
      expect(decrypted.number_field).toBe(42)
      expect(decrypted._encrypted_fields).toBeUndefined()
    })

    it('should handle objects with JSON values', () => {
      const obj = {
        config: {
          api_key: 'secret-key',
          endpoint: 'https://api.example.com'
        }
      }

      const encrypted = encryptionService.encryptObject(obj, ['config'])
      const decrypted = encryptionService.decryptObject(encrypted)

      expect(decrypted.config).toEqual(obj.config)
    })
  })

  describe('verify', () => {
    it('should verify valid encrypted data', () => {
      const plaintext = 'test-data'
      const encrypted = encryptionService.encrypt(plaintext)
      
      const isValid = encryptionService.verify(encrypted)
      expect(isValid).toBe(true)
    })

    it('should detect corrupted encrypted data', () => {
      const plaintext = 'test-data'
      const encrypted = encryptionService.encrypt(plaintext)
      
      // Corrupt the data
      encrypted.encrypted_data = encrypted.encrypted_data.slice(0, -2) + 'xx'
      
      const isValid = encryptionService.verify(encrypted)
      expect(isValid).toBe(false)
    })
  })

  describe('generateKey', () => {
    it('should generate keys of correct length', () => {
      const key16 = EncryptionService.generateKey(16)
      const key32 = EncryptionService.generateKey(32)
      
      expect(key16).toHaveLength(32) // 16 bytes = 32 hex chars
      expect(key32).toHaveLength(64) // 32 bytes = 64 hex chars
    })

    it('should generate different keys each time', () => {
      const key1 = EncryptionService.generateKey()
      const key2 = EncryptionService.generateKey()
      
      expect(key1).not.toBe(key2)
    })
  })
})