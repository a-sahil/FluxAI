# FluxAI Setup Guide

## Prerequisites

- Node.js 18+ installed
- Supabase account (free tier works)
- npm or yarn package manager

## Step 1: Supabase Setup

### Create a New Project

1. Go to [supabase.com](https://supabase.com) and sign in
2. Click "New Project"
3. Fill in project details:
   - Name: `flux-ai`
   - Database Password: (save this securely)
   - Region: Choose closest to you
4. Wait for project to be created (~2 minutes)

### Run Database Schema

1. In your Supabase dashboard, go to **SQL Editor**
2. Click "New Query"
3. Copy the entire contents of `schema.sql` from this project
4. Paste into the SQL editor
5. Click "Run" or press `Ctrl+Enter`
6. You should see "Success. No rows returned"

### Load Demo Data (Optional but Recommended)

1. In SQL Editor, create another new query
2. Copy the entire contents of `seed-data.sql`
3. Paste and run
4. This creates 3 demo tenants, 8 tools, and sample policies

### Get Your API Keys

1. Go to **Project Settings** → **API**
2. Copy these values:
   - `Project URL` → This is your `SUPABASE_URL`
   - `anon public` key → This is your `SUPABASE_ANON_KEY`
   - `service_role` key → This is your `SUPABASE_SERVICE_ROLE_KEY` (keep secret!)

## Step 2: Project Configuration

### Create .env File

```bash
cp .env.example .env
```

### Edit .env

Open `.env` in your text editor and fill in:

```env
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
PORT=3001
NODE_ENV=development
```

## Step 3: Install Dependencies

```bash
npm install
```

If you encounter errors, try:

```bash
npm install --legacy-peer-deps
```

## Step 4: Build the Project

```bash
npm run build
```

This compiles TypeScript to JavaScript in the `dist/` folder.

## Step 5: Test the Server

### Test HTTP Server

```bash
npm run dev
```

Open browser to `http://localhost:3001` - you should see the admin dashboard.

### Test MCP Server

```bash
npm run mcp
```

The server should start and output: `FluxAI MCP Server running on stdio`

Press `Ctrl+C` to stop.

## Step 6: Verify Database Connection

You can test the connection by checking the health endpoint:

```bash
curl http://localhost:3001/health
```

Should return: `{"status":"ok","service":"flux-ai"}`

## Step 7: Test MCP Tools (Optional)

You can test the MCP server using the MCP Inspector:

```bash
npx @modelcontextprotocol/inspector node dist/mcp-server.js
```

This opens a web UI where you can test the tools interactively.

## Step 8: Archestra Integration

### Register in Archestra

1. Start Archestra platform
2. Go to **MCP Registry**
3. Add new MCP server:
   - Name: `flux-ai`
   - Command: `node`
   - Args: `["d:/2fast2mcp/fluxAI/dist/mcp-server.js"]`
   - Working Directory: `d:/2fast2mcp/fluxAI`

### Create Test Agent

1. Go to **Agents** in Archestra
2. Create new agent with system prompt:

```
You are a cost-aware AI agent. Before using any expensive tools, 
you MUST call flux-ai.check_and_route to check budget and policies.

Your credentials:
- tenant_id: 22222222-2222-2222-2222-222222222222 (ProCorp)
- user_id: bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb

Always respect the decision from FluxAI.
```

3. Enable FluxAI tools for this agent

## Troubleshooting

### "Cannot find module" errors

Make sure you've run `npm run build` to compile TypeScript.

### "Missing Supabase configuration" error

Check that your `.env` file exists and has all required variables.

### Database connection errors

1. Verify your Supabase project is active
2. Check that API keys are correct
3. Ensure you've run `schema.sql`

### TypeScript compilation errors

Try deleting `node_modules` and reinstalling:

```bash
rm -rf node_modules package-lock.json
npm install
```

## Demo Tenant IDs

For testing, use these pre-seeded tenant/user IDs:

**FreeCo (Free Tier)**
- Tenant ID: `11111111-1111-1111-1111-111111111111`
- User ID: `aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa`
- Daily Limit: $2
- Premium tools: Denied (auto-downgrade)

**ProCorp (Pro Tier)**
- Tenant ID: `22222222-2222-2222-2222-222222222222`
- User ID: `bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb`
- Daily Limit: $50
- Premium tools: Allowed

## Next Steps

1. Test the demo scenarios in README.md
2. Create your own tenants and policies
3. Integrate with your Archestra agents
4. Build custom admin UI features

## Need Help?

- Check the main README.md for architecture details
- Review the code comments in `src/` files
- Test with MCP Inspector for debugging

Happy cost governing! 🛡️
