/**
 * Module resolution hook for `node --test`.
 *
 * App code uses extensionless imports ("../util/time") because that is what
 * Metro expects and what the rest of the React Native ecosystem writes. Node's
 * ESM resolver requires explicit extensions, so this hook retries a failed
 * specifier with ".ts" / ".tsx" / "/index.ts" before giving up. It exists only
 * for the test runner — it is never part of an app bundle.
 */
import { register } from 'node:module';
import { pathToFileURL } from 'node:url';

const CANDIDATE_SUFFIXES = ['.ts', '.tsx', '/index.ts', '/index.tsx'];

export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context);
  } catch (error) {
    if (!specifier.startsWith('.') && !specifier.startsWith('/')) throw error;
    for (const suffix of CANDIDATE_SUFFIXES) {
      try {
        return await nextResolve(specifier + suffix, context);
      } catch {
        // Try the next candidate extension.
      }
    }
    throw error;
  }
}

register(pathToFileURL(import.meta.filename));
