const http = require('http');
const fs = require('fs');
const path = require('path');

const HOST = process.env.HOST || '0.0.0.0';
const PORT = Number(process.env.PORT) || 3000;

const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8'
};

function json(response, statusCode, payload) {
    response.writeHead(statusCode, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store'
    });
    response.end(JSON.stringify(payload));
}

function text(response, statusCode, payload) {
    response.writeHead(statusCode, {
        'Content-Type': 'text/plain; charset=utf-8'
    });
    response.end(payload);
}

function serveFile(response, pathname) {
    const safePath = pathname === '/' ? '/index.html' : pathname;
    const filePath = path.join(__dirname, safePath);

    if (!filePath.startsWith(__dirname)) {
        text(response, 403, 'Forbidden');
        return;
    }

    fs.readFile(filePath, (error, content) => {
        if (error) {
            text(response, 404, 'Not found');
            return;
        }

        const extension = path.extname(filePath).toLowerCase();
        response.writeHead(200, {
            'Content-Type': MIME_TYPES[extension] || 'application/octet-stream',
            'Cache-Control': 'no-store'
        });
        response.end(content);
    });
}

const server = http.createServer((request, response) => {
    const url = new URL(request.url, `http://${request.headers.host}`);

    if (request.method === 'GET' && url.pathname === '/api/realtime-config') {
        json(response, 200, {
            supabaseUrl: process.env.SUPABASE_URL || '',
            supabaseAnonKey: process.env.SUPABASE_ANON_KEY || ''
        });
        return;
    }

    if (request.method !== 'GET') {
        text(response, 405, 'Method not allowed');
        return;
    }

    serveFile(response, url.pathname);
});

server.listen(PORT, HOST, () => {
    console.log(`Pong server running at http://localhost:${PORT}`);
});
