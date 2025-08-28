/**
 * Deployment Session Service
 * 
 * Manages deployment session contexts to maintain state across
 * conversation turns and prevent context loss during deployments
 */

import { v4 as uuidv4 } from 'uuid'
import {
  DeploymentSessionContext,
  DeploymentStep,
  SessionUpdate,
  SessionQuery,
  DeploymentTarget
} from '../types/session'

export class DeploymentSessionService {
  private sessions: Map<string, DeploymentSessionContext> = new Map()
  private userSessions: Map<string, Set<string>> = new Map() // user_id -> session_ids
  
  constructor() {
    // Start cleanup timer for expired sessions
    setInterval(() => this.cleanupExpiredSessions(), 60000) // Every minute
  }

  /**
   * Create a new deployment session
   */
  async createSession(
    userId: string,
    workspaceId: string,
    deploymentTarget: DeploymentTarget,
    conversationId?: string
  ): Promise<DeploymentSessionContext> {
    const sessionId = uuidv4()
    const now = new Date()
    
    const session: DeploymentSessionContext = {
      session_id: sessionId,
      conversation_id: conversationId,
      user_id: userId,
      workspace_id: workspaceId,
      deployment_target: deploymentTarget,
      infrastructure_state: {
        provider: 'digitalocean' // Default, can be updated
      },
      dns_state: {
        provider: 'cloudflare' // Default, can be updated
      },
      service_state: {},
      deployment_steps: [],
      created_at: now,
      updated_at: now,
      expires_at: new Date(now.getTime() + 24 * 60 * 60 * 1000), // 24 hours
      status: 'planning',
      error_count: 0
    }
    
    // Store session
    this.sessions.set(sessionId, session)
    
    // Track user sessions
    if (!this.userSessions.has(userId)) {
      this.userSessions.set(userId, new Set())
    }
    this.userSessions.get(userId)!.add(sessionId)
    
    console.log(`[DeploymentSession] Created session ${sessionId} for deployment to ${deploymentTarget.target_domain}`)
    
    return session
  }

  /**
   * Get a deployment session by ID
   */
  async getSession(sessionId: string): Promise<DeploymentSessionContext | null> {
    const session = this.sessions.get(sessionId)
    
    if (!session) {
      return null
    }
    
    // Check if expired
    if (session.expires_at && new Date() > session.expires_at) {
      console.log(`[DeploymentSession] Session ${sessionId} has expired`)
      this.deleteSession(sessionId)
      return null
    }
    
    // Update expiry on access
    session.expires_at = new Date(Date.now() + 24 * 60 * 60 * 1000)
    session.updated_at = new Date()
    
    return session
  }

  /**
   * Update a deployment session
   */
  async updateSession(sessionId: string, update: SessionUpdate): Promise<DeploymentSessionContext | null> {
    const session = await this.getSession(sessionId)
    
    if (!session) {
      return null
    }
    
    // Update infrastructure state
    if (update.infrastructure_state) {
      session.infrastructure_state = {
        ...session.infrastructure_state,
        ...update.infrastructure_state
      }
    }
    
    // Update DNS state
    if (update.dns_state) {
      session.dns_state = {
        ...session.dns_state,
        ...update.dns_state
      }
    }
    
    // Update service state
    if (update.service_state) {
      session.service_state = {
        ...session.service_state,
        ...update.service_state
      }
    }
    
    // Update other fields
    if (update.current_step) {
      session.current_step = update.current_step
    }
    
    if (update.status) {
      session.status = update.status
    }
    
    if (update.error_message) {
      session.last_error = update.error_message
      session.error_count++
    }
    
    if (update.notes) {
      session.notes = [...(session.notes || []), ...update.notes]
    }
    
    if (update.metadata) {
      session.metadata = {
        ...session.metadata,
        ...update.metadata
      }
    }
    
    session.updated_at = new Date()
    session.expires_at = new Date(Date.now() + 24 * 60 * 60 * 1000)
    
    console.log(`[DeploymentSession] Updated session ${sessionId}`, update)
    
    return session
  }

  /**
   * Add a deployment step to the session
   */
  async addDeploymentStep(
    sessionId: string,
    stepName: string,
    status: DeploymentStep['status'] = 'pending'
  ): Promise<void> {
    const session = await this.getSession(sessionId)
    
    if (!session) {
      return
    }
    
    const step: DeploymentStep = {
      step_name: stepName,
      status,
      started_at: status === 'in_progress' ? new Date() : undefined
    }
    
    session.deployment_steps.push(step)
    session.current_step = stepName
    session.updated_at = new Date()
    
    console.log(`[DeploymentSession] Added step '${stepName}' to session ${sessionId}`)
  }

