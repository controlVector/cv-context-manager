import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'

// Request/Response schemas for validation
const StoreCredentialSchema = z.object({
  key: z.string().min(1),
  value: z.string().min(1),
  credential_type: z.enum(['oauth', 'api_key', 'password', 'token']),
  provider: z.string().min(1),
  expires_at: z.string().datetime().optional()
})

const StoreSSHKeySchema = z.object({
  key_name: z.string().min(1),
  private_key: z.string().min(1),
  public_key: z.string().min(1),
  key_type: z.enum(['rsa', 'ed25519', 'ecdsa']),
  metadata: z.object({
    description: z.string().optional(),
    allowed_hosts: z.array(z.string()).optional()
  }).optional()
})

const UpdatePreferencesSchema = z.object({
  default_cloud_provider: z.string().optional(),
  preferred_regions: z.array(z.string()).optional(),
  cost_limits: z.object({
    daily_limit: z.number().optional(),
    monthly_limit: z.number().optional(),
    alert_threshold: z.number().optional()
  }).optional(),
  notification_preferences: z.object({
    channels: z.array(z.enum(['email', 'slack', 'webhook'])).optional(),
    quiet_hours: z.object({
      start: z.string(),
      end: z.string(),
      timezone: z.string()
    }).optional()
  }).optional(),
  ui_preferences: z.object({
    theme: z.enum(['light', 'dark', 'auto']).optional(),
    sidebar_collapsed: z.boolean().optional(),
    default_view: z.string().optional()
  }).optional()
})

const AddDeploymentPatternSchema = z.object({
  name: z.string().min(1),
  pattern_type: z.enum(['infrastructure', 'deployment', 'hybrid']),
  configuration: z.record(z.any()),
  success_rate: z.number().min(0).max(1),
  usage_count: z.number().min(0).default(1)
})

const RecordInfrastructureEventSchema = z.object({
  event_type: z.enum(['provision', 'deploy', 'scale', 'delete', 'update']),
  resource_type: z.string().min(1),
  provider: z.string().min(1),
  status: z.enum(['success', 'failed', 'pending']),
  configuration: z.record(z.any()),
  cost_impact: z.number().default(0),
  duration_ms: z.number().min(0),
  metadata: z.record(z.any()).optional()
})


// Helper to ensure user is authenticated
function requireAuth(request: FastifyRequest, reply: FastifyReply): { user_id: string; workspace_id: string } | null {
  try {
    // Access the JWT user from the request 
    const userData = (request as any).user
    if (!userData || !userData.user_id || !userData.workspace_id) {
      reply.code(401).send({ error: 'Unauthorized' })
      return null
    }
    
    return {
      user_id: userData.user_id,
      workspace_id: userData.workspace_id
    }
  } catch (error) {
    reply.code(401).send({ error: 'Unauthorized' })
    return null
  }
}

