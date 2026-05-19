/**
 * Reads name + version from this CLI package's package.json at runtime so the
 * outbound User-Agent header reflects the actual published version — no manual
 * sync needed on every release.
 *
 * Walks up from __dirname to find the nearest package.json. This works both
 * when compiled (dist/src/lib/) and when run through a TS test runner (src/lib/).
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

interface PackageJson {
  readonly name: string;
  readonly version: string;
}

function findPackageJson(startDir: string): PackageJson {
  let dir = startDir;
  while (dir !== path.parse(dir).root) {
    const candidate = path.join(dir, 'package.json');
    if (fs.existsSync(candidate)) {
      const contents = fs.readFileSync(candidate, 'utf8');
      const parsed = JSON.parse(contents) as PackageJson;
      // Only accept this package's own package.json, not a parent monorepo's.
      if (parsed.name === 'agent-root') return parsed;
    }
    dir = path.dirname(dir);
  }
  // Conservative fallback so the CLI never hard-crashes on a missing file.
  return { name: 'agent-root', version: '0.0.0' };
}

const pkg = findPackageJson(__dirname);

export const PACKAGE_NAME: string = pkg.name;
export const PACKAGE_VERSION: string = pkg.version;
export const USER_AGENT: string = `${pkg.name}/${pkg.version}`;
