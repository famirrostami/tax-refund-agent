import { z } from "zod";

const money = z.number().finite().nonnegative();

/** What the app expects a receipt to be, independent of country. Amounts are in major units (e.g. EUR 12.50). */
export const receiptSchema = z.object({
  vendor: z.string().nullable().describe("Seller name exactly as printed, or null if not visible"),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .describe("Document or purchase date as YYYY-MM-DD, or null if not visible"),
  totalAmount: money.nullable().describe("Gross total paid, or null if not visible"),
  currency: z.string().length(3).nullable().describe("ISO 4217 code such as EUR, or null if not visible"),
  vatAmount: money.nullable().describe("VAT/MwSt amount if printed, else null"),
  vatRate: z.number().min(0).max(100).nullable().describe("VAT rate in percent if printed, else null"),
  description: z.string().describe("Short plain description of what was bought"),
  lineItems: z.array(z.object({ description: z.string(), amount: money.nullable() })),
  paymentMethod: z.string().nullable(),
  documentType: z.enum(["receipt", "invoice", "contract", "statement", "other"]),
  legibility: z.enum(["clear", "partial", "unreadable"]),
  uncertainFields: z.array(z.string()).describe("Names of fields that were hard to read or guessed"),
});

export type Receipt = z.infer<typeof receiptSchema>;
