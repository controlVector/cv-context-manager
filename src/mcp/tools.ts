/**
 * MCP (Model Context Protocol) Tool Definitions for Context Manager
 * 
 * Three-tier architecture preserving existing secure credential system:
 * - Secret Context: Encrypted user credentials and tokens (existing system)
 * - User Context: User-specific preferences and history (existing system) 
 * - Global Context: Community knowledge base (new addition)
 */

import { z } from 'zod'

export interface MCPTool {
  name: string
  description: string
  inputSchema: z.ZodSchema
}

export interface MCPToolResult {
  content: Array<{
    type: 'text'
    text: string
  }>
  isError?: boolean
}

// =================================
// SECRET CONTEXT TOOLS (Tier 1) 🔐
// =================================

export const StoreCredentialSchema = z.object({
  key: z.string().describe("Credential identifier (e.g., 'digitalocean_token')"),
  value: z.string().describe("Encrypted credential value"),
  credential_type: z.enum(['oauth', 'api_key', 'password', 'token']).describe("Type of credential"),
  provider: z.string().describe("Provider name (e.g., 'digitalocean', 'aws')"),
  expires_at: z.string().datetime().optional().describe("Optional expiration datetime"),
  workspace_id: z.string().describe("Workspace identifier"),
  user_id: z.string().describe("User identifier"),
  jwt_token: z.string().describe("JWT token for authentication")
})

export const RetrieveCredentialSchema = z.object({
  key: z.string().describe("Credential identifier to retrieve"),
  workspace_id: z.string().describe("Workspace identifier"),
  user_id: z.string().describe("User identifier"),
  jwt_token: z.string().describe("JWT token for authentication")
})

export const StoreSSHKeySchema = z.object({
  key_name: z.string().describe("SSH key identifier"),
  private_key: z.string().describe("Private key content"),
  public_key: z.string().describe("Public key content"),
  key_type: z.enum(['rsa', 'ed25519', 'ecdsa']).describe("SSH key algorithm"),
  metadata: z.object({
    description: z.string().optional(),
    allowed_hosts: z.array(z.string()).optional()
  }).optional().describe("Optional key metadata"),
  workspace_id: z.string().describe("Workspace identifier"),
  user_id: z.string().describe("User identifier"),
  jwt_token: z.string().describe("JWT token for authentication")
})

export const RetrieveSSHKeySchema = z.object({
  key_name: z.string().describe("SSH key name to retrieve"),
  workspace_id: z.string().describe("Workspace identifier"),
  user_id: z.string().describe("User identifier"),
  jwt_token: z.string().describe("JWT token for authentication")
})

export const ListSecretsSchema = z.object({
  workspace_id: z.string().describe("Workspace identifier"),
  user_id: z.string().describe("User identifier"),
  jwt_token: z.string().describe("JWT token for authentication")
})

// =================================
// USER CONTEXT TOOLS (Tier 2) 👤
// =================================

export const GetUserContextSchema = z.object({
  workspace_id: z.string().describe("Workspace identifier"),
  user_id: z.string().describe("User identifier"),
  jwt_token: z.string().describe("JWT token for authentication")
})

export const UpdateUserPreferencesSchema = z.object({
  preferences: z.object({
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
  }).describe("User preference updates"),
  workspace_id: z.string().describe("Workspace identifier"),
  user_id: z.string().describe("User identifier"),
  jwt_token: z.string().describe("JWT token for authentication")
})

export const AddDeploymentPatternSchema = z.object({
  pattern: z.object({
    name: z.string().describe("Pattern name"),
    pattern_type: z.enum(['infrastructure', 'deployment', 'hybrid']),
    configuration: z.record(z.any()).describe("Pattern configuration"),
    success_rate: z.number().min(0).max(1).describe("Success rate (0-1)"),
    usage_count: z.number().min(0).default(1)
  }).describe("Deployment pattern to add"),
  workspace_id: z.string().describe("Workspace identifier"),
  user_id: z.string().describe("User identifier"),
  jwt_token: z.string().describe("JWT token for authentication")
})

export const SearchDeploymentPatternsSchema = z.object({
  filters: z.object({
    pattern_type: z.string().optional(),
    min_success_rate: z.number().optional(),
    name_contains: z.string().optional()
  }).describe("Search filters"),
  workspace_id: z.string().describe("Workspace identifier"),
  user_id: z.string().describe("User identifier"),
  jwt_token: z.string().describe("JWT token for authentication")
})

export const RecordInfrastructureEventSchema = z.object({
  event: z.object({
    event_type: z.enum(['provision', 'deploy', 'scale', 'delete', 'update']),
    resource_type: z.string().describe("Type of resource"),
    provider: z.string().describe("Cloud provider"),
    status: z.enum(['success', 'failed', 'pending']),
    configuration: z.record(z.any()).describe("Event configuration"),
    cost_impact: z.number().default(0).describe("Cost impact in USD"),
    duration_ms: z.number().min(0).describe("Duration in milliseconds"),
    metadata: z.record(z.any()).optional()
  }).describe("Infrastructure event details"),
  workspace_id: z.string().describe("Workspace identifier"),
  user_id: z.string().describe("User identifier"),
  jwt_token: z.string().describe("JWT token for authentication")
})

// =================================
// GLOBAL CONTEXT TOOLS (Tier 3) 🌐
// =================================

