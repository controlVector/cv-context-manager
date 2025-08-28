// Core Context Types for ControlVector Context Manager
export interface ContextTier {
  secret: SecretContext
  user: UserContext
  global: GlobalContext
}

// Secret Context - Encrypted sensitive data
export interface SecretContext {
  id: string
  workspace_id: string
  user_id: string
  api_keys: Record<string, EncryptedValue>
  credentials: Record<string, EncryptedCredential>
  ssh_keys: Record<string, EncryptedSSHKey>
  certificates: Record<string, EncryptedCertificate>
  created_at: string
  updated_at: string
  expires_at?: string
}

export interface EncryptedValue {
  encrypted_data: string
  algorithm: string
  iv: string
  created_at: string
  expires_at?: string
}

export interface EncryptedCredential extends EncryptedValue {
  credential_type: 'oauth' | 'api_key' | 'password' | 'token'
  provider: string
  metadata?: Record<string, any>
}

export interface EncryptedSSHKey extends EncryptedValue {
  key_type: 'rsa' | 'ed25519' | 'ecdsa'
  public_key: string
  fingerprint: string
  metadata?: {
    description?: string
    allowed_hosts?: string[]
  }
}

export interface EncryptedCertificate extends EncryptedValue {
  certificate_type: 'ssl' | 'client' | 'ca'
  common_name: string
  expires_at: string
  metadata?: Record<string, any>
}

// User Context - User-specific preferences and history
export interface UserContext {
  id: string
  workspace_id: string
  user_id: string
  preferences: UserPreferences
  deployment_patterns: DeploymentPattern[]
  infrastructure_history: InfrastructureEvent[]
  conversation_context: ConversationContext[]
  deployment_sessions?: DeploymentSession[]
  settings: UserSettings
  created_at: string
  updated_at: string
}

export interface UserPreferences {
  default_cloud_provider?: string
  preferred_regions?: string[]
  cost_limits?: {
    daily_limit?: number
    monthly_limit?: number
    alert_threshold?: number
  }
  notification_preferences?: {
    channels?: ('email' | 'slack' | 'webhook')[]
    quiet_hours?: {
      start: string
      end: string
      timezone: string
    }
  }
  ui_preferences?: {
    theme?: 'light' | 'dark' | 'auto'
    sidebar_collapsed?: boolean
    default_view?: string
  }
}

export interface DeploymentPattern {
  id: string
  name: string
  pattern_type: 'infrastructure' | 'deployment' | 'hybrid'
  configuration: Record<string, any>
  success_rate: number
  usage_count: number
  last_used: string
  created_at: string
}

export interface InfrastructureEvent {
  id: string
  event_type: 'provision' | 'deploy' | 'scale' | 'delete' | 'update'
  resource_type: string
  provider: string
  status: 'success' | 'failed' | 'pending'
  configuration: Record<string, any>
  cost_impact: number
  duration_ms: number
  timestamp: string
  metadata?: Record<string, any>
}

export interface ConversationContext {
  id: string
  session_id: string
  message_content: string
  intent_analysis: {
    primary_intent: string
    confidence: number
    entities: Record<string, any>
  }
  agent_responses: {
    agent_type: string
    response: string
    confidence: number
  }[]
  outcome: {
    status: 'success' | 'failed' | 'partial'
    actions_taken: string[]
    resources_affected: string[]
  }
  timestamp: string
}

export interface DeploymentSession {
  id: string
  workspace_id: string
  user_id: string
  session_name: string
  deployment_context: {
    target_repository?: string
    deployment_config?: any
    infrastructure_requirements?: any
    domain_config?: any
    current_step?: string
    progress_status?: 'initializing' | 'provisioning' | 'configuring' | 'deploying' | 'completed' | 'failed'
    error_context?: string
    last_prompt?: string
    next_suggested_action?: string
  }
  active_resources: Array<{
    provider: string
    resource_type: string
    resource_id: string
    resource_name: string
    status: string
    estimated_cost?: number
    created_at: string
  }>
  session_state: 'active' | 'paused' | 'completed' | 'failed'
  created_at: string
  updated_at: string
  expires_at: string
  metadata?: {
    cli_poc_patterns?: string[]
    watson_conversation_id?: string
    user_preferences?: any
  }
}

