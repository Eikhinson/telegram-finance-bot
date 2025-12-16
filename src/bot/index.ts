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

export function startBot() {
    bot.launch();
    console.log('🤖 Telegram bot started');

    // Enable graceful stop
    process.once('SIGINT', () => bot.stop('SIGINT'));
    process.once('SIGTERM', () => bot.stop('SIGTERM'));
}

export { bot };
