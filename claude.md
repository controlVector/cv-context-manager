# CV Context Manager Service

## Purpose & Agent Assignment
- **Primary Agent**: No single agent owner - serves all agents
- **Service Role**: Three-tier context management system providing secure, scalable state management
- **Key Capabilities**: 
  - Secret context encryption and secure storage
  - User context personalization and workspace isolation
  - Global context system-wide configuration management
  - Privacy-preserving context sharing between agents

## Technical Stack
- **Framework**: Node.js with TypeScript
- **Runtime**: Fastify for high-performance API serving
- **Database**: 
  - PostgreSQL (primary) for structured context data
  - Redis for high-frequency cache and session storage
  - Vault (optional) for enhanced secret management
- **External Dependencies**:
  - @supabase/supabase-js for database integration
  - ioredis for Redis operations
  - node-vault for secret management
  - crypto for encryption/decryption

## Integration Points
- **APIs Provided**:
  - `/api/v1/context/secret` - Encrypted credential management
  - `/api/v1/context/user/{userId}` - User-specific context operations
  - `/api/v1/context/global` - System-wide configuration
  - `/api/v1/context/workspace/{workspaceId}` - Workspace-scoped context
  - `/api/v1/context/share` - Privacy-preserving context sharing

- **APIs Consumed**:
  - Supabase: Database operations and RLS enforcement
  - Vault: Enhanced secret storage (production)
  - Redis: Caching and session management

- **Event Publications**:
  - `context.updated` - Context change notifications
  - `context.shared` - Context sharing events
  - `workspace.context.changed` - Workspace-specific updates

- **Context Tier Structure**:
  - **Secret Context**: Encrypted API keys, credentials, SSH keys
  - **User Context**: Preferences, workspace memberships, personalization
  - **Global Context**: System configuration, feature flags, defaults

## Current Status: CRITICAL INFRASTRUCTURE SUCCESS ✅🎉

**Service Running**: Port 3005
**TypeScript Issues**: Fixed ✅ 
**Frontend Integration**: Complete ✅
**Onboarding System**: Fully integrated ✅
**LLM Credential Storage**: Successfully tested and operational ✅
**In-Memory Development Mode**: Implemented and functional ✅
**JWT Authentication**: Fixed and synchronized across services ✅
**LIVE CREDENTIAL INTEGRATION**: DigitalOcean API token retrieval operational ✅🚀

### 🎯 MAJOR ACHIEVEMENT: Real Infrastructure Credential Integration (August 24, 2025)
- **🔐 SECURE TOKEN RETRIEVAL**: Successfully serving DigitalOcean API tokens to Atlas service
- **🎫 JWT AUTHENTICATION**: Proper JWT token validation and user identification  
- **🗝️ ENCRYPTED STORAGE**: Secure storage and retrieval of cloud provider credentials
- **🔄 API ENDPOINT CORRECTIONS**: Fixed credential retrieval endpoints for proper Atlas integration
- **🛡️ SECURITY COMPLIANCE**: Secure credential handling with proper access controls
- **🌐 CROSS-SERVICE INTEGRATION**: Seamless Watson → Atlas → Context Manager → DigitalOcean flow
- **📊 PRODUCTION READY**: Handling live production infrastructure credential requests

## Development Setup

### Prerequisites
- Node.js 18+
- PostgreSQL 14+ (or in-memory mode)
- Redis 6+ (optional - can use in-memory cache)
- Supabase account and project (or fallback credentials)

### Environment Configuration
```env
# Core Configuration
NODE_ENV=development
PORT=3005
DATABASE_URL=postgresql://user:pass@localhost:5432/cv_context
# For in-memory development mode
USE_IN_MEMORY_DB=true
USE_IN_MEMORY_CACHE=true

# Supabase Integration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Redis Configuration
REDIS_URL=redis://localhost:6379

# Encryption
CONTEXT_ENCRYPTION_KEY=your_32_byte_encryption_key
SECRET_KEY_ROTATION_INTERVAL=86400000

# Optional Vault Integration
VAULT_ENDPOINT=https://vault.example.com
VAULT_TOKEN=your_vault_token
```

### Local Development Commands
```bash
# Install dependencies
npm install

# Run database migrations
npm run migrate

# Run in development mode
npm run dev

# Run tests with encryption scenarios
npm test

# Generate new encryption keys
npm run generate-keys
```

## Deployment

### Docker Configuration
- Multi-stage build with security-focused Alpine image
- Non-root user execution
- Encrypted volume mounts for sensitive data
- Health checks via `/health` endpoint

### Environment Variables
- `ENCRYPTION_ALGORITHM`: Encryption method (default: aes-256-gcm)
- `CONTEXT_CACHE_TTL`: Cache expiration time (default: 3600s)
- `MAX_CONTEXT_SIZE`: Maximum context payload size (default: 1MB)
- `ENABLE_CONTEXT_AUDIT`: Enable audit logging (default: true)

### Production Considerations
- End-to-end encryption for all secret context data
- Regular key rotation and secure key management
- Comprehensive audit logging for all context access
- High availability with Redis clustering
- Backup and disaster recovery for encrypted data

## Architecture Context

### Role in Overall System
The Context Manager serves as the secure, centralized memory system for the entire ControlVector platform:

1. **Secret Context Tier**:
   - Encrypted storage of API keys, credentials, SSH keys
   - Secure sharing between authorized agents
   - Automatic key rotation and expiration

2. **User Context Tier**:
   - Workspace-scoped user preferences and settings
   - Personalization data and interaction history
   - Cross-workspace context isolation

3. **Global Context Tier**:
   - System-wide configuration and feature flags
   - Default settings and operational parameters
   - Shared resources and common data

### Dependencies on Other Services
- **Supabase**: Core database operations with Row Level Security
- **Redis**: High-performance caching and session storage
- **Vault** (optional): Enterprise-grade secret management

### Data Flow Patterns
1. **Context Storage**: Encrypted write operations with automatic classification
2. **Context Retrieval**: Permission-checked read operations with caching
3. **Context Sharing**: Privacy-preserving cross-agent context distribution
4. **Context Synchronization**: Real-time updates across distributed agents

### Privacy and Security Architecture
- **Encryption at Rest**: All secret context encrypted with AES-256-GCM
- **Access Control**: Fine-grained permissions per agent and workspace
- **Audit Trail**: Comprehensive logging of all context access patterns
- **Data Isolation**: Strict workspace boundaries with cryptographic separation
- **Key Management**: Secure key rotation and hierarchical key derivation

### Integration with Agent Ecosystem
Each agent interacts with appropriate context tiers:
- **Watson**: Accesses all tiers for orchestration decisions
- **Atlas**: Requires secret context for cloud provider credentials
- **Phoenix**: Uses user context for deployment preferences
- **Sherlock**: Monitors context access patterns for security
- **All Agents**: Benefit from global context for system-wide settings

This service provides the foundational trust and state management layer that enables secure, personalized, and efficient operation of the entire ControlVector agent ecosystem.