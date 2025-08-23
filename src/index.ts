import 'dotenv/config'
import Fastify from 'fastify'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import jwt from '@fastify/jwt'

import { DatabaseClient } from './database/client'
import { EncryptionService } from './utils/encryption'
import { SecretContextService } from './services/SecretContextService'
import { UserContextService } from './services/UserContextService'
import { contextRoutes } from './controllers/contextController'

const PORT = parseInt(process.env.PORT || '3002')
const HOST = process.env.HOST || '0.0.0.0'

async function buildServer() {
  const fastify = Fastify({
    logger: { 
      level: process.env.LOG_LEVEL || 'info'
    }
  })

  // Security plugins
  await fastify.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
      }
    }
  })

  await fastify.register(cors, {
    origin: process.env.NODE_ENV === 'development' 
      ? ['http://localhost:3000', 'http://localhost:3001']
      : [process.env.FRONTEND_URL || 'https://app.controlvector.io'],
    credentials: true
  })

  // JWT authentication
  await fastify.register(jwt, {
    secret: process.env.JWT_SECRET || 'your-secret-key'
  })

  // Database initialization
  const db = new DatabaseClient(
    process.env.SUPABASE_URL || 'https://dummy.supabase.co',
    process.env.SUPABASE_SERVICE_ROLE_KEY || 'dummy-key-for-development-mode-abcdefghijklmnop',
    {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      db: parseInt(process.env.REDIS_DB || '0')
    }
  )

  // Encryption service
  const encryption = new EncryptionService(
    process.env.CONTEXT_ENCRYPTION_KEY || 'fallback-key-for-development-only',
    '1'
  )

  // Services
  const secretContextService = new SecretContextService(db, encryption)
  const userContextService = new UserContextService(db)

  // Add services to fastify instance
  fastify.decorate('db', db)
  fastify.decorate('encryption', encryption)
  fastify.decorate('secretContextService', secretContextService)
  fastify.decorate('userContextService', userContextService)

  // Authentication hook
  fastify.addHook('onRequest', async (request, reply) => {
    // Skip auth for health checks and docs
    if (request.url === '/health' || request.url === '/docs' || request.url === '/') {
      return
    }

    try {
      await request.jwtVerify()
    } catch (err) {
      reply.code(401).send({ error: 'Unauthorized' })
    }
  })

  // Routes
  fastify.get('/', async () => ({
    service: 'cv-context-manager',
    version: '1.0.0',
    status: 'healthy',
    timestamp: new Date().toISOString()
  }))

  fastify.get('/health', async () => {
    const healthCheck = await db.healthCheck()
    
    return {
      status: healthCheck.database && healthCheck.cache ? 'healthy' : 'degraded',
      database: healthCheck.database,
      cache: healthCheck.cache,
      timestamp: new Date().toISOString()
    }
  })

  // Context management routes
  await fastify.register(contextRoutes, { prefix: '/api/v1/context' })

  // Error handler
  fastify.setErrorHandler((error, request, reply) => {
    request.log.error(error)

    if (error.code === 'FST_JWT_NO_AUTHORIZATION_IN_HEADER' || 
        error.code === 'FST_JWT_AUTHORIZATION_TOKEN_INVALID') {
      reply.code(401).send({ 
        error: 'Unauthorized',
        message: 'Valid JWT token required'
      })
      return
    }

    if (error.name === 'DatabaseError') {
      reply.code(500).send({
        error: 'Database Error',
        message: 'An error occurred while accessing the database'
      })
      return
    }

    reply.code(500).send({
      error: 'Internal Server Error',
      message: 'An unexpected error occurred'
    })
  })

  // Graceful shutdown
  const gracefulShutdown = async () => {
    fastify.log.info('Starting graceful shutdown...')
    
    try {
      await db.close()
      await fastify.close()
      fastify.log.info('Graceful shutdown completed')
      process.exit(0)
    } catch (error) {
      fastify.log.error(error as Error, 'Error during shutdown')
      process.exit(1)
    }
  }

  process.on('SIGTERM', gracefulShutdown)
  process.on('SIGINT', gracefulShutdown)

  return fastify
}

async function start() {
  try {
    const fastify = await buildServer()
    
    await fastify.listen({ 
      port: PORT, 
      host: HOST 
    })
    
    fastify.log.info(`CV Context Manager running on http://${HOST}:${PORT}`)
  } catch (err) {
    console.error('Error starting server:', err)
    process.exit(1)
  }
}

// Start server if this file is run directly
if (require.main === module) {
  start()
}

export { buildServer }

// Extend Fastify instance with our services
declare module 'fastify' {
  interface FastifyInstance {
    db: DatabaseClient
    encryption: EncryptionService
    secretContextService: SecretContextService
    userContextService: UserContextService
  }
}