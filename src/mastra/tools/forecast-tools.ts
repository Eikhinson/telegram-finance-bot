import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { pool } from "../../db/client";

export const forecastRevenueTool = createTool({
    id: "forecast-revenue",
    description: "Forecast revenue based on historical data",
    inputSchema: z.object({
        userId: z.string(),
        months: z.number().default(3).describe("Number of months to forecast"),
    }),
    outputSchema: z.object({
        averageMonthlyIncome: z.number(),
        forecastedRevenue: z.array(z.object({
            month: z.string(),
            estimated: z.number(),
        })),
        confidence: z.string(),
    }),
    execute: async ({ context }) => {
        try {
            // Get last 6 months of income data
            const sixMonthsAgo = new Date();
            sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

            const result = await pool.query(
                `SELECT 
           DATE_TRUNC('month', date) as month,
           SUM(amount) as total
         FROM transactions
         WHERE user_id = $1
           AND category = 'income'
           AND date >= $2
         GROUP BY DATE_TRUNC('month', date)
         ORDER BY month DESC`,
                [context.userId, sixMonthsAgo]
            );

            if (result.rows.length === 0) {
                return {
                    averageMonthlyIncome: 0,
                    forecastedRevenue: [],
                    confidence: 'low - insufficient data',
                };
            }

            const monthlyTotals = result.rows.map(row => parseFloat(row.total));
            const average = monthlyTotals.reduce((sum, val) => sum + val, 0) / monthlyTotals.length;

            // Simple linear trend
            const trend = monthlyTotals.length > 1
                ? (monthlyTotals[0] - monthlyTotals[monthlyTotals.length - 1]) / monthlyTotals.length
                : 0;

            const forecastedRevenue = [];
            const now = new Date();

            for (let i = 1; i <= context.months; i++) {
                const futureMonth = new Date(now);
                futureMonth.setMonth(now.getMonth() + i);

                forecastedRevenue.push({
                    month: futureMonth.toISOString().slice(0, 7),
                    estimated: Math.round(average + (trend * i)),
                });
            }

            return {
                averageMonthlyIncome: Math.round(average),
                forecastedRevenue,
                confidence: monthlyTotals.length >= 3 ? 'medium' : 'low',
            };
        } catch (error) {
            console.error('Error forecasting revenue:', error);
            return {
                averageMonthlyIncome: 0,
                forecastedRevenue: [],
                confidence: 'error',
            };
        }
    },
});

export const breakEvenAnalysisTool = createTool({
    id: "break-even-analysis",
    description: "Calculate break-even point based on fixed and variable costs",
    inputSchema: z.object({
        userId: z.string(),
        months: z.number().default(3),
    }),
    outputSchema: z.object({
        averageMonthlyIncome: z.number(),
        averageMonthlyExpenses: z.number(),
        monthlyNetProfit: z.number(),
        breakEvenReached: z.boolean(),
        recommendation: z.string(),
    }),
    execute: async ({ context }) => {
        try {
            const monthsAgo = new Date();
            monthsAgo.setMonth(monthsAgo.getMonth() - context.months);

            const incomeResult = await pool.query(
                `SELECT AVG(monthly_total) as avg_income
         FROM (
           SELECT DATE_TRUNC('month', date) as month, SUM(amount) as monthly_total
           FROM transactions
           WHERE user_id = $1 AND category = 'income' AND date >= $2
           GROUP BY DATE_TRUNC('month', date)
         ) as monthly_income`,
                [context.userId, monthsAgo]
            );

            const expenseResult = await pool.query(
                `SELECT AVG(monthly_total) as avg_expense
         FROM (
           SELECT DATE_TRUNC('month', date) as month, SUM(amount) as monthly_total
           FROM transactions
           WHERE user_id = $1 AND category = 'expense' AND date >= $2
           GROUP BY DATE_TRUNC('month', date)
         ) as monthly_expense`,
                [context.userId, monthsAgo]
            );

            const avgIncome = parseFloat(incomeResult.rows[0]?.avg_income || '0');
            const avgExpense = parseFloat(expenseResult.rows[0]?.avg_expense || '0');
            const netProfit = avgIncome - avgExpense;
            const breakEvenReached = avgIncome >= avgExpense;

            let recommendation = '';
            if (breakEvenReached) {
                const profitMargin = ((netProfit / avgIncome) * 100).toFixed(1);
                recommendation = `Отлично! Вы достигли точки безубыточности с маржой ${profitMargin}%. `;
                if (parseFloat(profitMargin) < 20) {
                    recommendation += 'Рекомендуется увеличить доходы или оптимизировать расходы для улучшения маржи.';
                }
            } else {
                const deficit = avgExpense - avgIncome;
                recommendation = `Внимание! Расходы превышают доходы на ${Math.round(deficit)} руб/мес. Необходимо либо увеличить доходы на ${Math.round(deficit)}, либо сократить расходы.`;
            }

            return {
                averageMonthlyIncome: Math.round(avgIncome),
                averageMonthlyExpenses: Math.round(avgExpense),
                monthlyNetProfit: Math.round(netProfit),
                breakEvenReached,
                recommendation,
            };
        } catch (error) {
            console.error('Error in break-even analysis:', error);
            return {
                averageMonthlyIncome: 0,
                averageMonthlyExpenses: 0,
                monthlyNetProfit: 0,
                breakEvenReached: false,
                recommendation: 'Ошибка при анализе данных',
            };
        }
    },
});
