import { createClient, SupabaseClient } from '@supabase/supabase-js'
import Redis from 'ioredis'
import { DatabaseConfig, CacheConfig } from '../types'

export class DatabaseClient {
  private supabase: SupabaseClient
  private redis: Redis | null = null
  private inMemoryCache: Map<string, any> = new Map()
  private useInMemoryCache: boolean
  private config: {
    database: DatabaseConfig
    cache: CacheConfig
  }

  constructor(supabaseUrl: string, supabaseKey: string, redisConfig: any) {
    this.useInMemoryCache = process.env.USE_IN_MEMORY_CACHE === 'true'
    
    this.supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: false // Server-side, no need to persist sessions
      },
      global: {
        headers: {
          'X-Client-Info': 'cv-context-manager'
        }
      }
    })

    // Only create Redis connection if not using in-memory cache
    if (!this.useInMemoryCache) {
      this.redis = new Redis({
        host: redisConfig.host || 'localhost',
        port: redisConfig.port || 6379,
        password: redisConfig.password,
        db: redisConfig.db || 0,
        keyPrefix: 'cv:context:',
        maxRetriesPerRequest: 3
      })
    }

    this.config = {
      database: {
        host: supabaseUrl,
        port: 443,
        database: 'postgres',
        username: 'supabase',
        password: supabaseKey,
        ssl: true
      },
      cache: {
        ttl: 3600, // 1 hour default
        max_size: 1000,
        prefix: 'cv:context:'
      }
    }
  }

  // Supabase Database Operations
  async query(table: string, options: any = {}) {
    let query = this.supabase.from(table).select(options.select || '*')
    
    if (options.filter) {
      Object.entries(options.filter).forEach(([key, value]) => {
        query = query.eq(key, value)
      })
    }
    
    if (options.order) {
      query = query.order(options.order.column, { ascending: options.order.ascending })
    }
    
    if (options.limit) {
      query = query.limit(options.limit)
    }
    
    if (options.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 10) - 1)
    }

    const { data, error } = await query
    
    if (error) {
      throw new DatabaseError(`Query failed: ${error.message}`, error.code || 'QUERY_ERROR')
    }
    
    return data
  }

  async insert(table: string, data: any) {
    const { data: result, error } = await this.supabase
      .from(table)
      .insert(data)
      .select()
      .single()
    
    if (error) {
      throw new DatabaseError(`Insert failed: ${error.message}`, error.code || 'INSERT_ERROR')
    }
    
    return result
  }

  async update(table: string, id: string, data: any) {
    const { data: result, error } = await this.supabase
      .from(table)
      .update(data)
      .eq('id', id)
      .select()
      .single()
    
    if (error) {
      throw new DatabaseError(`Update failed: ${error.message}`, error.code || 'UPDATE_ERROR')
    }
    
    return result
  }

  async delete(table: string, id: string) {
    const { error } = await this.supabase
      .from(table)
      .delete()
      .eq('id', id)
    
    if (error) {
      throw new DatabaseError(`Delete failed: ${error.message}`, error.code || 'DELETE_ERROR')
    }
    
    return true
  }

  async findById<T>(table: string, id: string): Promise<T | null> {
    const { data, error } = await this.supabase
      .from(table)
      .select('*')
      .eq('id', id)
      .single()
    
    if (error) {
      if (error.code === 'PGRST116') { // No rows found
        return null
      }
      throw new DatabaseError(`FindById failed: ${error.message}`, error.code || 'FIND_ERROR')
    }
    
    return data as T
  }

  async findByWorkspace<T>(table: string, workspaceId: string): Promise<T[]> {
    const { data, error } = await this.supabase
      .from(table)
      .select('*')
      .eq('workspace_id', workspaceId)
    
    if (error) {
      throw new DatabaseError(`FindByWorkspace failed: ${error.message}`, error.code || 'FIND_ERROR')
    }
    
    return (data as T[]) || []
  }

  async findByUserAndWorkspace<T>(
    table: string, 
    userId: string, 
    workspaceId: string
  ): Promise<T[]> {
    const { data, error } = await this.supabase
      .from(table)
      .select('*')
      .eq('user_id', userId)
      .eq('workspace_id', workspaceId)
    
    if (error) {
      throw new DatabaseError(`FindByUserAndWorkspace failed: ${error.message}`, error.code || 'FIND_ERROR')
    }
    
    return (data as T[]) || []
  }

  // Cache Operations (Redis or In-Memory)
  async cacheGet<T>(key: string): Promise<T | null> {
    try {
      if (this.useInMemoryCache) {
        const cached = this.inMemoryCache.get(key)
        return cached ? JSON.parse(cached) as T : null
      } else if (this.redis) {
        const cached = await this.redis!.get(key)
        if (!cached) return null
        return JSON.parse(cached) as T
      }
      return null
    } catch (error) {
      console.error('Cache get error:', error)
      return null
    }
  }

  async cacheSet<T>(key: string, value: T, ttl?: number): Promise<void> {
    try {
      const serialized = JSON.stringify(value)
      if (this.useInMemoryCache) {
        this.inMemoryCache.set(key, serialized)
        // Handle TTL for in-memory cache
        if (ttl) {
          setTimeout(() => {
            this.inMemoryCache.delete(key)
          }, ttl * 1000)
        }
      } else if (this.redis) {
        if (ttl) {
          await this.redis!.setex(key, ttl, serialized)
        } else {
          await this.redis!.set(key, serialized)
        }
      }
    } catch (error) {
      console.error('Cache set error:', error)
      // Don't throw - caching is non-critical
    }
  }

  async cacheDelete(key: string): Promise<void> {
    try {
      if (this.useInMemoryCache) {
        this.inMemoryCache.delete(key)
      } else if (this.redis) {
        await this.redis!.del(key)
      }
    } catch (error) {
      console.error('Cache delete error:', error)
    }
  }

  async cacheInvalidatePattern(pattern: string): Promise<void> {
    try {
      if (this.useInMemoryCache) {
        const regex = new RegExp(pattern.replace(/\*/g, '.*'))
        for (const [key] of this.inMemoryCache) {
          if (regex.test(key)) {
            this.inMemoryCache.delete(key)
          }
        }
      } else if (this.redis) {
        const keys = await this.redis!.keys(pattern)
        if (keys.length > 0) {
          await this.redis!.del(...keys)
        }
      }
    } catch (error) {
      console.error('Cache invalidate error:', error)
    }
  }

  // Utility Methods
  generateCacheKey(type: string, ...identifiers: string[]): string {
    return `${this.config.cache.prefix}${type}:${identifiers.join(':')}`
  }

  async healthCheck(): Promise<{ database: boolean; cache: boolean }> {
    const results = {
      database: false,
      cache: false
    }

    // Test database connection
    try {
      const { data, error } = await this.supabase
        .from('profiles')
        .select('id')
        .limit(1)
      
      results.database = !error
    } catch (error) {
      console.error('Database health check failed:', error)
    }

    // Test cache connection
    try {
      if (this.useInMemoryCache) {
        results.cache = true // In-memory cache is always healthy
      } else if (this.redis) {
        await this.redis!.ping()
        results.cache = true
      }
    } catch (error) {
      console.error('Cache health check failed:', error)
    }

    return results
  }

  async close(): Promise<void> {
    if (this.redis) {
      await this.redis!.quit()
    }
    if (this.useInMemoryCache) {
      this.inMemoryCache.clear()
    }
  }
}

export class DatabaseError extends Error {
  constructor(message: string, public code: string) {
    super(message)
    this.name = 'DatabaseError'
  }
}

// Database schema initialization
export async function initializeSchema(client: DatabaseClient): Promise<void> {
  // This would typically run migrations
  console.log('Schema initialization would run here')
  
  // For now, we'll assume the Supabase database schema is managed separately
  // In a production setup, you'd want to run migrations here
}