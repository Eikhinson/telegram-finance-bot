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
    console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`📍 TELEGRAM_BOT_TOKEN: ${process.env.TELEGRAM_BOT_TOKEN ? 'SET (' + process.env.TELEGRAM_BOT_TOKEN.substring(0, 10) + '...)' : '❌ NOT SET'}`);
    console.log(`📍 POSTGRES_CONNECTION_STRING: ${process.env.POSTGRES_CONNECTION_STRING ? 'SET' : '❌ NOT SET'}`);
    console.log(`📍 OPENAI_API_KEY: ${process.env.OPENAI_API_KEY ? 'SET' : '❌ NOT SET'}`);

    // Start health check server for cloud deployments
    startHealthCheck();

    // Initialize database
    console.log('📍 Initializing database...');
    await initDB();

    // Start Telegram bot
    console.log('📍 Starting Telegram bot...');
    await startBot();

    console.log('✅ Bot is ready!');
}

main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
});

// Global error handlers
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    // Keep process alive if possible, or exit gracefully
    // For now, logging is critical to see what's wrong in logs
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