export async function contextRoutes(fastify: FastifyInstance) {
  
  // =================================
  // SECRET CONTEXT ROUTES
  // =================================
  
  // Store encrypted credential
  fastify.post('/secret/credential', async (request: FastifyRequest, reply: FastifyReply) => {
    const { key, value, credential_type, provider, expires_at } = StoreCredentialSchema.parse(request.body)
    
    if (!request.user) {
      return reply.code(401).send({ error: 'Unauthorized' })
    }
    
    const user = requireAuth(request, reply)
    if (!user) return
    const { user_id, workspace_id } = user

    try {
      const expiresAtDate = expires_at ? new Date(expires_at) : undefined
      
      await fastify.secretContextService.storeCredential(
        workspace_id,
        user_id,
        key,
        value,
        credential_type,
        provider,
        expiresAtDate
      )

      reply.code(201).send({
        success: true,
        message: `Credential '${key}' stored successfully`
      })
    } catch (error) {
      reply.code(500).send({
        success: false,
        error: 'Failed to store credential',
        details: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  })

  // Get decrypted credential
  fastify.get('/secret/credential/:key', async (request: FastifyRequest, reply: FastifyReply) => {
    const { key } = request.params as { key: string }
    const user = requireAuth(request, reply)
    if (!user) return
    const { user_id, workspace_id } = user

    try {
      const credential = await fastify.secretContextService.getCredential(
        workspace_id,
        user_id,
        key
      )

      if (!credential) {
        reply.code(404).send({
          success: false,
          error: `Credential '${key}' not found`
        })
        return
      }

      reply.send({
        success: true,
        data: { value: credential }
      })
    } catch (error) {
      reply.code(500).send({
        success: false,
        error: 'Failed to retrieve credential',
        details: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  })

  // Store SSH key
  fastify.post('/secret/ssh-key', async (request: FastifyRequest, reply: FastifyReply) => {
    const { key_name, private_key, public_key, key_type, metadata } = StoreSSHKeySchema.parse(request.body)
    const user = requireAuth(request, reply)
    if (!user) return
    const { user_id, workspace_id } = user

    try {
      await fastify.secretContextService.storeSSHKey(
        workspace_id,
        user_id,
        key_name,
        private_key,
        public_key,
        key_type,
        metadata
      )

      reply.code(201).send({
        success: true,
        message: `SSH key '${key_name}' stored successfully`
      })
    } catch (error) {
      reply.code(500).send({
        success: false,
        error: 'Failed to store SSH key',
        details: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  })

  // Get SSH key
  fastify.get('/secret/ssh-key/:keyName', async (request: FastifyRequest, reply: FastifyReply) => {
    const { keyName } = request.params as { keyName: string }
    const user = requireAuth(request, reply)
    if (!user) return
    const { user_id, workspace_id } = user

    try {
      const sshKey = await fastify.secretContextService.getSSHKey(
        workspace_id,
        user_id,
        keyName
      )

      if (!sshKey) {
        reply.code(404).send({
          success: false,
          error: `SSH key '${keyName}' not found`
        })
        return
      }

      reply.send({
        success: true,
        data: sshKey
      })
    } catch (error) {
      reply.code(500).send({
        success: false,
        error: 'Failed to retrieve SSH key',
        details: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  })

  // List all secrets (metadata only)
  fastify.get('/secret/list', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = requireAuth(request, reply)
    if (!user) return
    const { user_id, workspace_id } = user

    try {
      const secrets = await fastify.secretContextService.listSecrets(workspace_id, user_id)

      reply.send({
        success: true,
        data: secrets
      })
    } catch (error) {
      reply.code(500).send({
        success: false,
        error: 'Failed to list secrets',
        details: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  })

  // Delete secret
  fastify.delete('/secret/:type/:key', async (request: FastifyRequest, reply: FastifyReply) => {
    const { type, key } = request.params as { type: string; key: string }
    const user = requireAuth(request, reply)
    if (!user) return
    const { user_id, workspace_id } = user

    if (!['credential', 'ssh_key', 'certificate'].includes(type)) {
      reply.code(400).send({
        success: false,
        error: 'Invalid secret type. Must be credential, ssh_key, or certificate'
      })
      return
    }

    try {
      const deleted = await fastify.secretContextService.deleteSecret(
        workspace_id,
        user_id,
        type as 'credential' | 'ssh_key' | 'certificate',
        key
      )

      if (!deleted) {
        reply.code(404).send({
          success: false,
          error: `${type} '${key}' not found`
        })
        return
      }

      reply.send({
        success: true,
        message: `${type} '${key}' deleted successfully`
      })
    } catch (error) {
      reply.code(500).send({
        success: false,
        error: `Failed to delete ${type}`,
        details: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  })

  // =================================
  // USER CONTEXT ROUTES
  // =================================

  // Get user context
  fastify.get('/user', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = requireAuth(request, reply)
    if (!user) return
    const { user_id, workspace_id } = user

    try {
      const userContext = await fastify.userContextService.getUserContext(workspace_id, user_id)

      if (!userContext) {
        reply.code(404).send({
          success: false,
          error: 'User context not found'
        })
        return
      }

      reply.send({
        success: true,
        data: userContext
      })
    } catch (error) {
      reply.code(500).send({
        success: false,
        error: 'Failed to retrieve user context',
        details: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  })

  // Update user preferences
  fastify.put('/user/preferences', async (request: FastifyRequest, reply: FastifyReply) => {
    const preferences = UpdatePreferencesSchema.parse(request.body)
    const user = requireAuth(request, reply)
    if (!user) return
    const { user_id, workspace_id } = user

    try {
      const updatedContext = await fastify.userContextService.updateUserPreferences(
        workspace_id,
        user_id,
        preferences
      )

      reply.send({
        success: true,
        data: updatedContext.preferences,
        message: 'Preferences updated successfully'
      })
    } catch (error) {
      reply.code(500).send({
        success: false,
        error: 'Failed to update preferences',
        details: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  })

  // Add deployment pattern
  fastify.post('/user/deployment-pattern', async (request: FastifyRequest, reply: FastifyReply) => {
    const pattern = AddDeploymentPatternSchema.parse(request.body)
    const user = requireAuth(request, reply)
    if (!user) return
    const { user_id, workspace_id } = user

    try {
      await fastify.userContextService.addDeploymentPattern(
        workspace_id,
        user_id,
        {
          ...pattern,
          last_used: new Date().toISOString()
        }
      )

      reply.code(201).send({
        success: true,
        message: 'Deployment pattern added successfully'
      })
    } catch (error) {
      reply.code(500).send({
        success: false,
        error: 'Failed to add deployment pattern',
        details: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  })

  // Record infrastructure event
  fastify.post('/user/infrastructure-event', async (request: FastifyRequest, reply: FastifyReply) => {
    const event = RecordInfrastructureEventSchema.parse(request.body)
    const user = requireAuth(request, reply)
    if (!user) return
    const { user_id, workspace_id } = user

    try {
      await fastify.userContextService.recordInfrastructureEvent(
        workspace_id,
        user_id,
        event
      )

      reply.code(201).send({
        success: true,
        message: 'Infrastructure event recorded successfully'
      })
    } catch (error) {
      reply.code(500).send({
        success: false,
        error: 'Failed to record infrastructure event',
        details: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  })

  // Search deployment patterns
  fastify.get('/user/deployment-patterns/search', async (request: FastifyRequest, reply: FastifyReply) => {
    const { pattern_type, min_success_rate, name_contains } = request.query as {
      pattern_type?: string
      min_success_rate?: string
      name_contains?: string
    }
    const user = requireAuth(request, reply)
    if (!user) return
    const { user_id, workspace_id } = user

    try {
      const patterns = await fastify.userContextService.searchDeploymentPatterns(
        workspace_id,
        user_id,
        {
          pattern_type,
          min_success_rate: min_success_rate ? parseFloat(min_success_rate) : undefined,
          name_contains
        }
      )

      reply.send({
        success: true,
        data: patterns
      })
    } catch (error) {
      reply.code(500).send({
        success: false,
        error: 'Failed to search deployment patterns',
        details: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  })

  // Get infrastructure analytics
  fastify.get('/user/analytics', async (request: FastifyRequest, reply: FastifyReply) => {
    const { start_date, end_date } = request.query as {
      start_date?: string
      end_date?: string
    }
    const user = requireAuth(request, reply)
    if (!user) return
    const { user_id, workspace_id } = user

    const timeRange = {
      start: start_date ? new Date(start_date) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
      end: end_date ? new Date(end_date) : new Date()
    }

    try {
      const analytics = await fastify.userContextService.getInfrastructureAnalytics(
        workspace_id,
        user_id,
        timeRange
      )

      reply.send({
        success: true,
        data: analytics
      })
    } catch (error) {
      reply.code(500).send({
        success: false,
        error: 'Failed to get infrastructure analytics',
        details: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  })

  // Get recommended patterns
  fastify.get('/user/recommendations', async (request: FastifyRequest, reply: FastifyReply) => {
    const { context } = request.query as { context?: string }
    const user = requireAuth(request, reply)
    if (!user) return
    const { user_id, workspace_id } = user

    try {
      const recommendations = await fastify.userContextService.getRecommendedPatterns(
        workspace_id,
        user_id,
        context
      )

      reply.send({
        success: true,
        data: recommendations
      })
    } catch (error) {
      reply.code(500).send({
        success: false,
        error: 'Failed to get recommendations',
        details: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  })

  // Search conversation history
  fastify.get('/user/conversations/search', async (request: FastifyRequest, reply: FastifyReply) => {
    const { q, limit } = request.query as { q?: string; limit?: string }
    const user = requireAuth(request, reply)
    if (!user) return
    const { user_id, workspace_id } = user

    if (!q) {
      reply.code(400).send({
        success: false,
        error: 'Query parameter "q" is required'
      })
      return
    }

    try {
      const conversations = await fastify.userContextService.searchConversationHistory(
        workspace_id,
        user_id,
        q,
        limit ? parseInt(limit) : 20
      )

      reply.send({
        success: true,
        data: conversations
      })
    } catch (error) {
      reply.code(500).send({
        success: false,
        error: 'Failed to search conversation history',
        details: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  })

  // =================================
  // GLOBAL CONTEXT ROUTES (Future)
  // =================================
  
  // Placeholder for global context endpoints
  fastify.get('/global/patterns', async (request: FastifyRequest, reply: FastifyReply) => {
    // TODO: Implement global context patterns
    reply.send({
      success: true,
      data: [],
      message: 'Global context patterns - coming soon'
    })
  })
}