// Quick test to verify the server returns generate_image tool
const http = require('http');

const data = JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/list',
    params: {}
});

const options = {
    hostname: 'localhost',
    port: 3002,
    path: '/mcp',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
    }
};

const req = http.request(options, (res) => {
    let responseData = '';

    res.on('data', (chunk) => {
        responseData += chunk;
    });

    res.on('end', () => {
        console.log('Response:', responseData);
        try {
            const parsed = JSON.parse(responseData);
            if (parsed.result && parsed.result.tools) {
                console.log('\n=== Available Tools ===');
                parsed.result.tools.forEach(tool => {
                    console.log(`- ${tool.name}: ${tool.description}`);
                });

                const hasGenerateImage = parsed.result.tools.some(t => t.name === 'generate_image');
                console.log(`\n✓ generate_image tool found: ${hasGenerateImage}`);
            }
        } catch (e) {
            console.error('Failed to parse response:', e.message);
        }
    });
});

req.on('error', (error) => {
    console.error('Error:', error.message);
});

req.write(data);
req.end();
