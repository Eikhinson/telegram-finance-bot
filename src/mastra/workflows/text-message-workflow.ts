// @ts-nocheck - Mastra workflow step typing incompatibility
import { createStep, createWorkflow } from "@mastra/core/workflows";
import { z } from "zod";
import { mastra } from "../index";
import { saveTransactionTool } from "../tools/transaction-tools";

const categorizeTextStep = createStep({
    id: "categorize-text",
    inputSchema: z.object({
        text: z.string(),
        userId: z.string(),
    }),
    outputSchema: z.object({
        category: z.enum(['income', 'expense']),
        subcategory: z.string(),
        amount: z.number(),
        date: z.string(),
        description: z.string(),
    }),
    execute: async ({ inputData }) => {
        const agent = mastra.getAgent("categorization");

        const result = await agent.generate(inputData.text, {
            resourceId: inputData.userId,
        });

        const data = JSON.parse(result.text);

        return {
            category: data.category,
            subcategory: data.subcategory,
            amount: data.amount,
            date: data.date,
            description: data.description,
        };
    },
});

const saveTextTransactionStep = createStep({
    id: "save-text-transaction",
    inputSchema: z.object({
        userId: z.string(),
        category: z.enum(['income', 'expense']),
        subcategory: z.string(),
        amount: z.number(),
        date: z.string(),
        description: z.string(),
    }),
    outputSchema: z.object({
        success: z.boolean(),
        transactionId: z.string().optional(),
    }),
    execute: async ({ inputData, runId, runtimeContext }) => {
        const result = await saveTransactionTool.execute({
            context: inputData,
            runId,
            runtimeContext,
        });

        return {
            success: result.success,
            transactionId: result.transactionId,
        };
    },
});

export const textMessageWorkflow = createWorkflow({
    id: "text-message-workflow",
    inputSchema: z.object({
        text: z.string(),
        userId: z.string(),
    }),
    outputSchema: z.object({
        success: z.boolean(),
        transactionId: z.string().optional(),
        category: z.string(),
        amount: z.number(),
        description: z.string(),
    }),
})
    .then(categorizeTextStep)
    .then(saveTextTransactionStep)
    .commit();
