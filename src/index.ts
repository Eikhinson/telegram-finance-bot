import 'dotenv/config';
import { initDB } from './db/client';
import { startBot } from './bot';

async function main() {
    console.log('🚀 Starting Telegram Finance Bot...');

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
