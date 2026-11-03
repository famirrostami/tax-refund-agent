/** Terminal client for trying the agent against a running server: npm run chat [-- --year=2025]. */
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";

const arg = (n: string) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const URL_BASE = arg("url") ?? "http://127.0.0.1:8787";
const year = Number(arg("year") ?? 2025);

type Part = { type: string; [k: string]: any };
type Msg = { role: "user" | "assistant"; parts: Part[] };

const rl = createInterface({ input: stdin, output: stdout });
const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;
const history: Msg[] = [];

/** Sends the history, prints the streamed reply, and returns the assistant message that was built from it. */
async function send(): Promise<Msg> {
  const res = await fetch(`${URL_BASE}/api/chat`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ year, messages: history }) });
  if (!res.ok || !res.body) throw new Error(`server answered ${res.status} ${await res.text()}`);
  const parts: Part[] = [];
  const byCall = (id: string) => parts.find((p) => p.toolCallId === id);
  let buffer = "";
  const handle = (c: any) => {
    switch (c.type) {
      case "text-start": parts.push({ type: "text", id: c.id, text: "" }); break;
      case "text-delta": { const p = parts.find((x) => x.id === c.id); if (p) p.text += c.delta; stdout.write(c.delta); break; }
      case "text-end": stdout.write("\n"); break;
      case "tool-input-available": parts.push({ type: `tool-${c.toolName}`, toolCallId: c.toolCallId, state: "input-available", input: c.input }); console.log(dim(`  → ${c.toolName}`)); break;
      case "tool-output-available": { const p = byCall(c.toolCallId); if (p) Object.assign(p, { state: "output-available", output: c.output }); break; }
      case "tool-approval-request": { const p = byCall(c.toolCallId); if (p) Object.assign(p, { state: "approval-requested", approval: { id: c.approvalId } }); break; }
      case "error": console.log(`\nerror: ${c.errorText}`); break;
    }
  };
  const decoder = new TextDecoder();
  for await (const chunk of res.body as any) {
    buffer += decoder.decode(chunk, { stream: true });
    let i;
    while ((i = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, i).trim();
      buffer = buffer.slice(i + 1);
      if (line.startsWith("data: ") && line !== "data: [DONE]") handle(JSON.parse(line.slice(6)));
    }
  }
  return { role: "assistant", parts: parts.map(({ id, ...p }) => p) };
}

async function answerQuestion(q: any): Promise<any> {
  const unit = q.unit ? ` (${q.unit})` : "";
  console.log(`\n? ${q.question}${unit}`);
  if (q.answerType === "choice") q.choices.forEach((c: any, i: number) => console.log(`   ${i + 1}) ${c.label}`));
  const raw = (await rl.question(q.answerType === "boolean" ? "  [y/n, Enter = skip, ? = don't know] > " : "  [Enter = skip, ? = don't know] > ")).trim();
  if (raw === "") return { answered: false, reason: "skipped" };
  if (raw === "?") return { answered: false, reason: "dont_know" };
  if (q.answerType === "number") return { answered: true, value: Number(raw.replace(",", ".")) };
  if (q.answerType === "boolean") return { answered: true, value: /^(y|yes|j|ja|true)$/i.test(raw) };
  if (q.answerType === "choice") return { answered: true, value: q.choices[Number(raw) - 1]?.value ?? raw };
  return { answered: true, value: raw };
}

console.log(`Tax refund agent, tax year ${year}. Type a message; /quit to leave.`);
for (;;) {
  const line = (await rl.question("\nyou > ").catch(() => "/quit")).trim();
  if (!line) continue;
  if (line === "/quit") break;
  history.push({ role: "user", parts: [{ type: "text", text: line }] });
  // Keep going while the agent is waiting for an answer or an approval from us.
  for (;;) {
    const msg = await send();
    history.push(msg);
    const question = msg.parts.find((p) => p.type === "tool-askUser" && p.state === "input-available");
    const approval = msg.parts.find((p) => p.state === "approval-requested");
    if (question) Object.assign(question, { state: "output-available", output: await answerQuestion(question.input) });
    else if (approval) {
      const ok = /^(y|yes|j|ja)$/i.test((await rl.question(`\nApprove ${approval.type.replace("tool-", "")}? It will write files on this machine. [y/N] > `)).trim());
      Object.assign(approval, { state: "approval-responded", approval: { id: approval.approval.id, approved: ok } });
    } else break;
  }
}
rl.close();
