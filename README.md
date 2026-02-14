# FluxAI 🛡️

**FluxAI - Advanced AI model cost optimization and smart routing**

FluxAI is a multi-tenant cost and quota management system for MCP (Model Context Protocol) agents. It acts as a "policy firewall" that intercepts tool and model calls, evaluates them against configured budgets and policies, and makes intelligent routing decisions (allow/deny/downgrade).

Built for the **2 fast 2 mcp** hackathon on We Make Devs.

## 🛠️ Tech Stack

### Backend
- **Runtime**: Node.js (v20+)
- **Language**: TypeScript (v5.9.3)
- **Framework**: Express.js (v5.2.1) - HTTP/REST API server
- **Database**: Supabase (PostgreSQL) - Scalable real-time database
- **MCP Protocol**: @modelcontextprotocol/sdk (v1.26.0) - Model Context Protocol integration

### Frontend (Admin Dashboard)
- **HTML5** - Simple admin UI for monitoring costs
- **Vanilla JavaScript** - Lightweight client-side interactions

### Core Libraries
- **dotenv** (v17.2.4) - Environment variable management
- **zod** (v4.3.6) - Runtime type validation and schema validation

### Development Tools
- **tsx** (v4.19.2) - TypeScript execution and watch mode
- **@types/node**, **@types/express**, **@types/cors** - TypeScript definitions

### Deployment
- **Docker** - Containerization with multi-stage builds
- **Docker Compose** - Local development orchestration
- **Node Alpine** - Lightweight production image

### AI Model Integration
- **Google Gemini** (1.5 Flash, 1.5 Pro) - Cost-efficient AI models
- **Anthropic Claude** (Optional) - Advanced reasoning models
- **OpenAI GPT** (Optional) - General-purpose language models

## 🎯 Features

- **Multi-tenant Budget Management**: Set daily/monthly limits per tenant, user, or tool
- **Smart Tool Routing**: Automatically downgrade to cheaper alternatives when budgets are tight
- **Policy Engine**: Flexible policies with allow/deny/downgrade/require_approval actions
- **Real-time Cost Tracking**: Track usage by tenant, user, and tool with aggregated summaries
- **MCP Integration**: Seamlessly integrates with Archestra's MCP ecosystem
- **Supabase Backend**: Leverages Supabase for scalable, real-time data management

## 🏗️ Architecture

```

FluxAI implements a layered architecture with clear separation of concerns:

### Core Components

#### 1. **MCP Server Layer** (`src/mcp-server.ts`)
- **Purpose**: Implements Model Context Protocol for agent integration
- **Transport**: HTTP/SSE (Server-Sent Events) for real-time streaming
- **Tools Exposed**: 
  - `check_and_route`: Main routing and policy enforcement
  - `get_usage_summary`: Real-time cost tracking
  - `set_policy`, `list_policies`, `delete_policy`: Policy management
  - `list_models`: Available model discovery
  - `smart_complete`: AI completion with auto-routing

#### 2. **HTTP API Server** (`src/index.ts`)
- **Purpose**: Admin dashboard and REST endpoints
- **Endpoints**:
  - `/` - Admin UI for cost monitoring
  - Health checks and status endpoints
- **Port**: 3001 (configurable via environment)

#### 3. **Business Logic Layer** (`src/lib/`)
- **Cost Estimator** (`cost-estimator.ts`): Calculates token costs per model
- **Policy Engine** (`policy-engine.ts`): Evaluates policies and makes routing decisions
- **Model Selector** (`model-selector.ts`): Intelligent model selection based on budget
- **Model Registry** (`model-registry.ts`): Centralized model configuration
- **Prompt Analyzer** (`prompt-analyzer.ts`): Analyzes prompts for complexity
- **Database Client** (`database.ts`): Supabase integration layer
- **API Clients** (`api-clients/`): External AI provider integrations

#### 4. **Tool Implementations** (`src/tools/`)
- **check-and-route.ts**: Policy-based request routing
- **get-usage-summary.ts**: Cost analytics and reporting
- **policy-tools.ts**: CRUD operations for policies
- **list-models.ts**: Model catalog management
- **smart-complete.ts**: AI completion with cost optimization

#### 5. **Data Layer**
- **Supabase (PostgreSQL)**: 
  - `tenants`: Multi-tenant configuration
  - `budgets`: Budget limits and alerts
  - `policies`: Routing policies
  - `usage_logs`: Request tracking
  - `usage_summaries`: Aggregated cost data
- **Schema**: `schema.sql` with RLS (Row Level Security)
- **Seed Data**: `seed-data.sql` with demo tenants

### Data Flow


┌─────────────────┐
│ Archestra Agent │
└────────┬────────┘
         │
         ▼
┌─────────────────────────┐
│  FluxAI MCP Server      │
│  ┌──────────────────┐   │
│  │ check_and_route  │   │
│  │ get_usage_summary│   │
│  │ set_policy       │   │
│  └──────────────────┘   │
└────────┬────────────────┘
         │
    ┌────┴────┐
    ▼         ▼
┌────────┐  ┌──────────────┐
│Supabase│  │Downstream MCP│
│   DB   │  │    Servers   │
└────────┘  └──────────────┘
```

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- Supabase account
- Archestra platform (optional for full demo)