export interface UserSettings {
  security: {
    mfa_enabled: boolean
    session_timeout: number
    ip_restrictions: string[]
  }
  workspace: {
    default_workspace_id: string
    workspace_permissions: Record<string, string[]>
  }
  integrations: {
    enabled_providers: string[]
    webhook_endpoints: string[]
  }
}

// Global Context - System-wide intelligence and patterns
export interface GlobalContext {
  id: string
  context_type: 'pattern' | 'metric' | 'intelligence' | 'template'
  category: string
  data: GlobalContextData
  confidence_score: number
  usage_count: number
  success_rate: number
  created_at: string
  updated_at: string
  tags: string[]
}

export type GlobalContextData =
  | DeploymentPatternData
  | CostOptimizationData
  | FailurePatternData
  | AgentPerformanceData
  | SecurityIntelligenceData
  | InfrastructureTemplateData

export interface DeploymentPatternData {
  pattern_name: string
  infrastructure_config: Record<string, any>
  deployment_config: Record<string, any>
  success_metrics: {
    deployment_time_avg: number
    failure_rate: number
    rollback_rate: number
    cost_efficiency: number
  }
  recommended_for: string[]
  anti_patterns: string[]
}

export interface CostOptimizationData {
  optimization_type: 'instance_sizing' | 'region_selection' | 'resource_scheduling'
  provider: string
  resource_type: string
  optimization_rules: {
    condition: Record<string, any>
    action: Record<string, any>
    expected_savings: number
  }[]
  verified_savings: number
  adoption_rate: number
}

export interface FailurePatternData {
  failure_type: string
  common_causes: string[]
  indicators: {
    metric: string
    threshold: number
    operator: 'gt' | 'lt' | 'eq' | 'ne'
  }[]
  mitigation_strategies: string[]
  prevention_steps: string[]
}

export interface AgentPerformanceData {
  agent_type: string
  performance_metrics: {
    avg_response_time: number
    success_rate: number
    user_satisfaction: number
    error_rate: number
  }
  optimization_suggestions: string[]
  training_data_quality: number
}

export interface SecurityIntelligenceData {
  threat_type: string
  threat_indicators: Record<string, any>
  severity: 'low' | 'medium' | 'high' | 'critical'
  affected_components: string[]
  mitigation_steps: string[]
  detection_rules: Record<string, any>
}

export interface InfrastructureTemplateData {
  template_name: string
  template_type: 'terraform' | 'cloudformation' | 'kubernetes' | 'docker-compose'
  provider: string
  template_content: string
  variables: Record<string, {
    type: string
    description: string
    default?: any
    required: boolean
  }>
  estimated_cost: {
    hourly: number
    monthly: number
    currency: string
  }
}

// API Types
export interface ContextRequest {
  workspace_id: string
  user_id: string
  context_type: 'secret' | 'user' | 'global'
  operation: 'get' | 'set' | 'update' | 'delete' | 'search'
  key?: string
  data?: any
  filters?: Record<string, any>
}

export interface ContextResponse<T = any> {
  success: boolean
  data?: T
  error?: {
    code: string
    message: string
    details?: Record<string, any>
  }
  metadata?: {
    total_count?: number
    page?: number
    limit?: number
    cached?: boolean
    encryption_info?: {
      algorithm: string
      key_version: string
    }
  }
}

// Database Types
export interface DatabaseConfig {
  host: string
  port: number
  database: string
  username: string
  password: string
  ssl?: boolean
  pool_size?: number
}

export interface EncryptionConfig {
  algorithm: string
  key: string
  iv_length: number
  tag_length: number
  key_rotation_interval: number
}

// Cache Types  
export interface CacheConfig {
  ttl: number
  max_size: number
  prefix: string
}

// Audit Types
export interface AuditLog {
  id: string
  workspace_id: string
  user_id: string
  operation: string
  context_type: 'secret' | 'user' | 'global'
  resource_key: string
  old_value_hash?: string
  new_value_hash?: string
  ip_address: string
  user_agent: string
  timestamp: string
  status: 'success' | 'failed'
  error_message?: string
}