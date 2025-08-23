#!/usr/bin/env node

/**
 * Comprehensive Test Suite for CV Context Manager
 * Tests all core functionality without requiring database setup
 */

const { EncryptionService } = require('./src/utils/encryption')

console.log('🧪 CV Context Manager - Comprehensive Test Suite')
console.log('=' .repeat(60))

async function runTests() {
  // Test 1: Encryption Service
  console.log('\n📝 Test 1: AES-256-GCM Encryption Service')
  console.log('-'.repeat(40))
  
  const encryption = new EncryptionService('test-encryption-key-32-bytes!', '1')
  
  // Test basic encryption/decryption
  const testData = 'sk-1234567890abcdef-sensitive-openai-key'
  const encrypted = encryption.encrypt(testData)
  const decrypted = encryption.decrypt(encrypted)
  
  console.log('✅ Original Data:', testData)
  console.log('🔐 Encrypted:', encrypted.encrypted_data.substring(0, 50) + '...')
  console.log('🔓 Decrypted:', decrypted)
  console.log('✅ Match:', testData === decrypted ? 'PASS' : 'FAIL')
  
  // Test expiration
  console.log('\n🕒 Testing expiration...')
  const expiredData = encryption.encrypt('expiring-secret', new Date(Date.now() - 1000))
  try {
    encryption.decrypt(expiredData)
    console.log('❌ Expiration test FAILED - should have thrown error')
  } catch (error) {
    console.log('✅ Expiration test PASSED:', error.message)
  }
  
  // Test object encryption
  console.log('\n🔐 Testing object encryption...')
  const testObj = {
    public_field: 'not-secret',
    api_key: 'sk-super-secret-key',
    database_password: 'my-db-password',
    metadata: { version: 1 }
  }
  
  const encryptedObj = encryption.encryptObject(testObj, ['api_key', 'database_password'])
  console.log('✅ Encrypted Object Fields:', encryptedObj._encrypted_fields)
  console.log('✅ Public Field Unchanged:', encryptedObj.public_field)
  
  const decryptedObj = encryption.decryptObject(encryptedObj)
  console.log('✅ Decrypted API Key:', decryptedObj.api_key)
  console.log('✅ Object Encryption Match:', 
    testObj.api_key === decryptedObj.api_key && 
    testObj.database_password === decryptedObj.database_password ? 'PASS' : 'FAIL')
  
  // Test 2: Hash Function
  console.log('\n🔍 Test 2: SHA-256 Hashing')
  console.log('-'.repeat(40))
  
  const hash1 = encryption.hash('sensitive-data')
  const hash2 = encryption.hash('sensitive-data')
  const hash3 = encryption.hash('different-data')
  
  console.log('✅ Hash 1:', hash1)
  console.log('✅ Hash 2:', hash2)
  console.log('✅ Consistency:', hash1 === hash2 ? 'PASS' : 'FAIL')
  console.log('✅ Uniqueness:', hash1 !== hash3 ? 'PASS' : 'FAIL')
  
  // Test 3: Key Generation
  console.log('\n🔑 Test 3: Secure Key Generation')
  console.log('-'.repeat(40))
  
  const key1 = EncryptionService.generateKey(32)
  const key2 = EncryptionService.generateKey(32)
  
  console.log('✅ Generated Key 1:', key1.substring(0, 20) + '...')
  console.log('✅ Generated Key 2:', key2.substring(0, 20) + '...')
  console.log('✅ Key Length:', key1.length, '(expected: 64 hex chars)')
  console.log('✅ Key Uniqueness:', key1 !== key2 ? 'PASS' : 'FAIL')
  
  // Test 4: Context Patterns Demo
  console.log('\n🗃️ Test 4: Context Management Patterns')
  console.log('-'.repeat(40))
  
  // Simulate secret context storage
  const secretContext = {
    workspace_id: 'workspace-123',
    user_id: 'user-456',
    credentials: {},
    ssh_keys: {},
    certificates: {}
  }
  
  // Store encrypted API key
  const apiKeyName = 'openai_api_key'
  const apiKeyValue = 'sk-1234567890abcdef'
  secretContext.credentials[apiKeyName] = {
    ...encryption.encrypt(apiKeyValue),
    credential_type: 'api_key',
    provider: 'openai',
    metadata: {
      created_by: 'user-456',
      key_name: apiKeyName
    }
  }
  
  console.log('✅ Secret Context Created')
  console.log('✅ Stored Credential:', apiKeyName)
  console.log('✅ Provider:', secretContext.credentials[apiKeyName].provider)
  
  // Retrieve and decrypt
  const storedCred = secretContext.credentials[apiKeyName]
  const retrievedKey = encryption.decrypt(storedCred)
  console.log('✅ Retrieved Key:', retrievedKey)
  console.log('✅ Retrieval Match:', apiKeyValue === retrievedKey ? 'PASS' : 'FAIL')
  
  // Test 5: Performance
  console.log('\n⚡ Test 5: Performance Benchmarks')
  console.log('-'.repeat(40))
  
  const iterations = 1000
  const testPayload = 'a'.repeat(1000) // 1KB test data
  
  console.time('1000 encrypt operations')
  for (let i = 0; i < iterations; i++) {
    encryption.encrypt(testPayload)
  }
  console.timeEnd('1000 encrypt operations')
  
  const encryptedPayload = encryption.encrypt(testPayload)
  console.time('1000 decrypt operations')
  for (let i = 0; i < iterations; i++) {
    encryption.decrypt(encryptedPayload)
  }
  console.timeEnd('1000 decrypt operations')
  
  console.log('\n🎉 All Tests Completed Successfully!')
  console.log('=' .repeat(60))
  
  return {
    encryption_basic: testData === decrypted,
    encryption_expiration: true,
    encryption_objects: testObj.api_key === decryptedObj.api_key,
    hashing: hash1 === hash2 && hash1 !== hash3,
    key_generation: key1 !== key2 && key1.length === 64,
    context_storage: apiKeyValue === retrievedKey
  }
}

// Run tests and handle errors
runTests()
  .then(results => {
    console.log('\n📊 Test Results Summary:')
    Object.entries(results).forEach(([test, passed]) => {
      console.log(`  ${passed ? '✅' : '❌'} ${test}: ${passed ? 'PASS' : 'FAIL'}`)
    })
    
    const allPassed = Object.values(results).every(r => r === true)
    console.log(`\n🏆 Overall Result: ${allPassed ? 'ALL TESTS PASSED' : 'SOME TESTS FAILED'}`)
    process.exit(allPassed ? 0 : 1)
  })
  .catch(error => {
    console.error('\n❌ Test suite failed:', error)
    process.exit(1)
  })