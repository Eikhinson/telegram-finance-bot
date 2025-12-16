import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { pool } from "../../db/client";
import { createObjectCsvWriter } from "csv-writer";
import * as fs from 'fs';
import * as path from 'path';

export const exportToCSVTool = createTool({
    id: "export-to-csv",
    description: "Export transactions to CSV file",
    inputSchema: z.object({
        userId: z.string(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        category: z.enum(['income', 'expense']).optional(),
    }),
    outputSchema: z.object({
        success: z.boolean(),
        filePath: z.string().optional(),
        rowCount: z.number(),
        error: z.string().optional(),
    }),
    execute: async ({ context }) => {
        try {
            const conditions = ['user_id = $1'];
            const params: any[] = [context.userId];
            let paramIndex = 2;

            if (context.startDate) {
                conditions.push(`date >= $${paramIndex++}`);
                params.push(new Date(context.startDate));
            }

            if (context.endDate) {
                conditions.push(`date <= $${paramIndex++}`);
                params.push(new Date(context.endDate));
            }

            if (context.category) {
                conditions.push(`category = $${paramIndex++}`);
                params.push(context.category);
            }

            const result = await pool.query(
                `SELECT date, category, subcategory, amount, description
         FROM transactions
         WHERE ${conditions.join(' AND ')}
         ORDER BY date DESC`,
                params
            );

            if (result.rows.length === 0) {
                return {
                    success: false,
                    rowCount: 0,
                    error: 'No transactions found for the specified filters',
                };
            }

            // Create exports directory if it doesn't exist
            const exportsDir = path.join(process.cwd(), 'exports');
            if (!fs.existsSync(exportsDir)) {
                fs.mkdirSync(exportsDir, { recursive: true });
            }

            const fileName = `transactions_${context.userId}_${Date.now()}.csv`;
            const filePath = path.join(exportsDir, fileName);

            const csvWriter = createObjectCsvWriter({
                path: filePath,
                header: [
                    { id: 'date', title: 'Date' },
                    { id: 'category', title: 'Category' },
                    { id: 'subcategory', title: 'Subcategory' },
                    { id: 'amount', title: 'Amount' },
                    { id: 'description', title: 'Description' },
                ],
            });

            await csvWriter.writeRecords(result.rows);

            return {
                success: true,
                filePath,
                rowCount: result.rows.length,
            };
        } catch (error) {
            console.error('Error exporting to CSV:', error);
            return {
                success: false,
                rowCount: 0,
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    },
});
