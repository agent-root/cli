import { colors } from '../cli/colors';
import { RECORD_TYPES } from '../constants/record-types';

export function formatRecord(r: Record<string, unknown>, indent?: string): string {
  const ind = indent || '  ';
  const typeLabel = RECORD_TYPES[r.type as string] || r.type as string;
  let out = '';
  out += `${ind}${colors.bold((r.name || r.id) as string)} ${colors.dim(`(${typeLabel})`)}\n`;
  out += `${ind}${colors.dim('address:')} ${r._domain || ''}/${r.id}\n`;
  if (r.description) out += `${ind}${colors.dim('desc:')}    ${r.description as string}\n`;
  if (r.endpoint)    out += `${ind}${colors.dim('endpoint:')} ${r.endpoint as string}\n`;
  if (r.transport)   out += `${ind}${colors.dim('transport:')} ${r.transport as string}\n`;
  if (r.protocol)    out += `${ind}${colors.dim('protocol:')} ${r.protocol as string}\n`;
  if (r.auth)        out += `${ind}${colors.dim('auth:')}     ${r.auth as string}\n`;
  if (r.pricing)     out += `${ind}${colors.dim('pricing:')}  ${r.pricing as string}\n`;
  if (r.index)       out += `${ind}${colors.dim('index:')}    ${r.index as string}\n`;
  if (r.skill_md)    out += `${ind}${colors.dim('skill_md:')} ${r.skill_md as string}\n`;
  if (Array.isArray(r.capabilities) && r.capabilities.length > 0) {
    out += `${ind}${colors.dim('caps:')}     ${(r.capabilities as string[]).join(', ')}\n`;
  }
  if (Array.isArray(r.tools) && r.tools.length > 0) {
    out += `${ind}${colors.dim('tools:')}    ${(r.tools as Array<{ name: string }>).map(t => t.name).join(', ')}\n`;
  }
  return out;
}
