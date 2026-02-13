export interface Tenant {
    id: string;
    name: string;
    plan: 'free' | 'pro' | 'enterprise';
    soft_limit_usd: number;
    hard_limit_usd: number;
    created_at: string;
    updated_at: string;
}

export interface User {
    id: string;
    tenant_id: string;
    email: string;
    role: 'admin' | 'member';
    personal_cap_usd?: number;
    created_at: string;
    updated_at: string;
}

export interface Tool {
    id: string;
    name: string;
    category: 'llm' | 'search' | 'db' | 'custom';
    tier: 'cheap' | 'standard' | 'premium';
    cost_per_unit: number;
    unit_type: 'tokens' | 'requests';
    created_at: string;
    updated_at: string;
}

export interface Policy {
    id: string;
    tenant_id: string;
    scope: 'tenant' | 'user' | 'tool';
    scope_id?: string;
    limit_type: 'daily' | 'monthly' | 'per_request';
    limit_value: number;
    fallback_tool_id?: string;
    decision: 'allow' | 'deny' | 'downgrade' | 'require_approval';
    created_at: string;
    updated_at: string;
}

export interface UsageEvent {
    id: string;
    timestamp: string;
    tenant_id: string;
    user_id: string;
    tool_id: string;
    units: number;
    cost_estimate: number;
    decision: 'allowed' | 'denied' | 'downgraded';
    metadata?: Record<string, any>;
    created_at: string;
}

export interface UsageAggregate {
    tenant_id: string;
    user_id?: string;
    tool_id?: string;
    period_type: 'day' | 'month';
    period_start: string;
    total_units: number;
    total_cost: number;
    updated_at: string;
}

export interface CheckAndRouteInput {
    tenant_id: string;
    user_id: string;
    tool_id: string;
    estimated_units: number;
    params: Record<string, any>;
}

export interface CheckAndRouteOutput {
    decision: 'allowed' | 'denied' | 'downgraded';
    final_tool_used: string;
    result?: any;
    cost_estimate: number;
    remaining_budget: number;
    message: string;
}

export interface GetUsageSummaryInput {
    tenant_id: string;
    user_id?: string;
    period: 'day' | 'month';
    start_date?: string;
    end_date?: string;
}

export interface UsageSummary {
    tenant_id: string;
    user_id?: string;
    period: 'day' | 'month';
    total_cost: number;
    total_units: number;
    by_tool: Array<{
        tool_id: string;
        tool_name: string;
        cost: number;
        units: number;
    }>;
    recent_events: UsageEvent[];
}

export interface SetPolicyInput {
    tenant_id: string;
    scope: 'tenant' | 'user' | 'tool';
    scope_id?: string;
    limit_type: 'daily' | 'monthly' | 'per_request';
    limit_value: number;
    fallback_tool_id?: string;
    decision: 'allow' | 'deny' | 'downgrade' | 'require_approval';
}

export interface PolicyEvaluationResult {
    allowed: boolean;
    reason: string;
    suggested_tool?: string;
    current_usage: number;
    limit: number;
}
