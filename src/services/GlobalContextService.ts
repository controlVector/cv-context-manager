/**
 * Global Context Service - Community Knowledge Base
 * 
 * Manages anonymous community-contributed patterns and workflows
 * that help agents make better decisions across all users.
 */

export interface CommunityPattern {
  id: string
  name: string
  pattern_type: 'infrastructure' | 'deployment' | 'stack' | 'workflow'
  description: string
  configuration: Record<string, any>
  success_metrics: {
    success_rate: number
    usage_count: number
    cost_efficiency?: number
    performance_score?: number
  }
  tags: string[]
  provider: string
  tech_stack: string[]
  created_at: string
  updated_at: string
  anonymous_id?: string
}

export interface WorkflowPattern {
  id: string
  name: string
  description: string
  steps: Array<{
    step_name: string
    agent: string
    command: string
    success_rate: number
  }>
  use_case: string
  total_success_rate: number
  average_duration: number
  created_at: string
  anonymous_id?: string
}

export interface StackRecommendation {
  stack_name: string
  description: string
  components: Array<{
    type: string
    technology: string
    justification: string
  }>
  estimated_cost: {
    monthly_minimum: number
    monthly_typical: number
    currency: string
  }
  success_rate: number
  community_usage: number
}

export class GlobalContextService {
  // In-memory storage for development (replace with actual database in production)
  private communityPatterns: Map<string, CommunityPattern> = new Map()
  private workflowPatterns: Map<string, WorkflowPattern> = new Map()

  constructor() {
    // Initialize with some sample community patterns
    this.initializeSampleData()
  }

  /**
   * Submit anonymous community pattern
   */
  async submitCommunityPattern(pattern: Omit<CommunityPattern, 'id' | 'created_at' | 'updated_at'>): Promise<string> {
    const id = `pattern_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const now = new Date().toISOString()
    
    const communityPattern: CommunityPattern = {
      id,
      ...pattern,
      created_at: now,
      updated_at: now
    }

    this.communityPatterns.set(id, communityPattern)
    
    console.log(`[GlobalContext] New community pattern submitted: ${pattern.name} (${pattern.pattern_type})`)
    return id
  }

  /**
   * Get community patterns with filters
   */
  async getCommunityPatterns(filters: {
    pattern_type?: string
    provider?: string
    tech_stack?: string[]
    min_success_rate?: number
    tags?: string[]
    limit?: number
  }): Promise<CommunityPattern[]> {
    let patterns = Array.from(this.communityPatterns.values())

    // Apply filters
    if (filters.pattern_type) {
      patterns = patterns.filter(p => p.pattern_type === filters.pattern_type)
    }
    
    if (filters.provider) {
      patterns = patterns.filter(p => p.provider === filters.provider)
    }
    
    if (filters.tech_stack && filters.tech_stack.length > 0) {
      patterns = patterns.filter(p => 
        filters.tech_stack!.some(tech => p.tech_stack.includes(tech))
      )
    }
    
    if (filters.min_success_rate) {
      patterns = patterns.filter(p => p.success_metrics.success_rate >= filters.min_success_rate!)
    }
    
    if (filters.tags && filters.tags.length > 0) {
      patterns = patterns.filter(p => 
        filters.tags!.some(tag => p.tags.includes(tag))
      )
    }

    // Sort by success rate and usage count
    patterns.sort((a, b) => {
      const scoreA = a.success_metrics.success_rate * a.success_metrics.usage_count
      const scoreB = b.success_metrics.success_rate * b.success_metrics.usage_count
      return scoreB - scoreA
    })

    // Apply limit
    return patterns.slice(0, filters.limit || 20)
  }

  /**
   * Get recommended stack based on requirements
   */
  async getRecommendedStack(requirements: {
    app_type: 'web_app' | 'api' | 'static_site' | 'microservice' | 'data_pipeline'
    expected_traffic: 'low' | 'medium' | 'high'
    budget_range: 'minimal' | 'moderate' | 'enterprise'
    tech_preferences?: string[]
    provider_preference?: string
  }): Promise<StackRecommendation[]> {
    // Get patterns that match requirements
    const matchingPatterns = await this.getCommunityPatterns({
      pattern_type: 'stack',
      provider: requirements.provider_preference,
      tech_stack: requirements.tech_preferences,
      limit: 50
    })

    // Generate recommendations based on app type and patterns
    const recommendations: StackRecommendation[] = []

    // Basic recommendations based on app type
    switch (requirements.app_type) {
      case 'web_app':
        recommendations.push(...this.generateWebAppRecommendations(requirements, matchingPatterns))
        break
      case 'api':
        recommendations.push(...this.generateAPIRecommendations(requirements, matchingPatterns))
        break
      case 'static_site':
        recommendations.push(...this.generateStaticSiteRecommendations(requirements, matchingPatterns))
        break
      case 'microservice':
        recommendations.push(...this.generateMicroserviceRecommendations(requirements, matchingPatterns))
        break
      case 'data_pipeline':
        recommendations.push(...this.generateDataPipelineRecommendations(requirements, matchingPatterns))
        break
    }

    return recommendations.slice(0, 3) // Return top 3 recommendations
  }

  /**
   * Submit workflow pattern
   */
  async submitWorkflowPattern(workflow: Omit<WorkflowPattern, 'id' | 'created_at'>): Promise<string> {
    const id = `workflow_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const now = new Date().toISOString()
    
    const workflowPattern: WorkflowPattern = {
      id,
      ...workflow,
      created_at: now
    }

    this.workflowPatterns.set(id, workflowPattern)
    
    console.log(`[GlobalContext] New workflow pattern submitted: ${workflow.name}`)
    return id
  }

