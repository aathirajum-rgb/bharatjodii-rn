const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');

// flavor -> APP_TYPE, kept in sync with android/app/build.gradle productFlavors
const FLAVORS = {
  jodii: 115,
  tamil: 116,
  telugu: 117,
  malayalam: 118,
  kannada: 119,
  oriya: 120,
  bengali: 121,
  marathi: 122,
  gujarati: 123,
  hindi: 124,
  punjabi: 125,
  ninetysixkulimaratha: 301,
  ezhava: 302,
  nair: 303,
  kayastha: 304,
  lingayath: 305,
  khandayat: 306,
  sc: 307,
  vokkaliga: 308,
  vishwakarma: 309,
  patel: 310,
  adidravidar: 311,
  teli: 312,
  vanniyar: 313,
  reddy: 314,
  kapu: 315,
  viswabrahmin: 316,
  thiyya: 317,
  kuruba: 318,
  gowda: 319,
  nadar: 320,
  aryavysya: 321,
  prajapati: 322,
  konguvellalar: 323,
  thevar: 324,
  kshatriya: 325,
  kamma: 326,
  rajput: 327,
  agarwal: 328,
  yadav: 329,
  mali: 330,
  st: 331,
  naidu: 332,
  mudaliyar: 333,
  chettiyar: 334,
  padmasali: 335,
  jat: 336,
  baniya: 337,
  pillai: 338,
  brahmin: 504,
  christian: 501,
  muslim: 502,
  divorcee: 503,
  jain: 505,
  sikh: 506,
};

const VALID_ENVS = ['dev', 'stg', 'uat', 'preprod', 'prod'];

function cap(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function run(command, args, extraEnv) {
  const result = spawnSync(command, args, {
    cwd: ROOT,
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, ...extraEnv },
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

// ios/ has no Gradle-style product flavors — Expo fully regenerates the native
// project per flavor (see app.config.js's ios block), so prebuild-ios/run-ios
// always pass --clean. That wipes ios/ first, so refuse to run over uncommitted
// changes there instead of silently discarding someone's in-progress native edits.
function assertIosClean() {
  const result = spawnSync('git', ['status', '--porcelain', '--', 'ios'], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  if (result.status === 0 && result.stdout.trim()) {
    console.error(
      'ios/ has uncommitted changes, and prebuild-ios/run-ios wipe it via `expo prebuild --clean`:\n' +
      result.stdout +
      '\nCommit, stash, or discard those changes first, then re-run.',
    );
    process.exit(1);
  }
}

function main() {
  const [command, flavor, env] = process.argv.slice(2);
  const COMMANDS = ['assemble', 'bundle', 'web', 'prebuild-ios', 'run-ios'];

  if (!COMMANDS.includes(command)) {
    console.error(`Usage: node scripts/flavor-cli.js <${COMMANDS.join('|')}> <flavor> [${VALID_ENVS.join('|')}]`);
    process.exit(1);
  }
  const appType = FLAVORS[flavor];
  if (appType === undefined) {
    console.error(`Unknown flavor "${flavor}". Known flavors: ${Object.keys(FLAVORS).join(', ')}`);
    process.exit(1);
  }
  if (env && !VALID_ENVS.includes(env)) {
    console.error(`Unknown env "${env}". Expected one of: ${VALID_ENVS.join(', ')}`);
    process.exit(1);
  }

  if (env) {
    run('node', ['scripts/setup-env.js', env]);
  }

  const flavorEnv = {
    EXPO_PUBLIC_APP_FLAVOR: flavor,
    EXPO_PUBLIC_APP_TYPE: String(appType),
    ...(env ? { EXPO_PUBLIC_APP_ENV: env } : {}),
  };

  if (command === 'web') {
    run('npx', ['expo', 'export', '--platform', 'web', '--output-dir', `dist-${flavor}`], flavorEnv);
  } else if (command === 'prebuild-ios' || command === 'run-ios') {
    assertIosClean();
    // Unlike Android (flavorEnv above, consumed only by the JS bundle Gradle
    // triggers), app.config.js reads APP_FLAVOR directly at prebuild time to
    // pick bundleIdentifier/name/icon — expo prebuild needs it, not just the
    // EXPO_PUBLIC_* vars the running app reads later.
    const prebuildEnv = { ...flavorEnv, APP_FLAVOR: flavor };
    run('npx', ['expo', 'prebuild', '--platform', 'ios', '--clean'], prebuildEnv);
    if (command === 'run-ios') {
      // ios/ was just regenerated, so this builds+installs against it rather
      // than re-prebuilding (expo run:ios only prebuilds when ios/ is absent).
      run('npx', ['expo', 'run:ios'], prebuildEnv);
    }
  } else {
    const gradleTask = `${command}${cap(flavor)}Release`;
    run('./android/gradlew', ['-p', 'android', gradleTask], flavorEnv);
  }
}

main();
