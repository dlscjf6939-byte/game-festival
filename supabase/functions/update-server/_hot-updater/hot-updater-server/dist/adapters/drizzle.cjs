Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const require_index = require("../node_modules/.pnpm/fumadb@0.2.2_drizzle-orm@0.44.7_@cloudflare_workers-types@4.20260313.1_@electric-sql_pg_c72c8c754becd21f6d6662e8fbd28e7f/node_modules/fumadb/dist/adapters/drizzle/index.cjs");
//#region src/adapters/drizzle.ts
const drizzleAdapter = (config) => Object.assign(require_index.drizzleAdapter(config), { provider: config.provider });
//#endregion
exports.drizzleAdapter = drizzleAdapter;
