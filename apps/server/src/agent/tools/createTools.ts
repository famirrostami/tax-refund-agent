import type { LanguageModel, ToolSet } from "ai";
import type { ExportStore } from "../../exports";
import type { FileStore } from "../../files";
import type { Pack } from "../../packs";
import { createExtractReceiptTool } from "./extractReceipt";
import { createSearchRulesTool } from "./searchRules";
import { createCheckDeductibilityTool } from "./checkDeductibility";
import { createAskUserTool } from "./askUser";
import { createClassifyExpenseTool } from "./classifyExpense";
import { createMapToFormFieldsTool } from "./mapToFormFields";
import { createBuildChecklistTool } from "./buildChecklist";
import { createBuildExportTool } from "./buildExport";

export function createTools(ctx: { model: LanguageModel; files: FileStore; exports: ExportStore; pack: Pack; year: number; acceptsPdf?: boolean }): ToolSet {
  return {
    extractReceipt: createExtractReceiptTool(ctx),
    searchRules: createSearchRulesTool(ctx),
    checkDeductibility: createCheckDeductibilityTool(ctx),
    classifyExpense: createClassifyExpenseTool(ctx),
    mapToFormFields: createMapToFormFieldsTool(ctx),
    buildChecklist: createBuildChecklistTool(ctx),
    buildExport: createBuildExportTool(ctx),
    askUser: createAskUserTool(),
  };
}