  /**
   * Get workflow patterns by use case
   */
  async getWorkflowPatterns(useCase?: string, limit: number = 10): Promise<WorkflowPattern[]> {
    let workflows = Array.from(this.workflowPatterns.values())

    if (useCase) {
      workflows = workflows.filter(w => w.use_case.toLowerCase().includes(useCase.toLowerCase()))
    }

    // Sort by success rate and duration (prefer faster, more successful workflows)
    workflows.sort((a, b) => {
      const scoreA = a.total_success_rate / (a.average_duration / 60) // success per minute
      const scoreB = b.total_success_rate / (b.average_duration / 60)
      return scoreB - scoreA
    })

    return workflows.slice(0, limit)
  }

  // Private helper methods for generating recommendations
  private generateWebAppRecommendations(requirements: any, patterns: CommunityPattern[]): StackRecommendation[] {
    const recommendations: StackRecommendation[] = []

    // React + Node.js + PostgreSQL stack
    recommendations.push({
      stack_name: "Modern Web App Stack",
      description: "React frontend with Node.js API and PostgreSQL database",
      components: [
        { type: "frontend", technology: "React", justification: "Popular, component-based, large ecosystem" },
        { type: "api", technology: "Node.js + Express", justification: "JavaScript everywhere, fast development" },
        { type: "database", technology: "PostgreSQL", justification: "Reliable, ACID compliant, good performance" },
        { type: "hosting", technology: "DigitalOcean Droplet", justification: "Cost-effective, simple deployment" }
      ],
      estimated_cost: {
        monthly_minimum: 20,
        monthly_typical: 60,
        currency: "USD"
      },
      success_rate: 0.85,
      community_usage: 127
    })

    return recommendations
  }

  private generateAPIRecommendations(requirements: any, patterns: CommunityPattern[]): StackRecommendation[] {
    return [{
      stack_name: "Lightweight API Stack",
      description: "Fast Node.js API with Redis caching",
      components: [
        { type: "api", technology: "Node.js + Fastify", justification: "High performance, low overhead" },
        { type: "database", technology: "PostgreSQL", justification: "Reliable data storage" },
        { type: "cache", technology: "Redis", justification: "Fast data caching and sessions" }
      ],
      estimated_cost: {
        monthly_minimum: 15,
        monthly_typical: 45,
        currency: "USD"
      },
      success_rate: 0.92,
      community_usage: 89
    }]
  }

  private generateStaticSiteRecommendations(requirements: any, patterns: CommunityPattern[]): StackRecommendation[] {
    return [{
      stack_name: "Static Site Stack",
      description: "Static site with CDN deployment",
      components: [
        { type: "generator", technology: "Next.js", justification: "Static generation with React" },
        { type: "hosting", technology: "DigitalOcean Spaces + CDN", justification: "Cost-effective static hosting" }
      ],
      estimated_cost: {
        monthly_minimum: 5,
        monthly_typical: 15,
        currency: "USD"
      },
      success_rate: 0.95,
      community_usage: 203
    }]
  }

