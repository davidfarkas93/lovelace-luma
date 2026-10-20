import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const { outputText } = ts.transpileModule(readFileSync(new URL('../src/navigation.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
});
const exports = {};
vm.runInNewContext(outputText, { exports });
const { routeIsActive } = exports;
const exact = {url:'/pages/energy',label:'Energy'};
assert(routeIsActive(exact, '/pages/energy?mode=day#chart'));
assert(routeIsActive(exact, '/pages/energy/'));
assert(!routeIsActive(exact, '/pages/energy-settings'));
assert(!routeIsActive(exact, '/pages/energyish'));
const family = {...exact,match_paths:['/pages/energy','/pages/energy-*']};
assert(routeIsActive(family, '/pages/energy-charging'));
assert(!routeIsActive(family, '/pages/energyish'));
assert(routeIsActive({url:'/site/a.b',label:'Literal'}, '/site/a.b'));
assert(!routeIsActive({url:'/site/a.b',label:'Literal'}, '/site/axb'));
assert(routeIsActive({...exact,match_paths:['/energy/*','/another-page']}, '/energy/solar'));
assert(routeIsActive({...exact,match_paths:['/energy/*','/another-page']}, '/another-page'));
console.log('Navigation: exact pages, explicit page families, query/hash handling and literal path escaping passed.');
