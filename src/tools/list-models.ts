// List Models Tool - Shows available AI models and their pricing

import { z } from 'zod';
import { MODEL_REGISTRY, getEnabledModels } from '../lib/model-registry.js';

// Input schema
export const ListModelsSchema = z.object({
    show_all: z.boolean().optional().default(false),
});

export type ListModelsInput = z.infer<typeof ListModelsSchema>;

export interface ListModelsOutput {
    models: Array<{
        id: string;
        display_name: string;
        provider: string;
        tier: string;
        capabilities: string[];
        pricing: {
            input_per_1m: number;
            output_per_1m: number;
        };
        enabled: boolean;
    }>;
    total_count: number;
    enabled_count: number;
}

/**
 * List available AI models
 */
export function listModels(input: ListModelsInput): ListModelsOutput {
    const { show_all } = input;

    const modelsToShow = show_all ? MODEL_REGISTRY : getEnabledModels();

    const models = modelsToShow.map(model => ({
        id: model.id,
        display_name: model.displayName,
        provider: model.provider,
        tier: model.tier,
        capabilities: Object.entries(model.capabilities)
            .filter(([_, enabled]) => enabled)
            .map(([cap, _]) => cap),
        pricing: {
            input_per_1m: model.pricing.inputCostPer1MTokens,
            output_per_1m: model.pricing.outputCostPer1MTokens,
        },
        enabled: model.enabled,
    }));

    return {
        models,
        total_count: MODEL_REGISTRY.length,
        enabled_count: getEnabledModels().length,
    };
}
