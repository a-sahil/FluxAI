-- Demo data for FluxAI

-- Insert demo tools
INSERT INTO tools (id, name, category, tier, cost_per_unit, unit_type) VALUES
  ('gpt-4', 'GPT-4', 'llm', 'premium', 0.00003, 'tokens'),
  ('gpt-4-turbo', 'GPT-4 Turbo', 'llm', 'premium', 0.00001, 'tokens'),
  ('gpt-3.5-turbo', 'GPT-3.5 Turbo', 'llm', 'cheap', 0.0000005, 'tokens'),
  ('claude-3-opus', 'Claude 3 Opus', 'llm', 'premium', 0.000015, 'tokens'),
  ('claude-3-sonnet', 'Claude 3 Sonnet', 'llm', 'standard', 0.000003, 'tokens'),
  ('claude-3-haiku', 'Claude 3 Haiku', 'llm', 'cheap', 0.00000025, 'tokens'),
  ('search-api', 'Search API', 'search', 'standard', 0.001, 'requests'),
  ('vector-db', 'Vector Database', 'db', 'standard', 0.0001, 'requests')
ON CONFLICT (id) DO NOTHING;

-- Insert demo tenants
INSERT INTO tenants (id, name, plan, soft_limit_usd, hard_limit_usd) VALUES
  ('11111111-1111-1111-1111-111111111111', 'FreeCo', 'free', 1.00, 2.00),
  ('22222222-2222-2222-2222-222222222222', 'ProCorp', 'pro', 40.00, 50.00),
  ('33333333-3333-3333-3333-333333333333', 'EnterpriseLLC', 'enterprise', 400.00, 500.00)
ON CONFLICT (id) DO NOTHING;

-- Insert demo users
INSERT INTO users (id, tenant_id, email, role) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'user@freeco.com', 'member'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '22222222-2222-2222-2222-222222222222', 'user@procorp.com', 'member'),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', '22222222-2222-2222-2222-222222222222', 'admin@procorp.com', 'admin'),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', '33333333-3333-3333-3333-333333333333', 'admin@enterprisellc.com', 'admin')
ON CONFLICT (id) DO NOTHING;

-- Insert demo policies

-- FreeCo: Strict daily limit, deny premium models
INSERT INTO policies (tenant_id, scope, scope_id, limit_type, limit_value, decision) VALUES
  ('11111111-1111-1111-1111-111111111111', 'tenant', NULL, 'daily', 2.00, 'deny')
ON CONFLICT DO NOTHING;

INSERT INTO policies (tenant_id, scope, scope_id, limit_type, limit_value, fallback_tool_id, decision) VALUES
  ('11111111-1111-1111-1111-111111111111', 'tool', 'gpt-4', 'per_request', 0.00, 'gpt-3.5-turbo', 'downgrade'),
  ('11111111-1111-1111-1111-111111111111', 'tool', 'gpt-4-turbo', 'per_request', 0.00, 'gpt-3.5-turbo', 'downgrade'),
  ('11111111-1111-1111-1111-111111111111', 'tool', 'claude-3-opus', 'per_request', 0.00, 'claude-3-haiku', 'downgrade')
ON CONFLICT DO NOTHING;

-- ProCorp: Higher daily limit, allow premium
INSERT INTO policies (tenant_id, scope, scope_id, limit_type, limit_value, decision) VALUES
  ('22222222-2222-2222-2222-222222222222', 'tenant', NULL, 'daily', 50.00, 'deny')
ON CONFLICT DO NOTHING;

-- EnterpriseLLC: Very high limits
INSERT INTO policies (tenant_id, scope, scope_id, limit_type, limit_value, decision) VALUES
  ('33333333-3333-3333-3333-333333333333', 'tenant', NULL, 'monthly', 500.00, 'require_approval')
ON CONFLICT DO NOTHING;
