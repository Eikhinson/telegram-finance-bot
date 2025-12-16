import { Telegraf } from 'telegraf';
import * as dotenv from 'dotenv';
import { handleVoice } from './handlers/voice-handler';
import { handleText } from './handlers/text-handler';
import {
    handleStart,
    handleReport,
    handleExport,
    handleHelp,
} from './handlers/command-handler';

dotenv.config();

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN!);

// Middleware for logging
bot.use(async (ctx, next) => {
    const start = Date.now();
    await next();
    const ms = Date.now() - start;
    console.log(`[${ctx.updateType}] ${ms}ms`);
});

// Commands
bot.command('start', handleStart);
bot.command('report', handleReport);
bot.command('export', handleExport);
bot.command('help', handleHelp);

// Message handlers
bot.on('voice', handleVoice);
bot.on('text', handleText);

// Error handling
bot.catch((err, ctx) => {
    console.error(`Error for ${ctx.updateType}:`, err);
    ctx.reply('Произошла ошибка. Попробуйте ещё раз.');
});

export async function startBot() {
    try {
        // @ts-ignore - Telegraf types might be slightly off for launch options in some versions
        await bot.launch({
            dropPendingUpdates: true,
        });
        console.log('🤖 Telegram bot started successfully');

        // Enable graceful stop
        const stopBot = (signal: string) => {
            console.log(`Checking signal: ${signal}`);
            bot.stop(signal);
        };

        process.once('SIGINT', () => stopBot('SIGINT'));
        process.once('SIGTERM', () => stopBot('SIGTERM'));
    } catch (error) {
        console.error('❌ Failed to start Telegram bot:', error);
        throw error;
    }
}

export { bot };
