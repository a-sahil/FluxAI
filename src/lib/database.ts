import { getSupabaseClient } from './supabase';
import { UsageEvent } from '../types';

export class DatabaseService {
    private supabase = getSupabaseClient();

    /**
     * Record a usage event
     */
    async recordUsage(event: Omit<UsageEvent, 'id' | 'created_at'>): Promise<UsageEvent | null> {
        const { data, error } = await this.supabase
            .from('usage_events')
            .insert({
                timestamp: event.timestamp,
                tenant_id: event.tenant_id,
                user_id: event.user_id,
                tool_id: event.tool_id,
                units: event.units,
                cost_estimate: event.cost_estimate,
                decision: event.decision,
                metadata: event.metadata,
            })
            .select()
            .single();

        if (error) {
            console.error('Error recording usage:', error);
            return null;
        }

        // Update aggregates asynchronously
        this.updateAggregates(event.tenant_id, event.user_id, event.tool_id, event.cost_estimate, event.units);

        return data as UsageEvent;
    }

    /**
     * Update usage aggregates
     */
    private async updateAggregates(
        tenantId: string,
        userId: string,
        toolId: string,
        cost: number,
        units: number
    ): Promise<void> {
        const now = new Date();

        // Daily aggregate
        const dayStart = new Date(now);
        dayStart.setHours(0, 0, 0, 0);

        await this.upsertAggregate(tenantId, userId, toolId, 'day', dayStart.toISOString().split('T')[0], cost, units);

        // Monthly aggregate
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        await this.upsertAggregate(tenantId, userId, toolId, 'month', monthStart.toISOString().split('T')[0], cost, units);
    }

    /**
     * Upsert aggregate record
     */
    private async upsertAggregate(
        tenantId: string,
        userId: string,
        toolId: string,
        periodType: 'day' | 'month',
        periodStart: string,
        cost: number,
        units: number
    ): Promise<void> {
        // Check if aggregate exists
        const { data: existing } = await this.supabase
            .from('usage_aggregates')
            .select('total_cost, total_units')
            .eq('tenant_id', tenantId)
            .eq('user_id', userId)
            .eq('tool_id', toolId)
            .eq('period_type', periodType)
            .eq('period_start', periodStart)
            .maybeSingle();

        if (existing) {
            // Update existing
            await this.supabase
                .from('usage_aggregates')
                .update({
                    total_cost: parseFloat(existing.total_cost) + cost,
                    total_units: existing.total_units + units,
                    updated_at: new Date().toISOString(),
                })
                .eq('tenant_id', tenantId)
                .eq('user_id', userId)
                .eq('tool_id', toolId)
                .eq('period_type', periodType)
                .eq('period_start', periodStart);
        } else {
            // Insert new
            await this.supabase
                .from('usage_aggregates')
                .insert({
                    tenant_id: tenantId,
                    user_id: userId,
                    tool_id: toolId,
                    period_type: periodType,
                    period_start: periodStart,
                    total_cost: cost,
                    total_units: units,
                });
        }
    }

    /**
     * Get tool by ID
     */
// src/lib/database.ts

async getTool(toolId: string) {
    const { data, error } = await this.supabase
        .from('tools')
        .select('*')
        .eq('id', toolId)
        .single();

    if (error) {
        // CODE ADDED: Ignore "Row not found" error, just return null
        if (error.code === 'PGRST116') {
            return null;
        }
        console.error('Error fetching tool:', error);
        return null;
    }

    return data;
}

    /**
     * Get usage summary
     */
    async getUsageSummary(
        tenantId: string,
        userId?: string,
        period: 'day' | 'month' = 'day',
        startDate?: string,
        endDate?: string
    ) {
        let query = this.supabase
            .from('usage_events')
            .select('*, tools(name)')
            .eq('tenant_id', tenantId);

        if (userId) {
            query = query.eq('user_id', userId);
        }

        if (startDate) {
            query = query.gte('timestamp', startDate);
        }

        if (endDate) {
            query = query.lte('timestamp', endDate);
        }

        const { data: events, error } = await query.order('timestamp', { ascending: false }).limit(50);

        if (error) {
            console.error('Error fetching usage summary:', error);
            return null;
        }

        // Aggregate by tool
        const byTool: Record<string, { cost: number; units: number; name: string }> = {};
        let totalCost = 0;
        let totalUnits = 0;

        events?.forEach((event: any) => {
            const cost = parseFloat(event.cost_estimate);
            totalCost += cost;
            totalUnits += event.units;

            if (!byTool[event.tool_id]) {
                byTool[event.tool_id] = {
                    cost: 0,
                    units: 0,
                    name: event.tools?.name || event.tool_id,
                };
            }

            byTool[event.tool_id].cost += cost;
            byTool[event.tool_id].units += event.units;
        });

        return {
            tenant_id: tenantId,
            user_id: userId,
            period,
            total_cost: totalCost,
            total_units: totalUnits,
            by_tool: Object.entries(byTool).map(([tool_id, data]) => ({
                tool_id,
                tool_name: data.name,
                cost: data.cost,
                units: data.units,
            })),
            recent_events: events || [],
        };
    }
}
