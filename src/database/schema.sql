-- ControlVector Context Manager Database Schema
-- This schema extends the existing chatbot-ui Supabase database

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =================================
-- SECRET CONTEXT TABLES
-- =================================

-- Secret contexts table (encrypted sensitive data)
CREATE TABLE IF NOT EXISTS secret_contexts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL,
    user_id UUID NOT NULL,
    -- Encrypted JSON fields
    credentials JSONB DEFAULT '{}',
    ssh_keys JSONB DEFAULT '{}', 
    certificates JSONB DEFAULT '{}',
    api_keys JSONB DEFAULT '{}',
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    
    -- Constraints
    CONSTRAINT fk_secret_contexts_workspace FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
    CONSTRAINT fk_secret_contexts_user FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE,
    CONSTRAINT unique_secret_context_user_workspace UNIQUE(user_id, workspace_id)
);

-- =================================
-- USER CONTEXT TABLES  
-- =================================

-- User contexts table (user-specific preferences and history)
CREATE TABLE IF NOT EXISTS user_contexts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL,
    user_id UUID NOT NULL,
    
    -- User preferences (JSON)
    preferences JSONB DEFAULT '{
        "default_cloud_provider": "digitalocean",
        "preferred_regions": ["nyc1", "sfo3"],
        "cost_limits": {
            "daily_limit": 50,
            "monthly_limit": 500,
            "alert_threshold": 80
        },
        "notification_preferences": {
            "channels": ["email"],
            "quiet_hours": {
                "start": "22:00",
                "end": "08:00", 
                "timezone": "UTC"
            }
        },
        "ui_preferences": {
            "theme": "auto",
            "sidebar_collapsed": false,
            "default_view": "infrastructure"
        }
    }',
    
    -- User settings (JSON)
    settings JSONB DEFAULT '{
        "security": {
            "mfa_enabled": false,
            "session_timeout": 3600,
            "ip_restrictions": []
        },
        "workspace": {
            "workspace_permissions": {}
        },
        "integrations": {
            "enabled_providers": ["digitalocean"],
            "webhook_endpoints": []
        }
    }',
    
    -- Deployment patterns (JSON array)
    deployment_patterns JSONB DEFAULT '[]',
    
    -- Infrastructure history (JSON array)  
    infrastructure_history JSONB DEFAULT '[]',
    
    -- Conversation context (JSON array)
    conversation_context JSONB DEFAULT '[]',
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT fk_user_contexts_workspace FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
    CONSTRAINT fk_user_contexts_user FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE,
    CONSTRAINT unique_user_context_user_workspace UNIQUE(user_id, workspace_id)
);

-- =================================
-- GLOBAL CONTEXT TABLES
-- =================================

-- Global context table (system-wide intelligence)
CREATE TABLE IF NOT EXISTS global_contexts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    context_type VARCHAR(50) NOT NULL, -- 'pattern', 'metric', 'intelligence', 'template'
    category VARCHAR(100) NOT NULL, -- 'deployment', 'cost', 'security', etc.
    
    -- Context data (flexible JSON structure)
    data JSONB NOT NULL,
    
    -- Intelligence metrics
    confidence_score DECIMAL(3,2) DEFAULT 0.0 CHECK (confidence_score >= 0 AND confidence_score <= 1),
    usage_count INTEGER DEFAULT 0,
    success_rate DECIMAL(3,2) DEFAULT 0.0 CHECK (success_rate >= 0 AND success_rate <= 1),
    
    -- Classification tags
    tags TEXT[] DEFAULT '{}',
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Indexes for efficient querying
    CONSTRAINT check_context_type CHECK (context_type IN ('pattern', 'metric', 'intelligence', 'template'))
);

-- =================================
-- AUDIT AND LOGGING TABLES
-- =================================

-- Audit logs table (security and compliance)
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL,
    user_id UUID NOT NULL,
    
    -- Operation details
    operation VARCHAR(100) NOT NULL,
    context_type VARCHAR(20) NOT NULL CHECK (context_type IN ('secret', 'user', 'global')),
    resource_key VARCHAR(255) NOT NULL,
    
    -- Value hashes (for integrity checking without storing actual values)
    old_value_hash VARCHAR(64),
    new_value_hash VARCHAR(64),
    
    -- Request metadata
    ip_address INET,
    user_agent TEXT,
    
    -- Result
    status VARCHAR(20) NOT NULL CHECK (status IN ('success', 'failed')),
    error_message TEXT,
    
    -- Timestamp
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT fk_audit_logs_workspace FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
    CONSTRAINT fk_audit_logs_user FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE
);

