import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

export function ensureCanonicalStore(domain: string, recordId: string): string {
  const canonicalDir = path.join(os.homedir(), '.agents', 'skills', domain, recordId);
  fs.mkdirSync(canonicalDir, { recursive: true });
  return canonicalDir;
}

export function createSymlink(targetDir: string, linkPath: string): string {
  fs.mkdirSync(path.dirname(linkPath), { recursive: true });
  try {
    const stat = fs.lstatSync(linkPath);
    if (stat.isSymbolicLink() || stat.isDirectory()) {
      fs.rmSync(linkPath, { recursive: true });
    }
  } catch {
    // No existing entry to clean up, lstat throws ENOENT on a fresh
    // install. That's the happy path here.
  }

  if (process.platform === 'win32') {
    try {
      fs.symlinkSync(path.resolve(targetDir), linkPath, 'junction');
      return 'junction';
    } catch {
      fs.cpSync(targetDir, linkPath, { recursive: true });
      return 'copy';
    }
  } else {
    fs.symlinkSync(path.resolve(targetDir), linkPath);
    return 'symlink';
  }
}
