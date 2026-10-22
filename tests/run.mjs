import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const project=fileURLToPath(new URL('../',import.meta.url));
for(const file of ['domain.test.mjs','integration.test.mjs','frontend.test.mjs','organization-migration.test.mjs']){
 const result=spawnSync(process.execPath,['--import','./tests/register.mjs',`./tests/${file}`],{cwd:project,stdio:'inherit'});
 if(result.status!==0)process.exit(result.status??1);
}
console.log('Domain, application-handler, frontend, and organization-migration test suites completed. Run npm run test:d1 to verify the Cloudflare D1 runtime too.');
