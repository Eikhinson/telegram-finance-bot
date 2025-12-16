import { createStep, createWorkflow } from "@mastra/core/workflows";
import { z } from "zod";
import { generatePLTool } from "../tools/report-tools";

const fetchReportDataStep = createStep({
    id: "fetch-report-data",
    inputSchema: z.object({
        userId: z.string(),
        startDate: z.string(),
        endDate: z.string(),
    }),
    outputSchema: z.object({
        totalIncome: z.number(),
        totalExpenses: z.number(),
        netProfit: z.number(),
        incomeByCategory: z.record(z.number()),
        expensesByCategory: z.record(z.number()),
    }),
    execute: async ({ inputData, runId, runtimeContext }) => {
        const result = await generatePLTool.execute({
            context: inputData,
            runId,
            runtimeContext,
        });

        return result;
    },
});

const formatReportStep = createStep({
    id: "format-report",
    inputSchema: z.object({
        totalIncome: z.number(),
        totalExpenses: z.number(),
        netProfit: z.number(),
        incomeByCategory: z.record(z.number()),
        expensesByCategory: z.record(z.number()),
    }),
    outputSchema: z.object({
        formattedReport: z.string(),
    }),
    execute: async ({ inputData }) => {
        let report = `📊 <b>ОТЧЁТ О ПРИБЫЛЯХ И УБЫТКАХ</b>\n\n`;

        report += `💰 <b>ДОХОДЫ</b>: ${inputData.totalIncome.toLocaleString('ru-RU')} руб.\n`;
        if (Object.keys(inputData.incomeByCategory).length > 0) {
            report += `Детализация:\n`;
            for (const [category, amount] of Object.entries(inputData.incomeByCategory)) {
                report += `  • ${category}: ${amount.toLocaleString('ru-RU')} руб.\n`;
            }
        }

        report += `\n💸 <b>РАСХОДЫ</b>: ${inputData.totalExpenses.toLocaleString('ru-RU')} руб.\n`;
        if (Object.keys(inputData.expensesByCategory).length > 0) {
            report += `Детализация:\n`;
            for (const [category, amount] of Object.entries(inputData.expensesByCategory)) {
                report += `  • ${category}: ${amount.toLocaleString('ru-RU')} руб.\n`;
            }
        }

        const profitEmoji = inputData.netProfit >= 0 ? '✅' : '❌';
        report += `\n${profitEmoji} <b>ЧИСТАЯ ПРИБЫЛЬ</b>: ${inputData.netProfit.toLocaleString('ru-RU')} руб.`;

        if (inputData.netProfit < 0) {
            report += `\n\n⚠️ Внимание: расходы превышают доходы!`;
        }

        return {
            formattedReport: report,
        };
    },
});

export const reportWorkflow = createWorkflow({
    id: "report-workflow",
    inputSchema: z.object({
        userId: z.string(),
        startDate: z.string(),
        endDate: z.string(),
    }),
    outputSchema: z.object({
        formattedReport: z.string(),
    }),
})
    .then(fetchReportDataStep)
    .then(formatReportStep)
    .commit();
