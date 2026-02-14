import express from 'express';
import cors from 'cors';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { CallToolRequestSchema, ListToolsRequestSchema, isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import { InMemoryEventStore } from '@modelcontextprotocol/sdk/examples/shared/inMemoryEventStore.js';
import { randomUUID } from 'node:crypto';
import dotenv from 'dotenv';

// Import tools
import { CheckAndRouteSchema, checkAndRoute } from './tools/check-and-route.js';
import { GetUsageSummarySchema, getUsageSummary } from './tools/get-usage-summary.js';
import { SetPolicySchema, setPolicy, ListPoliciesSchema, listPolicies, DeletePolicySchema, deletePolicy } from './tools/policy-tools.js';
import { SmartCompleteSchema, smartComplete } from './tools/smart-complete.js';
import { ListModelsSchema, listModels } from './tools/list-models.js';
import { createGoogleAIClient } from './lib/api-clients/google-ai-client.js';

dotenv.config();

const app = express();
const MCP_PORT = parseInt(process.env.MCP_PORT || '3002');

// Middleware
app.use(cors({
    origin: true, // Allow all origins (Archestra backend may come from different ports)
    credentials: true,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'mcp-session-id']
}));
app.use(express.json());

// Store active SSE transports by session ID
const connections = new Map<string, SSEServerTransport>();
// Store StreamableHTTP transports by session ID
const streamableConnections = new Map<string, StreamableHTTPServerTransport>();
// Also track the most recent transport for clients that don't send sessionId
let lastTransport: SSEServerTransport | null = null;

