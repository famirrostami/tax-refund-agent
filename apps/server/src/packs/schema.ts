import { z } from "zod";

export const manifestSchema = z.object({
  country: z.string().regex(/^[a-z]{2}$/),
  name: z.string().min(1),
  currency: z.string().length(3),
  locale: z.string().min(2),
  authority: z.string().min(1),
  years: z.array(z.number().int()).min(1),
});

export const categoriesSchema = z
  .array(
    z.object({
      id: z.string().regex(/^[a-z][a-z0-9_]*$/),
      labelKey: z.string().min(1),
      description: z.string().min(1),
      requiredDocs: z.array(z.string()),
      questions: z.array(z.string()),
    }),
  )
  .min(1);

export type Manifest = z.infer<typeof manifestSchema>;
export type Category = z.infer<typeof categoriesSchema>[number];

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const ruleSchema = z.object({
  id: z.string().regex(/^[a-z]{2}\.[a-z0-9_.]+$/),
  category: z.string(),
  title: z.string().min(1),
  tax_years: z.array(z.number().int()).min(1),
  summary: z.string().min(1),
  keywords: z.array(z.string()),
  /** Machine-readable parameters. `type` selects the calculator; all numbers live here, never in code. */
  calc: z.object({ type: z.string() }).passthrough(),
  conditions: z.array(z.string()),
  sources: z
    .array(z.object({ label: z.string(), url: z.string().url(), kind: z.enum(["statute", "bgbl", "bmf", "official_guidance", "court", "secondary"]) }))
    .min(1),
  verification: z.enum(["verified", "partial", "unresolved"]),
  last_verified: isoDate,
  notes: z.string(),
  open_questions: z.array(z.string()),
});

export type Rule = z.infer<typeof ruleSchema>;

export const formFieldSchema = z.object({
  id: z.string().regex(/^[a-z][a-z0-9_]*$/),
  form: z.string().min(1),
  section: z.string().min(1),
  /** Official line number or range ("34", "49-51"); null when not confirmed or not published. */
  line: z.string().regex(/^\d+(-\d+)?$/).nullable(),
  labelDe: z.string().min(1),
  labelEn: z.string().min(1),
  unit: z.enum(["EUR", "days", "km", "text"]),
  verification: z.enum(["verified", "unverified"]),
  note: z.string().optional(),
});

const outputBase = { from: z.string().regex(/^(facts|result)\.[A-Za-z0-9_.]+$/), minus: z.string().regex(/^(facts|result)\.[A-Za-z0-9_.]+$/).optional() };
export const mappingOutputSchema = z.union([
  z.object({ fieldId: z.string(), ...outputBase }),
  z.object({
    choose: z.object({ path: z.string(), cases: z.array(z.object({ equals: z.union([z.boolean(), z.string(), z.number()]), fieldId: z.string() })).min(1) }),
    ...outputBase,
  }),
]);

export const mappingSchema = z
  .object({ ruleId: z.string(), outputs: z.array(mappingOutputSchema), informational: z.string().optional() })
  .refine((m) => m.outputs.length > 0 || m.informational, { message: "a mapping needs outputs or an informational note" });

export const yearFormsSchema = z
  .object({
    tax_year: z.number().int(),
    status: z.enum(["published", "pending"]),
    extends: z.number().int().optional(),
    source: z.object({ label: z.string(), url: z.string().url(), kind: z.enum(["official_guidance", "bmf", "statute"]) }),
    last_verified: isoDate,
    notes: z.string(),
    fields: z.array(formFieldSchema).optional(),
    mappings: z.array(mappingSchema).optional(),
  })
  .refine((y) => (y.extends !== undefined) !== (y.fields !== undefined && y.mappings !== undefined), { message: "use either `extends` or both `fields` and `mappings`" });

export type FormField = z.infer<typeof formFieldSchema>;
export type Mapping = z.infer<typeof mappingSchema>;
export type MappingOutput = z.infer<typeof mappingOutputSchema>;
export type YearForms = { taxYear: number; status: "published" | "pending"; source: { label: string; url: string }; notes: string; fields: FormField[]; mappings: Mapping[] };

const docSource = z.object({ label: z.string(), url: z.string().url() });
export const docItemSchema = z
  .object({
    id: z.string().regex(/^[a-z][a-z0-9_]*$/),
    kind: z.enum(["document", "information"]),
    text: z.string().min(1),
    why: z.string().optional(),
    /** true only when an official source states it; such items must carry the source. */
    official: z.boolean(),
    source: docSource.optional(),
  })
  .refine((i) => !i.official || i.source, { message: "official items need a source" });

export const documentsSchema = z.object({
  based_on_year: z.number().int(),
  last_verified: isoDate,
  notes: z.string(),
  general: z.object({ keep: docItemSchema, upload_steps: z.array(z.object({ text: z.string().min(1), source: docSource })).min(1) }),
  by_rule: z.record(z.string(), z.array(docItemSchema)),
});

export type DocItem = z.infer<typeof docItemSchema>;
export type Documents = z.infer<typeof documentsSchema>;
