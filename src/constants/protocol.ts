/**
 * Protocol-level constants for the AgentRoot DNS+JSON-manifest format.
 *
 * Single source of truth: if the protocol version bumps, the DNS prefix
 * changes, or the docs move, update here and every call site picks it up.
 */

import { MANIFEST_PATH } from '@agent-root/core';

/**
 * Version tag at the start of every AgentRoot TXT record. Resolvers reject
 * any TXT record that does not begin with this string.
 */
export const PROTOCOL_VERSION = 'v=ar1';

/**
 * DNS subdomain where AgentRoot resolvers look for the TXT record.
 * A manifest for example.com is published under _agentroot.example.com.
 */
export const DNS_PREFIX = '_agentroot';

/**
 * Canonical URL for the published protocol specification.
 */
export const DOCS_URL = 'https://agentroot.io/docs/protocol';

/**
 * Build the DNS host where a domain's AgentRoot TXT record lives.
 *
 * @example
 *   txtHostFor('example.com')  // '_agentroot.example.com'
 */
export function txtHostFor(domain: string): string {
  return `${DNS_PREFIX}.${domain}`;
}

/**
 * Build the TXT record value that a domain owner publishes for an HTTPS
 * manifest at the canonical `.well-known/agentroot.json` path.
 *
 * @example
 *   buildTxtRecord('example.com')
 *   // 'v=ar1 manifest=https://example.com/.well-known/agentroot.json'
 */
export function buildTxtRecord(domain: string): string {
  return `${PROTOCOL_VERSION} manifest=https://${domain}/${MANIFEST_PATH}`;
}
