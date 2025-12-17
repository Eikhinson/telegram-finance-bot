import { Mastra } from '@mastra/core/mastra';
import { PostgresStore } from '@mastra/pg';
import { Agent } from '@mastra/core/agent';
import { createOpenAI } from '@ai-sdk/openai';
import { z } from 'zod';
import { createTool } from '@mastra/core/tools';
import pg from 'pg';

"use strict";
const INCOME_CATEGORIES = [
  "sales",
  // Продажи
  "services",
  // Услуги
  "consulting",
  // Консалтинг
  "other_income"
  // Прочие доходы
];
const EXPENSE_CATEGORIES = [
  "salaries",
  // Зарплаты
  "rent",
  // Аренда
  "utilities",
  // Коммунальные услуги
  "marketing",
  // Маркетинг
  "it_services",
  // IT услуги
  "office_supplies",
  // Офисные принадлежности
  "travel",
  // Командировки
  "professional_services",
  // Профессиональные услуги
  "taxes",
  // Налоги
  "insurance",
  // Страхование
  "other_expenses"
  // Прочие расходы
];

"use strict";
const navy$1 = createOpenAI({
  baseURL: process.env.OPENAI_BASE_URL,
  apiKey: process.env.OPENAI_API_KEY
});
const transactionSchema = z.object({
  category: z.enum(["income", "expense"]),
  subcategory: z.string(),
  amount: z.number(),
  date: z.string().describe("Date in ISO format"),
  description: z.string()
});
const multiTransactionSchema = z.object({
  transactions: z.array(transactionSchema)
});
const categorizationAgent = new Agent({
  name: "Payment Categorization Agent",
  instructions: `You are an expert financial categorization assistant. 
  
Your task is to analyze transaction descriptions and categorize them. 
IMPORTANT: The user may mention MULTIPLE transactions in a single message. You MUST extract ALL of them.

INCOME CATEGORIES:
${INCOME_CATEGORIES.map((cat) => `- ${cat}`).join("\n")}

EXPENSE CATEGORIES:
${EXPENSE_CATEGORIES.map((cat) => `- ${cat}`).join("\n")}

For EACH transaction mentioned:
1. Determine if it's income or expense
2. Choose the most appropriate subcategory
3. Extract the amount
4. Extract or infer the date (use today if not mentioned)
5. Create a clean description

Examples of MULTIPLE transactions in one message:
"\u041F\u043E\u043B\u0443\u0447\u0438\u043B 50000 \u043E\u0442 \u043A\u043B\u0438\u0435\u043D\u0442\u0430, \u0437\u0430\u043F\u043B\u0430\u0442\u0438\u043B \u0430\u0440\u0435\u043D\u0434\u0443 30000 \u0438 \u0437\u0430\u0440\u043F\u043B\u0430\u0442\u0443 100000"
\u2192 Returns 3 transactions:
  1. income, services, 50000, "\u041F\u043E\u043B\u0443\u0447\u0438\u043B \u043E\u0442 \u043A\u043B\u0438\u0435\u043D\u0442\u0430"
  2. expense, rent, 30000, "\u0410\u0440\u0435\u043D\u0434\u0430"
  3. expense, salaries, 100000, "\u0417\u0430\u0440\u043F\u043B\u0430\u0442\u0430"

"\u0414\u043E\u0445\u043E\u0434 200\u043A \u043A\u043E\u043D\u0441\u0430\u043B\u0442\u0438\u043D\u0433, \u0440\u0430\u0441\u0445\u043E\u0434 50\u043A \u043C\u0430\u0440\u043A\u0435\u0442\u0438\u043D\u0433, 20\u043A IT"
\u2192 Returns 3 transactions:
  1. income, consulting, 200000
  2. expense, marketing, 50000
  3. expense, it_services, 20000

Parse "\u043A" or "\u0442\u044B\u0441" as thousands (e.g., "50\u043A" = 50000).
Always respond with an array of ALL transactions found in the message.`,
  model: navy$1("gpt-5.2"),
  // @ts-ignore
  outputSchema: multiTransactionSchema
});

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

