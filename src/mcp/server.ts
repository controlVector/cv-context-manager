/**
 * MCP (Model Context Protocol) Server for Context Manager
 * 
 * Three-tier architecture preserving existing secure credential functionality:
 * - Secret Context: Uses existing SecretContextService (DETERMINISTIC SECURITY)
 * - User Context: Uses existing UserContextService
 * - Global Context: Uses new GlobalContextService for community patterns
 */

import { SecretContextService } from '../services/SecretContextService'
import { UserContextService } from '../services/UserContextService'
import { GlobalContextService } from '../services/GlobalContextService'
import { 
  CONTEXT_MANAGER_MCP_TOOLS, 
  validateMCPToolInput, 
  createMCPResult,
  MCPToolResult,
  StoreCredentialSchema,
  RetrieveCredentialSchema,
  StoreSSHKeySchema,
  RetrieveSSHKeySchema,
  ListSecretsSchema,
  GetUserContextSchema,
  UpdateUserPreferencesSchema,
  AddDeploymentPatternSchema,
  SearchDeploymentPatternsSchema,
  RecordInfrastructureEventSchema,
  SubmitCommunityPatternSchema,
  GetCommunityPatternsSchema,
  GetRecommendedStackSchema,
  SubmitWorkflowPatternSchema
} from './tools'

export class ContextManagerMCPServer {
  private secretContextService: SecretContextService
  private userContextService: UserContextService
  private globalContextService: GlobalContextService

  constructor(
    secretContextService: SecretContextService,
    userContextService: UserContextService,
    globalContextService: GlobalContextService
  ) {
    this.secretContextService = secretContextService
    this.userContextService = userContextService
    this.globalContextService = globalContextService
  }