  /**
   * Update a deployment step status
   */
  async updateDeploymentStep(
    sessionId: string,
    stepName: string,
    status: DeploymentStep['status'],
    result?: any,
    errorMessage?: string
  ): Promise<void> {
    const session = await this.getSession(sessionId)
    
    if (!session) {
      return
    }
    
    const step = session.deployment_steps.find(s => s.step_name === stepName)
    
    if (!step) {
      await this.addDeploymentStep(sessionId, stepName, status)
      return
    }
    
    step.status = status
    
    if (status === 'in_progress' && !step.started_at) {
      step.started_at = new Date()
    }
    
    if (status === 'completed' || status === 'failed') {
      step.completed_at = new Date()
    }
    
    if (result) {
      step.result = result
    }
    
    if (errorMessage) {
      step.error_message = errorMessage
      session.error_count++
      session.last_error = errorMessage
    }
    
    session.updated_at = new Date()
    
    console.log(`[DeploymentSession] Updated step '${stepName}' to ${status} in session ${sessionId}`)
  }

  /**
   * Get active sessions for a user
   */
  async getUserSessions(userId: string, activeOnly: boolean = true): Promise<DeploymentSessionContext[]> {
    const sessionIds = this.userSessions.get(userId)
    
    if (!sessionIds) {
      return []
    }
    
    const sessions: DeploymentSessionContext[] = []
    
    for (const sessionId of sessionIds) {
      const session = await this.getSession(sessionId)
      
      if (session) {
        if (!activeOnly || session.status === 'in_progress' || session.status === 'planning') {
          sessions.push(session)
        }
      }
    }
    
    return sessions.sort((a, b) => b.updated_at.getTime() - a.updated_at.getTime())
  }

  /**
   * Find sessions by query
   */
  async findSessions(query: SessionQuery): Promise<DeploymentSessionContext[]> {
    const results: DeploymentSessionContext[] = []
    
    for (const session of this.sessions.values()) {
      // Check if expired
      if (session.expires_at && new Date() > session.expires_at) {
        continue
      }
      
      // Apply query filters
      if (query.user_id && session.user_id !== query.user_id) continue
      if (query.workspace_id && session.workspace_id !== query.workspace_id) continue
      if (query.status && session.status !== query.status) continue
      if (query.domain && session.deployment_target.target_domain !== query.domain) continue
      if (query.ip_address && session.infrastructure_state.ip_address !== query.ip_address) continue
      if (query.created_after && session.created_at < query.created_after) continue
      if (query.created_before && session.created_at > query.created_before) continue
      
      results.push(session)
    }
    
    return results.sort((a, b) => b.updated_at.getTime() - a.updated_at.getTime())
  }

  /**
   * Get the most recent active session for a conversation
   */
  async getConversationSession(conversationId: string): Promise<DeploymentSessionContext | null> {
    for (const session of this.sessions.values()) {
      if (session.conversation_id === conversationId && 
          (session.status === 'planning' || session.status === 'in_progress')) {
        return await this.getSession(session.session_id)
      }
    }
    
    return null
  }

  /**
   * Delete a session
   */
  async deleteSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId)
    
    if (session) {
      // Remove from user sessions
      const userSessions = this.userSessions.get(session.user_id)
      if (userSessions) {
        userSessions.delete(sessionId)
      }
      
      // Delete session
      this.sessions.delete(sessionId)
      
      console.log(`[DeploymentSession] Deleted session ${sessionId}`)
    }
  }

  /**
   * Clean up expired sessions
   */
  private cleanupExpiredSessions(): void {
    const now = new Date()
    let cleanedCount = 0
    
    for (const [sessionId, session] of this.sessions.entries()) {
      if (session.expires_at && now > session.expires_at) {
        this.deleteSession(sessionId)
        cleanedCount++
      }
    }
    
    if (cleanedCount > 0) {
      console.log(`[DeploymentSession] Cleaned up ${cleanedCount} expired sessions`)
    }
  }

  /**
   * Get session summary for logging
   */
  getSessionSummary(session: DeploymentSessionContext): string {
    return `Session ${session.session_id}: ${session.deployment_target.target_domain} (${session.status}) - ` +
           `IP: ${session.infrastructure_state.ip_address || 'pending'}, ` +
           `SSH: ${session.infrastructure_state.ssh_key_id || 'none'}, ` +
           `DNS: ${session.dns_state.domain_configured ? 'configured' : 'pending'}`
  }
}