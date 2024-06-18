export type RelativePath = `./${string}`;
export type AbsolutePath = `/${string}`;
export type AbsoluteJSONPath = `${AbsolutePath}.json`;

/**
 * A type-guard that validates if a given path is a relative path.
 * @param path - The path to check.
 */
export function isRelative(path: string): path is RelativePath {
  return path.startsWith('./') || path.startsWith('../');
}
