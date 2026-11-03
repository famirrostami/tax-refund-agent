import { serve } from "@hono/node-server";
import { loadEnv } from "./env";
import { loadPack } from "./packs";
import { createModel, modelCapabilities } from "./agent/model";
import { createApp } from "./app";

const env = loadEnv();
const pack = await loadPack(env.PACKS_DIR, env.COUNTRY);
const app = createApp({ model: createModel(env), pack, dataDir: env.DATA_DIR, capabilities: modelCapabilities(env) });
serve({ fetch: app.fetch, port: env.PORT }, (info) => console.log(`server on :${info.port} (${pack.manifest.name}, model: ${env.LLM_PROVIDER}/${env.LLM_MODEL})`));