// Create tool handlers function
function setupToolHandlers(server: Server) {
    // Register tools
    server.setRequestHandler(ListToolsRequestSchema, async () => {
        console.log('ListTools request received');
        return {
            tools: [
                {
                    name: 'check_and_route',
                    description: 'Check policy and route tool request with cost estimation',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            tenant_id: { type: 'string', format: 'uuid' },
                            user_id: { type: 'string', format: 'uuid' },
                            tool_id: { type: 'string' },
                            estimated_units: { type: 'number' },
                            params: { type: 'object' },
                        },
                        required: ['tenant_id', 'user_id', 'tool_id', 'estimated_units', 'params'],
                    },
                },
                {
                    name: 'get_usage_summary',
                    description: 'Get usage summary and cost breakdown',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            tenant_id: { type: 'string', format: 'uuid' },
                            user_id: { type: 'string', format: 'uuid' },
                            period: { type: 'string', enum: ['day', 'month'] },
                        },
                        required: ['tenant_id'],
                    },
                },
                {
                    name: 'set_policy',
                    description: 'Create or update a policy',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            tenant_id: { type: 'string', format: 'uuid' },
                            scope: { type: 'string', enum: ['tenant', 'user', 'tool'] },
                            scope_id: { type: 'string' },
                            limit_type: { type: 'string', enum: ['daily', 'monthly', 'per_request'] },
                            limit_value: { type: 'number' },
                            fallback_tool_id: { type: 'string' },
                            decision: { type: 'string', enum: ['allow', 'deny', 'downgrade', 'require_approval'] },
                        },
                        required: ['tenant_id', 'scope', 'limit_type', 'limit_value'],
                    },
                },
                {
                    name: 'list_policies',
                    description: 'List all policies for a tenant',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            tenant_id: { type: 'string', format: 'uuid' },
                        },
                        required: ['tenant_id'],
                    },
                },
                {
                    name: 'delete_policy',
                    description: 'Delete a policy by ID',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            policy_id: { type: 'string', format: 'uuid' },
                        },
                        required: ['policy_id'],
                    },
                },
                // Smart AI Routing Tools
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
                {
                    name: 'generate_image',
                    description: 'Generate an AI image based on a prompt using gemini-2.5-flash-image.',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            prompt: { type: 'string', description: 'Description of the image' },
                        },
                        required: ['prompt']
                    }
                },
            ],
        };
    });

    // Handle tool calls
    server.setRequestHandler(CallToolRequestSchema, async (request) => {
        console.log('CallTool request received:', request.params.name);
        const { name, arguments: args } = request.params;

        try {
            switch (name) {
                case 'check_and_route': {
                    const parsed = CheckAndRouteSchema.parse(args);
                    const result = await checkAndRoute(parsed);
                    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
                }

                case 'get_usage_summary': {
                    const parsed = GetUsageSummarySchema.parse(args);
                    const result = await getUsageSummary(parsed);
                    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
                }

                case 'set_policy': {
                    const parsed = SetPolicySchema.parse(args);
                    const result = await setPolicy(parsed);
                    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
                }

                case 'list_policies': {
                    const parsed = ListPoliciesSchema.parse(args);
                    const result = await listPolicies(parsed);
                    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
                }

                case 'delete_policy': {
                    const parsed = DeletePolicySchema.parse(args);
                    const result = await deletePolicy(parsed);
                    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
                }

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

                case 'generate_image': {
                    // --- GEMINI IMAGE GENERATION LOGIC ---
                    const prompt = (args as any)?.prompt;
                    if (!prompt) throw new Error('Missing prompt');

                    console.log(`Generating image using gemini-2.5-flash-image for: ${prompt}`);

                    const googleClient = createGoogleAIClient();
                    if (!googleClient) {
                        throw new Error('Google AI client not configured. Check GOOGLE_AI_API_KEY.');
                    }

                    const imageResult = await googleClient.generateImage({
                        prompt,
                        numberOfImages: 1
                    });

                    // Return the image as a markdown image with data URI
                    const image = imageResult.images[0];
                    return {
                        content: [
                            {
                                type: 'text',
                                text: `Here is your generated image:\n\n![${prompt}](${image.url})`
                            }
                        ]
                    };
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
}

// SSE endpoint for MCP
app.get('/sse', async (req, res) => {
    console.log('New SSE connection from:', req.ip);

    try {
        // Create a new MCP server instance for this connection
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

        // Setup tool handlers
        setupToolHandlers(server);

        // Create SSE transport - client will POST messages back to `/sse`
        const transport = new SSEServerTransport('/sse', res);

        // Track this transport by its session ID so POST requests can be routed
        const sessionId = transport.sessionId;
        connections.set(sessionId, transport);
        lastTransport = transport;
        console.log('Created SSE transport with sessionId:', sessionId);

        transport.onclose = () => {
            console.log('SSE transport closed for session:', sessionId);
            connections.delete(sessionId);
        };

        // Connect server to transport (this also starts the SSE stream)
        await server.connect(transport);

        console.log('SSE transport connected successfully');

        // Handle client disconnect
        req.on('close', () => {
            console.log('SSE HTTP request closed');
            server.close().catch(err => console.error('Error closing server:', err));
        });
    } catch (error) {
        console.error('Error setting up SSE connection:', error);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Failed to establish SSE connection' });
        }
    }
});

// POST endpoint for MCP messages (SSE client posts here)
app.post('/sse', express.json(), async (req, res) => {
    let sessionId = req.query.sessionId as string | undefined;
    console.log('POST /sse - Message received for session:', sessionId);
    console.log('Request body:', JSON.stringify(req.body, null, 2));
    console.log('Active connections:', Array.from(connections.keys()));

    // Try to resolve the transport using the sessionId if provided
    let transport = sessionId ? connections.get(sessionId) : undefined;

    // Fallback: if no sessionId was provided (some clients ignore it),
    // but we only have a single active transport, route to that one.
    if (!transport && connections.size === 1) {
        const [onlyId, onlyTransport] = connections.entries().next().value as [string, SSEServerTransport];
        sessionId = onlyId;
        transport = onlyTransport;
        console.log('No sessionId provided; falling back to sole active SSE session:', sessionId);
    }

    // Fallback: use last known transport as a best-effort route
    if (!transport && lastTransport) {
        transport = lastTransport;
        console.log('No matching sessionId; falling back to last SSE transport');
    }

    if (!transport) {
        console.error(`No active SSE transport found for POST /sse (sessionId: ${sessionId})`);
        res.status(404).json({ error: 'Session not found' });
        return;
    }

    try {
        console.log('Routing message to transport with sessionId:', transport.sessionId);
        // Let the SSE transport handle the JSON-RPC message and response
        await transport.handlePostMessage(req as any, res as any, req.body);
        console.log('Message handled successfully, response sent:', res.headersSent);
    } catch (error) {
        console.error('Error handling POST /sse message:', error);
        if (error instanceof Error) {
            console.error('Error stack:', error.stack);
        }
        if (!res.headersSent) {
            res.status(500).json({ error: 'Error handling message', details: error instanceof Error ? error.message : String(error) });
        }
    }
});

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'flux-ai-mcp', transport: 'sse' });
});

