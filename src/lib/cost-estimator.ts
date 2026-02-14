import { Tool } from '../types';

export class CostEstimator {
    /**
     * Estimate cost for a tool based on units
     */
    static estimateCost(tool: Tool, units: number): number {
        return tool.cost_per_unit * units;
    }

    /**
     * Estimate tokens for LLM calls based on input/output
     * This is a simplified estimation - in production you'd use tiktoken or similar
     */
    static estimateTokens(input: string, maxOutputTokens: number = 1000): number {
        // Rough estimation: ~4 characters per token
        const inputTokens = Math.ceil(input.length / 4);
        return inputTokens + maxOutputTokens;
    }

    /**
     * Get cost per token for common LLM models (in USD)
     */
    static getModelCostPerToken(modelId: string): { input: number; output: number } {
        const costs: Record<string, { input: number; output: number }> = {
            'gpt-4': { input: 0.00003, output: 0.00006 },
            'gpt-4-turbo': { input: 0.00001, output: 0.00003 },
            'gpt-3.5-turbo': { input: 0.0000005, output: 0.0000015 },
            'claude-3-opus': { input: 0.000015, output: 0.000075 },
            'claude-3-sonnet': { input: 0.000003, output: 0.000015 },
            'claude-3-haiku': { input: 0.00000025, output: 0.00000125 },
        };

        return costs[modelId] || { input: 0.00001, output: 0.00003 }; // default fallback
    }

    /**
     * Estimate cost for an LLM call
     */
    static estimateLLMCost(
        modelId: string,
        inputTokens: number,
        outputTokens: number
    ): number {
        const costs = this.getModelCostPerToken(modelId);
        return inputTokens * costs.input + outputTokens * costs.output;
    }

    /**
     * Parse actual token usage from LLM response
     */
    static parseTokenUsage(response: any): { input: number; output: number; total: number } {
        // Handle different response formats from various LLM providers
        if (response.usage) {
            return {
                input: response.usage.prompt_tokens || 0,
                output: response.usage.completion_tokens || 0,
                total: response.usage.total_tokens || 0,
            };
        }

        // Fallback
        return { input: 0, output: 0, total: 0 };
    }
}
