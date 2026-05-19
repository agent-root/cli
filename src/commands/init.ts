import fs from 'node:fs';
import path from 'node:path';
import pc from 'picocolors';
import { MANIFEST_PATH } from '@agent-root/core';
import { fatal } from '../cli/fatal';
import { getApiBase } from '../services/config/config-service';
import { buildTxtRecord, txtHostFor } from '../constants/protocol';

// --- public entry point ---

export async function cmdInit(positional: string[], flags: Record<string, unknown>): Promise<void> {
  const outputPath = positional[0] || MANIFEST_PATH;
  const dir = path.dirname(outputPath);

  if (fs.existsSync(outputPath) && !flags.force) {
    fatal(`${outputPath} already exists. Use --force to overwrite.`);
  }

  const domain = (flags.domain as string) || 'yourdomain.com';
  const template = buildManifestTemplate(domain);

  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(template, null, 2) + '\n', 'utf-8');
  console.log(`${pc.green('created')} ${outputPath}\n`);
  console.log('Next steps:');
  console.log(`  1. Edit ${outputPath} with your records`);
  console.log(`  2. Run ${pc.cyan(`npx agent-root validate ${outputPath}`)}`);
  console.log(`  3. Add a DNS TXT record:`);
  console.log(`     ${pc.dim(`${txtHostFor(domain)} TXT "${buildTxtRecord(domain)}"`)}`);
  console.log(`  4. Deploy and submit: ${pc.cyan(`curl -X POST ${getApiBase()}/api/submit -H "Content-Type: application/json" -d '{"domain":"${domain}"}'`)}`);
}

// --- private helpers ---

/**
 * Default scaffold for a fresh `agentroot.json`. One example MCP record so
 * the file passes validation as written; the user is expected to edit it.
 */
function buildManifestTemplate(domain: string): Record<string, unknown> {
  return {
    domain,
    records: [
      {
        type: 'mcp',
        id: 'my-tools',
        name: 'My Tools',
        description: 'Describe what your MCP server does',
        endpoint: `https://${domain}/mcp`,
        transport: 'sse',
      },
    ],
  };
}
