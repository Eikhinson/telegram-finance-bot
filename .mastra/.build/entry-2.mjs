import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import pg from 'pg';

"use strict";
const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.POSTGRES_CONNECTION_STRING,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : void 0
});
async function initDB() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS transactions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id VARCHAR(255) NOT NULL,
        amount DECIMAL(10, 2) NOT NULL,
        category VARCHAR(50) NOT NULL CHECK (category IN ('income', 'expense')),
        subcategory VARCHAR(100) NOT NULL,
        description TEXT,
        date TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_user_id ON transactions(user_id);
      CREATE INDEX IF NOT EXISTS idx_date ON transactions(date);
      CREATE INDEX IF NOT EXISTS idx_category ON transactions(category);
    `);
    console.log("\u2705 Database initialized successfully");
  } finally {
    client.release();
  }
}

"use strict";
const forecastRevenueTool = createTool({
  id: "forecast-revenue",
  description: "Forecast revenue based on historical data",
  inputSchema: z.object({
    userId: z.string(),
    months: z.number().default(3).describe("Number of months to forecast")
  }),
  outputSchema: z.object({
    averageMonthlyIncome: z.number(),
    forecastedRevenue: z.array(z.object({
      month: z.string(),
      estimated: z.number()
    })),
    confidence: z.string()
  }),
  execute: async ({ context }) => {
    try {
      const sixMonthsAgo = /* @__PURE__ */ new Date();
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
          confidence: "low - insufficient data"
        };
      }
      const monthlyTotals = result.rows.map((row) => parseFloat(row.total));
      const average = monthlyTotals.reduce((sum, val) => sum + val, 0) / monthlyTotals.length;
      const trend = monthlyTotals.length > 1 ? (monthlyTotals[0] - monthlyTotals[monthlyTotals.length - 1]) / monthlyTotals.length : 0;
      const forecastedRevenue = [];
      const now = /* @__PURE__ */ new Date();
      for (let i = 1; i <= context.months; i++) {
        const futureMonth = new Date(now);
        futureMonth.setMonth(now.getMonth() + i);
        forecastedRevenue.push({
          month: futureMonth.toISOString().slice(0, 7),
          estimated: Math.round(average + trend * i)
        });
      }
      return {
        averageMonthlyIncome: Math.round(average),
        forecastedRevenue,
        confidence: monthlyTotals.length >= 3 ? "medium" : "low"
      };
    } catch (error) {
      console.error("Error forecasting revenue:", error);
      return {
        averageMonthlyIncome: 0,
        forecastedRevenue: [],
        confidence: "error"
      };
    }
  }
});
const breakEvenAnalysisTool = createTool({
  id: "break-even-analysis",
  description: "Calculate break-even point based on fixed and variable costs",
  inputSchema: z.object({
    userId: z.string(),
    months: z.number().default(3)
  }),
  outputSchema: z.object({
    averageMonthlyIncome: z.number(),
    averageMonthlyExpenses: z.number(),
    monthlyNetProfit: z.number(),
    breakEvenReached: z.boolean(),
    recommendation: z.string()
  }),
  execute: async ({ context }) => {
    try {
      const monthsAgo = /* @__PURE__ */ new Date();
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
      const avgIncome = parseFloat(incomeResult.rows[0]?.avg_income || "0");
      const avgExpense = parseFloat(expenseResult.rows[0]?.avg_expense || "0");
      const netProfit = avgIncome - avgExpense;
      const breakEvenReached = avgIncome >= avgExpense;
      let recommendation = "";
      if (breakEvenReached) {
        const profitMargin = (netProfit / avgIncome * 100).toFixed(1);
        recommendation = `\u041E\u0442\u043B\u0438\u0447\u043D\u043E! \u0412\u044B \u0434\u043E\u0441\u0442\u0438\u0433\u043B\u0438 \u0442\u043E\u0447\u043A\u0438 \u0431\u0435\u0437\u0443\u0431\u044B\u0442\u043E\u0447\u043D\u043E\u0441\u0442\u0438 \u0441 \u043C\u0430\u0440\u0436\u043E\u0439 ${profitMargin}%. `;
        if (parseFloat(profitMargin) < 20) {
          recommendation += "\u0420\u0435\u043A\u043E\u043C\u0435\u043D\u0434\u0443\u0435\u0442\u0441\u044F \u0443\u0432\u0435\u043B\u0438\u0447\u0438\u0442\u044C \u0434\u043E\u0445\u043E\u0434\u044B \u0438\u043B\u0438 \u043E\u043F\u0442\u0438\u043C\u0438\u0437\u0438\u0440\u043E\u0432\u0430\u0442\u044C \u0440\u0430\u0441\u0445\u043E\u0434\u044B \u0434\u043B\u044F \u0443\u043B\u0443\u0447\u0448\u0435\u043D\u0438\u044F \u043C\u0430\u0440\u0436\u0438.";
        }
      } else {
        const deficit = avgExpense - avgIncome;
        recommendation = `\u0412\u043D\u0438\u043C\u0430\u043D\u0438\u0435! \u0420\u0430\u0441\u0445\u043E\u0434\u044B \u043F\u0440\u0435\u0432\u044B\u0448\u0430\u044E\u0442 \u0434\u043E\u0445\u043E\u0434\u044B \u043D\u0430 ${Math.round(deficit)} \u0440\u0443\u0431/\u043C\u0435\u0441. \u041D\u0435\u043E\u0431\u0445\u043E\u0434\u0438\u043C\u043E \u043B\u0438\u0431\u043E \u0443\u0432\u0435\u043B\u0438\u0447\u0438\u0442\u044C \u0434\u043E\u0445\u043E\u0434\u044B \u043D\u0430 ${Math.round(deficit)}, \u043B\u0438\u0431\u043E \u0441\u043E\u043A\u0440\u0430\u0442\u0438\u0442\u044C \u0440\u0430\u0441\u0445\u043E\u0434\u044B.`;
      }
      return {
        averageMonthlyIncome: Math.round(avgIncome),
        averageMonthlyExpenses: Math.round(avgExpense),
        monthlyNetProfit: Math.round(netProfit),
        breakEvenReached,
        recommendation
      };
    } catch (error) {
      console.error("Error in break-even analysis:", error);
      return {
        averageMonthlyIncome: 0,
        averageMonthlyExpenses: 0,
        monthlyNetProfit: 0,
        breakEvenReached: false,
        recommendation: "\u041E\u0448\u0438\u0431\u043A\u0430 \u043F\u0440\u0438 \u0430\u043D\u0430\u043B\u0438\u0437\u0435 \u0434\u0430\u043D\u043D\u044B\u0445"
      };
    }
  }
});

export { breakEvenAnalysisTool, forecastRevenueTool };
