import { DatabaseClient } from '../database/client'
import { 
  UserContext, 
  UserPreferences, 
  DeploymentPattern, 
  InfrastructureEvent,
  ConversationContext,
  DeploymentSession,
  UserSettings 
} from '../types'

export class UserContextService {
  constructor(private db: DatabaseClient) {}

  /**
   * Get user context for a specific workspace
   */
  async getUserContext(workspaceId: string, userId: string): Promise<UserContext | null> {
    // Try cache first
    const cacheKey = this.db.generateCacheKey('user_context', workspaceId, userId)
    const cached = await this.db.cacheGet<UserContext>(cacheKey)
    
    if (cached) {
      return cached
    }

    // Query database
    const results = await this.db.findByUserAndWorkspace<UserContext>(
      'user_contexts',
      userId,
      workspaceId
    )

    const userContext = results[0] || null
    
    // Cache the result
    if (userContext) {
      await this.db.cacheSet(cacheKey, userContext, 600) // 10 minute cache
    }

    return userContext
  }

  /**
   * Create or update user preferences
   */
  async updateUserPreferences(
    workspaceId: string,
    userId: string,
    preferences: UserPreferences
  ): Promise<UserContext> {
    let userContext = await this.getUserContext(workspaceId, userId)
    
    if (!userContext) {
      userContext = await this.createUserContext(workspaceId, userId)
    }

    // Merge preferences
    userContext.preferences = {
      ...userContext.preferences,
      ...preferences
    }

    userContext.updated_at = new Date().toISOString()

    return await this.saveUserContext(userContext)
  }

  /**
   * Update user settings
   */
  async updateUserSettings(
    workspaceId: string,
    userId: string,
    settings: Partial<UserSettings>
  ): Promise<UserContext> {
    let userContext = await this.getUserContext(workspaceId, userId)
    
    if (!userContext) {
      userContext = await this.createUserContext(workspaceId, userId)
    }

    // Deep merge settings
    userContext.settings = {
      ...userContext.settings,
      ...settings,
      security: {
        ...userContext.settings.security,
        ...settings.security
      },
      workspace: {
        ...userContext.settings.workspace,
        ...settings.workspace
      },
      integrations: {
        ...userContext.settings.integrations,
        ...settings.integrations
      }
    }

    userContext.updated_at = new Date().toISOString()

    return await this.saveUserContext(userContext)
  }

  /**
   * Add a deployment pattern to user's history
   */
  async addDeploymentPattern(
    workspaceId: string,
    userId: string,
    pattern: Omit<DeploymentPattern, 'id' | 'created_at'>
  ): Promise<void> {
    let userContext = await this.getUserContext(workspaceId, userId)
    
    if (!userContext) {
      userContext = await this.createUserContext(workspaceId, userId)
    }

    const deploymentPattern: DeploymentPattern = {
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
      ...pattern
    }

    // Check if pattern already exists
    const existingPatternIndex = userContext.deployment_patterns.findIndex(
      p => p.name === pattern.name && p.pattern_type === pattern.pattern_type
    )

    if (existingPatternIndex >= 0) {
      // Update existing pattern
      const existingPattern = userContext.deployment_patterns[existingPatternIndex]
      userContext.deployment_patterns[existingPatternIndex] = {
        ...existingPattern,
        ...deploymentPattern,
        usage_count: (existingPattern?.usage_count || 0) + 1,
        last_used: new Date().toISOString()
      }
    } else {
      // Add new pattern
      userContext.deployment_patterns.push(deploymentPattern)
    }

    // Keep only the most recent 50 patterns
    if (userContext.deployment_patterns.length > 50) {
      userContext.deployment_patterns = userContext.deployment_patterns
        .sort((a, b) => new Date(b.last_used).getTime() - new Date(a.last_used).getTime())
        .slice(0, 50)
    }

    userContext.updated_at = new Date().toISOString()
    await this.saveUserContext(userContext)
  }

  /**
   * Record infrastructure event
   */
  async recordInfrastructureEvent(
    workspaceId: string,
    userId: string,
    event: Omit<InfrastructureEvent, 'id' | 'timestamp'>
  ): Promise<void> {
    let userContext = await this.getUserContext(workspaceId, userId)
    
    if (!userContext) {
      userContext = await this.createUserContext(workspaceId, userId)
    }

    const infrastructureEvent: InfrastructureEvent = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      ...event
    }

