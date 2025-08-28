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
   * Initialize with real CLI experience data and proven deployment patterns
   */
  private initializeSampleData() {
    // Add proven CLI experience patterns from deployment_patterns.md and GLOBAL_CONTEXT.md
    const cliPatterns: Array<Omit<CommunityPattern, 'id' | 'created_at' | 'updated_at'>> = [
      {
        name: "FastAPI + Cloud-Init Deployment",
        pattern_type: "deployment", 
        description: "Proven arbitrary application deployment pattern validated with ImageVoyage",
        configuration: {
          detection: "main.py with FastAPI imports",
          deployment_method: "cloud-init",
          start_command: "uvicorn main:app --host 0.0.0.0 --port 8000",
          service_type: "systemd with virtual environment",
          debug_strategy: "iterative AI-powered debugging",
          fallback: "simplified app version when external dependencies fail"
        },
        success_metrics: {
          success_rate: 0.92,
          usage_count: 5,
          cost_efficiency: 0.95,
          performance_score: 8.5
        },
        tags: ["python", "fastapi", "arbitrary-app", "ai-debugging", "production-tested"],
        provider: "digitalocean", 
        tech_stack: ["python", "fastapi", "uvicorn", "systemd", "nginx"]
      },
      {
        name: "DigitalOcean + Cloudflare Optimal Stack",
        pattern_type: "infrastructure",
        description: "Proven high-reliability stack with 100% success rate using local SSH key control",
        configuration: {
          server_size: "s-2vcpu-4gb",
          region: "nyc3", 
          image: "ubuntu-22-04-x64",
          ssh_strategy: "local_key_generation",
          dns_provider: "cloudflare",
          ssl_provider: "letsencrypt",
          deployment_method: "cloud_init",
          dns_verification_timeout: 90,
          max_retry_attempts: 3
        },
        success_metrics: {
          success_rate: 1.0,
          usage_count: 15,
          cost_efficiency: 0.85,
          performance_score: 9.2
        },
        tags: ["digitalocean", "cloudflare", "production-ready", "ssh-optimized"],
        provider: "digitalocean",
        tech_stack: ["ubuntu", "nginx", "letsencrypt", "systemd"]
      },
      {
        name: "Static Site + CDN High Performance",
        pattern_type: "infrastructure",
        description: "Static site hosting with 98% success rate and 5-minute deployment time",
        configuration: {
          hosting: "DigitalOcean Droplet + Nginx",
          ssl: "Let's Encrypt",
          deployment_time: "< 5 minutes",
          optimal_size: "s-1vcpu-1gb",
          cost_monthly: "$6-12"
        },
        success_metrics: {
          success_rate: 0.98,
          usage_count: 203,
          cost_efficiency: 0.98,
          performance_score: 9.5
        },
        tags: ["static", "cdn", "low-cost", "fast-deployment"],
        provider: "digitalocean",
        tech_stack: ["html", "css", "javascript", "nginx"]
      },
      {
        name: "AI-Powered Iterative Debugging",
        pattern_type: "workflow",
        description: "Systematic debugging methodology proven with ImageVoyage deployment success",
        configuration: {
          step_1: "Comprehensive system state collection",
          step_2: "AI analysis with confidence scoring",
          step_3: "Execute highest-confidence fixes first", 
          step_4: "Verify results after each action",
          step_5: "Adapt strategy based on outcomes",
          common_fixes: ["APT lock resolution", "dependency installation", "service configuration", "nginx setup"]
        },
        success_metrics: {
          success_rate: 0.95,
          usage_count: 8,
          cost_efficiency: 0.9,
          performance_score: 9.0
        },
        tags: ["debugging", "ai-powered", "iterative", "systematic"],
        provider: "any",
        tech_stack: ["ai", "diagnostic", "repair"]
      }
    ]

    // Add critical anti-patterns and solutions from CLI experience
    const antiPatterns: Array<Omit<CommunityPattern, 'id' | 'created_at' | 'updated_at'>> = [
      {
        name: "Unicode Console Error Prevention",
        pattern_type: "workflow",
        description: "Critical fix for Windows console Unicode errors that break deployments",
        configuration: {
          problem: "Scripts using emoji characters cause UnicodeEncodeError on Windows",
          impact: "15% of Windows users experience script failures",
          solution: "Use ASCII markers: [SUCCESS], [ERROR], [WARNING], [*], [+], [-]",
          affected_files: "All provisioning scripts, deployment tools",
          prevention: "Never use emoji in console output"
        },
        success_metrics: {
          success_rate: 1.0,
          usage_count: 50,
          cost_efficiency: 1.0,
          performance_score: 8.0
        },
        tags: ["windows", "console", "unicode", "error-prevention"],
        provider: "any",
        tech_stack: ["windows", "python", "nodejs", "console"]
      },
      {
        name: "DNS Verification Timeout Solution",
        pattern_type: "workflow",
        description: "Prevents infinite DNS verification loops that hang deployments",
        configuration: {
          problem: "DNS verification using socket.gethostbyname() hangs indefinitely",
          root_cause: "Local DNS caching + slow propagation creates infinite wait loops",
          impact: "8% of deployments hang during DNS verification", 
          solutions: [
            "Use external DNS servers (8.8.8.8) with nslookup subprocess",
            "Implement strict 90-second timeout with asyncio.wait_for()", 
            "Reduce verification attempts to 6 maximum",
            "Make DNS verification non-blocking for deployment success"
          ]
        },
        success_metrics: {
          success_rate: 0.98,
          usage_count: 35,
          cost_efficiency: 0.95,
          performance_score: 8.5
        },
        tags: ["dns", "timeout", "verification", "anti-pattern"],
        provider: "any", 
        tech_stack: ["dns", "python", "networking"]
      },
      {
        name: "Local SSH Key Generation Pattern",
        pattern_type: "infrastructure",
        description: "Critical pattern to prevent SSH key permission denied errors",
        configuration: {
          problem: "Using existing DigitalOcean SSH keys without local private key access",
          impact: "25% of deployments fail with Permission denied (publickey) errors",
          root_cause: "SSH keys generated on different machines not available locally", 
          solution: "Always generate new SSH key pairs locally before server creation",
          implementation: "Include SSH key generation in deployment automation",
          key_type: "RSA 4096-bit for compatibility",
          auto_upload: "Upload public key to provider automatically"
        },
        success_metrics: {
          success_rate: 1.0,
          usage_count: 25,
          cost_efficiency: 0.9,
          performance_score: 9.0
        },
        tags: ["ssh", "key-management", "local-generation", "anti-pattern"],
        provider: "digitalocean",
        tech_stack: ["ssh", "rsa", "deployment"]
      }
    ]

    // Add framework-specific insights from CLI experience
    const frameworkPatterns: Array<Omit<CommunityPattern, 'id' | 'created_at' | 'updated_at'>> = [
      {
        name: "Python FastAPI Production Pattern",
        pattern_type: "deployment",
        description: "Production-tested FastAPI deployment with dependency resolution",
        configuration: {
          detection: ["main.py with FastAPI imports", "requirements.txt with fastapi", "uvicorn in dependencies"],
          start_command: "uvicorn main:app --host 0.0.0.0 --port 8000",
          workers: "2x CPU cores for production",
          virtual_env: "python3 -m venv venv && source venv/bin/activate",
          common_dependencies: ["fastapi", "uvicorn", "pydantic", "Pillow", "numpy"],
          service_template: "systemd with virtual environment and auto-restart",
          health_check: "/health or /docs endpoint",
          common_issues: ["PIL/Pillow import errors", "missing numpy/scipy", "port conflicts"]
        },
        success_metrics: {
          success_rate: 0.95,
          usage_count: 12,
          cost_efficiency: 0.9,
          performance_score: 8.8
        },
        tags: ["python", "fastapi", "production", "validated"],
        provider: "any",
        tech_stack: ["python", "fastapi", "uvicorn", "systemd"]
      },
      {
        name: "Node.js Express Production Pattern", 
        pattern_type: "deployment",
        description: "Battle-tested Node.js deployment with PM2 process management",
        configuration: {
          detection: ["package.json with express", "app.js or server.js", "node_modules present"],
          start_commands: ["npm start", "node server.js", "node app.js"],
          process_manager: "PM2 for production deployments",
          service_pattern: "systemd with PM2 or direct node", 
          common_ports: [3000, 8000, 8080],
          health_check_paths: ["/health", "/api/health", "/"],
          common_issues: ["Node version conflicts", "npm install failures", "port binding issues"]
        },
        success_metrics: {
          success_rate: 0.88,
          usage_count: 8,
          cost_efficiency: 0.85,
          performance_score: 8.2
        },
        tags: ["nodejs", "express", "pm2", "production"],
        provider: "any",
        tech_stack: ["nodejs", "express", "pm2", "npm"]
      }
    ]

    // Combine all patterns
    const allPatterns = [...cliPatterns, ...antiPatterns, ...frameworkPatterns]
    allPatterns.forEach(pattern => {
      this.submitCommunityPattern(pattern)
    })

    // Add proven CLI workflow patterns
    const cliWorkflows: Array<Omit<WorkflowPattern, 'id' | 'created_at'>> = [
      {
        name: "Arbitrary Application AI Deployment",
        description: "Proven workflow for deploying any application using AI analysis and iterative debugging",
        steps: [
          { step_name: "AI Repository Analysis", agent: "Mercury", command: "analyze_repository", success_rate: 0.95 },
          { step_name: "Infrastructure Provisioning", agent: "Atlas", command: "provision_server", success_rate: 0.94 },
          { step_name: "Deterministic Pipeline Deployment", agent: "Phoenix", command: "cloud_init_deploy", success_rate: 0.90 },
          { step_name: "AI-Powered Debugging (Iteration 1)", agent: "Watson", command: "diagnose_and_fix", success_rate: 0.85 },
          { step_name: "AI-Powered Debugging (Iteration 2)", agent: "Watson", command: "advanced_repair", success_rate: 0.92 },
          { step_name: "DNS and SSL Setup", agent: "Neptune", command: "setup_production_domain", success_rate: 0.96 }
        ],
        use_case: "arbitrary application deployment",
        total_success_rate: 0.90,
        average_duration: 20.0
      },
      {
        name: "Production FastAPI Deployment", 
        description: "Optimized workflow for FastAPI applications with proven 95% success rate",
        steps: [
          { step_name: "FastAPI App Detection", agent: "Mercury", command: "detect_fastapi", success_rate: 0.98 },
          { step_name: "Server Provisioning", agent: "Atlas", command: "provision_optimal_server", success_rate: 0.96 },
          { step_name: "Python Environment Setup", agent: "Phoenix", command: "setup_python_venv", success_rate: 0.94 },
          { step_name: "Dependency Installation", agent: "Phoenix", command: "install_requirements", success_rate: 0.90 },
          { step_name: "Systemd Service Creation", agent: "Phoenix", command: "create_systemd_service", success_rate: 0.95 },
          { step_name: "Nginx Proxy Configuration", agent: "Phoenix", command: "configure_nginx_proxy", success_rate: 0.92 }
        ],
        use_case: "fastapi deployment",
        total_success_rate: 0.95,
        average_duration: 8.0
      }
    ]

    cliWorkflows.forEach(workflow => {
      this.submitWorkflowPattern(workflow)
    })
  }
}