// StreamableHTTP endpoint (recommended, protocol version 2025-11-25)
app.all('/mcp', express.json(), async (req, res) => {
    console.log(`Received ${req.method} request to /mcp`);
    const sessionId = req.headers['mcp-session-id'] as string | undefined;

    try {
        let transport: StreamableHTTPServerTransport | undefined;

        // Handle existing session
        if (sessionId && streamableConnections.has(sessionId)) {
            transport = streamableConnections.get(sessionId);
            if (transport) {
                console.log('Reusing existing StreamableHTTP transport for session:', sessionId);
                await transport.handleRequest(req, res, req.body);
                return;
            }
        }

        // Handle POST initialization
        if (req.method === 'POST' && req.body && isInitializeRequest(req.body)) {
            console.log('Creating new StreamableHTTP transport for initialization');
            const eventStore = new InMemoryEventStore();
            transport = new StreamableHTTPServerTransport({
                sessionIdGenerator: () => randomUUID(),
                eventStore,
                onsessioninitialized: (sid) => {
                    console.log(`StreamableHTTP session initialized with ID: ${sid}`);
                    streamableConnections.set(sid, transport!);
                }
            });

            transport.onclose = () => {
                const sid = transport!.sessionId;
                if (sid) {
                    console.log(`StreamableHTTP transport closed for session: ${sid}`);
                    streamableConnections.delete(sid);
                }
            };

            // Create server and connect
            const server = new Server(
                { name: 'flux-ai', version: '1.0.0' },
                { capabilities: { tools: {} } }
            );
            setupToolHandlers(server);
            await server.connect(transport);
            console.log('StreamableHTTP transport connected successfully');

            // Handle the initialization request
            await transport.handleRequest(req, res, req.body);
            return;
        }

        // Handle GET requests (might be health check or stream fetch)
        if (req.method === 'GET') {
            // If no session ID, return endpoint info
            if (!sessionId) {
                res.json({
                    name: 'FluxAI MCP Server',
                    version: '1.0.0',
                    protocol: 'StreamableHTTP',
                    endpoint: '/mcp',
                    status: 'ready'
                });
                return;
            }
            // If session ID but no transport, return error
            res.status(404).json({
                jsonrpc: '2.0',
                error: { code: -32001, message: 'Session not found' },
                id: null
            });
            return;
        }

        // Invalid request
        console.error('Invalid request:', {
            method: req.method,
            hasSessionId: !!sessionId,
            hasBody: !!req.body,
            isInitialize: req.body ? isInitializeRequest(req.body) : false
        });
        res.status(400).json({
            jsonrpc: '2.0',
            error: {
                code: -32000,
                message: 'Bad Request: Invalid request method or missing session'
            },
            id: null
        });
    } catch (error) {
        console.error('Error handling StreamableHTTP request:', error);
        if (error instanceof Error) {
            console.error('Error stack:', error.stack);
        }
        if (!res.headersSent) {
            res.status(500).json({
                jsonrpc: '2.0',
                error: {
                    code: -32603,
                    message: 'Internal server error',
                    details: error instanceof Error ? error.message : String(error)
                },
                id: null
            });
        }
    }
});

// Info endpoint
app.get('/', (req, res) => {
    res.json({
        name: 'FluxAI MCP Server',
        version: '1.0.0',
        transports: ['SSE', 'StreamableHTTP'],
        endpoints: {
            sse: '/sse (deprecated SSE protocol)',
            streamable: '/mcp (recommended StreamableHTTP protocol)',
            health: '/health',
        },
    });
});

// Start server
app.listen(MCP_PORT, '0.0.0.0', () => {
    console.log(`FluxAI MCP Server (HTTP/SSE) running on http://0.0.0.0:${MCP_PORT}`);
    console.log(`SSE endpoint: http://localhost:${MCP_PORT}/sse`);
    console.log(`External access: http://192.168.29.75:${MCP_PORT}/sse`);
    console.log(`Health check: http://localhost:${MCP_PORT}/health`);
});