    userContext.infrastructure_history.push(infrastructureEvent)

    // Keep only the most recent 100 events
    if (userContext.infrastructure_history.length > 100) {
      userContext.infrastructure_history = userContext.infrastructure_history
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 100)
    }

    userContext.updated_at = new Date().toISOString()
    await this.saveUserContext(userContext)
  }

  /**
   * Add conversation context (for Watson's learning)
   */
  async addConversationContext(
    workspaceId: string,
    userId: string,
    conversation: Omit<ConversationContext, 'id' | 'timestamp'>
  ): Promise<void> {
    let userContext = await this.getUserContext(workspaceId, userId)
    
    if (!userContext) {
      userContext = await this.createUserContext(workspaceId, userId)
    }

    const conversationContext: ConversationContext = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      ...conversation
    }

    userContext.conversation_context.push(conversationContext)

    // Keep only the most recent 200 conversations
    if (userContext.conversation_context.length > 200) {
      userContext.conversation_context = userContext.conversation_context
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 200)
    }

    userContext.updated_at = new Date().toISOString()
    await this.saveUserContext(userContext)
  }

  /**
   * Search user's deployment patterns
   */
  async searchDeploymentPatterns(
    workspaceId: string,
    userId: string,
    query: {
      pattern_type?: string
      min_success_rate?: number
      provider?: string
      name_contains?: string
    }
  ): Promise<DeploymentPattern[]> {
    const userContext = await this.getUserContext(workspaceId, userId)
    
    if (!userContext) {
      return []
    }

    let patterns = userContext.deployment_patterns

    // Apply filters
    if (query.pattern_type) {
      patterns = patterns.filter(p => p.pattern_type === query.pattern_type)
    }

    if (query.min_success_rate !== undefined) {
      patterns = patterns.filter(p => p.success_rate >= query.min_success_rate!)
    }

    if (query.name_contains) {
      patterns = patterns.filter(p => 
        p.name.toLowerCase().includes(query.name_contains!.toLowerCase())
      )
    }

    // Sort by usage count and success rate
    patterns.sort((a, b) => {
      const scoreA = a.usage_count * a.success_rate
      const scoreB = b.usage_count * b.success_rate
      return scoreB - scoreA
    })

    return patterns
  }

  /**
   * Get infrastructure usage analytics
   */
  async getInfrastructureAnalytics(
    workspaceId: string,
    userId: string,
    timeRange: { start: Date; end: Date }
  ): Promise<{
    totalEvents: number
    successRate: number
    costSummary: { total: number; average: number }
    providerBreakdown: Record<string, number>
    eventTypeBreakdown: Record<string, number>
  }> {
    const userContext = await this.getUserContext(workspaceId, userId)
    
    if (!userContext) {
      return {
        totalEvents: 0,
        successRate: 0,
        costSummary: { total: 0, average: 0 },
        providerBreakdown: {},
        eventTypeBreakdown: {}
      }
    }

    // Filter events by time range
    const events = userContext.infrastructure_history.filter(event => {
      const eventTime = new Date(event.timestamp)
      return eventTime >= timeRange.start && eventTime <= timeRange.end
    })

    const totalEvents = events.length
    const successfulEvents = events.filter(e => e.status === 'success').length
    const successRate = totalEvents > 0 ? successfulEvents / totalEvents : 0

    const totalCost = events.reduce((sum, event) => sum + (event.cost_impact || 0), 0)
    const averageCost = totalEvents > 0 ? totalCost / totalEvents : 0

    const providerBreakdown: Record<string, number> = {}
    const eventTypeBreakdown: Record<string, number> = {}

    events.forEach(event => {
      providerBreakdown[event.provider] = (providerBreakdown[event.provider] || 0) + 1
      eventTypeBreakdown[event.event_type] = (eventTypeBreakdown[event.event_type] || 0) + 1
    })

    return {
      totalEvents,
      successRate,
      costSummary: { total: totalCost, average: averageCost },
      providerBreakdown,
      eventTypeBreakdown
    }
  }

  /**
   * Search conversation history
   */
  async searchConversationHistory(
    workspaceId: string,
    userId: string,
    query: string,
    limit: number = 20
  ): Promise<ConversationContext[]> {
    const userContext = await this.getUserContext(workspaceId, userId)
    
    if (!userContext) {
      return []
    }

    const queryLower = query.toLowerCase()

    // Simple text search - in production, you'd want to use a proper search engine
    const matchingConversations = userContext.conversation_context
      .filter(conversation => 
        conversation.message_content.toLowerCase().includes(queryLower) ||
        conversation.intent_analysis.primary_intent.toLowerCase().includes(queryLower) ||
        conversation.agent_responses.some(response => 
          response.response.toLowerCase().includes(queryLower)
        )
      )
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit)

    return matchingConversations
  }

  /**
   * Get user's most used deployment patterns (recommendations)
   */
  async getRecommendedPatterns(
    workspaceId: string,
    userId: string,
    context?: string
  ): Promise<DeploymentPattern[]> {
    const userContext = await this.getUserContext(workspaceId, userId)
    
    if (!userContext) {
      return []
    }

    let patterns = userContext.deployment_patterns

    // Filter by context if provided (e.g., "react", "docker", "aws")
    if (context) {
      const contextLower = context.toLowerCase()
      patterns = patterns.filter(pattern =>
        pattern.name.toLowerCase().includes(contextLower) ||
        JSON.stringify(pattern.configuration).toLowerCase().includes(contextLower)
      )
    }

    // Sort by success rate and usage count
    patterns.sort((a, b) => {
      // Weight: success_rate (70%) + usage_count normalized (30%)
      const maxUsage = Math.max(...patterns.map(p => p.usage_count), 1)
      const scoreA = (a.success_rate * 0.7) + ((a.usage_count / maxUsage) * 0.3)
      const scoreB = (b.success_rate * 0.7) + ((b.usage_count / maxUsage) * 0.3)
      return scoreB - scoreA
    })

    return patterns.slice(0, 5) // Top 5 recommendations
  }

  /**
   * Deployment session management for persistent dev/op workflows
   */
  async createDeploymentSession(
    workspaceId: string,
    userId: string,
    sessionName: string,
    deploymentContext: DeploymentSession['deployment_context']
  ): Promise<DeploymentSession> {
    let userContext = await this.getUserContext(workspaceId, userId)
    
    if (!userContext) {
      userContext = await this.createUserContext(workspaceId, userId)
    }

    const deploymentSession: DeploymentSession = {
      id: crypto.randomUUID(),
      workspace_id: workspaceId,
      user_id: userId,
      session_name: sessionName,
      deployment_context: deploymentContext,
      active_resources: [],
      session_state: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days
    }

    if (!userContext.deployment_sessions) {
      userContext.deployment_sessions = []
    }
    userContext.deployment_sessions.push(deploymentSession)
    
    // Keep only the most recent 10 active sessions
    userContext.deployment_sessions = userContext.deployment_sessions
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
      .slice(0, 10)

    userContext.updated_at = new Date().toISOString()
    await this.saveUserContext(userContext)

    return deploymentSession
  }

  async updateDeploymentSession(
    workspaceId: string,
    userId: string,
    sessionId: string,
    updates: Partial<Pick<DeploymentSession, 'deployment_context' | 'active_resources' | 'session_state' | 'metadata'>>
  ): Promise<DeploymentSession | null> {
    let userContext = await this.getUserContext(workspaceId, userId)
    
    if (!userContext) {
      return null
    }

    const sessionIndex = userContext.deployment_sessions?.findIndex(s => s.id === sessionId) ?? -1
    if (sessionIndex === -1 || !userContext.deployment_sessions) {
      return null
    }

    const existingSession = userContext.deployment_sessions[sessionIndex]
    if (!existingSession) {
      return null
    }
    
    const updatedSession: DeploymentSession = {
      id: existingSession.id,
      workspace_id: existingSession.workspace_id,
      user_id: existingSession.user_id,
      session_name: existingSession.session_name,
      deployment_context: updates.deployment_context || existingSession.deployment_context,
      active_resources: updates.active_resources || existingSession.active_resources,
      session_state: updates.session_state || existingSession.session_state,
      metadata: updates.metadata || existingSession.metadata,
      created_at: existingSession.created_at,
      updated_at: new Date().toISOString(),
      // Extend expiration if session is still active
      expires_at: updates.session_state === 'active' || existingSession.session_state === 'active'
        ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
        : existingSession.expires_at
    }

    userContext.deployment_sessions[sessionIndex] = updatedSession
    userContext.updated_at = new Date().toISOString()
    await this.saveUserContext(userContext)

    return updatedSession
  }

  async getDeploymentSession(
    workspaceId: string,
    userId: string,
    sessionId: string
  ): Promise<DeploymentSession | null> {
    const userContext = await this.getUserContext(workspaceId, userId)
    
    if (!userContext) {
      return null
    }

    return userContext.deployment_sessions?.find(s => s.id === sessionId) || null
  }

  async getActiveDeploymentSessions(
    workspaceId: string,
    userId: string
  ): Promise<DeploymentSession[]> {
    const userContext = await this.getUserContext(workspaceId, userId)
    
    if (!userContext) {
      return []
    }

    const now = new Date().toISOString()
    
    return userContext.deployment_sessions
      ?.filter(session => 
        session.session_state === 'active' && 
        session.expires_at > now
      )
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()) || []
  }

  async resumeDeploymentSession(
    workspaceId: string,
    userId: string,
    sessionId: string
  ): Promise<DeploymentSession | null> {
    const session = await this.getDeploymentSession(workspaceId, userId, sessionId)
    
    if (!session) {
      return null
    }

    // Check if session is expired
    if (new Date(session.expires_at) <= new Date()) {
      return null
    }

    // Update session state to active if it was paused
    if (session.session_state === 'paused') {
      return await this.updateDeploymentSession(workspaceId, userId, sessionId, {
        session_state: 'active'
      })
    }

    return session
  }

  async pauseDeploymentSession(
    workspaceId: string,
    userId: string,
    sessionId: string
  ): Promise<DeploymentSession | null> {
    return await this.updateDeploymentSession(workspaceId, userId, sessionId, {
      session_state: 'paused'
    })
  }

  async cleanupExpiredSessions(
    workspaceId: string,
    userId: string
  ): Promise<number> {
    let userContext = await this.getUserContext(workspaceId, userId)
    
    if (!userContext) {
      return 0
    }

    const now = new Date().toISOString()
    const originalCount = userContext.deployment_sessions?.length || 0
    
    if (userContext.deployment_sessions) {
      userContext.deployment_sessions = userContext.deployment_sessions.filter(session => 
        session.expires_at > now || session.session_state === 'active'
      )
    }

    const cleanedCount = originalCount - (userContext.deployment_sessions?.length || 0)
    
    if (cleanedCount > 0) {
      userContext.updated_at = new Date().toISOString()
      await this.saveUserContext(userContext)
    }

    return cleanedCount
  }

  // Private helper methods
  private async createUserContext(workspaceId: string, userId: string): Promise<UserContext> {
    const userContext: UserContext = {
      id: crypto.randomUUID(),
      workspace_id: workspaceId,
      user_id: userId,
      preferences: {
        default_cloud_provider: 'digitalocean',
        preferred_regions: ['nyc1', 'sfo3'],
        cost_limits: {
          daily_limit: 50,
          monthly_limit: 500,
          alert_threshold: 80
        },
        notification_preferences: {
          channels: ['email'],
          quiet_hours: {
            start: '22:00',
            end: '08:00',
            timezone: 'UTC'
          }
        },
        ui_preferences: {
          theme: 'auto',
          sidebar_collapsed: false,
          default_view: 'infrastructure'
        }
      },
      deployment_patterns: [],
      infrastructure_history: [],
      conversation_context: [],
      deployment_sessions: [],
      settings: {
        security: {
          mfa_enabled: false,
          session_timeout: 3600,
          ip_restrictions: []
        },
        workspace: {
          default_workspace_id: workspaceId,
          workspace_permissions: {}
        },
        integrations: {
          enabled_providers: ['digitalocean'],
          webhook_endpoints: []
        }
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    return await this.saveUserContext(userContext)
  }

  private async saveUserContext(userContext: UserContext): Promise<UserContext> {
    if (await this.db.findById('user_contexts', userContext.id)) {
      await this.db.update('user_contexts', userContext.id, userContext)
    } else {
      await this.db.insert('user_contexts', userContext)
    }

    // Update cache
    const cacheKey = this.db.generateCacheKey('user_context', userContext.workspace_id, userContext.user_id)
    await this.db.cacheSet(cacheKey, userContext, 600) // 10 minute cache

    return userContext
  }
}