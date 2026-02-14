// Model Registry - Defines all available AI models with pricing and capabilities

export interface ModelDefinition {
    id: string;
    provider: 'google' | 'anthropic' | 'openai';
    name: string;
    displayName: string;
    tier: 'fast' | 'balanced' | 'premium';
    capabilities: {
        text: boolean;
        code: boolean;
        image: boolean;
        reasoning: boolean;
    };
    pricing: {
        inputCostPer1MTokens: number;  // USD per 1M input tokens
        outputCostPer1MTokens: number; // USD per 1M output tokens
    };
    contextWindow: number;
    enabled: boolean;
}

export const MODEL_REGISTRY: ModelDefinition[] = [
    // Google AI Models
    {
        id: 'gemini-2.5-flash',
        provider: 'google',
        name: 'gemini-2.5-flash',
        displayName: 'Gemini 2.5 Flash',
        tier: 'fast',
        capabilities: {
            text: true,
            code: true,
            image: false,
            reasoning: true,
        },
        pricing: {
            inputCostPer1MTokens: 0.075,
            outputCostPer1MTokens: 0.30,
        },
        contextWindow: 1000000,
        enabled: true,
    },
    {
        // FIX: Correct model ID — must include "-preview" suffix
        id: 'gemini-2.5-flash-image-preview',
        provider: 'google',
        name: 'gemini-2.5-flash-image-preview',
        displayName: 'Gemini 2.5 Flash Image',
        tier: 'fast',
        capabilities: {
            text: false,
            code: false,
            image: true,
            reasoning: false,
        },
        pricing: {
            // Each image = 1,290 output tokens = ~$0.039/image on paid tier
            // Free tier: ~500 requests/day via Google AI Studio key
            inputCostPer1MTokens: 0.075,
            outputCostPer1MTokens: 0.30,
        },
        contextWindow: 1000000,
        enabled: false,
    },
    {
        id: 'gemini-2.5-flash-lite',
        provider: 'google',
        name: 'gemini-2.5-flash-lite',
        displayName: 'gemini-2.5-flash-lite',
        tier: 'balanced',
        capabilities: {
            text: true,
            code: true,
            image: false,
            reasoning: true,
        },
        pricing: {
            inputCostPer1MTokens: 1.25,
            outputCostPer1MTokens: 5.00,
        },
        contextWindow: 2000000,
        enabled: true,
    },
    {
        id: 'gemini-exp-1206 ',
        provider: 'google',
        name: 'gemini-exp-1206 ',
        displayName: 'gemini-exp-1206 ',
        tier: 'premium',
        capabilities: {
            text: true,
            code: true,
            image: false,
            reasoning: true,
        },
        pricing: {
            inputCostPer1MTokens: 1.25,
            outputCostPer1MTokens: 5.00,
        },
        contextWindow: 2000000,
        enabled: true,
    },
    {
        id: 'imagen-3',
        provider: 'google',
        name: 'imagen-3',
        displayName: 'Imagen 3',
        tier: 'premium',
        capabilities: {
            text: false,
            code: false,
            image: true,
            reasoning: false,
        },
        pricing: {
            inputCostPer1MTokens: 0,
            outputCostPer1MTokens: 0,
        },
        contextWindow: 0,
        enabled: false, // Disabled in favor of gemini-2.5-flash-image-preview
    },

    // Anthropic Models (Optional)
    {
        id: 'claude-3.5-haiku',
        provider: 'anthropic',
        name: 'claude-3-5-haiku-20241022',
        displayName: 'Claude 3.5 Haiku',
        tier: 'fast',
        capabilities: {
            text: true,
            code: true,
            image: false,
            reasoning: true,
        },
        pricing: {
            inputCostPer1MTokens: 1.00,
            outputCostPer1MTokens: 5.00,
        },
        contextWindow: 200000,
        enabled: false,
    },
    {
        id: 'claude-3.5-sonnet',
        provider: 'anthropic',
        name: 'claude-3-5-sonnet-20241022',
        displayName: 'Claude 3.5 Sonnet',
        tier: 'balanced',
        capabilities: {
            text: true,
            code: true,
            image: false,
            reasoning: true,
        },
        pricing: {
            inputCostPer1MTokens: 3.00,
            outputCostPer1MTokens: 15.00,
        },
        contextWindow: 200000,
        enabled: false,
    },
    {
        id: 'claude-3-opus',
        provider: 'anthropic',
        name: 'claude-3-opus-20240229',
        displayName: 'Claude 3 Opus',
        tier: 'premium',
        capabilities: {
            text: true,
            code: true,
            image: false,
            reasoning: true,
        },
        pricing: {
            inputCostPer1MTokens: 15.00,
            outputCostPer1MTokens: 75.00,
        },
        contextWindow: 200000,
        enabled: false,
    },

    // OpenAI Models (Optional)
    {
        id: 'gpt-3.5-turbo',
        provider: 'openai',
        name: 'gpt-3.5-turbo',
        displayName: 'GPT-3.5 Turbo',
        tier: 'fast',
        capabilities: {
            text: true,
            code: true,
            image: false,
            reasoning: true,
        },
        pricing: {
            inputCostPer1MTokens: 0.50,
            outputCostPer1MTokens: 1.50,
        },
        contextWindow: 16385,
        enabled: false,
    },
    {
        id: 'gpt-4-turbo',
        provider: 'openai',
        name: 'gpt-4-turbo',
        displayName: 'GPT-4 Turbo',
        tier: 'balanced',
        capabilities: {
            text: true,
            code: true,
            image: false,
            reasoning: true,
        },
        pricing: {
            inputCostPer1MTokens: 10.00,
            outputCostPer1MTokens: 30.00,
        },
        contextWindow: 128000,
        enabled: false,
    },
    {
        id: 'gpt-4',
        provider: 'openai',
        name: 'gpt-4',
        displayName: 'GPT-4',
        tier: 'premium',
        capabilities: {
            text: true,
            code: true,
            image: false,
            reasoning: true,
        },
        pricing: {
            inputCostPer1MTokens: 30.00,
            outputCostPer1MTokens: 60.00,
        },
        contextWindow: 8192,
        enabled: false,
    },
];

