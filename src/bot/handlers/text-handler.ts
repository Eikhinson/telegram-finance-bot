// @ts-nocheck - Mastra tool.execute требует runtimeContext сложной структуры
import { Context } from 'telegraf';
import { mastra } from '../../mastra';
import { saveTransactionTool } from '../../mastra/tools/transaction-tools';

// Keywords that indicate a transaction vs a question
const TRANSACTION_KEYWORDS = [
    'получил', 'получила', 'заработал', 'продал', 'выручка',
    'оплатил', 'оплатила', 'потратил', 'купил', 'заплатил',
    'аренда', 'зарплата', 'расход', 'доход', 'руб', 'рублей',
    'тыс', 'к', '₽',
];

function isTransactionMessage(text: string): boolean {
    const lowerText = text.toLowerCase();
    // Check if contains numbers (amounts) AND transaction keywords
    const hasAmount = /\d+/.test(text);
    const hasKeyword = TRANSACTION_KEYWORDS.some(keyword => lowerText.includes(keyword));
    return hasAmount && hasKeyword;
}

export async function handleText(ctx: Context) {
    if (!ctx.message || !('text' in ctx.message)) {
        return;
    }

    const text = ctx.message.text;
    const userId = ctx.from!.id.toString();

    // Check if it's a transaction or a question
    if (isTransactionMessage(text)) {
        await ctx.reply('💭 Обрабатываю транзакции...');

        try {
            const agent = mastra.getAgent("categorization");

            const result = await agent.generate(text, {
                resourceId: userId,
            });

            // Parse the structured output (array of transactions)
            const data = JSON.parse(result.text);
            const transactions = data.transactions || [data];

            if (transactions.length === 0) {
                await ctx.reply('❌ Не удалось распознать транзакции. Проверьте формат.');
                return;
            }

            // Save all transactions
            const savedResults = [];
            for (const tx of transactions) {
                const saveResult = await saveTransactionTool.execute({
                    context: {
                        userId,
                        amount: tx.amount,
                        category: tx.category,
                        subcategory: tx.subcategory,
                        // @ts-ignore
                        description: tx.description,
                        // @ts-ignore
                        date: tx.date,
                    },
                });
                savedResults.push({ ...tx, success: saveResult.success });
            }

            // Format response
            const successCount = savedResults.filter(r => r.success).length;
            let response = `✅ Сохранено ${successCount} из ${transactions.length} транзакций:\n\n`;

            for (const tx of savedResults) {
                const icon = tx.category === 'income' ? '💰' : '💸';
                const status = tx.success ? '✓' : '✗';
                // HTML bold for description
                response += `${status} ${icon} <b>${tx.amount.toLocaleString('ru-RU')} руб.</b> — ${tx.description}\n`;
            }

            await ctx.reply(response, { parse_mode: 'HTML' });
        } catch (error) {
            console.error('Error processing transactions:', error);
            await ctx.reply('❌ Ошибка при обработке транзакций.');
        }
    } else {
        // Process as question for finance assistant
        await ctx.reply('🤔 Ищу ответ...');

        try {
            const agent = mastra.getAgent("financeAssistant");

            const result = await agent.generate(text, {
                resourceId: userId,
                threadId: userId, // Using userId as threadId for conversation continuity
            });

            await ctx.reply(result.text);
        } catch (error) {
            console.error('Error answering question:', error);
            await ctx.reply('❌ Не удалось получить ответ. Попробуйте переформулировать вопрос.');
        }
    }
}
