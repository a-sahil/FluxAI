// Model Selector - Selects the optimal model based on prompt analysis and constraints

import { ModelDefinition, getModelsByTier, getModelsByCapability, getCheapestModel } from './model-registry.js';
import { PromptAnalysis, TaskComplexity, TaskType } from './prompt-analyzer.js';

export interface SelectionPreferences {
    preferSpeed?: boolean;      // Prefer faster models
    preferCost?: boolean;       // Prefer cheaper models
    preferQuality?: boolean;    // Prefer higher quality models
    budgetRemaining?: number;   // Remaining budget in USD
    maxCostPerRequest?: number; // Max cost per request in USD
}

export interface ModelSelection {
    model: ModelDefinition;
    reason: string;
    estimatedCost: number;
    alternatives: ModelDefinition[];
}

/**
 * Selects the optimal model based on prompt analysis and user preferences
 */
export function selectModel(
    analysis: PromptAnalysis,
    preferences: SelectionPreferences = {}
): ModelSelection {
    const { complexity, taskType } = analysis;

    // Handle image generation separately
    if (taskType === 'image') {
        return selectImageModel(preferences);
    }

    // Get candidate models based on task type
    let candidates = getModelsByCapability(taskType === 'code' ? 'code' : 'text');

    // Filter by budget if specified
    if (preferences.budgetRemaining !== undefined && preferences.budgetRemaining <= 0) {
        // Budget exhausted - use cheapest model only
        const cheapest = getCheapestModel('text');
        if (cheapest) {
            return {
                model: cheapest,
                reason: 'Budget exhausted - using cheapest available model',
                estimatedCost: estimateCostForModel(cheapest, analysis.estimatedTokens),
                alternatives: [],
            };
        }
    }

    // Select based on complexity and preferences
    let selectedModel: ModelDefinition | undefined;
    let reason: string;

    if (preferences.preferCost) {
        // Always prefer cheapest model
        selectedModel = getCheapestModel('text');
        reason = 'Cost optimization preference - selected cheapest model';
    } else if (preferences.preferSpeed) {
        // Prefer fast tier
        const fastModels = getModelsByTier('fast');
        selectedModel = fastModels[0];
        reason = 'Speed preference - selected fast tier model';
    } else if (preferences.preferQuality) {
        // Prefer premium tier
        const premiumModels = getModelsByTier('balanced');
        selectedModel = premiumModels[0];
        reason = 'Quality preference - selected premium tier model';
    } else {
        // Default: select based on complexity
        selectedModel = selectByComplexity(complexity);
        reason = `Complexity-based selection (${complexity})`;
    }

    // Fallback to cheapest if no model selected
    if (!selectedModel) {
        selectedModel = getCheapestModel('text');
        reason = 'Fallback to cheapest available model';
    }

    // Check max cost per request
    const estimatedCost = estimateCostForModel(selectedModel!, analysis.estimatedTokens);
    if (preferences.maxCostPerRequest && estimatedCost > preferences.maxCostPerRequest) {
        // Downgrade to cheaper model
        const cheapest = getCheapestModel('text');
        if (cheapest) {
            return {
                model: cheapest,
                reason: `Cost per request exceeds limit - downgraded to ${cheapest.displayName}`,
                estimatedCost: estimateCostForModel(cheapest, analysis.estimatedTokens),
                alternatives: [selectedModel!],
            };
        }
    }

    // Get alternatives
    const alternatives = candidates
        .filter(m => m.id !== selectedModel!.id)
        .slice(0, 3);

    return {
        model: selectedModel!,
        reason,
        estimatedCost,
        alternatives,
    };
}

function selectByComplexity(complexity: TaskComplexity): ModelDefinition | undefined {
    switch (complexity) {
        case 'simple':
            // Use fastest/cheapest model for simple tasks
            const fastModels = getModelsByTier('fast');
            return fastModels[0] || getCheapestModel('text');

        case 'medium':
            // Use balanced model for medium tasks
            const balancedModels = getModelsByTier('balanced');
            return balancedModels[0];

        case 'complex':
            // Use premium model for complex tasks
            const premiumModels = getModelsByTier('premium').filter(m => m.capabilities.text);
            return premiumModels[0];

        default:
            return getCheapestModel('text');
    }
}

function selectImageModel(preferences: SelectionPreferences): ModelSelection {
    const imageModels = getModelsByCapability('image');

    if (imageModels.length === 0) {
        throw new Error('No image generation models available');
    }

    const model = imageModels[0]; // Use first available image model

    return {
        model,
        reason: 'Image generation task detected',
        estimatedCost: 0.04, // Approximate cost per image
        alternatives: imageModels.slice(1),
    };
}

function estimateCostForModel(model: ModelDefinition, estimatedTokens: number): number {
    // Assume 1:1 input:output ratio for estimation
    const inputTokens = estimatedTokens;
    const outputTokens = estimatedTokens;

    const inputCost = (inputTokens / 1_000_000) * model.pricing.inputCostPer1MTokens;
    const outputCost = (outputTokens / 1_000_000) * model.pricing.outputCostPer1MTokens;

    return inputCost + outputCost;
}

/**
 * Calculate potential savings by using smart routing vs always using premium model
 */
export function calculateSavings(
    actualModel: ModelDefinition,
    premiumModel: ModelDefinition,
    estimatedTokens: number
): number {
    const actualCost = estimateCostForModel(actualModel, estimatedTokens);
    const premiumCost = estimateCostForModel(premiumModel, estimatedTokens);

    return Math.max(0, premiumCost - actualCost);
}
