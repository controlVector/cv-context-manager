// Simple test script for CV Context Manager
const fastify = require('fastify')({ logger: true })

// Mock services for testing without database
const mockEncryption = {
  encrypt: (data) => ({ encrypted_data: Buffer.from(data).toString('base64'), iv: 'mock-iv', algorithm: 'aes-256-gcm', created_at: new Date().toISOString() }),
  decrypt: (data) => Buffer.from(data.encrypted_data, 'base64').toString(),
  hash: (data) => require('crypto').createHash('sha256').update(data).digest('hex')
}

const mockDb = {
  healthCheck: async () => ({ database: true, cache: true }),
  query: async () => [],
  insert: async (table, data) => ({ ...data, id: 'mock-id' }),
  close: async () => {}
}

// Basic routes
fastify.get('/', async (request, reply) => {
  return {
    service: 'cv-context-manager',
    version: '1.0.0', 
    status: 'healthy',
    timestamp: new Date().toISOString()
  }
})

fastify.get('/health', async (request, reply) => {
  const healthCheck = await mockDb.healthCheck()
  return {
    status: healthCheck.database && healthCheck.cache ? 'healthy' : 'degraded',
    database: healthCheck.database,
    cache: healthCheck.cache,
    timestamp: new Date().toISOString()
  }
})

// Test encryption endpoint
fastify.post('/test/encrypt', async (request, reply) => {
  const { data } = request.body
  if (!data) {
    return reply.code(400).send({ error: 'Missing data field' })
  }
  
  const encrypted = mockEncryption.encrypt(data)
  const decrypted = mockEncryption.decrypt(encrypted)
  
  return {
    original: data,
    encrypted: encrypted,
    decrypted: decrypted,
    match: data === decrypted
  }
})

// Start server
const start = async () => {
  try {
    await fastify.listen({ port: 3002, host: '0.0.0.0' })
    console.log('🚀 CV Context Manager test server running on http://localhost:3002')
    console.log('📊 Available endpoints:')
    console.log('  GET  / - Service info')
    console.log('  GET  /health - Health check')
    console.log('  POST /test/encrypt - Test encryption')
  } catch (err) {
    fastify.log.error(err)
    process.exit(1)
  }
}

start()