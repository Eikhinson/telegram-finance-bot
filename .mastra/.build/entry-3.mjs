import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import pg from 'pg';

"use strict";
const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.POSTGRES_CONNECTION_STRING
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
const generatePLTool = createTool({
  id: "generate-pl-report",
  description: "Generate Profit & Loss report for a user",
  inputSchema: z.object({
    userId: z.string(),
    startDate: z.string(),
    endDate: z.string()
  }),
  outputSchema: z.object({
    totalIncome: z.number(),
    totalExpenses: z.number(),
    netProfit: z.number(),
    incomeByCategory: z.record(z.number()),
    expensesByCategory: z.record(z.number())
  }),
  execute: async ({ context }) => {
    try {
      const incomeResult = await pool.query(
        `SELECT subcategory, SUM(amount) as total
         FROM transactions
         WHERE user_id = $1 
           AND category = 'income'
           AND date >= $2 
           AND date <= $3
         GROUP BY subcategory`,
        [context.userId, new Date(context.startDate), new Date(context.endDate)]
      );
      const expenseResult = await pool.query(
        `SELECT subcategory, SUM(amount) as total
         FROM transactions
         WHERE user_id = $1 
           AND category = 'expense'
           AND date >= $2 
           AND date <= $3
         GROUP BY subcategory`,
        [context.userId, new Date(context.startDate), new Date(context.endDate)]
      );
      const incomeByCategory = {};
      let totalIncome = 0;
      incomeResult.rows.forEach((row) => {
        const amount = parseFloat(row.total);
        incomeByCategory[row.subcategory] = amount;
        totalIncome += amount;
      });
      const expensesByCategory = {};
      let totalExpenses = 0;
      expenseResult.rows.forEach((row) => {
        const amount = parseFloat(row.total);
        expensesByCategory[row.subcategory] = amount;
        totalExpenses += amount;
      });
      return {
        totalIncome,
        totalExpenses,
        netProfit: totalIncome - totalExpenses,
        incomeByCategory,
        expensesByCategory
      };
    } catch (error) {
      console.error("Error generating P&L report:", error);
      return {
        totalIncome: 0,
        totalExpenses: 0,
        netProfit: 0,
        incomeByCategory: {},
        expensesByCategory: {}
      };
    }
  }
});
const getCategoryBreakdownTool = createTool({
  id: "get-category-breakdown",
  description: "Get detailed breakdown for a specific category",
  inputSchema: z.object({
    userId: z.string(),
    category: z.enum(["income", "expense"]),
    subcategory: z.string().optional(),
    startDate: z.string(),
    endDate: z.string()
  }),
  outputSchema: z.object({
    total: z.number(),
    transactions: z.array(z.object({
      date: z.string(),
      amount: z.number(),
      description: z.string()
    }))
  }),
  execute: async ({ context }) => {
    try {
      const conditions = [
        "user_id = $1",
        "category = $2",
        "date >= $3",
        "date <= $4"
      ];
      const params = [
        context.userId,
        context.category,
        new Date(context.startDate),
        new Date(context.endDate)
      ];
      if (context.subcategory) {
        conditions.push("subcategory = $5");
        params.push(context.subcategory);
      }
      const result = await pool.query(
        `SELECT date, amount, description
         FROM transactions
         WHERE ${conditions.join(" AND ")}
         ORDER BY date DESC`,
        params
      );
      const total = result.rows.reduce((sum, row) => sum + parseFloat(row.amount), 0);
      return {
        total,
        transactions: result.rows.map((row) => ({
          date: row.date.toISOString(),
          amount: parseFloat(row.amount),
          description: row.description
        }))
      };
    } catch (error) {
      console.error("Error getting category breakdown:", error);
      return {
        total: 0,
        transactions: []
      };
    }
  }
});

export { generatePLTool, getCategoryBreakdownTool };
