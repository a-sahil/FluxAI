import { getSupabaseClient } from './supabase';
import {
    Policy,
    UsageAggregate,
    PolicyEvaluationResult,
    Tool,
} from '../types';

export class PolicyEngine {
    private supabase = getSupabaseClient();

    /**
     * Evaluate if a request should be allowed based on policies
     */
    async evaluateRequest(
        tenantId: string,
        userId: string,
        toolId: string,
        estimatedCost: number
    ): Promise<PolicyEvaluationResult> {
        // Fetch applicable policies
        const policies = await this.getApplicablePolicies(tenantId, userId, toolId);

        if (policies.length === 0) {
            return {
                allowed: true,
                reason: 'No policies defined, allowing by default',
                current_usage: 0,
                limit: Infinity,
            };
        }

        // Check each policy
        for (const policy of policies) {
            const currentUsage = await this.getCurrentUsage(
                tenantId,
                userId,
                toolId,
                policy.limit_type === 'per_request' ? 'daily' : policy.limit_type as 'daily' | 'monthly'
            );

            const projectedUsage = currentUsage + estimatedCost;

            // Check if this would exceed the limit
            if (projectedUsage > policy.limit_value) {
                // Handle based on policy decision
                if (policy.decision === 'deny') {
                    return {
                        allowed: false,
                        reason: `Would exceed ${policy.limit_type} limit of $${policy.limit_value}`,
                        current_usage: currentUsage,
                        limit: policy.limit_value,
                    };
                } else if (policy.decision === 'downgrade' && policy.fallback_tool_id) {
                    return {
                        allowed: true,
                        reason: `Downgrading to ${policy.fallback_tool_id} due to budget limit`,
                        suggested_tool: policy.fallback_tool_id,
                        current_usage: currentUsage,
                        limit: policy.limit_value,
                    };
                } else if (policy.decision === 'require_approval') {
                    return {
                        allowed: false,
                        reason: 'Requires manual approval due to budget limit',
                        current_usage: currentUsage,
                        limit: policy.limit_value,
                    };
                }
            }
        }

        // All policies passed
        const usage = await this.getCurrentUsage(tenantId, userId, toolId, 'daily');
        return {
            allowed: true,
            reason: 'Within budget limits',
            current_usage: usage,
            limit: policies[0]?.limit_value || Infinity,
        };
    }

    /**
     * Get applicable policies for a request
     * Priority: tool-specific > user-specific > tenant-wide
     */
    private async getApplicablePolicies(
        tenantId: string,
        userId: string,
        toolId: string
    ): Promise<Policy[]> {
        const { data, error } = await this.supabase
            .from('policies')
            .select('*')
            .eq('tenant_id', tenantId)
            .or(`scope.eq.tenant,and(scope.eq.user,scope_id.eq.${userId}),and(scope.eq.tool,scope_id.eq.${toolId})`)
            .order('scope', { ascending: false }); // tool > user > tenant

        if (error) {
            console.error('Error fetching policies:', error);
            return [];
        }

        return data as Policy[];
    }

    /**
     * Get current usage for a period
     */
    private async getCurrentUsage(
        tenantId: string,
        userId: string,
        toolId: string,
        periodType: 'daily' | 'monthly'
    ): Promise<number> {
        const periodStart = this.getPeriodStart(periodType);

        // Try to get from aggregates first for performance
        const { data: aggregate } = await this.supabase
            .from('usage_aggregates')
            .select('total_cost')
            .eq('tenant_id', tenantId)
            .eq('period_type', periodType === 'daily' ? 'day' : 'month')
            .eq('period_start', periodStart)
            .maybeSingle();

        if (aggregate) {
            return parseFloat(aggregate.total_cost.toString());
        }

        // Fallback: calculate from events
        const { data: events } = await this.supabase
            .from('usage_events')
            .select('cost_estimate')
            .eq('tenant_id', tenantId)
            .gte('timestamp', periodStart);

        if (!events || events.length === 0) {
            return 0;
        }

        return events.reduce((sum, event) => sum + parseFloat(event.cost_estimate.toString()), 0);
    }

    /**
     * Get the start of the current period
     */
    private getPeriodStart(periodType: 'daily' | 'monthly'): string {
        const now = new Date();

        if (periodType === 'daily') {
            now.setHours(0, 0, 0, 0);
        } else {
            now.setDate(1);
            now.setHours(0, 0, 0, 0);
        }

        return now.toISOString();
    }

    /**
     * Check if a tool is allowed for a tenant's plan
     */
    async isToolAllowedForPlan(tenantId: string, toolId: string): Promise<boolean> {
        const { data: tenant } = await this.supabase
            .from('tenants')
            .select('plan')
            .eq('id', tenantId)
            .single();

        const { data: tool } = await this.supabase
            .from('tools')
            .select('tier')
            .eq('id', toolId)
            .single();

        if (!tenant || !tool) {
            return false;
        }

        // Free plan can't use premium tools
        if (tenant.plan === 'free' && tool.tier === 'premium') {
            return false;
        }

        return true;
    }

    /**
     * Get suggested fallback tool
     */
    async getSuggestedFallback(toolId: string): Promise<string | null> {
        const { data: tool } = await this.supabase
            .from('tools')
            .select('category, tier')
            .eq('id', toolId)
            .single();

        if (!tool) {
            return null;
        }

        // Find a cheaper tool in the same category
        const { data: alternatives } = await this.supabase
            .from('tools')
            .select('id, tier, cost_per_unit')
            .eq('category', tool.category)
            .neq('id', toolId)
            .order('cost_per_unit', { ascending: true })
            .limit(1);

        return alternatives && alternatives.length > 0 ? alternatives[0].id : null;
    }
}
