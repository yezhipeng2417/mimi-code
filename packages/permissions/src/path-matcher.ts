/**
 * PathMatcher — Glob-based path matching for permission rules.
 *
 * Supports patterns like:
 *   "/Users/foo/**" — all files under /Users/foo
 *   "*.ts" — all TypeScript files
 *   "/Users/foo/bar.ts" — exact path match
 */

/**
 * Match a file path against a glob-like pattern.
 */
export function matchPath(pattern: string, filePath: string): boolean {
  // Exact match
  if (pattern === filePath) return true;

  // Convert glob pattern to regex
  const regexStr = pattern
    // Escape regex special chars (except * and ?)
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    // ** matches any path
    .replace(/\*\*/g, '{{GLOBSTAR}}')
    // * matches anything except /
    .replace(/\*/g, '[^/]*')
    // ? matches single char
    .replace(/\?/g, '[^/]')
    // Restore globstar
    .replace(/\{\{GLOBSTAR\}\}/g, '.*');

  const regex = new RegExp(`^${regexStr}$`);
  return regex.test(filePath);
}

/**
 * Check if a command matches a pattern.
 * Patterns can be exact commands or prefix patterns with *.
 */
export function matchCommand(pattern: string, command: string): boolean {
  if (pattern === command) return true;
  if (pattern === '*') return true;

  // Simple prefix matching: "git *" matches "git status"
  if (pattern.endsWith(' *')) {
    const prefix = pattern.slice(0, -2);
    return command.startsWith(prefix + ' ') || command === prefix;
  }

  return matchPath(pattern, command);
}
