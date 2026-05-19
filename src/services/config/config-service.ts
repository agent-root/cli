import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { API_BASE } from '@agent-root/core';

export const CONFIG_PATH: string = path.join(os.homedir(), '.agentroot', 'config.json');

let _configCache: Record<string, string> | null = null;

export function loadConfig(): Record<string, string> {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')) as Record<string, string>;
  } catch {
    return {};
  }
}

export function saveConfig(data: Record<string, string>): void {
  fs.mkdirSync(path.dirname(CONFIG_PATH), { recursive: true });
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(data, null, 2) + '\n');
}

export function getApiBase(): string {
  if (_configCache === null) {
    _configCache = loadConfig();
  }
  return _configCache['api-url'] || API_BASE;
}
