import { z } from 'zod';
import { DatabaseService } from '../lib/database';
import { UsageSummary } from '../types';

const db = new DatabaseService();

// Input schema
export const GetUsageSummarySchema = z.object({
    tenant_id: z.string(), // Removed .uuid() so it accepts any string
    user_id: z.string().optional(), // Removed .uuid()
    period: z.enum(['day', 'month']).default('day'),
    start_date: z.string().optional(),
    end_date: z.string().optional(),
});

/**
 * Get usage summary for a tenant/user
 */
export async function getUsageSummary(
    input: z.infer<typeof GetUsageSummarySchema>
): Promise<UsageSummary | { error: string }> {
    const { tenant_id, user_id, period, start_date, end_date } = input;

    try {
        const summary = await db.getUsageSummary(tenant_id, user_id, period, start_date, end_date);

        if (!summary) {
            return { error: 'Failed to fetch usage summary' };
        }

        return summary;
    } catch (error) {
        console.error('Error in getUsageSummary:', error);
        return {
            error: `Error fetching usage: ${error instanceof Error ? error.message : 'Unknown error'}`,
        };
    }
}
