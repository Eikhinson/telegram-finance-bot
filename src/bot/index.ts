import { Telegraf } from 'telegraf';
import * as dotenv from 'dotenv';
import { pool } from '../db/client';
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
    try {
        await next();
    } catch (e) {
        console.error('Middleware caught error:', e);
        throw e; // rethrow for bot.catch
    }
    const ms = Date.now() - start;
    console.log(`[${ctx.updateType}] ${ms}ms`);
});

// Diagnostics
bot.command('ping', async (ctx) => {
    await ctx.reply('🏓 Pong! Bot is alive and listening.');
});

bot.command('status', async (ctx) => {
    try {
        await ctx.reply('🔍 Checking system status...');

        // Check DB
        const startDb = Date.now();
        await pool.query('SELECT 1');
        const dbMs = Date.now() - startDb;

        await ctx.reply(`✅ Database: Connected (${dbMs}ms)\n✅ Bot: Online\n✅ Environment: ${process.env.NODE_ENV || 'development'}`);
    } catch (error) {
        console.error('Status check failed:', error);
        await ctx.reply(`❌ System Error:\nDatabase: Failed\nError: ${(error as Error).message}`);
    }
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
    // Try to reply to user if possible
    try {
        if (ctx && ctx.reply) {
            ctx.reply('❌ Внутренняя ошибка бота. Администратор уведомлен.');
        }
    } catch (e) {
        console.error('Could not reply with error message:', e);
    }
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