"use strict";
const navy = createOpenAI({
  baseURL: process.env.OPENAI_BASE_URL,
  apiKey: process.env.OPENAI_API_KEY
});
const financeAssistantAgent = new Agent({
  name: "Finance Assistant",
  instructions: `You are a helpful financial assistant for a small business owner.

You have access to financial data and can:
- Answer questions about income and expenses
- Provide insights into spending patterns
- Generate financial reports
- Help identify where money is being spent
- Offer financial advice based on transaction history

When answering questions:
1. Use the available tools to fetch relevant data
2. Analyze the data to provide meaningful insights
3. Present information clearly and concisely
4. Use Russian language for responses
5. Format numbers with proper currency (\u0440\u0443\u0431.)

Examples of questions you can answer:
- "\u041A\u0443\u0434\u0430 \u0443\u0448\u043B\u0438 \u0434\u0435\u043D\u044C\u0433\u0438 \u0432 \u0434\u0435\u043A\u0430\u0431\u0440\u0435?"
- "\u0421\u043A\u043E\u043B\u044C\u043A\u043E \u044F \u043F\u043E\u0442\u0440\u0430\u0442\u0438\u043B \u043D\u0430 \u043C\u0430\u0440\u043A\u0435\u0442\u0438\u043D\u0433 \u0437\u0430 \u043F\u043E\u0441\u043B\u0435\u0434\u043D\u0438\u0439 \u043C\u0435\u0441\u044F\u0446?"
- "\u041F\u043E\u043A\u0430\u0436\u0438 \u043C\u043D\u0435 \u0432\u0441\u0435 \u0440\u0430\u0441\u0445\u043E\u0434\u044B \u043D\u0430 IT"
- "\u041A\u0430\u043A\u0430\u044F \u0431\u044B\u043B\u0430 \u0447\u0438\u0441\u0442\u0430\u044F \u043F\u0440\u0438\u0431\u044B\u043B\u044C \u0437\u0430 \u043A\u0432\u0430\u0440\u0442\u0430\u043B?"
- "\u041D\u0430 \u0447\u0442\u043E \u0443\u0445\u043E\u0434\u0438\u0442 \u0431\u043E\u043B\u044C\u0448\u0435 \u0432\u0441\u0435\u0433\u043E \u0434\u0435\u043D\u0435\u0433?"

Always be helpful, professional, and proactive in offering financial insights.

CRITICAL SAFETY RULES:
1. If the user asks to delete ALL data (using clearUserData), you MUST first ask for explicit confirmation.
   Example: "\u0412\u044B \u0443\u0432\u0435\u0440\u0435\u043D\u044B, \u0447\u0442\u043E \u0445\u043E\u0442\u0438\u0442\u0435 \u0443\u0434\u0430\u043B\u0438\u0442\u044C \u0432\u0441\u044E \u0444\u0438\u043D\u0430\u043D\u0441\u043E\u0432\u0443\u044E \u0438\u0441\u0442\u043E\u0440\u0438\u044E? \u042D\u0442\u043E \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u0435 \u043D\u0435\u043B\u044C\u0437\u044F \u043E\u0442\u043C\u0435\u043D\u0438\u0442\u044C. \u041D\u0430\u043F\u0438\u0448\u0438\u0442\u0435 \u0414\u0410 \u0423\u0414\u0410\u041B\u0418\u0422\u042C \u0434\u043B\u044F \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043D\u0438\u044F."
2. ONLY call the clearUserData tool if the user provides this explicit confirmation.
3. For clearUserData, you must set the 'confirmed' parameter to true.
4. If the user asks to delete the LAST transaction (deleteLastTransaction), you can proceed without explicit double-confirmation if the intent is clear (e.g. "\u041E\u0439, \u0443\u0434\u0430\u043B\u0438 \u044D\u0442\u043E"), but confirm what was deleted.`,
  model: navy("gpt-5.2"),
  // NOTE: Memory disabled - requires threadId which complicates Telegram integration
  // memory: new Memory({ storage: new PostgresStore({ connectionString: ... }) }),
  tools: {
    getTransactions: getTransactionsTool,
    saveTransaction: saveTransactionTool,
    generatePL: generatePLTool,
    getCategoryBreakdown: getCategoryBreakdownTool,
    deleteLastTransaction: deleteLastTransactionTool,
    clearUserData: clearUserDataTool
  }
});

"use strict";
const mastra = new Mastra({
  agents: {
    categorization: categorizationAgent,
    financeAssistant: financeAssistantAgent
  },
  storage: new PostgresStore({
    connectionString: process.env.POSTGRES_CONNECTION_STRING
  })
});

export { mastra };
