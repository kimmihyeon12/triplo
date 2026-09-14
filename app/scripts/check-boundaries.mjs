import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const root = path.resolve('src/app');
const files = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(file);
    else if (file.endsWith('.ts') && !file.endsWith('.spec.ts')) files.push(file);
  }
}
walk(root);
const configFile = ts.readConfigFile('tsconfig.app.json', ts.sys.readFile);
const config = ts.parseJsonConfigFileContent(configFile.config, ts.sys, process.cwd());
const graph = new Map();
const errors = [];
const rel = file => path.relative(root, file).replaceAll('\\', '/');
for (const file of files) {
  const name = rel(file);
  const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
  if (source.text.includes('@Component(') && path.basename(path.dirname(file)) !== path.basename(file, '.ts')) errors.push(`${name}: component HTML/TS/CSS must share a component folder`);
  if (source.text.includes('@Component(') && path.basename(file).includes('-page')) errors.push(`${name}: omit the -page filename suffix`);
  const imports = [];
  function visit(node) {
    if (ts.isPropertyAssignment(node) && ['template', 'styles'].includes(node.name.getText(source))) errors.push(`${name}: inline template/styles must be moved to separate files`);
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) imports.push(node.moduleSpecifier.text);
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword && ts.isStringLiteral(node.arguments[0])) imports.push(node.arguments[0].text);
    if (/\/(model|util)\//.test(name) && ts.isIdentifier(node) && ['window', 'document', 'navigator', 'localStorage'].includes(node.text)) errors.push(`${name}: browser dependency ${node.text} in pure layer`);
    ts.forEachChild(node, visit);
  }
  visit(source);
  const edges = [];
  for (const specifier of imports) {
    if (/\/(model|util)\//.test(name) && specifier.startsWith('@angular/')) errors.push(`${name}: Angular dependency in pure layer`);
    const resolved = ts.resolveModuleName(specifier, file, config.options, ts.sys).resolvedModule?.resolvedFileName;
    if (!resolved || !resolved.startsWith(root + path.sep)) continue;
    const target = rel(resolved);
    edges.push(resolved);
    if (/^(shared|core)\//.test(name) && target.startsWith('features/')) errors.push(`${name} -> ${target}: shared/core cannot depend on features`);
    if (name.includes('/data/') && /\/(feature|ui)\//.test(target)) errors.push(`${name} -> ${target}: data cannot depend on presentation`);
    if (name.includes('/model/') && /\/(util|data|feature|ui)\//.test(target)) errors.push(`${name} -> ${target}: model cannot depend on behavior`);
    if (name.includes('/util/') && /\/(data|feature|ui)\//.test(target)) errors.push(`${name} -> ${target}: pure utilities cannot depend on services`);
    const feature = name.match(/^features\/([^/]+)/)?.[1];
    const other = target.match(/^features\/([^/]+)/)?.[1];
    if (feature && other && feature !== other && target.includes('/feature/')) errors.push(`${name} -> ${target}: use the feature public entry`);
  }
  graph.set(file, edges);
}
const visited = new Set();
const active = new Set();
function checkCycle(file, stack = []) {
  if (active.has(file)) { errors.push(`cycle: ${[...stack, file].map(rel).join(' -> ')}`); return; }
  if (visited.has(file)) return;
  active.add(file);
  for (const child of graph.get(file) ?? []) checkCycle(child, [...stack, file]);
  active.delete(file);
  visited.add(file);
}
for (const file of files) checkCycle(file);
if (errors.length) { console.error(errors.join('\n')); process.exitCode = 1; }
else console.log(`Architecture boundaries and cycles: ${files.length} modules passed`);
