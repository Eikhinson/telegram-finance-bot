import 'dotenv/config';
import http from 'http';
import { initDB } from './db/client';
import { startBot } from './bot'; // Adjusted import path based on previous file view which showed it at src/bot/index.ts, but valid imports in src/index.ts were './bot'. Need to check where startBot is exported from. src/index.ts had "import { startBot } from './bot';" so I will respect that.

function startHealthCheck() {
    const port = process.env.PORT || 3000;
    const server = http.createServer((req, res) => {
        if (req.url === '/health') {
            res.writeHead(200, { 'Content-Type': 'text/plain' });
            res.end('OK');
        } else {
            res.writeHead(200, { 'Content-Type': 'text/plain' });
            res.end('Bot is running');
        }
    });

    server.listen(port, () => {
        console.log(`🏥 Health check server running on port ${port}`);
    });
}

async function main() {
    console.log('🚀 Starting Telegram Finance Bot...');

    // Start health check server for cloud deployments
    startHealthCheck();

    // Initialize database
    await initDB();

    // Start Telegram bot
    await startBot();

    console.log('✅ Bot is ready!');
}

main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
});
