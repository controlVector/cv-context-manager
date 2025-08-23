import { DatabaseClient } from '../database/client'
import { EncryptionService } from '../utils/encryption'
import { 
  SecretContext, 
  EncryptedCredential, 
  EncryptedSSHKey, 
  EncryptedCertificate,
  AuditLog 
} from '../types'

export class SecretContextService {
  constructor(
    private db: DatabaseClient,
    private encryption: EncryptionService
  ) {}

  /**
   * Store encrypted API key or credential
   */
  async storeCredential(
    workspaceId: string,
    userId: string,
    key: string,
    value: string,
    credentialType: 'oauth' | 'api_key' | 'password' | 'token',
    provider: string,
    expiresAt?: Date
  ): Promise<void> {
    // Encrypt the credential
    const encryptedCredential: EncryptedCredential = {
      ...this.encryption.encrypt(value, expiresAt),
      credential_type: credentialType,
      provider: provider,
      metadata: {
        created_by: userId,
        provider: provider,
        key_name: key
      }
    }

    // Check if secret context exists for this user/workspace
    let secretContext = await this.getSecretContext(workspaceId, userId)
    
    if (!secretContext) {
      // Create new secret context
      secretContext = {
        id: crypto.randomUUID(),
        workspace_id: workspaceId,
        user_id: userId,
        api_keys: {},
        credentials: {},
        ssh_keys: {},
        certificates: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    }

    // Add the credential
    secretContext.credentials[key] = encryptedCredential
    secretContext.updated_at = new Date().toISOString()

    // Store in database
    await this.saveSecretContext(secretContext)

    // Audit log
    await this.createAuditLog({
      workspace_id: workspaceId,
      user_id: userId,
      operation: 'store_credential',
      context_type: 'secret',
      resource_key: key,
      new_value_hash: this.encryption.hash(value),
      status: 'success'
    })

    // Cache invalidation
    const cacheKey = this.db.generateCacheKey('secret_context', workspaceId, userId)
    await this.db.cacheDelete(cacheKey)
  }

  /**
   * Retrieve and decrypt credential
   */
  async getCredential(
    workspaceId: string,
    userId: string,
    key: string
  ): Promise<string | null> {
    const secretContext = await this.getSecretContext(workspaceId, userId)
    
    if (!secretContext || !secretContext.credentials[key]) {
      return null
    }

    const encryptedCredential = secretContext.credentials[key]
    
    try {
      const decryptedValue = this.encryption.decrypt(encryptedCredential)
      
      // Audit log
      await this.createAuditLog({
        workspace_id: workspaceId,
        user_id: userId,
        operation: 'get_credential',
        context_type: 'secret',
        resource_key: key,
        status: 'success'
      })
      
      return decryptedValue
    } catch (error) {
      // Audit failed access
      await this.createAuditLog({
        workspace_id: workspaceId,
        user_id: userId,
        operation: 'get_credential',
        context_type: 'secret',
        resource_key: key,
        status: 'failed',
        error_message: error instanceof Error ? error.message : 'Unknown error'
      })
      
      throw new Error(`Failed to decrypt credential '${key}': ${error}`)
    }
  }

  /**
   * Store SSH key
   */
  async storeSSHKey(
    workspaceId: string,
    userId: string,
    keyName: string,
    privateKey: string,
    publicKey: string,
    keyType: 'rsa' | 'ed25519' | 'ecdsa',
    metadata?: { description?: string; allowed_hosts?: string[] }
  ): Promise<void> {
    const fingerprint = this.generateSSHFingerprint(publicKey)
    
    const encryptedSSHKey: EncryptedSSHKey = {
      ...this.encryption.encrypt(privateKey),
      key_type: keyType,
      public_key: publicKey,
      fingerprint: fingerprint,
      metadata: metadata || {}
    }

    let secretContext = await this.getSecretContext(workspaceId, userId)
    
    if (!secretContext) {
      secretContext = await this.createEmptySecretContext(workspaceId, userId)
    }

    secretContext.ssh_keys[keyName] = encryptedSSHKey
    secretContext.updated_at = new Date().toISOString()

    await this.saveSecretContext(secretContext)

    // Audit and cache invalidation
    await this.createAuditLog({
      workspace_id: workspaceId,
      user_id: userId,
      operation: 'store_ssh_key',
      context_type: 'secret',
      resource_key: keyName,
      status: 'success'
    })

    const cacheKey = this.db.generateCacheKey('secret_context', workspaceId, userId)
    await this.db.cacheDelete(cacheKey)
  }

  /**
   * Get SSH key (decrypted private key)
   */
  async getSSHKey(
    workspaceId: string,
    userId: string,
    keyName: string
  ): Promise<{ privateKey: string; publicKey: string; fingerprint: string } | null> {
    const secretContext = await this.getSecretContext(workspaceId, userId)
    
    if (!secretContext || !secretContext.ssh_keys[keyName]) {
      return null
    }

    const encryptedSSHKey = secretContext.ssh_keys[keyName]
    
    try {
      const privateKey = this.encryption.decrypt(encryptedSSHKey)
      
      await this.createAuditLog({
        workspace_id: workspaceId,
        user_id: userId,
        operation: 'get_ssh_key',
        context_type: 'secret',
        resource_key: keyName,
        status: 'success'
      })
      
      return {
        privateKey,
        publicKey: encryptedSSHKey.public_key,
        fingerprint: encryptedSSHKey.fingerprint
      }
    } catch (error) {
      await this.createAuditLog({
        workspace_id: workspaceId,
        user_id: userId,
        operation: 'get_ssh_key',
        context_type: 'secret',
        resource_key: keyName,
        status: 'failed',
        error_message: error instanceof Error ? error.message : 'Unknown error'
      })
      
      throw new Error(`Failed to decrypt SSH key '${keyName}': ${error}`)
    }
  }

  /**
   * List available credentials/keys (without decrypting values)
   */
  async listSecrets(
    workspaceId: string,
    userId: string
  ): Promise<{
    credentials: Array<{ key: string; provider: string; type: string; created_at: string; expires_at?: string }>
    ssh_keys: Array<{ key: string; type: string; fingerprint: string; created_at: string }>
    certificates: Array<{ key: string; type: string; common_name: string; expires_at: string }>
  }> {
    const secretContext = await this.getSecretContext(workspaceId, userId)
    
    if (!secretContext) {
      return { credentials: [], ssh_keys: [], certificates: [] }
    }

    const credentials = Object.entries(secretContext.credentials).map(([key, cred]) => {
      const result: any = {
        key,
        provider: cred.provider,
        type: cred.credential_type,
        created_at: cred.created_at
      }
      if (cred.expires_at) {
        result.expires_at = cred.expires_at
      }
      return result
    })

    const ssh_keys = Object.entries(secretContext.ssh_keys).map(([key, sshKey]) => ({
      key,
      type: sshKey.key_type,
      fingerprint: sshKey.fingerprint,
      created_at: sshKey.created_at
    }))

    const certificates = Object.entries(secretContext.certificates).map(([key, cert]) => ({
      key,
      type: cert.certificate_type,
      common_name: cert.common_name,
      expires_at: cert.expires_at
    }))

    return { credentials, ssh_keys, certificates }
  }

  /**
   * Delete credential/key
   */
  async deleteSecret(
    workspaceId: string,
    userId: string,
    secretType: 'credential' | 'ssh_key' | 'certificate',
    key: string
  ): Promise<boolean> {
    const secretContext = await this.getSecretContext(workspaceId, userId)
    
    if (!secretContext) {
      return false
    }

    let deleted = false
    const oldValueHash = secretContext[`${secretType}s`]?.[key] 
      ? this.encryption.hash(JSON.stringify(secretContext[`${secretType}s`][key]))
      : undefined

    switch (secretType) {
      case 'credential':
        if (secretContext.credentials[key]) {
          delete secretContext.credentials[key]
          deleted = true
        }
        break
      case 'ssh_key':
        if (secretContext.ssh_keys[key]) {
          delete secretContext.ssh_keys[key]
          deleted = true
        }
        break
      case 'certificate':
        if (secretContext.certificates[key]) {
          delete secretContext.certificates[key]
          deleted = true
        }
        break
    }

    if (deleted) {
      secretContext.updated_at = new Date().toISOString()
      await this.saveSecretContext(secretContext)

      const auditLogData: Partial<AuditLog> = {
        workspace_id: workspaceId,
        user_id: userId,
        operation: 'delete_secret',
        context_type: 'secret',
        resource_key: key,
        status: 'success'
      }
      if (oldValueHash) {
        auditLogData.old_value_hash = oldValueHash
      }
      await this.createAuditLog(auditLogData)

      // Cache invalidation
      const cacheKey = this.db.generateCacheKey('secret_context', workspaceId, userId)
      await this.db.cacheDelete(cacheKey)
    }

    return deleted
  }

  // Private helper methods
  private async getSecretContext(workspaceId: string, userId: string): Promise<SecretContext | null> {
    // Try cache first
    const cacheKey = this.db.generateCacheKey('secret_context', workspaceId, userId)
    const cached = await this.db.cacheGet<SecretContext>(cacheKey)
    
    if (cached) {
      return cached
    }

    // Query database
    const results = await this.db.findByUserAndWorkspace<SecretContext>(
      'secret_contexts',
      userId,
      workspaceId
    )

    const secretContext = results[0] || null
    
    // Cache the result
    if (secretContext) {
      await this.db.cacheSet(cacheKey, secretContext, 300) // 5 minute cache
    }

    return secretContext
  }

  private async saveSecretContext(secretContext: SecretContext): Promise<void> {
    // Encrypt the entire secret context before storing
    const encryptedContext = this.encryption.encryptObject(
      secretContext,
      ['credentials', 'ssh_keys', 'certificates']
    )

    if (await this.db.findById('secret_contexts', secretContext.id)) {
      await this.db.update('secret_contexts', secretContext.id, encryptedContext)
    } else {
      await this.db.insert('secret_contexts', encryptedContext)
    }
  }

  private async createEmptySecretContext(workspaceId: string, userId: string): Promise<SecretContext> {
    return {
      id: crypto.randomUUID(),
      workspace_id: workspaceId,
      user_id: userId,
      api_keys: {},
      credentials: {},
      ssh_keys: {},
      certificates: {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
  }

  private async createAuditLog(logData: Partial<AuditLog>): Promise<void> {
    const auditLog: AuditLog = {
      id: crypto.randomUUID(),
      workspace_id: logData.workspace_id!,
      user_id: logData.user_id!,
      operation: logData.operation!,
      context_type: logData.context_type!,
      resource_key: logData.resource_key!,
      ip_address: logData.ip_address || 'system',
      user_agent: logData.user_agent || 'cv-context-manager',
      timestamp: new Date().toISOString(),
      status: logData.status!,
      ...((logData.old_value_hash !== undefined) && { old_value_hash: logData.old_value_hash }),
      ...((logData.new_value_hash !== undefined) && { new_value_hash: logData.new_value_hash }),
      ...((logData.error_message !== undefined) && { error_message: logData.error_message })
    }

    try {
      await this.db.insert('audit_logs', auditLog)
    } catch (error) {
      console.error('Failed to create audit log:', error)
      // Don't throw - auditing failure shouldn't break the operation
    }
  }

  private generateSSHFingerprint(publicKey: string): string {
    // Simple fingerprint generation - in production, use proper SSH key parsing
    return this.encryption.hash(publicKey).substring(0, 32)
  }
}