import { colors } from '../cli/colors';
import { postJSON } from '../services/http/fetch';
import { getApiBase } from '../services/config/config-service';
import { resolveAgentroot } from '../services/dns/dns-service';
import { fatal } from '../cli/fatal';
import { maybeSpinner } from '../cli/spinner';
import { txtHostFor } from '../constants/protocol';

interface InstructionsBlock {
  agentroot?: {
    record?: string;
    type?: string;
    value?: string;
    skill?: string;
    inline?: string;
  };
  agent?: { record?: string; type?: string; value?: string };
  skill?: { record?: string; type?: string; value?: string; alternative?: string };
  spec?: string;
}

interface SubmitResponse {
  domain?: string;
  found?: string[];
  manifest?: Record<string, unknown> | null;
  agent?: Record<string, unknown> | null;
  skill?: Record<string, unknown> | null;
  success?: boolean;
  message?: string;
  records_indexed?: number;
  validation_errors?: string[];
  validation_warnings?: string[];
  instructions?: InstructionsBlock;
  // Legacy shape some prior versions returned, support both for forward-compat.
  verification_required?: boolean;
  txt_record?: string;
}

function printInstructions(domain: string, instructions: InstructionsBlock | undefined): void {
  if (!instructions) return;
  const ar = instructions.agentroot;
  if (ar && ar.value) {
    console.log();
    console.log(`  ${colors.bold('Add this DNS TXT record, then re-submit:')}`);
    console.log();
    console.log(`    ${colors.dim('host:')}  ${ar.record ?? txtHostFor(domain)}`);
    console.log(`    ${colors.dim('type:')}  ${ar.type ?? 'TXT'}`);
    console.log(`    ${colors.dim('value:')} ${ar.value}`);
    console.log();
    console.log(`  ${colors.dim('Once propagated:')} ${colors.cyan(`agent-root submit ${domain}`)}`);
    console.log();
    if (instructions.spec) {
      console.log(`  ${colors.dim('Reference:')} ${instructions.spec}`);
    }
  }
}

function printValidationErrors(errs: string[] | undefined, warnings: string[] | undefined): boolean {
  let printed = false;
  if (errs && errs.length > 0) {
    console.log();
    console.log(`  ${colors.bold(colors.red('Validation errors:'))}`);
    for (const e of errs) {
      console.log(`    ${colors.red('-')} ${e}`);
    }
    printed = true;
  }
  if (warnings && warnings.length > 0) {
    console.log();
    console.log(`  ${colors.bold(colors.yellow('Warnings:'))}`);
    for (const w of warnings) {
      console.log(`    ${colors.yellow('-')} ${w}`);
    }
    printed = true;
  }
  return printed;
}

interface ResolvedSubmit {
  body: Record<string, unknown>;
  resolvedManifestUrl: string | null;
}

/**
 * Build the POST body. If the user didn't pass `--manifest-url`, try to
 * DNS-resolve the domain first, the registry can verify either way, but
 * surfacing the manifest URL we found in the CLI output helps the user
 * confirm their DNS is set up right.
 */
async function buildSubmitBody(domain: string, manifestUrlFlag: string | undefined): Promise<ResolvedSubmit> {
  const body: Record<string, unknown> = { domain };
  if (manifestUrlFlag) {
    body['manifest_url'] = manifestUrlFlag;
    return { body, resolvedManifestUrl: manifestUrlFlag };
  }
  // The local DNS probe is a convenience, not a precondition. A transient
  // ETIMEOUT or refused resolver must not block the submit, the registry
  // does its own verification anyway, so swallow any unexpected error and
  // fall through to "no manifest_url, let the server figure it out".
  try {
    const probe = await resolveAgentroot(domain);
    if (probe.found && probe.mode === 'manifest') {
      body['manifest_url'] = probe.manifestUrl;
      return { body, resolvedManifestUrl: probe.manifestUrl };
    }
  } catch {
    // DNS hiccup on the user's machine, the registry will retry server-side
    // and either index the domain or return the TXT-record instructions.
  }
  return { body, resolvedManifestUrl: null };
}

export async function cmdSubmit(positional: string[], flags: Record<string, unknown>): Promise<void> {
  const domain = positional[0];
  if (!domain) {
    fatal('Usage: agent-root submit <domain> [--manifest-url <url>]', 'Example: agent-root submit mycompany.com');
  }

  // parseArgs normalizes --manifest-url to camelCase, so we only read one key.
  const manifestUrlFlag = typeof flags['manifestUrl'] === 'string' ? flags['manifestUrl'] : undefined;

  const spinner = maybeSpinner(`Submitting ${domain} to the registry...`, flags).start();

  const { body, resolvedManifestUrl } = await buildSubmitBody(domain, manifestUrlFlag);

  let response: { status: number; body: SubmitResponse };
  try {
    response = await postJSON<SubmitResponse>(`${getApiBase()}/api/submit`, body);
  } catch (err) {
    spinner.error({ text: `Could not submit ${domain}` });
    if (flags['json']) {
      console.log(JSON.stringify({ success: false, error: (err as Error).message }, null, 2));
    }
    fatal((err as Error).message);
  }

  const data = response.body;

  if (flags['json']) {
    spinner.stop();
    console.log(JSON.stringify(data, null, 2));
    if (!data.success) process.exit(1);
    return;
  }

  // Success path, the registry verified DNS and indexed the manifest.
  if (data.success) {
    spinner.success({ text: data.message ?? `Submitted ${domain}` });
    // Prefer the URL the registry actually verified, fall back to the one
    // we probed locally so the output is informative even if the registry
    // omitted it from its response.
    const manifestUrl = (data.manifest && typeof data.manifest['manifest_url'] === 'string')
      ? data.manifest['manifest_url'] as string
      : resolvedManifestUrl;
    if (manifestUrl) {
      console.log();
      console.log(`  ${colors.dim('manifest:')} ${manifestUrl}`);
    }
    if (typeof data.records_indexed === 'number') {
      console.log(`  ${colors.dim('indexed:')}  ${data.records_indexed} record(s)`);
    }
    const found = data.found ?? [];
    if (found.length > 0) {
      console.log(`  ${colors.dim('found:')}    ${found.join(', ')}`);
    }
    return;
  }

  // Failure paths, either DNS isn't set up yet or the manifest failed validation.
  spinner.error({ text: data.message ?? `Submission failed for ${domain}` });

  const hadValidation = printValidationErrors(data.validation_errors, data.validation_warnings);

  // Legacy shape: explicit verification_required + txt_record at top level.
  if (data.verification_required && data.txt_record) {
    console.log();
    console.log(`  ${colors.bold('Add this DNS TXT record, then re-submit:')}`);
    console.log(`    ${colors.dim('value:')} ${data.txt_record}`);
  } else if (!hadValidation) {
    // Current shape: print the `instructions` block when DNS lookup failed.
    printInstructions(domain, data.instructions);
  }

  process.exit(1);
}