-- =================================
-- INDEXES FOR PERFORMANCE
-- =================================

-- Secret contexts indexes
CREATE INDEX IF NOT EXISTS idx_secret_contexts_workspace_id ON secret_contexts(workspace_id);
CREATE INDEX IF NOT EXISTS idx_secret_contexts_user_id ON secret_contexts(user_id);
CREATE INDEX IF NOT EXISTS idx_secret_contexts_updated_at ON secret_contexts(updated_at);

-- User contexts indexes  
CREATE INDEX IF NOT EXISTS idx_user_contexts_workspace_id ON user_contexts(workspace_id);
CREATE INDEX IF NOT EXISTS idx_user_contexts_user_id ON user_contexts(user_id);
CREATE INDEX IF NOT EXISTS idx_user_contexts_updated_at ON user_contexts(updated_at);

-- Global contexts indexes
CREATE INDEX IF NOT EXISTS idx_global_contexts_type_category ON global_contexts(context_type, category);
CREATE INDEX IF NOT EXISTS idx_global_contexts_confidence ON global_contexts(confidence_score DESC);
CREATE INDEX IF NOT EXISTS idx_global_contexts_usage ON global_contexts(usage_count DESC);
CREATE INDEX IF NOT EXISTS idx_global_contexts_tags ON global_contexts USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_global_contexts_data ON global_contexts USING GIN(data);

-- Audit logs indexes
CREATE INDEX IF NOT EXISTS idx_audit_logs_workspace_id ON audit_logs(workspace_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_operation ON audit_logs(operation);
CREATE INDEX IF NOT EXISTS idx_audit_logs_context_type ON audit_logs(context_type);

-- =================================
-- ROW LEVEL SECURITY (RLS)
-- =================================

-- Enable RLS on all tables
ALTER TABLE secret_contexts ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_contexts ENABLE ROW LEVEL SECURITY;
ALTER TABLE global_contexts ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Secret contexts policies
CREATE POLICY "Users can only access their own workspace secret contexts" ON secret_contexts
    USING (workspace_id IN (
        SELECT workspace_id FROM workspace_users WHERE user_id = auth.uid()
    ));

CREATE POLICY "Users can only modify their own secret contexts" ON secret_contexts
    FOR ALL USING (user_id = auth.uid());

-- User contexts policies  
CREATE POLICY "Users can only access their own workspace user contexts" ON user_contexts
    USING (workspace_id IN (
        SELECT workspace_id FROM workspace_users WHERE user_id = auth.uid()
    ));

CREATE POLICY "Users can only modify their own user contexts" ON user_contexts
    FOR ALL USING (user_id = auth.uid());

-- Global contexts policies (read-only for most users)
CREATE POLICY "All authenticated users can read global contexts" ON global_contexts
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Only service role can modify global contexts" ON global_contexts
    FOR ALL USING (auth.role() = 'service_role');

-- Audit logs policies (read-only)
CREATE POLICY "Users can read audit logs for their workspaces" ON audit_logs
    FOR SELECT USING (workspace_id IN (
        SELECT workspace_id FROM workspace_users WHERE user_id = auth.uid()
    ));

-- =================================
-- FUNCTIONS AND TRIGGERS
-- =================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_secret_contexts_updated_at 
    BEFORE UPDATE ON secret_contexts 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_contexts_updated_at 
    BEFORE UPDATE ON user_contexts 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_global_contexts_updated_at 
    BEFORE UPDATE ON global_contexts 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- =================================
-- SAMPLE DATA (Development Only)
-- =================================

-- This would be populated in development/testing environments
-- INSERT INTO global_contexts (context_type, category, data, confidence_score, usage_count, success_rate, tags) VALUES
-- ('pattern', 'deployment', '{"pattern_name": "Basic React Deployment", "infrastructure_config": {"provider": "digitalocean", "size": "s-1vcpu-1gb"}, "deployment_config": {"strategy": "blue_green"}}', 0.95, 150, 0.98, ARRAY['react', 'digitalocean', 'basic']);

-- =================================
-- GRANTS (if needed)
-- =================================

-- Grant necessary permissions to authenticated role
GRANT SELECT, INSERT, UPDATE, DELETE ON secret_contexts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON user_contexts TO authenticated;  
GRANT SELECT ON global_contexts TO authenticated;
GRANT SELECT ON audit_logs TO authenticated;

-- Grant full permissions to service role
GRANT ALL ON secret_contexts TO service_role;
GRANT ALL ON user_contexts TO service_role;
GRANT ALL ON global_contexts TO service_role;
GRANT ALL ON audit_logs TO service_role;