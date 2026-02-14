// Google AI API Client - Integrates with Google's Gemini and Imagen models

import { ModelDefinition } from '../model-registry.js';

export interface GoogleAIRequest {
    model: string;
    prompt: string;
    systemInstruction?: string;
    maxTokens?: number;
    temperature?: number;
}

export interface GoogleAIResponse {
    text: string;
    usage: {
        inputTokens: number;
        outputTokens: number;
    };
    model: string;
}

export interface ImageGenerationRequest {
    prompt: string;
    aspectRatio?: '1:1' | '16:9' | '9:16' | '4:3' | '3:4';
    numberOfImages?: number;
}

export interface ImageGenerationResponse {
    images: Array<{
        url: string;
        mimeType: string;
    }>;
}

/**
 * Google AI API Client
 */
export class GoogleAIClient {
    private apiKey: string;
    private baseUrl = 'https://generativelanguage.googleapis.com/v1beta';

    constructor(apiKey: string) {
        if (!apiKey) {
            throw new Error('Google AI API key is required');
        }
        this.apiKey = apiKey;
    }

    /**
     * Generate text completion using Gemini models
     */
    async generateText(request: GoogleAIRequest): Promise<GoogleAIResponse> {
        const { model, prompt, systemInstruction, maxTokens, temperature } = request;

        const requestBody: any = {
            contents: [
                {
                    parts: [{ text: prompt }]
                }
            ],
            generationConfig: {
                maxOutputTokens: maxTokens || 2048,
                temperature: temperature || 0.7,
            },
            ...(systemInstruction && {
                systemInstruction: {
                    parts: [{ text: systemInstruction }]
                }
            })
        };

        const url = `${this.baseUrl}/models/${model}:generateContent?key=${this.apiKey}`;

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody),
            });

            if (!response.ok) {
                const error = await response.text();
                throw new Error(`Google AI API error: ${response.status} - ${error}`);
            }

            const data = await response.json() as any;
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
            const usage = {
                inputTokens: data.usageMetadata?.promptTokenCount || 0,
                outputTokens: data.usageMetadata?.candidatesTokenCount || 0,
            };

            return { text, usage, model };
        } catch (error) {
            console.error('Google AI API error:', error);
            throw error;
        }
    }

    /**
     * Generate images using Gemini 2.5 Flash Image
     *
     * KEY FACTS (verified from Google docs):
     * - Model string: "gemini-2.5-flash-image" (GA — no -preview suffix)
     * - Endpoint: :generateContent (NOT :predict — that's Vertex AI only)
     * - To request image output use responseModalities: ["TEXT", "IMAGE"]
     * - responseMimeType does NOT accept "image/png" → causes 400 INVALID_ARGUMENT
     *   (only accepts text/plain, application/json, application/xml, application/yaml, text/x.enum)
     * - Response image is in candidates[0].content.parts[].inlineData.data (base64)
     * - Free tier: ~1,500 req/day, 60 req/min (Google AI Studio key)
     */
    async generateImage(request: ImageGenerationRequest): Promise<ImageGenerationResponse> {
        const { prompt, aspectRatio, numberOfImages = 1 } = request;

        const model = 'gemini-2.5-flash-image';
        const url = `${this.baseUrl}/models/${model}:generateContent?key=${this.apiKey}`;

        const requestBody: any = {
            contents: [
                {
                    role: 'user',
                    parts: [{ text: prompt }]
                }
            ],
            generationConfig: {
                // CORRECT: responseModalities triggers native image output
                // WRONG:   responseMimeType: "image/png"  ← 400 INVALID_ARGUMENT
                responseModalities: ['TEXT', 'IMAGE'],
                ...(aspectRatio && {
                    imageConfig: { aspectRatio }
                })
            }
        };

        const images: Array<{ url: string; mimeType: string }> = [];

        // The model generates one image per call; loop if multiple images requested
        for (let i = 0; i < numberOfImages; i++) {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody),
            });

            if (!response.ok) {
                const error = await response.text();
                throw new Error(`Google AI Image API error: ${response.status} - ${error}`);
            }

            const data = await response.json() as any;
            const parts = data.candidates?.[0]?.content?.parts ?? [];

            for (const part of parts) {
                if (part.inlineData) {
                    const mimeType = part.inlineData.mimeType || 'image/png';
                    images.push({
                        url: `data:${mimeType};base64,${part.inlineData.data}`,
                        mimeType,
                    });
                }
            }
        }

        if (images.length === 0) {
            throw new Error('No images returned from the API. The model may have only returned text.');
        }

        return { images };
    }

    /**
     * Count tokens in a text (approximate)
     */
    estimateTokens(text: string): number {
        return Math.ceil(text.length / 4);
    }
}

/**
 * Create a Google AI client instance
 */
export function createGoogleAIClient(apiKey?: string): GoogleAIClient | null {
    const key = apiKey || process.env.GOOGLE_AI_API_KEY;

    if (!key) {
        console.warn('Google AI API key not found. Google AI models will not be available.');
        return null;
    }

    return new GoogleAIClient(key);
}