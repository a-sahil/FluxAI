import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(express.json());
app.use(express.static('public'));

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'flux-ai' });
});

// API routes
app.get('/api/status', (req, res) => {
    res.json({
        service: 'FluxAI',
        version: '1.0.0',
        mcp_server: 'active',
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`FluxAI HTTP server running on port ${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/health`);
    console.log(`\nTo run MCP server: npm run mcp`);
});
