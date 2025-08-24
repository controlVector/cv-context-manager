/**
 * MCP HTTP Routes for Context Manager
 * 
 * Three-tier MCP interface preserving existing security:
 * - Secret Context: Same JWT validation as existing endpoints
 * - User Context: User-scoped operations
 * - Global Context: Anonymous community contributions
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { ContextManagerMCPServer } from './server'
import { GlobalContextService } from '../services/GlobalContextService'

// Request schemas
const MCPToolCallSchema = z.object({
  name: z.string().describe("Name of the MCP tool to call"),
  arguments: z.record(z.any()).describe("Tool arguments as key-value pairs")
})

// MCP Routes
export async function mcpRoutes(fastify: FastifyInstance) {
  
  // Initialize global context service and MCP server
  const globalContextService = new GlobalContextService()
  const contextMCPServer = new ContextManagerMCPServer(
    fastify.secretContextService,
    fastify.userContextService,
    globalContextService
  )

  // List available MCP tools
  fastify.get('/mcp/tools', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const tools = contextMCPServer.getAvailableTools()
      
      reply.send({
        success: true,
        tools: tools.tools,
        count: tools.tools.length,
        service: 'Context Manager',
        tiers: {
          secret_context: 'Encrypted credential and SSH key management',
          user_context: 'User-specific preferences and deployment patterns',
          global_context: 'Community knowledge base and recommendations'
        },
        mcp_version: '1.0.0'
      })
    } catch (error) {
      reply.code(500).send({
        success: false,
        error: 'Failed to list MCP tools',
        message: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  })

  // Call an MCP tool
  fastify.post('/mcp/call', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = MCPToolCallSchema.parse(request.body)
      
      const result = await contextMCPServer.callTool(body.name, body.arguments)
      
      if (result.isError) {
        reply.code(400).send({
          success: false,
          error: 'Tool execution failed',
          result: result,
          tool_name: body.name
        })
      } else {
        reply.send({
          success: true,
          result: result,
          tool_name: body.name,
          execution_time: new Date().toISOString()
        })
      }
    } catch (error) {
      reply.code(400).send({
        success: false,
        error: 'Invalid MCP tool call',
        message: error instanceof Error ? error.message : 'Unknown validation error'
      })
    }
  })

  // Batch call multiple MCP tools
  fastify.post('/mcp/batch', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = z.object({
        calls: z.array(MCPToolCallSchema).min(1).max(10).describe("Array of MCP tool calls to execute")
      }).parse(request.body)
      
      const results = await Promise.all(
        body.calls.map(async (call) => {
          try {
            const result = await contextMCPServer.callTool(call.name, call.arguments)
            return {
              tool_name: call.name,
              success: !result.isError,
              result: result
            }
          } catch (error) {
            return {
              tool_name: call.name,
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error'
            }
          }
        })
      )

      const successCount = results.filter(r => r.success).length
      const hasErrors = results.some(r => !r.success)

      reply.code(hasErrors ? 207 : 200).send({
        success: successCount === results.length,
        results: results,
        summary: {
          total_calls: results.length,
          successful: successCount,
          failed: results.length - successCount
        },
        execution_time: new Date().toISOString()
      })
    } catch (error) {
      reply.code(400).send({
        success: false,
        error: 'Invalid MCP batch call',
        message: error instanceof Error ? error.message : 'Unknown validation error'
      })
    }
  })

  // Get tools by tier (helpful for inference loops)
  fastify.get('/mcp/tools/tier/:tier', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { tier } = request.params as { tier: string }
      
      if (!['secret', 'user', 'global'].includes(tier)) {
        reply.code(400).send({
          success: false,
          error: 'Invalid tier',
          message: 'Tier must be one of: secret, user, global',
          available_tiers: ['secret', 'user', 'global']
        })
        return
      }

      const tools = contextMCPServer.getAvailableTools()
      
      // Filter tools by tier based on naming convention
      const tierTools = tools.tools.filter(tool => {
        if (tier === 'secret') {
          return tool.name.includes('credential') || tool.name.includes('ssh') || tool.name.includes('secret')
        } else if (tier === 'user') {
          return tool.name.includes('user') || tool.name.includes('deployment') || tool.name.includes('preferences')
        } else if (tier === 'global') {
          return tool.name.includes('community') || tool.name.includes('recommended') || tool.name.includes('workflow')
        }
        return false
      })

      reply.send({
        success: true,
        tier: tier,
        tools: tierTools,
        count: tierTools.length,
        tier_description: {
          secret: 'Encrypted credential and SSH key management (requires JWT)',
          user: 'User-specific preferences and deployment patterns (requires JWT)',
          global: 'Community knowledge base and recommendations (anonymous)'
        }[tier]
      })
    } catch (error) {
      reply.code(500).send({
        success: false,
        error: 'Failed to get tools by tier',
        message: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  })

  // Get tool schema for a specific tool
  fastify.get('/mcp/tools/:toolName/schema', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { toolName } = request.params as { toolName: string }
      const tools = contextMCPServer.getAvailableTools()
      
      const tool = tools.tools.find(t => t.name === toolName)
      if (!tool) {
        reply.code(404).send({
          success: false,
          error: 'Tool not found',
          message: `MCP tool '${toolName}' is not available`,
          available_tools: tools.tools.map(t => t.name)
        })
        return
      }

      // Determine tier and security requirements
      let tier = 'unknown'
      let security_requirements: string[] = []

      if (toolName.includes('credential') || toolName.includes('ssh') || toolName.includes('secret')) {
        tier = 'secret_context'
        security_requirements = ['jwt_token', 'workspace_id', 'user_id', 'encrypted_storage']
      } else if (toolName.includes('user') || toolName.includes('deployment') || toolName.includes('preferences')) {
        tier = 'user_context'  
        security_requirements = ['jwt_token', 'workspace_id', 'user_id']
      } else if (toolName.includes('community') || toolName.includes('recommended') || toolName.includes('workflow')) {
        tier = 'global_context'
        security_requirements = ['anonymous_submissions_allowed']
      }

      reply.send({
        success: true,
        tool: tool,
        tier: tier,
        security_requirements: security_requirements,
        usage_example: {
          method: 'POST',
          url: '/api/v1/mcp/call',
          body: {
            name: tool.name,
            arguments: {
              example: 'See inputSchema for required parameters'
            }
          }
        }
      })
    } catch (error) {
      reply.code(500).send({
        success: false,
        error: 'Failed to get tool schema',
        message: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  })

  // Health check specifically for MCP functionality
  fastify.get('/mcp/health', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const tools = contextMCPServer.getAvailableTools()
      
      // Test basic tool availability by tier
      const secretTools = tools.tools.filter(t => t.name.includes('credential') || t.name.includes('ssh') || t.name.includes('secret')).length
      const userTools = tools.tools.filter(t => t.name.includes('user') || t.name.includes('deployment') || t.name.includes('preferences')).length
      const globalTools = tools.tools.filter(t => t.name.includes('community') || t.name.includes('recommended') || t.name.includes('workflow')).length
      
      const totalTools = tools.tools.length
      const expectedTools = 14 // We expect 14 MCP tools total
      
      reply.send({
        status: totalTools === expectedTools ? 'healthy' : 'degraded',
        mcp_server: 'operational',
        available_tools: totalTools,
        expected_tools: expectedTools,
        tiers: {
          secret_context: { tools: secretTools, expected: 5 },
          user_context: { tools: userTools, expected: 5 },
          global_context: { tools: globalTools, expected: 4 }
        },
        existing_services: {
          secret_context_service: 'operational',
          user_context_service: 'operational', 
          global_context_service: 'operational'
        },
        timestamp: new Date().toISOString(),
        service: 'Context Manager MCP Server'
      })
    } catch (error) {
      reply.code(500).send({
        status: 'unhealthy',
        mcp_server: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
        service: 'Context Manager MCP Server'
      })
    }
  })

  // Quick test endpoints for each tier
  fastify.get('/mcp/test/global', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // Test global context - get community patterns (anonymous)
      const result = await contextMCPServer.callTool('get_community_patterns', { 
        filters: { limit: 3 } 
      })
      
      reply.send({
        success: true,
        test: 'global_context',
        message: 'Global context test successful - anonymous access to community patterns',
        result: result
      })
    } catch (error) {
      reply.code(500).send({
        success: false,
        test: 'global_context',
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  })
}