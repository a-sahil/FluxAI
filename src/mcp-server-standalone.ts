// Standalone MCP Server for Smart AI Routing (No Database Required)
// This server only includes smart_complete and list_models tools

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import dotenv from 'dotenv';

// Import smart routing tools only
import { SmartCompleteSchema, smartComplete } from './tools/smart-complete.js';
import { ListModelsSchema, listModels } from './tools/list-models.js';

dotenv.config();

// Create MCP server
const server = new Server(
    {
        name: 'flux-ai-smart-router',
        version: '1.0.0',
    },
    {
        capabilities: {
            tools: {},
        },
    }
);

// Register tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
    console.error('ListTools request received');
    return {
        tools: [
            {
                name: 'smart_complete',
                description: 'Intelligent AI completion that automatically selects the best model based on task complexity and cost optimization',
                inputSchema: {
                    type: 'object',
                    properties: {
                        prompt: { type: 'string', description: 'The prompt to complete' },
                        context: { type: 'string', description: 'Optional context for the prompt' },
                        preferences: {
                            type: 'object',
                            properties: {
                                prefer_speed: { type: 'boolean', description: 'Prefer faster models' },
                                prefer_cost: { type: 'boolean', description: 'Prefer cheaper models' },
                                prefer_quality: { type: 'boolean', description: 'Prefer higher quality models' },
                                max_cost_per_request: { type: 'number', description: 'Maximum cost per request in USD' },
                            },
                        },
                        system_instruction: { type: 'string', description: 'System instruction for the model' },
                        max_tokens: { type: 'number', description: 'Maximum tokens to generate' },
                        temperature: { type: 'number', description: 'Temperature for generation (0-2)' },
                    },
                    required: ['prompt'],
                },
            },
            {
                name: 'list_models',
                description: 'List all available AI models with their capabilities and pricing',
                inputSchema: {
                    type: 'object',
                    properties: {
                        show_all: { type: 'boolean', description: 'Show all models including disabled ones' },
                    },
                },
            },
        ],
    };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    console.error('CallTool request received:', request.params.name);
    const { name, arguments: args } = request.params;

    try {
        switch (name) {
            case 'smart_complete': {
                const parsed = SmartCompleteSchema.parse(args);
                const result = await smartComplete(parsed);
                return {
                    content: [{
                        type: 'text',
                        // CHANGE THIS LINE to put the model name at the top:
                        text: `[🎯 Model: ${result.metadata.model_display_name} | Cost: $${result.metadata.cost_estimate.toFixed(6)}]\n\n${result.response}`
                    }]
                };
            }

            case 'list_models': {
                const parsed = ListModelsSchema.parse(args);
                const result = listModels(parsed);
                return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
            }

            default:
                throw new Error(`Unknown tool: ${name}`);
        }
    } catch (error) {
        console.error('Tool execution error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return {
            content: [{ type: 'text', text: JSON.stringify({ error: errorMessage }) }],
            isError: true,
        };
    }
});

// Start server with stdio transport
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('FluxAI Smart Router MCP Server running on stdio');
}

main().catch((error) => {
    console.error('Server error:', error);
    process.exit(1);
});
