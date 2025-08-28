/**
 * Deployment Session Context Types
 * 
 * Provides persistent session management for deployment workflows
 * to maintain state across conversation turns and prevent context loss
 */

export interface DeploymentTarget {
  repository_url: string
  branch: string
  application_name: string
  target_domain: string
  framework?: string // 'fastapi', 'express', 'django', etc.
}

export interface InfrastructureState {
  provider: string // 'digitalocean', 'aws', etc.
  droplet_id?: string
  droplet_name?: string
  ip_address?: string
  region?: string
  size?: string
  ssh_key_id?: string
  ssh_key_name?: string
  ssh_public_key?: string
  ssh_connection_established?: boolean
  created_at?: Date
}

export interface DNSState {
  provider: string // 'cloudflare', 'route53', etc.
  zone_id?: string
  record_id?: string
  domain_configured?: boolean
  dns_propagated?: boolean
  ssl_configured?: boolean
  ssl_provider?: string // 'letsencrypt', 'cloudflare', etc.
  certificate_id?: string
}

export interface ServiceState {
  application_deployed?: boolean
  application_running?: boolean
  nginx_configured?: boolean
  nginx_running?: boolean
  firewall_configured?: boolean
  systemd_service_name?: string
  application_port?: number
  public_port?: number
  health_check_endpoint?: string
  last_health_check?: Date
  health_status?: 'healthy' | 'unhealthy' | 'unknown'
}

export interface DeploymentStep {
  step_name: string
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped'
  started_at?: Date
  completed_at?: Date
  error_message?: string
  tool_calls?: string[]
  result?: any
}

export interface DeploymentSessionContext {
  session_id: string
  conversation_id?: string // Link to Watson conversation
  user_id: string
  workspace_id: string
  
  // Deployment target info
  deployment_target: DeploymentTarget
  
  // Infrastructure state tracking
  infrastructure_state: InfrastructureState
  
  // DNS and SSL state
  dns_state: DNSState
  
  // Application service state
  service_state: ServiceState
  
  // Deployment workflow tracking
  deployment_steps: DeploymentStep[]
  current_step?: string
  
  // Session metadata
  created_at: Date
  updated_at: Date
  expires_at?: Date // Sessions expire after 24 hours of inactivity
  status: 'planning' | 'in_progress' | 'completed' | 'failed' | 'abandoned'
  
  // Error tracking
  error_count: number
  last_error?: string
  
  // Additional context
  notes?: string[]
  metadata?: Record<string, any>
}

export interface SessionUpdate {
  infrastructure_state?: Partial<InfrastructureState>
  dns_state?: Partial<DNSState>
  service_state?: Partial<ServiceState>
  current_step?: string
  status?: DeploymentSessionContext['status']
  error_message?: string
  notes?: string[]
  metadata?: Record<string, any>
}

export interface SessionQuery {
  user_id?: string
  workspace_id?: string
  status?: DeploymentSessionContext['status']
  domain?: string
  ip_address?: string
  created_after?: Date
  created_before?: Date
}