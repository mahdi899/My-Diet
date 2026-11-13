const { spawnSync } = require('node:child_process')
const path = require('node:path')

const result = spawnSync(process.execPath, ['--import', 'tsx', '--test', 'test/unit/onboarding-react-flow.spec.ts'], {
  cwd: path.resolve(__dirname, '../backend'),
  stdio: 'inherit',
})
process.exit(result.status ?? 1)