// Helper functions
export function getModelById(modelId: string): ModelDefinition | undefined {
    return MODEL_REGISTRY.find(m => m.id === modelId);
}

export function getEnabledModels(): ModelDefinition[] {
    return MODEL_REGISTRY.filter(m => m.enabled);
}

export function getModelsByTier(tier: 'fast' | 'balanced' | 'premium'): ModelDefinition[] {
    return MODEL_REGISTRY.filter(m => m.enabled && m.tier === tier);
}

export function getModelsByCapability(capability: keyof ModelDefinition['capabilities']): ModelDefinition[] {
    return MODEL_REGISTRY.filter(m => m.enabled && m.capabilities[capability]);
}

export function getCheapestModel(capability: keyof ModelDefinition['capabilities']): ModelDefinition | undefined {
    const models = getModelsByCapability(capability);
    if (models.length === 0) return undefined;

    return models.reduce((cheapest, current) => {
        const cheapestCost = cheapest.pricing.inputCostPer1MTokens + cheapest.pricing.outputCostPer1MTokens;
        const currentCost = current.pricing.inputCostPer1MTokens + current.pricing.outputCostPer1MTokens;
        return currentCost < cheapestCost ? current : cheapest;
    });
}

export function estimateCost(modelId: string, inputTokens: number, outputTokens: number): number {
    const model = getModelById(modelId);
    if (!model) return 0;

    const inputCost = (inputTokens / 1_000_000) * model.pricing.inputCostPer1MTokens;
    const outputCost = (outputTokens / 1_000_000) * model.pricing.outputCostPer1MTokens;

    return inputCost + outputCost;
}