// @ts-nocheck - Mastra workflow step typing incompatibility
import { createStep, createWorkflow } from "@mastra/core/workflows";
import { z } from "zod";
import { mastra } from "../index";
import { saveTransactionTool } from "../tools/transaction-tools";

const transcribeStep = createStep({
    id: "transcribe-voice",
    inputSchema: z.object({
        audioFilePath: z.string(),
        userId: z.string(),
    }),
    outputSchema: z.object({
        transcription: z.string(),
    }),
    execute: async ({ inputData }) => {
        // Using OpenAI Whisper API
        const OpenAI = await import('openai');
        const openai = new OpenAI.default({
            apiKey: process.env.OPENAI_API_KEY,
            baseURL: process.env.OPENAI_BASE_URL,
        });

        const fs = await import('fs');
        const transcription = await openai.audio.transcriptions.create({
            file: fs.createReadStream(inputData.audioFilePath),
            model: "whisper-1",
            language: "ru",
        });

        return {
            transcription: transcription.text,
        };
    },
});

const categorizeStep = createStep({
    id: "categorize-transaction",
    inputSchema: z.object({
        transcription: z.string(),
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

        const result = await agent.generate(inputData.transcription, {
            resourceId: inputData.userId,
        });

        // Parse the structured output
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

const saveStep = createStep({
    id: "save-transaction",
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

export const voiceMessageWorkflow = createWorkflow({
    id: "voice-message-workflow",
    inputSchema: z.object({
        audioFilePath: z.string(),
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
    .then(transcribeStep)
    .then(categorizeStep)
    .then(saveStep)
    .commit();
