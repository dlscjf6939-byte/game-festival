import { ORMDatabaseAdapter } from "../db/types.mjs";
import { prismaAdapter as prismaAdapter$1 } from "../node_modules/.pnpm/fumadb@0.2.2_drizzle-orm@0.44.7_@cloudflare_workers-types@4.20260313.1_@electric-sql_pg_c72c8c754becd21f6d6662e8fbd28e7f/node_modules/fumadb/dist/adapters/prisma/index.mjs";

//#region src/adapters/prisma.d.ts
type PrismaConfig = Parameters<typeof prismaAdapter$1>[0];
declare const prismaAdapter: (config: PrismaConfig) => ORMDatabaseAdapter;
//#endregion
export { PrismaConfig, prismaAdapter };