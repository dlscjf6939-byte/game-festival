import { BuildType } from "@hot-updater/cli-tools";

//#region iac/supabaseApi.d.ts
interface SupabaseApi {
  listBuckets: () => Promise<{
    id: string;
    name: string;
    isPublic: boolean;
    createdAt: string;
  }[]>;
  createBucket: (bucketName: string, options: {
    public: boolean;
  }) => Promise<{
    name: string;
  }>;
}
//#endregion
//#region iac/index.d.ts
declare const getLegacySupabaseConfigReference: (configText: string) => "HOT_UPDATER_SUPABASE_ANON_KEY" | "supabaseAnonKey" | null;
declare const resolveEdgeFunctionDenoConfig: (targetDir: string) => Promise<{
  imports: Record<string, string>;
}>;
declare const selectProject: () => Promise<{
  id: string;
  name: string;
  region: string;
}>;
declare const selectBucket: (api: SupabaseApi) => Promise<{
  id: string;
  name: string;
}>;
declare const runInit: ({
  build
}: {
  build: BuildType;
}) => Promise<void>;
//#endregion
export { getLegacySupabaseConfigReference, resolveEdgeFunctionDenoConfig, runInit, selectBucket, selectProject };