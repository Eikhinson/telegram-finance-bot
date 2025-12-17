import { Mastra } from "@mastra/core/mastra";
import { PostgresStore } from "@mastra/pg";
import { categorizationAgent } from "./agents/categorization-agent";
import { financeAssistantAgent } from "./agents/finance-assistant-agent";

export const mastra = new Mastra({
    agents: {
        categorization: categorizationAgent,
        financeAssistant: financeAssistantAgent,
    },

    storage: new PostgresStore({
        connectionString: process.env.DATABASE_URL || process.env.POSTGRES_CONNECTION_STRING!,
    }),
});
