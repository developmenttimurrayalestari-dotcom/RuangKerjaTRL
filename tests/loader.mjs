// Test-only loader: transpiles real application TS and replaces platform transports.
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
const stubs={
 'cloudflare:workers':'export const env=globalThis.__workspaceTestEnv;',
 'next/headers':'export async function headers(){return globalThis.__workspaceTestHeaders ?? new Headers();}',
 'next/navigation':'export function redirect(url){throw new Error("Redirect: "+url);}',
};
export async function resolve(specifier,context,nextResolve){
 if(stubs[specifier])return {url:'data:text/javascript,'+encodeURIComponent(stubs[specifier]),shortCircuit:true};
 if(specifier.startsWith('.')&&context.parentURL?.startsWith('file:')){const url=new URL(specifier,context.parentURL);if(!/\.(m?js|ts|tsx|json)$/.test(url.pathname)&&existsSync(fileURLToPath(url)+'.ts'))return {url:url.href+'.ts',shortCircuit:true};}
 return nextResolve(specifier,context);
}
export async function load(url,context,nextLoad){
 if(url.startsWith('file:')&&url.endsWith('.ts')&&!url.includes('/node_modules/')){const source=readFileSync(fileURLToPath(url),'utf8');return{format:'module',source:ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,verbatimModuleSyntax:false}}).outputText,shortCircuit:true};}
 if(url.startsWith('file:')&&url.includes('/lib/data/')&&url.endsWith('.json'))return{format:'module',source:'export default '+readFileSync(fileURLToPath(url),'utf8')+';',shortCircuit:true};
 return nextLoad(url,context);
}
