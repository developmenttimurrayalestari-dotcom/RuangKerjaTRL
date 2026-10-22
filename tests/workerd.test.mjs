// Run handlers and migration regressions in separate processes so test hooks
// and temporary migration paths cannot leak between suites.
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const project = fileURLToPath(new URL('../', import.meta.url));
for (const file of ['integration.test.mjs', 'organization-migration.test.mjs']) {
  const result = spawnSync(process.execPath, ['--import', './tests/register.mjs', `./tests/${file}`], {
    cwd: project,
    stdio: 'inherit',
    env: {...process.env, TEST_D1_RUNTIME: 'workerd'},
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