### 1. Clone and Install

```bash
cd d:\2fast2mcp\fluxAI
npm install
```

### 2. Set Up Supabase

1. Create a new Supabase project at [supabase.com](https://supabase.com)
2. Run the schema:
   - Go to SQL Editor in Supabase dashboard
   - Copy and paste contents of `schema.sql`
   - Execute the SQL
3. (Optional) Load demo data:
   - Copy and paste contents of `seed-data.sql`
   - Execute the SQL

### 3. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your Supabase credentials:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
PORT=3001
```

### 4. Run the Server

**HTTP Server (for admin UI):**
```bash
npm run dev
```

**MCP Server (for Archestra integration):**
```bash
npm run mcp
```

## 🔧 MCP Tools

### `check_and_route`

Main tool for policy-governed tool routing.

**Input:**
```json
{
  "tenant_id": "uuid",
  "user_id": "uuid",
  "tool_id": "gpt-4",
  "estimated_units": 1000,
  "params": { "prompt": "Hello world" }
}
```

**Output:**
```json
{
  "decision": "allowed",
  "final_tool_used": "gpt-4",
  "cost_estimate": 0.03,
  "remaining_budget": 49.97,
  "message": "Request approved and routed"
}
```

### `get_usage_summary`

Get usage statistics and cost breakdown.

**Input:**
```json
{
  "tenant_id": "uuid",
  "period": "day"
}
```

### `set_policy`

Create a new policy.

**Input:**
```json
{
  "tenant_id": "uuid",
  "scope": "tenant",
  "limit_type": "daily",
  "limit_value": 50.00,
  "decision": "deny"
}
```

### `list_policies`

List all policies for a tenant.

### `delete_policy`

Delete a policy by ID.

## 📊 Demo Tenants

The seed data includes 3 demo tenants:

| Tenant | Plan | Daily Limit | Premium Access |
|--------|------|-------------|----------------|
| FreeCo | Free | $2 | ❌ (auto-downgrade) |
| ProCorp | Pro | $50 | ✅ |
| EnterpriseLLC | Enterprise | $500/month | ✅ |

**Demo User IDs:**
- FreeCo user: `aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa`
- ProCorp user: `bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb`

## 🎬 Demo Scenarios

### Scenario 1: Free Tier Downgrade

```bash
# FreeCo user tries to use GPT-4
# Result: Automatically downgraded to GPT-3.5 Turbo
```

### Scenario 2: Budget Exhaustion

```bash
# User hits daily limit
# Result: Request denied with clear message about budget
```

### Scenario 3: Pro Tier Success

```bash
# ProCorp user uses GPT-4
# Result: Allowed, cost tracked
```

## 🔌 Archestra Integration

### 1. Register FluxAI in Archestra

Add to your Archestra MCP catalog:

```json
{
  "name": "flux-ai",
  "command": "node",
  "args": ["dist/mcp-server.js"],
  "cwd": "/path/to/fluxAI"
}
```

### 2. Configure Agent

In your Archestra agent system prompt:

```
You are a cost-aware agent. Always use flux-ai.check_and_route 
before calling expensive tools like LLMs.

Your tenant_id: 22222222-2222-2222-2222-222222222222
Your user_id: bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb
```

## 📁 Project Structure

```
fluxAI/
├── src/
│   ├── index.ts              # HTTP server
│   ├── mcp-server.ts         # MCP server
│   ├── types/
│   │   └── index.ts          # TypeScript types
│   ├── lib/
│   │   ├── supabase.ts       # Supabase client
│   │   ├── cost-estimator.ts # Cost calculation
│   │   ├── policy-engine.ts  # Policy evaluation
│   │   └── database.ts       # DB operations
│   └── tools/
│       ├── check-and-route.ts
│       ├── get-usage-summary.ts
│       └── policy-tools.ts
├── schema.sql                # Database schema
├── seed-data.sql             # Demo data
├── package.json
└── tsconfig.json
```

## 🛠️ Development

```bash
# Build TypeScript
npm run build

# Run in development mode
npm run dev

# Run MCP server
npm run mcp
```

## 📝 TODO / Future Enhancements

- [ ] Admin dashboard UI
- [ ] Real downstream MCP server integration
- [ ] Webhook notifications for budget alerts
- [ ] Cost optimization recommendations
- [ ] Multi-currency support
- [ ] Advanced analytics and reporting

## 🏆 Hackathon Submission

**Project**: FluxAI - Cost & Policy Governor for MCP Agents  
**Hackathon**: 2 fast 2 mcp (We Make Devs)  
**Key Innovation**: Multi-tenant budget enforcement with smart tool downgrading

## 📄 License

MIT

## 🤝 Contributing

This is a hackathon project, but contributions are welcome!

---

Built with ❤️ for the MCP ecosystem
# test
