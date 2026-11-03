import { tool } from "ai";
import { z } from "zod";
import type { Pack, Rule } from "../../../packs";

const tokenize = (text: string) => text.toLowerCase().split(/[^a-z0-9äöüß]+/).filter((t) => t.length > 1);

/** Lexical scoring over title, keywords and summary. Replace with embeddings in rag/ when the corpus grows. */
export function scoreRule(rule: Rule, queryTokens: string[]): number {
  const title = new Set(tokenize(rule.title));
  const keywords = new Set(rule.keywords.flatMap(tokenize));
  const summary = new Set(tokenize(rule.summary));
  return queryTokens.reduce((n, t) => n + (title.has(t) ? 3 : 0) + (keywords.has(t) ? 3 : 0) + (summary.has(t) ? 1 : 0), 0);
}

export function searchRules(pack: Pick<Pack, "rules">, input: { query: string; year: number; category?: string; limit?: number }) {
  const q = tokenize(input.query);
  return pack.rules
    .filter((r) => r.tax_years.includes(input.year) && (!input.category || r.category === input.category))
    .map((r) => ({ r, score: scoreRule(r, q) }))
    .filter((x) => x.score > 0 || (input.category && x.r.category === input.category))
    .sort((a, b) => b.score - a.score)
    .slice(0, input.limit ?? 5)
    .map((x) => x.r);
}

export function createSearchRulesTool({ pack, year }: { pack: Pick<Pack, "rules">; year: number }) {
  return tool({
    description:
      "Search the official tax rules for the current country and tax year. Returns matching rules with their parameters, conditions, sources and verification status. Use this before stating any amount, limit or condition. If nothing matches, say the case needs review; do not answer from memory.",
    inputSchema: z.object({
      query: z.string().describe("What you need to know, e.g. 'laptop purchase' or 'days working from home'"),
      category: z.string().optional().describe("Optional deduction category id to restrict the search"),
    }),
    execute: async ({ query, category }) => {
      const results = searchRules(pack, { query, year, category });
      return {
        ok: true as const,
        taxYear: year,
        results: results.map((r) => ({
          ruleId: r.id,
          category: r.category,
          title: r.title,
          summary: r.summary,
          calc: r.calc,
          conditions: r.conditions,
          sources: r.sources.map((s) => ({ label: s.label, url: s.url })),
          verification: r.verification,
          lastVerified: r.last_verified,
          notes: r.notes,
          openQuestions: r.open_questions,
        })),
      };
    },
  });
}
