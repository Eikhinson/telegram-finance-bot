import { Agent } from "@mastra/core/agent";
import { createOpenAI } from "@ai-sdk/openai";
import { z } from "zod";
import { INCOME_CATEGORIES, EXPENSE_CATEGORIES } from "../../db/schema";

const navy = createOpenAI({
    baseURL: process.env.OPENAI_BASE_URL,
    apiKey: process.env.OPENAI_API_KEY,
});

const transactionSchema = z.object({
    category: z.enum(['income', 'expense']),
    subcategory: z.string(),
    amount: z.number(),
    date: z.string().describe("Date in ISO format"),
    description: z.string(),
});

// Schema for multiple transactions
const multiTransactionSchema = z.object({
    transactions: z.array(transactionSchema),
});

export const categorizationAgent = new Agent({
    name: "Payment Categorization Agent",
    instructions: `You are an expert financial categorization assistant. 
  
Your task is to analyze transaction descriptions and categorize them. 
IMPORTANT: The user may mention MULTIPLE transactions in a single message. You MUST extract ALL of them.

INCOME CATEGORIES:
${INCOME_CATEGORIES.map(cat => `- ${cat}`).join('\n')}

EXPENSE CATEGORIES:
${EXPENSE_CATEGORIES.map(cat => `- ${cat}`).join('\n')}

For EACH transaction mentioned:
1. Determine if it's income or expense
2. Choose the most appropriate subcategory
3. Extract the amount
4. Extract or infer the date (use today if not mentioned)
5. Create a clean description

Examples of MULTIPLE transactions in one message:
"Получил 50000 от клиента, заплатил аренду 30000 и зарплату 100000"
→ Returns 3 transactions:
  1. income, services, 50000, "Получил от клиента"
  2. expense, rent, 30000, "Аренда"
  3. expense, salaries, 100000, "Зарплата"

"Доход 200к консалтинг, расход 50к маркетинг, 20к IT"
→ Returns 3 transactions:
  1. income, consulting, 200000
  2. expense, marketing, 50000
  3. expense, it_services, 20000

Parse "к" or "тыс" as thousands (e.g., "50к" = 50000).
Always respond with an array of ALL transactions found in the message.`,
    model: navy("gpt-5.2"),
    // @ts-ignore
    outputSchema: multiTransactionSchema,
});