export const SubmitCommunityPatternSchema = z.object({
  pattern: z.object({
    name: z.string().describe("Pattern name"),
    pattern_type: z.enum(['infrastructure', 'deployment', 'stack', 'workflow']),
    description: z.string().describe("Pattern description"),
    configuration: z.record(z.any()).describe("Anonymous configuration"),
    success_metrics: z.object({
      success_rate: z.number().min(0).max(1),
      usage_count: z.number().min(1),
      cost_efficiency: z.number().optional(),
      performance_score: z.number().optional()
    }).describe("Success metrics"),
    tags: z.array(z.string()).describe("Search tags"),
    provider: z.string().describe("Cloud provider"),
    tech_stack: z.array(z.string()).describe("Technology stack")
  }).describe("Community pattern submission"),
  // Note: No user_id or jwt_token - anonymous submissions
  anonymous_id: z.string().optional().describe("Optional anonymous identifier")
})

export const GetCommunityPatternsSchema = z.object({
  filters: z.object({
    pattern_type: z.string().optional(),
    provider: z.string().optional(),
    tech_stack: z.array(z.string()).optional(),
    min_success_rate: z.number().optional(),
    tags: z.array(z.string()).optional(),
    limit: z.number().default(20)
  }).describe("Pattern search filters")
})

export const GetRecommendedStackSchema = z.object({
  requirements: z.object({
    app_type: z.enum(['web_app', 'api', 'static_site', 'microservice', 'data_pipeline']),
    expected_traffic: z.enum(['low', 'medium', 'high']),
    budget_range: z.enum(['minimal', 'moderate', 'enterprise']),
    tech_preferences: z.array(z.string()).optional(),
    provider_preference: z.string().optional()
  }).describe("Application requirements")
})

export const SubmitWorkflowPatternSchema = z.object({
  workflow: z.object({
    name: z.string().describe("Workflow name"),
    description: z.string().describe("Workflow description"), 
    steps: z.array(z.object({
      step_name: z.string(),
      agent: z.string().describe("Agent responsible for step"),
      command: z.string().describe("Command or operation"),
      success_rate: z.number().min(0).max(1)
    })).describe("Workflow steps"),
    use_case: z.string().describe("Primary use case"),
    total_success_rate: z.number().min(0).max(1),
    average_duration: z.number().describe("Average completion time in minutes")
  }).describe("Workflow pattern"),
  anonymous_id: z.string().optional().describe("Optional anonymous identifier")
})

// MCP Tool Definitions
export const CONTEXT_MANAGER_MCP_TOOLS: MCPTool[] = [
  // Secret Context Tools (Tier 1) 🔐
  {
    name: 'store_credential',
    description: 'Securely store encrypted user credentials and API tokens',
    inputSchema: StoreCredentialSchema
  },
  {
    name: 'retrieve_credential',
    description: 'Retrieve decrypted user credentials for API operations',
    inputSchema: RetrieveCredentialSchema
  },
  {
    name: 'store_ssh_key',
    description: 'Securely store encrypted SSH private/public key pairs',
    inputSchema: StoreSSHKeySchema
  },
  {
    name: 'retrieve_ssh_key',
    description: 'Retrieve SSH keys for deployment operations',
    inputSchema: RetrieveSSHKeySchema
  },
  {
    name: 'list_user_secrets',
    description: 'List metadata of stored credentials and SSH keys (no values)',
    inputSchema: ListSecretsSchema
  },
  
  // User Context Tools (Tier 2) 👤
  {
    name: 'get_user_context',
    description: 'Get user-specific context, preferences, and workspace data',
    inputSchema: GetUserContextSchema
  },
  {
    name: 'update_user_preferences',
    description: 'Update user preferences for cloud providers, regions, and UI settings',
    inputSchema: UpdateUserPreferencesSchema
  },
  {
    name: 'add_deployment_pattern',
    description: 'Add successful deployment pattern to user\'s knowledge base',
    inputSchema: AddDeploymentPatternSchema
  },
  {
    name: 'search_deployment_patterns',
    description: 'Search user\'s deployment patterns with filters',
    inputSchema: SearchDeploymentPatternsSchema
  },
  {
    name: 'record_infrastructure_event',
    description: 'Record infrastructure operation for user\'s history and analytics',
    inputSchema: RecordInfrastructureEventSchema
  },
  
  // Global Context Tools (Tier 3) 🌐
  {
    name: 'submit_community_pattern',
    description: 'Anonymously submit successful infrastructure pattern to community knowledge base',
    inputSchema: SubmitCommunityPatternSchema
  },
  {
    name: 'get_community_patterns',
    description: 'Search community-contributed infrastructure patterns',
    inputSchema: GetCommunityPatternsSchema
  },
  {
    name: 'get_recommended_stack',
    description: 'Get AI-recommended technology stack based on requirements and community data',
    inputSchema: GetRecommendedStackSchema
  },
  {
    name: 'submit_workflow_pattern',
    description: 'Anonymously contribute working agent workflow patterns',
    inputSchema: SubmitWorkflowPatternSchema
  }
]

// Helper functions
export function validateMCPToolInput<T>(tool: MCPTool, input: unknown): T {
  try {
    return tool.inputSchema.parse(input) as T
  } catch (error) {
    throw new Error(`Invalid input for tool '${tool.name}': ${error instanceof Error ? error.message : 'Unknown validation error'}`)
  }
}

export function createMCPResult(content: string, isError: boolean = false): MCPToolResult {
  return {
    content: [
      {
        type: 'text',
        text: content
      }
    ],
    isError
  }
}