/**
 * Reads name + version from this CLI package's package.json at runtime so the
 * outbound User-Agent header reflects the actual published version — no manual
 * sync needed on every release.
 *
 * CLI is CommonJS (rootDir = "."), so the compiled file lives at
 * dist/src/lib/package-info.js  →  ../../../package.json (3 levels up).
 */

import * as path from 'node:path';

interface PackageJson {
  readonly name: string;
  readonly version: string;
}

// __dirname is available because module=CommonJS for the CLI package.
const pkgPath = path.resolve(__dirname, '../../../package.json');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pkg = require(pkgPath) as PackageJson;

export const PACKAGE_NAME: string = pkg.name;
export const PACKAGE_VERSION: string = pkg.version;
export const USER_AGENT: string = `${pkg.name}/${pkg.version}`;
