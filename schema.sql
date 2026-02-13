-- FluxAI Database Schema for Supabase

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Tenants table
CREATE TABLE IF NOT EXISTS tenants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  plan VARCHAR(50) NOT NULL CHECK (plan IN ('free', 'pro', 'enterprise')),
  soft_limit_usd DECIMAL(10,2) DEFAULT 0,
  hard_limit_usd DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL UNIQUE,
  role VARCHAR(50) DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  personal_cap_usd DECIMAL(10,2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tools table
CREATE TABLE IF NOT EXISTS tools (
  id VARCHAR(100) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  category VARCHAR(50) CHECK (category IN ('llm', 'search', 'db', 'custom')),
  tier VARCHAR(50) CHECK (tier IN ('cheap', 'standard', 'premium')),
  cost_per_unit DECIMAL(10,6) NOT NULL,
  unit_type VARCHAR(50) DEFAULT 'tokens' CHECK (unit_type IN ('tokens', 'requests')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Policies table
CREATE TABLE IF NOT EXISTS policies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  scope VARCHAR(50) NOT NULL CHECK (scope IN ('tenant', 'user', 'tool')),
  scope_id VARCHAR(255),
  limit_type VARCHAR(50) NOT NULL CHECK (limit_type IN ('daily', 'monthly', 'per_request')),
  limit_value DECIMAL(10,2) NOT NULL,
  fallback_tool_id VARCHAR(100) REFERENCES tools(id),
  decision VARCHAR(50) DEFAULT 'allow' CHECK (decision IN ('allow', 'deny', 'downgrade', 'require_approval')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Usage events table
CREATE TABLE IF NOT EXISTS usage_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tool_id VARCHAR(100) NOT NULL REFERENCES tools(id),
  units INTEGER NOT NULL,
  cost_estimate DECIMAL(10,6) NOT NULL,
  decision VARCHAR(50) NOT NULL CHECK (decision IN ('allowed', 'denied', 'downgraded')),
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Usage aggregates table (for performance)
-- Note: user_id and tool_id use empty UUID/string as defaults to allow composite primary key
CREATE TABLE IF NOT EXISTS usage_aggregates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID DEFAULT '00000000-0000-0000-0000-000000000000'::UUID,
  tool_id VARCHAR(100) DEFAULT '',
  period_type VARCHAR(50) NOT NULL CHECK (period_type IN ('day', 'month')),
  period_start DATE NOT NULL,
  total_units INTEGER DEFAULT 0,
  total_cost DECIMAL(10,2) DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (tenant_id, user_id, tool_id, period_type, period_start)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_tenant_id ON users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_policies_tenant_id ON policies(tenant_id);
CREATE INDEX IF NOT EXISTS idx_usage_events_tenant_id ON usage_events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_usage_events_user_id ON usage_events(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_events_tool_id ON usage_events(tool_id);
CREATE INDEX IF NOT EXISTS idx_usage_events_timestamp ON usage_events(timestamp);
CREATE INDEX IF NOT EXISTS idx_usage_aggregates_period ON usage_aggregates(period_type, period_start);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_tenants_updated_at BEFORE UPDATE ON tenants
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tools_updated_at BEFORE UPDATE ON tools
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_policies_updated_at BEFORE UPDATE ON policies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) policies
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE tools ENABLE ROW LEVEL SECURITY;
ALTER TABLE policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_aggregates ENABLE ROW LEVEL SECURITY;

-- Allow service role to bypass RLS
CREATE POLICY "Service role can do everything on tenants" ON tenants FOR ALL USING (true);
CREATE POLICY "Service role can do everything on users" ON users FOR ALL USING (true);
CREATE POLICY "Service role can do everything on tools" ON tools FOR ALL USING (true);
CREATE POLICY "Service role can do everything on policies" ON policies FOR ALL USING (true);
CREATE POLICY "Service role can do everything on usage_events" ON usage_events FOR ALL USING (true);
CREATE POLICY "Service role can do everything on usage_aggregates" ON usage_aggregates FOR ALL USING (true);
