// @ts-nocheck - Mastra workflow result types incompatible with strict typing
import { Context } from 'telegraf';
import { mastra } from '../../mastra';
import { exportToCSVTool } from '../../mastra/tools/export-tools';
import { forecastRevenueTool, breakEvenAnalysisTool } from '../../mastra/tools/forecast-tools';

export async function handleStart(ctx: Context) {
    await ctx.reply(
        `👋 Добро пожаловать в AI-систему финансового учёта!\n\n` +
        `Я понимаю команды на естественном языке. Просто напишите мне, что нужно сделать.\n\n` +
        `<b>📝 Добавление транзакций:</b>\n` +
        `• "Получил 50000 от клиента, заплатил аренду 30к"\n` +
        `• Можно писать несколько сразу или диктовать голосом.\n\n` +
        `<b>📊 Отчёты и аналитика (просто попросите):</b>\n` +
        `• "Пришли отчет" или "Покажи P&L"\n` +
        `• "Сделай прогноз доходов"\n` +
        `• "Посчитай безубыточность"\n` +
        `• "Экспорт в Excel/CSV"\n\n` +
        `<b>❓ Вопросы:</b>\n` +
        `• "Куда ушли деньги в этом месяце?"\n` +
        `• "Сколько я потратил на маркетинг?"`,
        { parse_mode: 'HTML' }
    );
}

export async function handleReport(ctx: Context) {
    await ctx.reply('📊 Генерирую отчёт...');

    try {
        const userId = ctx.from!.id.toString();

        // Report for current month
        const now = new Date();
        const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);

        const workflow = mastra.getWorkflow("report-workflow");
        const run = await workflow.createRunAsync();

        const result = await run.start({
            inputData: {
                userId,
                startDate: startDate.toISOString(),
                endDate: endDate.toISOString(),
            },
        });

        const reportOutput = result.results?.['format-report'];
        if (reportOutput && reportOutput.status === 'success') {
            await ctx.reply(reportOutput.output.formattedReport, { parse_mode: 'HTML' });
        } else {
            throw new Error("Report generation failed");
        }
    } catch (error) {
        console.error('Error generating report:', error);
        await ctx.reply('❌ Ошибка при генерации отчёта.');
    }
}

export async function handleExport(ctx: Context) {
    await ctx.reply('📁 Экспортирую данные...');

    try {
        const userId = ctx.from!.id.toString();

        const result = await exportToCSVTool.execute({
            context: {
                userId,
            },
            suspend: () => Promise.resolve(),
            runId: 'manual',
            runtimeContext: {}
        });

        if (result.success && result.filePath) {
            await ctx.replyWithDocument({
                source: result.filePath,
                filename: 'transactions.csv',
            });
            await ctx.reply(`✅ Экспортировано ${result.rowCount} транзакций`);
        } else {
            await ctx.reply('❌ Нет данных для экспорта');
        }
    } catch (error) {
        console.error('Error exporting:', error);
        await ctx.reply('❌ Ошибка при экспорте данных.');
    }
}

export async function handleHelp(ctx: Context) {
    await ctx.reply(
        `📖 <b>СПРАВКА</b>\n\n` +
        `Я работаю полностью на естественном языке. Вам не нужно запоминать команды.\n\n` +
        `<b>Как добавить доход/расход:</b>\n` +
        `Просто напишите: "Купил ноутбук за 80000" или "Пришла оплата 15000 за сайт".\n` +
        `Можно указать несколько операций сразу: "Такси 500, обед 1000, кофе 300".\n\n` +
        `<b>Как получить отчёт:</b>\n` +
        `Напишите: "отчет", "report", "итоги месяца", "P&L".\n\n` +
        `<b>Как скачать данные:</b>\n` +
        `Напишите: "экспорт", "csv", "скачать базу".\n\n` +
        `<b>Аналитика:</b>\n` +
        `Напишите: "прогноз" (forecast) или "безубыточность" (breakeven).\n\n` +
        `<b>Вопросы:</b>\n` +
        `В любой момент спросите: "Сколько денег осталось?", "Где самые большие расходы?".`,
        { parse_mode: 'HTML' }
    );
}

// Forecast command
export async function handleForecast(ctx: Context) {
    await ctx.reply('📈 Строю прогноз...');

    try {
        const userId = ctx.from!.id.toString();

        const result = await forecastRevenueTool.execute({
            context: { userId, months: 3 },
            suspend: () => Promise.resolve(),
            runId: 'manual',
            runtimeContext: {}
        });

        let response = `📈 <b>ПРОГНОЗ ДОХОДОВ</b>\n\n`;
        response += `Средний месячный доход: ${result.averageMonthlyIncome.toLocaleString('ru-RU')} руб.\n\n`;

        if (result.forecastedRevenue.length > 0) {
            response += `<b>Прогноз:</b>\n`;
            for (const f of result.forecastedRevenue) {
                response += `• ${f.month}: ~${f.estimated.toLocaleString('ru-RU')} руб.\n`;
            }
        }

        response += `\nУверенность: ${result.confidence}`;

        await ctx.reply(response, { parse_mode: 'HTML' });
    } catch (error) {
        console.error('Error forecasting:', error);
        await ctx.reply('❌ Ошибка при построении прогноза.');
    }
}

// Break-even analysis command
export async function handleBreakeven(ctx: Context) {
    await ctx.reply('⚖️ Анализирую безубыточность...');

    try {
        const userId = ctx.from!.id.toString();

        const result = await breakEvenAnalysisTool.execute({
            context: { userId, months: 3 },
            suspend: () => Promise.resolve(),
            runId: 'manual',
            runtimeContext: {}
        });

        const icon = result.breakEvenReached ? '✅' : '⚠️';

        let response = `⚖️ <b>АНАЛИЗ БЕЗУБЫТОЧНОСТИ</b>\n\n`;
        response += `Средний доход/мес: ${result.averageMonthlyIncome.toLocaleString('ru-RU')} руб.\n`;
        response += `Средний расход/мес: ${result.averageMonthlyExpenses.toLocaleString('ru-RU')} руб.\n`;
        response += `Чистая прибыль/мес: ${result.monthlyNetProfit.toLocaleString('ru-RU')} руб.\n\n`;
        response += `${icon} ${result.breakEvenReached ? 'Безубыточность достигнута!' : 'Безубыточность НЕ достигнута'}\n\n`;
        response += `💡 ${result.recommendation}`;

        await ctx.reply(response, { parse_mode: 'HTML' });
    } catch (error) {
        console.error('Error in breakeven:', error);
        await ctx.reply('❌ Ошибка при анализе.');
    }
}
