#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { checkAndRoute, CheckAndRouteSchema } from './tools/check-and-route.js';
import { getUsageSummary, GetUsageSummarySchema } from './tools/get-usage-summary.js';
import {
    setPolicy,
    listPolicies,
    deletePolicy,
    SetPolicySchema,
    ListPoliciesSchema,
    DeletePolicySchema,
} from './tools/policy-tools.js';

// Create MCP server
const server = new Server(
    {
        name: 'flux-ai',
        version: '1.0.0',
    },
    {
        capabilities: {
            tools: {},
        },
    }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
        tools: [
            {
                name: 'check_and_route',
                description:
                    'Check policies and route a tool request. Returns decision (allowed/denied/downgraded), cost estimate, and remaining budget.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        tenant_id: {
                            type: 'string',
                            description: 'UUID of the tenant making the request',
                        },
                        user_id: {
                            type: 'string',
                            description: 'UUID of the user making the request',
                        },
                        tool_id: {
                            type: 'string',
                            description: 'ID of the tool to use (e.g., "gpt-4", "gpt-3.5-turbo")',
                        },
                        estimated_units: {
                            type: 'number',
                            description: 'Estimated units (tokens or requests) for this call',
                        },
                        params: {
                            type: 'object',
                            description: 'Parameters to pass to the downstream tool',
                        },
                    },
                    required: ['tenant_id', 'user_id', 'tool_id', 'estimated_units', 'params'],
                },
            },
            {
                name: 'get_usage_summary',
                description:
                    'Get usage summary for a tenant or user, including cost breakdown by tool and recent events.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        tenant_id: {
                            type: 'string',
                            description: 'UUID of the tenant',
                        },
                        user_id: {
                            type: 'string',
                            description: 'Optional UUID of specific user',
                        },
                        period: {
                            type: 'string',
                            enum: ['day', 'month'],
                            description: 'Period to summarize (day or month)',
                        },
                        start_date: {
                            type: 'string',
                            description: 'Optional start date (ISO format)',
                        },
                        end_date: {
                            type: 'string',
                            description: 'Optional end date (ISO format)',
                        },
                    },
                    required: ['tenant_id'],
                },
            },
            {
                name: 'set_policy',
                description:
                    'Create a new policy for a tenant. Policies control budget limits and tool access.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        tenant_id: {
                            type: 'string',
                            description: 'UUID of the tenant',
                        },
                        scope: {
                            type: 'string',
                            enum: ['tenant', 'user', 'tool'],
                            description: 'Scope of the policy',
                        },
                        scope_id: {
                            type: 'string',
                            description: 'ID of user or tool if scope is user/tool',
                        },
                        limit_type: {
                            type: 'string',
                            enum: ['daily', 'monthly', 'per_request'],
                            description: 'Type of limit',
                        },
                        limit_value: {
                            type: 'number',
                            description: 'Limit value in USD',
                        },
                        fallback_tool_id: {
                            type: 'string',
                            description: 'Tool to use if downgrading',
                        },
                        decision: {
                            type: 'string',
                            enum: ['allow', 'deny', 'downgrade', 'require_approval'],
                            description: 'Action to take when limit is reached',
                        },
                    },
                    required: ['tenant_id', 'scope', 'limit_type', 'limit_value'],
                },
            },
            {
                name: 'list_policies',
                description: 'List all policies for a tenant.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        tenant_id: {
                            type: 'string',
                            description: 'UUID of the tenant',
                        },
                    },
                    required: ['tenant_id'],
                },
            },
            {
                name: 'delete_policy',
                description: 'Delete a policy by ID.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        policy_id: {
                            type: 'string',
                            description: 'UUID of the policy to delete',
                        },
                    },
                    required: ['policy_id'],
                },
            },
        ],
    };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
        switch (name) {
            case 'check_and_route': {
                const input = CheckAndRouteSchema.parse(args);
                const result = await checkAndRoute(input);
                return {
                    content: [
                        {
                            type: 'text',
                            text: JSON.stringify(result, null, 2),
                        },
                    ],
                };
            }

            case 'get_usage_summary': {
                const input = GetUsageSummarySchema.parse(args);
                const result = await getUsageSummary(input);
                return {
                    content: [
                        {
                            type: 'text',
                            text: JSON.stringify(result, null, 2),
                        },
                    ],
                };
            }

            case 'set_policy': {
                const input = SetPolicySchema.parse(args);
                const result = await setPolicy(input);
                return {
                    content: [
                        {
                            type: 'text',
                            text: JSON.stringify(result, null, 2),
                        },
                    ],
                };
            }

            case 'list_policies': {
                const input = ListPoliciesSchema.parse(args);
                const result = await listPolicies(input);
                return {
                    content: [
                        {
                            type: 'text',
                            text: JSON.stringify(result, null, 2),
                        },
                    ],
                };
            }

            case 'delete_policy': {
                const input = DeletePolicySchema.parse(args);
                const result = await deletePolicy(input);
                return {
                    content: [
                        {
                            type: 'text',
                            text: JSON.stringify(result, null, 2),
                        },
                    ],
                };
            }

            default:
                throw new Error(`Unknown tool: ${name}`);
        }
    } catch (error) {
        console.error(`Error executing tool ${name}:`, error);
        return {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify({
                        error: error instanceof Error ? error.message : 'Unknown error',
                    }),
                },
            ],
            isError: true,
        };
    }
});

// Start server
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('FluxAI MCP Server running on stdio');
}

main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
});
