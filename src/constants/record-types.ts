export const RECORD_TYPES: Record<string, string> = {
  agent: 'Agent',
  mcp: 'MCP Server',
  skill: 'Skill',
  a2a: 'A2A Endpoint',
  payment: 'Payment',
};

/**
 * Resolve a human-readable label for a record type. Preserves the historical
 * cascade `RECORD_TYPES[type] ?? type ?? 'skill'` so list/uninstall stay
 * byte-identical to the pre-helper output for every input.
 */
export function labelForType(type: string | undefined | null): string {
  if (type && RECORD_TYPES[type]) return RECORD_TYPES[type] as string;
  return type ?? 'skill';
}
