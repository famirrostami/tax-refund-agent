import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { wrapLanguageModel, type LanguageModel } from "ai";
import { claudeCode } from "ai-sdk-provider-claude-code";
import { textToolCalling } from "./toolCalling";

let sandbox: string | undefined;

/** Empty throw-away working directory: the CLI must never see the project or the user's files. */
const emptyCwd = () => (sandbox ??= mkdtempSync(join(tmpdir(), "tax-agent-cli-")));

type CliModel = ReturnType<typeof claudeCode>;

/**
 * The Claude Code CLI used purely as a language model. The session is locked down: no built-in tools (shell, file
 * access, web), no MCP servers (not even the account's own connectors such as Gmail), no permission prompts,
 * nothing persisted to ~/.claude, no filesystem settings. Tool calling for the app's tools is emulated by
 * `textToolCalling`, so the server runs the same loop as with any API model.
 *
 * A provider instance remembers the last CLI session id and resumes it on its next call. That would carry one
 * conversation into another, so every call gets a fresh instance and every call is stateless.
 */
export function createClaudeCodeModel(modelId: string): LanguageModel {
  const fresh = (): CliModel =>
    claudeCode(modelId, {
      cwd: emptyCwd(),
      tools: [] as string[],
      strictMcpConfig: true,
      permissionPrompts: "none",
      persistSession: false,
      maxTurns: 4,
    });
  const probe = fresh();
  const stateless = {
    specificationVersion: probe.specificationVersion,
    provider: probe.provider,
    modelId: probe.modelId,
    supportedUrls: probe.supportedUrls,
    doGenerate: (options: Parameters<CliModel["doGenerate"]>[0]) => fresh().doGenerate(options),
    doStream: (options: Parameters<CliModel["doStream"]>[0]) => fresh().doStream(options),
  } as unknown as CliModel;
  return wrapLanguageModel({ model: stateless, middleware: textToolCalling() });
}
