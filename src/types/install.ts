export interface SkillMeta {
  id: string;
  name: string;
  description: string;
  url: string;
  domain: string;
}

export interface JsonOut {
  status: string;
  domain: string;
  recordId: string | null;
  type: string | null;
  installed: Array<Record<string, unknown>>;
  skipped: Array<Record<string, unknown>>;
  errors: Array<Record<string, unknown>>;
  [key: string]: unknown;
}

export interface UpdateGlobalManifestOptions {
  domain: string;
  recordId: string;
  tools: string[];
  linkTypes: Record<string, string>;
  skillMeta: { name: string; versionHash: string; url: string };
}

export interface ResolveSkillsFromRecordOptions {
  record: Record<string, unknown>;
  domain: string;
  recordId: string;
  flags: Record<string, unknown>;
}

export interface FetchSkillsFromRegistryOptions {
  domain: string;
  recordId: string | null;
  installAll: boolean;
  flags: Record<string, unknown>;
}

export interface InstallSkillOptions {
  domain: string;
  recordId: string | null;
  record: Record<string, unknown> | null;
  manifest: Record<string, unknown> | null;
  installAll: boolean;
  isProject: boolean;
  flags: Record<string, unknown>;
  jsonOut: JsonOut;
}
