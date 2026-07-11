import ts from 'typescript';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import type { ManifestConfig } from './types.js';

/**
 * Statically extracts `manifest.version`, `manifest.permissions`, and
 * `manifest.host_permissions` from a `wxt.config.ts`-shaped source file, without executing it.
 * Executing arbitrary release-adjacent config in CI (or against an untrusted git ref) is worth
 * avoiding when a plain AST read is enough — the config is a single `defineConfig({ ... })`
 * call with a literal `manifest` object, so this only ever needs to understand object/array/
 * string literals, not general JS evaluation.
 */
export function extractManifestConfig(
  sourceText: string,
  fileName = 'wxt.config.ts',
): ManifestConfig {
  const sourceFile = ts.createSourceFile(
    fileName,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );

  const manifestObject = findManifestObjectLiteral(sourceFile);
  if (!manifestObject) {
    return { version: undefined, permissions: [], hostPermissions: [] };
  }

  return {
    version: getStringPropertyValue(manifestObject, 'version'),
    permissions: getStringArrayPropertyValue(manifestObject, 'permissions') ?? [],
    hostPermissions: getStringArrayPropertyValue(manifestObject, 'host_permissions') ?? [],
  };
}

/** Reads and extracts manifest config from a file on disk (the current checkout). */
export function readManifestConfigFromFile(path: string): ManifestConfig {
  return extractManifestConfig(readFileSync(path, 'utf8'), path);
}

/**
 * Reads and extracts manifest config from a specific git ref (e.g. a previous release tag),
 * without checking that ref out. Used for permission diffing against the previous release.
 */
export function readManifestConfigAtGitRef(
  ref: string,
  path = 'wxt.config.ts',
  cwd = process.cwd(),
): ManifestConfig {
  const sourceText = execFileSync('git', ['show', `${ref}:${path}`], { cwd, encoding: 'utf8' });
  return extractManifestConfig(sourceText, path);
}

function findManifestObjectLiteral(
  sourceFile: ts.SourceFile,
): ts.ObjectLiteralExpression | undefined {
  let result: ts.ObjectLiteralExpression | undefined;

  const visit = (node: ts.Node) => {
    if (result) return;

    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === 'defineConfig'
    ) {
      const [configArg] = node.arguments;
      if (configArg && ts.isObjectLiteralExpression(configArg)) {
        const manifestProp = findProperty(configArg, 'manifest');
        if (manifestProp && ts.isObjectLiteralExpression(manifestProp)) {
          result = manifestProp;
          return;
        }
      }
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return result;
}

function findProperty(obj: ts.ObjectLiteralExpression, name: string): ts.Expression | undefined {
  for (const property of obj.properties) {
    if (
      ts.isPropertyAssignment(property) &&
      ((ts.isIdentifier(property.name) && property.name.text === name) ||
        (ts.isStringLiteral(property.name) && property.name.text === name))
    ) {
      return property.initializer;
    }
  }
  return undefined;
}

function getStringPropertyValue(obj: ts.ObjectLiteralExpression, name: string): string | undefined {
  const value = findProperty(obj, name);
  if (value && ts.isStringLiteralLike(value)) {
    return value.text;
  }
  return undefined;
}

function getStringArrayPropertyValue(
  obj: ts.ObjectLiteralExpression,
  name: string,
): string[] | undefined {
  const value = findProperty(obj, name);
  if (!value || !ts.isArrayLiteralExpression(value)) return undefined;

  const values: string[] = [];
  for (const element of value.elements) {
    if (ts.isStringLiteralLike(element)) {
      values.push(element.text);
    }
  }
  return values;
}