  private generateMicroserviceRecommendations(requirements: any, patterns: CommunityPattern[]): StackRecommendation[] {
    return [{
      stack_name: "Container Microservice Stack",
      description: "Docker containers with load balancing",
      components: [
        { type: "runtime", technology: "Docker + Node.js", justification: "Containerized, scalable services" },
        { type: "orchestration", technology: "Docker Swarm", justification: "Simple container orchestration" },
        { type: "load_balancer", technology: "DigitalOcean Load Balancer", justification: "Managed load balancing" },
        { type: "database", technology: "PostgreSQL", justification: "Shared data layer" }
      ],
      estimated_cost: {
        monthly_minimum: 40,
        monthly_typical: 120,
        currency: "USD"
      },
      success_rate: 0.78,
      community_usage: 64
    }]
  }

  private generateDataPipelineRecommendations(requirements: any, patterns: CommunityPattern[]): StackRecommendation[] {
    return [{
      stack_name: "Data Pipeline Stack",
      description: "Python-based data processing pipeline",
      components: [
        { type: "processing", technology: "Python + Pandas", justification: "Powerful data processing capabilities" },
        { type: "database", technology: "PostgreSQL", justification: "Structured data storage" },
        { type: "queue", technology: "Redis", justification: "Task queue and caching" },
        { type: "compute", technology: "DigitalOcean CPU-Optimized", justification: "High-performance computing" }
      ],
      estimated_cost: {
        monthly_minimum: 30,
        monthly_typical: 90,
        currency: "USD"
      },
      success_rate: 0.82,
      community_usage: 42
    }]
  }

  /**
   * Initialize sample data for development
   */
  private initializeSampleData() {
    // Add sample community patterns
    const samplePatterns: Array<Omit<CommunityPattern, 'id' | 'created_at' | 'updated_at'>> = [
      {
        name: "Node.js + PostgreSQL + Redis",
        pattern_type: "stack",
        description: "Full-stack web application with caching",
        configuration: {
          frontend: "React",
          api: "Node.js + Express",
          database: "PostgreSQL",
          cache: "Redis"
        },
        success_metrics: {
          success_rate: 0.89,
          usage_count: 156,
          cost_efficiency: 0.92
        },
        tags: ["web-app", "javascript", "database", "cache"],
        provider: "digitalocean",
        tech_stack: ["nodejs", "react", "postgresql", "redis"]
      },
      {
        name: "Static Site + CDN",
        pattern_type: "infrastructure",
        description: "Static site hosting with global CDN",
        configuration: {
          hosting: "DigitalOcean Spaces",
          cdn: "DigitalOcean CDN",
          ssl: "Let's Encrypt"
        },
        success_metrics: {
          success_rate: 0.96,
          usage_count: 289,
          cost_efficiency: 0.98
        },
        tags: ["static", "cdn", "low-cost"],
        provider: "digitalocean",
        tech_stack: ["html", "css", "javascript"]
      }
    ]

    samplePatterns.forEach(pattern => {
      this.submitCommunityPattern(pattern)
    })

    // Add sample workflow patterns
    const sampleWorkflows: Array<Omit<WorkflowPattern, 'id' | 'created_at'>> = [
      {
        name: "Full Stack Deployment",
        description: "Complete deployment workflow for web applications",
        steps: [
          { step_name: "Provision Infrastructure", agent: "Atlas", command: "provision_infrastructure", success_rate: 0.94 },
          { step_name: "Setup Database", agent: "Perseus", command: "deploy_database", success_rate: 0.89 },
          { step_name: "Deploy Application", agent: "Phoenix", command: "deploy_application", success_rate: 0.91 },
          { step_name: "Configure Monitoring", agent: "Sentinel", command: "setup_monitoring", success_rate: 0.87 }
        ],
        use_case: "web application deployment",
        total_success_rate: 0.88,
        average_duration: 12.5
      }
    ]

    sampleWorkflows.forEach(workflow => {
      this.submitWorkflowPattern(workflow)
    })
  }
}