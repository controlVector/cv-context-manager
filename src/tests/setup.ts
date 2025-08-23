// Jest setup file
import 'dotenv/config'

// Mock environment variables for testing
process.env.NODE_ENV = 'test'
process.env.CONTEXT_ENCRYPTION_KEY = 'test-encryption-key-32-bytes-long!'
process.env.JWT_SECRET = 'test-jwt-secret-key'
process.env.SUPABASE_URL = 'https://test.supabase.co'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key'
process.env.REDIS_HOST = 'localhost'
process.env.REDIS_PORT = '6379'

// Increase timeout for database operations
jest.setTimeout(30000)