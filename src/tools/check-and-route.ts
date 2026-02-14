import { z } from 'zod';
import { PolicyEngine } from '../lib/policy-engine';
import { CostEstimator } from '../lib/cost-estimator';
import { DatabaseService } from '../lib/database';
import { CheckAndRouteOutput } from '../types';

const db = new DatabaseService();
const policyEngine = new PolicyEngine();

// Input schema for check_and_route
// REMOVED .uuid() validation to be more forgiving with LLM inputs
export const CheckAndRouteSchema = z.object({
    tenant_id: z.string().min(1),
    user_id: z.string().min(1),
    tool_id: z.string(),
    estimated_units: z.number().positive(),
    params: z.record(z.string(), z.any()),
});

/**
 * Main tool: Check policies and route request to appropriate tool
 */
export async function checkAndRoute(
    input: z.infer<typeof CheckAndRouteSchema>
): Promise<CheckAndRouteOutput> {
    // Clean inputs (trim whitespace that LLMs might add)
    const tenant_id = input.tenant_id.trim();
    const user_id = input.user_id.trim();
    const { tool_id, estimated_units, params } = input;

    try {
        // Get tool information
        const tool = await db.getTool(tool_id);
        if (!tool) {
            return {
                decision: 'denied',
                final_tool_used: tool_id,
                cost_estimate: 0,
                remaining_budget: 0,
                message: `Tool ${tool_id} not found`,
            };
        }

        // Check if tool is allowed for tenant's plan
        const toolAllowed = await policyEngine.isToolAllowedForPlan(tenant_id, tool_id);
        if (!toolAllowed) {
            // Try to find a fallback
            const fallback = await policyEngine.getSuggestedFallback(tool_id);

            if (fallback) {
                return {
                    decision: 'downgraded',
                    final_tool_used: fallback,
                    cost_estimate: 0,
                    remaining_budget: 0,
                    message: `Tool ${tool_id} not available on your plan. Downgraded to ${fallback}`,
                };
            }

            return {
                decision: 'denied',
                final_tool_used: tool_id,
                cost_estimate: 0,
                remaining_budget: 0,
                message: `Tool ${tool_id} not available on your plan`,
            };
        }

        // Estimate cost
        const estimatedCost = CostEstimator.estimateCost(tool, estimated_units);

        // Evaluate policies
        const evaluation = await policyEngine.evaluateRequest(
            tenant_id,
            user_id,
            tool_id,
            estimatedCost
        );

        // If not allowed, handle accordingly
        if (!evaluation.allowed) {
            // Record denied event
            await db.recordUsage({
                timestamp: new Date().toISOString(),
                tenant_id,
                user_id,
                tool_id,
                units: 0,
                cost_estimate: 0,
                decision: 'denied',
                metadata: { reason: evaluation.reason },
            });

            return {
                decision: 'denied',
                final_tool_used: tool_id,
                cost_estimate: estimatedCost,
                remaining_budget: evaluation.limit - evaluation.current_usage,
                message: evaluation.reason,
            };
        }

        // If downgrade suggested
        if (evaluation.suggested_tool) {
            const fallbackTool = await db.getTool(evaluation.suggested_tool);
            const fallbackCost = fallbackTool
                ? CostEstimator.estimateCost(fallbackTool, estimated_units)
                : estimatedCost;

            // Record downgraded event
            await db.recordUsage({
                timestamp: new Date().toISOString(),
                tenant_id,
                user_id,
                tool_id: evaluation.suggested_tool,
                units: estimated_units,
                cost_estimate: fallbackCost,
                decision: 'downgraded',
                metadata: {
                    original_tool: tool_id,
                    reason: evaluation.reason,
                    params,
                },
            });

            return {
                decision: 'downgraded',
                final_tool_used: evaluation.suggested_tool,
                result: {
                    message: 'Request would be routed to downstream tool here',
                    tool: evaluation.suggested_tool,
                    params,
                },
                cost_estimate: fallbackCost,
                remaining_budget: evaluation.limit - evaluation.current_usage - fallbackCost,
                message: evaluation.reason,
            };
        }

        // Allowed - record usage and proceed
        await db.recordUsage({
            timestamp: new Date().toISOString(),
            tenant_id,
            user_id,
            tool_id,
            units: estimated_units,
            cost_estimate: estimatedCost,
            decision: 'allowed',
            metadata: { params },
        });

        return {
            decision: 'allowed',
            final_tool_used: tool_id,
            result: {
                message: 'Request would be routed to downstream tool here',
                tool: tool_id,
                params,
            },
            cost_estimate: estimatedCost,
            remaining_budget: evaluation.limit - evaluation.current_usage - estimatedCost,
            message: 'Request approved and routed',
        };
    } catch (error) {
        console.error('Error in checkAndRoute:', error);
        return {
            decision: 'denied',
            final_tool_used: tool_id,
            cost_estimate: 0,
            remaining_budget: 0,
            message: `Error processing request: ${error instanceof Error ? error.message : 'Unknown error'}`,
        };
    }
}