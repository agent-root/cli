export async function confirmAction(message: string, flags: Record<string, unknown>): Promise<boolean> {
  if (flags.yes || !process.stdout.isTTY) return true;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { confirm } = require('@inquirer/prompts') as { confirm: (opts: { message: string; default: boolean }) => Promise<boolean> };
  try {
    return await confirm({ message, default: false });
  } catch {
    return false;
  }
}
