// @ts-nocheck - Mastra WorkflowResult types не имеют прямых свойств результата
import { Context } from 'telegraf';
import * as fs from 'fs';
import * as path from 'path';
import { voiceMessageWorkflow } from '../../mastra/workflows/voice-message-workflow';
import { mastra } from '../../mastra';

export async function handleVoice(ctx: Context) {
    if (!ctx.message || !('voice' in ctx.message)) {
        return;
    }

    await ctx.reply('🎤 Обрабатываю голосовое сообщение...');

    try {
        const voice = ctx.message.voice;
        const fileLink = await ctx.telegram.getFileLink(voice.file_id);

        // Download voice file
        const response = await fetch(fileLink.href);
        const buffer = await response.arrayBuffer();

        // Save temporarily
        const tempDir = path.join(process.cwd(), 'temp');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        const tempFilePath = path.join(tempDir, `voice_${Date.now()}.ogg`);
        fs.writeFileSync(tempFilePath, Buffer.from(buffer));

        // Run workflow
        const workflow = mastra.getWorkflow("voice-message-workflow");
        const run = await workflow.createRunAsync();

        const result = await run.start({
            inputData: {
                audioFilePath: tempFilePath,
                userId: ctx.from!.id.toString(),
            },
        });

        // Clean up temp file
        fs.unlinkSync(tempFilePath);

        if (result.success) {
            const categoryIcon = result.category === 'income' ? '💰' : '💸';
            await ctx.reply(
                `✅ Транзакция сохранена!\n\n` +
                `${categoryIcon} ${result.category === 'income' ? 'Доход' : 'Расход'}\n` +
                `💵 Сумма: ${result.amount.toLocaleString('ru-RU')} руб.\n` +
                `📝 ${result.description}`
            );
        } else {
            await ctx.reply('❌ Не удалось сохранить транзакцию. Попробуйте ещё раз.');
        }
    } catch (error) {
        console.error('Error handling voice:', error);
        await ctx.reply('❌ Ошибка при обработке голосового сообщения.');
    }
}
