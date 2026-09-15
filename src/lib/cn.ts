export type CnArg = string | false | null | undefined;

export function cn(...args: CnArg[]): string {
  return args.filter(Boolean).join(" ");
}