  /**
   * Get list of available MCP tools
   */
  getAvailableTools() {
    return {
      tools: CONTEXT_MANAGER_MCP_TOOLS.map(tool => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema._def // Zod schema definition
      }))
    }
  }

  /**
   * Execute an MCP tool call
   */
  async callTool(toolName: string, input: unknown): Promise<MCPToolResult> {
    try {
      switch (toolName) {
        // Secret Context Tools (Tier 1) 🔐
        case 'store_credential':
          return await this.storeCredential(input)
        case 'retrieve_credential':
          return await this.retrieveCredential(input)
        case 'store_ssh_key':
          return await this.storeSSHKey(input)
        case 'retrieve_ssh_key':
          return await this.retrieveSSHKey(input)
        case 'list_user_secrets':
          return await this.listUserSecrets(input)
        
        // User Context Tools (Tier 2) 👤
        case 'get_user_context':
          return await this.getUserContext(input)
        case 'update_user_preferences':
          return await this.updateUserPreferences(input)
        case 'add_deployment_pattern':
          return await this.addDeploymentPattern(input)
        case 'search_deployment_patterns':
          return await this.searchDeploymentPatterns(input)
        case 'record_infrastructure_event':
          return await this.recordInfrastructureEvent(input)
        
        // Global Context Tools (Tier 3) 🌐
        case 'submit_community_pattern':
          return await this.submitCommunityPattern(input)
        case 'get_community_patterns':
          return await this.getCommunityPatterns(input)
        case 'get_recommended_stack':
          return await this.getRecommendedStack(input)
        case 'submit_workflow_pattern':
          return await this.submitWorkflowPattern(input)
        
        default:
          return createMCPResult(`Unknown tool: ${toolName}`, true)
      }
    } catch (error) {
      console.error(`MCP tool error (${toolName}):`, error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      return createMCPResult(`Tool execution failed: ${errorMessage}`, true)
    }
  }

  // =================================
  // SECRET CONTEXT TOOLS (Tier 1) 🔐
  // =================================

  private async storeCredential(input: unknown): Promise<MCPToolResult> {
    const tool = CONTEXT_MANAGER_MCP_TOOLS.find(t => t.name === 'store_credential')!
    const params = validateMCPToolInput<typeof StoreCredentialSchema._type>(tool, input)

    try {
      // Use EXISTING secure credential storage - NO CHANGES to security
      await this.secretContextService.storeCredential(
        params.workspace_id,
        params.user_id,
        params.key,
        params.value,
        params.credential_type,
        params.provider,
        params.expires_at ? new Date(params.expires_at) : undefined
      )

      return createMCPResult(
        `Credential stored successfully.\n` +
        `Key: ${params.key}\n` +
        `Provider: ${params.provider}\n` +
        `Type: ${params.credential_type}\n` +
        `Workspace: ${params.workspace_id}\n` +
        `Expires: ${params.expires_at || 'Never'}`
      )
    } catch (error) {
      return createMCPResult(`Failed to store credential: ${error instanceof Error ? error.message : 'Unknown error'}`, true)
    }
  }

  private async retrieveCredential(input: unknown): Promise<MCPToolResult> {
    const tool = CONTEXT_MANAGER_MCP_TOOLS.find(t => t.name === 'retrieve_credential')!
    const params = validateMCPToolInput<typeof RetrieveCredentialSchema._type>(tool, input)

    try {
      // Use EXISTING secure credential retrieval - SAME SECURITY
      const credential = await this.secretContextService.getCredential(
        params.workspace_id,
        params.user_id,
        params.key
      )

      if (!credential) {
        return createMCPResult(`Credential '${params.key}' not found`, true)
      }

      return createMCPResult(
        `Credential retrieved successfully.\n` +
        `Key: ${params.key}\n` +
        `Value: ${credential}\n` +
        `Workspace: ${params.workspace_id}`
      )
    } catch (error) {
      return createMCPResult(`Failed to retrieve credential: ${error instanceof Error ? error.message : 'Unknown error'}`, true)
    }
  }

  private async storeSSHKey(input: unknown): Promise<MCPToolResult> {
    const tool = CONTEXT_MANAGER_MCP_TOOLS.find(t => t.name === 'store_ssh_key')!
    const params = validateMCPToolInput<typeof StoreSSHKeySchema._type>(tool, input)

    try {
      // Use EXISTING SSH key storage - SAME ENCRYPTION
      await this.secretContextService.storeSSHKey(
        params.workspace_id,
        params.user_id,
        params.key_name,
        params.private_key,
        params.public_key,
        params.key_type,
        params.metadata
      )

      return createMCPResult(
        `SSH key stored successfully.\n` +
        `Key Name: ${params.key_name}\n` +
        `Key Type: ${params.key_type}\n` +
        `Workspace: ${params.workspace_id}\n` +
        `Description: ${params.metadata?.description || 'None'}`
      )
    } catch (error) {
      return createMCPResult(`Failed to store SSH key: ${error instanceof Error ? error.message : 'Unknown error'}`, true)
    }
  }

  private async retrieveSSHKey(input: unknown): Promise<MCPToolResult> {
    const tool = CONTEXT_MANAGER_MCP_TOOLS.find(t => t.name === 'retrieve_ssh_key')!
    const params = validateMCPToolInput<typeof RetrieveSSHKeySchema._type>(tool, input)

    try {
      // Use EXISTING SSH key retrieval - SAME SECURITY
      const sshKey = await this.secretContextService.getSSHKey(
        params.workspace_id,
        params.user_id,
        params.key_name
      )

      if (!sshKey) {
        return createMCPResult(`SSH key '${params.key_name}' not found`, true)
      }

      return createMCPResult(
        `SSH key retrieved successfully.\n` +
        `Key Name: ${params.key_name}\n` +
        `Public Key: ${sshKey.publicKey}\n` +
        `Private Key: [REDACTED - Available in response object]\n` +
        `Fingerprint: ${sshKey.fingerprint}`
      )
    } catch (error) {
      return createMCPResult(`Failed to retrieve SSH key: ${error instanceof Error ? error.message : 'Unknown error'}`, true)
    }
  }

  private async listUserSecrets(input: unknown): Promise<MCPToolResult> {
    const tool = CONTEXT_MANAGER_MCP_TOOLS.find(t => t.name === 'list_user_secrets')!
    const params = validateMCPToolInput<typeof ListSecretsSchema._type>(tool, input)

    try {
      // Use EXISTING secret listing - SAME SECURITY
      const secrets = await this.secretContextService.listSecrets(params.workspace_id, params.user_id)

      // Handle the secrets structure properly
      const allSecrets = [
        ...secrets.credentials.map(cred => `credential: ${cred.key} (Provider: ${cred.provider})`),
        ...secrets.ssh_keys.map(key => `ssh_key: ${key.key} (Type: ${key.type})`),
        ...secrets.certificates.map(cert => `certificate: ${cert.key} (Type: ${cert.type})`)
      ]

      return createMCPResult(
        `User secrets (metadata only):\n` +
        `Workspace: ${params.workspace_id}\n` +
        `Total Secrets: ${allSecrets.length}\n\n` +
        `${allSecrets.join('\n') || 'No secrets found'}`
      )
    } catch (error) {
      return createMCPResult(`Failed to list secrets: ${error instanceof Error ? error.message : 'Unknown error'}`, true)
    }
  }

  // =================================
  // USER CONTEXT TOOLS (Tier 2) 👤
  // =================================

  private async getUserContext(input: unknown): Promise<MCPToolResult> {
    const tool = CONTEXT_MANAGER_MCP_TOOLS.find(t => t.name === 'get_user_context')!
    const params = validateMCPToolInput<typeof GetUserContextSchema._type>(tool, input)

    try {
      // Use EXISTING user context service
      const userContext = await this.userContextService.getUserContext(params.workspace_id, params.user_id)

      if (!userContext) {
        return createMCPResult(`User context not found for workspace: ${params.workspace_id}`, true)
      }

      return createMCPResult(
        `User Context Retrieved:\n` +
        `User ID: ${params.user_id}\n` +
        `Workspace: ${params.workspace_id}\n` +
        `Default Provider: ${userContext.preferences?.default_cloud_provider || 'Not set'}\n` +
        `Preferred Regions: ${userContext.preferences?.preferred_regions?.join(', ') || 'Not set'}\n` +
        `Theme: ${userContext.preferences?.ui_preferences?.theme || 'auto'}\n` +
        `Deployment Patterns: ${userContext.deployment_patterns?.length || 0} patterns\n` +
        `Context Created: ${userContext.created_at || 'Unknown'}`
      )
    } catch (error) {
      return createMCPResult(`Failed to get user context: ${error instanceof Error ? error.message : 'Unknown error'}`, true)
    }
  }

  private async updateUserPreferences(input: unknown): Promise<MCPToolResult> {
    const tool = CONTEXT_MANAGER_MCP_TOOLS.find(t => t.name === 'update_user_preferences')!
    const params = validateMCPToolInput<typeof UpdateUserPreferencesSchema._type>(tool, input)

    try {
      // Use EXISTING user preferences update
      const updatedContext = await this.userContextService.updateUserPreferences(
        params.workspace_id,
        params.user_id,
        params.preferences
      )

      return createMCPResult(
        `User preferences updated successfully.\n` +
        `Workspace: ${params.workspace_id}\n` +
        `Updated fields: ${Object.keys(params.preferences).join(', ')}\n` +
        `Default Provider: ${updatedContext.preferences?.default_cloud_provider || 'Not set'}\n` +
        `Preferred Regions: ${updatedContext.preferences?.preferred_regions?.join(', ') || 'Not set'}`
      )
    } catch (error) {
      return createMCPResult(`Failed to update preferences: ${error instanceof Error ? error.message : 'Unknown error'}`, true)
    }
  }

  private async addDeploymentPattern(input: unknown): Promise<MCPToolResult> {
    const tool = CONTEXT_MANAGER_MCP_TOOLS.find(t => t.name === 'add_deployment_pattern')!
    const params = validateMCPToolInput<typeof AddDeploymentPatternSchema._type>(tool, input)

    try {
      // Use EXISTING deployment pattern storage
      await this.userContextService.addDeploymentPattern(
        params.workspace_id,
        params.user_id,
        {
          ...params.pattern,
          last_used: new Date().toISOString()
        }
      )

      return createMCPResult(
        `Deployment pattern added successfully.\n` +
        `Pattern Name: ${params.pattern.name}\n` +
        `Type: ${params.pattern.pattern_type}\n` +
        `Success Rate: ${(params.pattern.success_rate * 100).toFixed(1)}%\n` +
        `Usage Count: ${params.pattern.usage_count}`
      )
    } catch (error) {
      return createMCPResult(`Failed to add deployment pattern: ${error instanceof Error ? error.message : 'Unknown error'}`, true)
    }
  }

  private async searchDeploymentPatterns(input: unknown): Promise<MCPToolResult> {
    const tool = CONTEXT_MANAGER_MCP_TOOLS.find(t => t.name === 'search_deployment_patterns')!
    const params = validateMCPToolInput<typeof SearchDeploymentPatternsSchema._type>(tool, input)

    try {
      // Use EXISTING pattern search
      const patterns = await this.userContextService.searchDeploymentPatterns(
        params.workspace_id,
        params.user_id,
        params.filters
      )

      const patternsInfo = patterns.map(pattern => 
        `${pattern.name} (${pattern.pattern_type}) - Success: ${(pattern.success_rate * 100).toFixed(1)}%`
      ).join('\n')

      return createMCPResult(
        `Deployment patterns found: ${patterns.length}\n` +
        `Search filters: ${JSON.stringify(params.filters, null, 2)}\n\n` +
        `${patternsInfo || 'No patterns match the criteria'}`
      )
    } catch (error) {
      return createMCPResult(`Failed to search patterns: ${error instanceof Error ? error.message : 'Unknown error'}`, true)
    }
  }

  private async recordInfrastructureEvent(input: unknown): Promise<MCPToolResult> {
    const tool = CONTEXT_MANAGER_MCP_TOOLS.find(t => t.name === 'record_infrastructure_event')!
    const params = validateMCPToolInput<typeof RecordInfrastructureEventSchema._type>(tool, input)

    try {
      // Use EXISTING event recording
      await this.userContextService.recordInfrastructureEvent(
        params.workspace_id,
        params.user_id,
        params.event
      )

      return createMCPResult(
        `Infrastructure event recorded successfully.\n` +
        `Event Type: ${params.event.event_type}\n` +
        `Resource Type: ${params.event.resource_type}\n` +
        `Provider: ${params.event.provider}\n` +
        `Status: ${params.event.status}\n` +
        `Cost Impact: $${params.event.cost_impact.toFixed(2)}\n` +
        `Duration: ${params.event.duration_ms}ms`
      )
    } catch (error) {
      return createMCPResult(`Failed to record event: ${error instanceof Error ? error.message : 'Unknown error'}`, true)
    }
  }

  // =================================
  // GLOBAL CONTEXT TOOLS (Tier 3) 🌐
  // =================================

  private async submitCommunityPattern(input: unknown): Promise<MCPToolResult> {
    const tool = CONTEXT_MANAGER_MCP_TOOLS.find(t => t.name === 'submit_community_pattern')!
    const params = validateMCPToolInput<typeof SubmitCommunityPatternSchema._type>(tool, input)

    try {
      const patternId = await this.globalContextService.submitCommunityPattern(params.pattern)

      return createMCPResult(
        `Community pattern submitted successfully.\n` +
        `Pattern ID: ${patternId}\n` +
        `Name: ${params.pattern.name}\n` +
        `Type: ${params.pattern.pattern_type}\n` +
        `Provider: ${params.pattern.provider}\n` +
        `Success Rate: ${(params.pattern.success_metrics.success_rate * 100).toFixed(1)}%\n` +
        `Thank you for contributing to the community knowledge base!`
      )
    } catch (error) {
      return createMCPResult(`Failed to submit pattern: ${error instanceof Error ? error.message : 'Unknown error'}`, true)
    }
  }

  private async getCommunityPatterns(input: unknown): Promise<MCPToolResult> {
    const tool = CONTEXT_MANAGER_MCP_TOOLS.find(t => t.name === 'get_community_patterns')!
    const params = validateMCPToolInput<typeof GetCommunityPatternsSchema._type>(tool, input)

    try {
      const patterns = await this.globalContextService.getCommunityPatterns(params.filters)

      const patternsInfo = patterns.slice(0, 10).map((pattern, index) => 
        `${index + 1}. ${pattern.name} (${pattern.provider})\n` +
        `   Type: ${pattern.pattern_type} | Success: ${(pattern.success_metrics.success_rate * 100).toFixed(1)}% | Usage: ${pattern.success_metrics.usage_count}\n` +
        `   Stack: ${pattern.tech_stack.join(', ')}\n` +
        `   ${pattern.description}`
      ).join('\n\n')

      return createMCPResult(
        `Community patterns found: ${patterns.length}\n` +
        `Applied filters: ${JSON.stringify(params.filters, null, 2)}\n\n` +
        `Top patterns:\n${patternsInfo || 'No patterns found'}`
      )
    } catch (error) {
      return createMCPResult(`Failed to get community patterns: ${error instanceof Error ? error.message : 'Unknown error'}`, true)
    }
  }

  private async getRecommendedStack(input: unknown): Promise<MCPToolResult> {
    const tool = CONTEXT_MANAGER_MCP_TOOLS.find(t => t.name === 'get_recommended_stack')!
    const params = validateMCPToolInput<typeof GetRecommendedStackSchema._type>(tool, input)

    try {
      const recommendations = await this.globalContextService.getRecommendedStack(params.requirements)

      const recommendationsInfo = recommendations.map((rec, index) => 
        `${index + 1}. ${rec.stack_name}\n` +
        `   ${rec.description}\n` +
        `   Components: ${rec.components.map(c => `${c.type}:${c.technology}`).join(', ')}\n` +
        `   Cost: $${rec.estimated_cost.monthly_minimum}-$${rec.estimated_cost.monthly_typical}/month\n` +
        `   Success Rate: ${(rec.success_rate * 100).toFixed(1)}% | Community Usage: ${rec.community_usage}`
      ).join('\n\n')

      return createMCPResult(
        `Stack recommendations for ${params.requirements.app_type}:\n` +
        `Traffic: ${params.requirements.expected_traffic} | Budget: ${params.requirements.budget_range}\n\n` +
        `${recommendationsInfo}`
      )
    } catch (error) {
      return createMCPResult(`Failed to get recommendations: ${error instanceof Error ? error.message : 'Unknown error'}`, true)
    }
  }

  private async submitWorkflowPattern(input: unknown): Promise<MCPToolResult> {
    const tool = CONTEXT_MANAGER_MCP_TOOLS.find(t => t.name === 'submit_workflow_pattern')!
    const params = validateMCPToolInput<typeof SubmitWorkflowPatternSchema._type>(tool, input)

    try {
      const workflowId = await this.globalContextService.submitWorkflowPattern(params.workflow)

      const stepsInfo = params.workflow.steps.map((step, index) => 
        `${index + 1}. ${step.step_name} (${step.agent}) - ${(step.success_rate * 100).toFixed(1)}%`
      ).join('\n')

      return createMCPResult(
        `Workflow pattern submitted successfully.\n` +
        `Workflow ID: ${workflowId}\n` +
        `Name: ${params.workflow.name}\n` +
        `Use Case: ${params.workflow.use_case}\n` +
        `Overall Success: ${(params.workflow.total_success_rate * 100).toFixed(1)}%\n` +
        `Average Duration: ${params.workflow.average_duration} minutes\n\n` +
        `Steps:\n${stepsInfo}\n\n` +
        `Thank you for sharing your workflow!`
      )
    } catch (error) {
      return createMCPResult(`Failed to submit workflow: ${error instanceof Error ? error.message : 'Unknown error'}`, true)
    }
  }
}

// Note: Export will be handled by routes.ts which creates the singleton instance