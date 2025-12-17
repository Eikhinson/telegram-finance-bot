import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { p as pool } from '../client.mjs';
import 'pg';

const saveTransactionTool = createTool({
  id: "save-transaction",
  description: "Save a financial transaction to the database",
  inputSchema: z.object({
    userId: z.string(),
    amount: z.number(),
    category: z.enum(["income", "expense"]),
    subcategory: z.string(),
    description: z.string(),
    date: z.string()
  }),
  outputSchema: z.object({
    success: z.boolean(),
    transactionId: z.string().optional(),
    error: z.string().optional()
  }),
  execute: async ({ context }) => {
    try {
      const result = await pool.query(
        `INSERT INTO transactions (user_id, amount, category, subcategory, description, date)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id`,
        [
          context.userId,
          context.amount,
          context.category,
          context.subcategory,
          context.description,
          new Date(context.date)
        ]
      );
      return {
        success: true,
        transactionId: result.rows[0].id
      };
    } catch (error) {
      console.error("Error saving transaction:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error"
      };
    }
  }
});
const getTransactionsTool = createTool({
  id: "get-transactions",
  description: "Get transactions with optional filters",
  inputSchema: z.object({
    userId: z.string(),
    category: z.enum(["income", "expense"]).optional(),
    subcategory: z.string().optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    limit: z.number().default(100)
  }),
  outputSchema: z.object({
    transactions: z.array(z.object({
      id: z.string(),
      amount: z.number(),
      category: z.string(),
      subcategory: z.string(),
      description: z.string(),
      date: z.string()
    })),
    total: z.number()
  }),
  execute: async ({ context }) => {
    try {
      const conditions = ["user_id = $1"];
      const params = [context.userId];
      let paramIndex = 2;
      if (context.category) {
        conditions.push(`category = $${paramIndex++}`);
        params.push(context.category);
      }
      if (context.subcategory) {
        conditions.push(`subcategory = $${paramIndex++}`);
        params.push(context.subcategory);
      }
      if (context.startDate) {
        conditions.push(`date >= $${paramIndex++}`);
        params.push(new Date(context.startDate));
      }
      if (context.endDate) {
        conditions.push(`date <= $${paramIndex++}`);
        params.push(new Date(context.endDate));
      }
      params.push(context.limit);
      const result = await pool.query(
        `SELECT id, amount, category, subcategory, description, date
         FROM transactions
         WHERE ${conditions.join(" AND ")}
         ORDER BY date DESC
         LIMIT $${paramIndex}`,
        params
      );
      return {
        transactions: result.rows.map((row) => ({
          ...row,
          date: row.date.toISOString()
        })),
        total: result.rows.length
      };
    } catch (error) {
      console.error("Error getting transactions:", error);
      return {
        transactions: [],
        total: 0
      };
    }
  }
});
const deleteLastTransactionTool = createTool({
  id: "delete-last-transaction",
  description: "Delete the most recent transaction for a user",
  inputSchema: z.object({
    userId: z.string()
  }),
  outputSchema: z.object({
    success: z.boolean(),
    deletedTransaction: z.object({
      amount: z.number(),
      description: z.string()
    }).optional(),
    message: z.string()
  }),
  execute: async ({ context }) => {
    try {
      const result = await pool.query(
        `DELETE FROM transactions 
                 WHERE id = (
                    SELECT id FROM transactions 
                    WHERE user_id = $1 
                    ORDER BY date DESC, created_at DESC 
                    LIMIT 1
                 ) 
                 RETURNING amount, description`,
        [context.userId]
      );
      if (result.rowCount === 0) {
        return {
          success: false,
          message: "No transactions found to delete"
        };
      }
      return {
        success: true,
        deletedTransaction: result.rows[0],
        message: "Last transaction deleted successfully"
      };
    } catch (error) {
      console.error("Error deleting transaction:", error);
      return {
        success: false,
        message: "Failed to delete transaction"
      };
    }
  }
});
const clearUserDataTool = createTool({
  id: "clear-user-data",
  description: "Delete ALL data for a specific user. Use with caution.",
  inputSchema: z.object({
    userId: z.string(),
    confirmed: z.boolean().optional().describe("MUST be true to proceed with deletion. If false/undefined, nothing happens.")
  }),
  outputSchema: z.object({
    success: z.boolean(),
    count: z.number(),
    message: z.string()
  }),
  execute: async ({ context }) => {
    if (context.confirmed !== true) {
      return {
        success: false,
        count: 0,
        message: "Confirmation required. Please ask the user to confirm."
      };
    }
    try {
      const result = await pool.query(
        `DELETE FROM transactions WHERE user_id = $1`,
        [context.userId]
      );
      return {
        success: true,
        count: result.rowCount || 0,
        message: `Successfully deleted ${result.rowCount} transactions`
      };
    } catch (error) {
      console.error("Error clearing user data:", error);
      return {
        success: false,
        count: 0,
        message: "Failed to clear user data"
      };
    }
  }
});

export { clearUserDataTool, deleteLastTransactionTool, getTransactionsTool, saveTransactionTool };
