import { z } from 'zod';
import { getSupabaseClient } from '../lib/supabase';
import { Policy } from '../types';

const supabase = getSupabaseClient();

// Input schemas
export const SetPolicySchema = z.object({
    tenant_id: z.string().min(1), // Relaxed validation
    scope: z.enum(['tenant', 'user', 'tool']),
    scope_id: z.string().optional(),
    limit_type: z.enum(['daily', 'monthly', 'per_request']),
    limit_value: z.number().positive(),
    fallback_tool_id: z.string().optional(),
    decision: z.enum(['allow', 'deny', 'downgrade', 'require_approval']).default('allow'),
});

export const ListPoliciesSchema = z.object({
    tenant_id: z.string().min(1), // Relaxed validation
});

export const DeletePolicySchema = z.object({
    policy_id: z.string().min(1), // Relaxed validation
});

/**
 * Create or update a policy
 */
export async function setPolicy(
    input: z.infer<typeof SetPolicySchema>
): Promise<Policy | { error: string }> {
    try {
        const { data, error } = await supabase
            .from('policies')
            .insert({
                tenant_id: input.tenant_id.trim(),
                scope: input.scope,
                scope_id: input.scope_id ? input.scope_id.trim() : undefined,
                limit_type: input.limit_type,
                limit_value: input.limit_value,
                fallback_tool_id: input.fallback_tool_id,
                decision: input.decision,
            })
            .select()
            .single();

        if (error) {
            console.error('Error creating policy:', error);
            return { error: error.message };
        }

        return data as Policy;
    } catch (error) {
        console.error('Error in setPolicy:', error);
        return {
            error: `Error creating policy: ${error instanceof Error ? error.message : 'Unknown error'}`,
        };
    }
}

/**
 * List all policies for a tenant
 */
export async function listPolicies(
    input: z.infer<typeof ListPoliciesSchema>
): Promise<Policy[] | { error: string }> {
    try {
        const { data, error } = await supabase
            .from('policies')
            .select('*')
            .eq('tenant_id', input.tenant_id.trim())
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error listing policies:', error);
            return { error: error.message };
        }

        return data as Policy[];
    } catch (error) {
        console.error('Error in listPolicies:', error);
        return {
            error: `Error listing policies: ${error instanceof Error ? error.message : 'Unknown error'}`,
        };
    }
}

/**
 * Delete a policy
 */
export async function deletePolicy(
    input: z.infer<typeof DeletePolicySchema>
): Promise<{ success: boolean; error?: string }> {
    try {
        const { error } = await supabase
            .from('policies')
            .delete()
            .eq('id', input.policy_id.trim());

        if (error) {
            console.error('Error deleting policy:', error);
            return { success: false, error: error.message };
        }

        return { success: true };
    } catch (error) {
        console.error('Error in deletePolicy:', error);
        return {
            success: false,
            error: `Error deleting policy: ${error instanceof Error ? error.message : 'Unknown error'}`,
        };
    }
}