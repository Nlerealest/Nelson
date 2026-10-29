// Signs Android release builds with Ndalama's own key instead of the shared
// debug key. The key never lives in this (public) repository: the build
// workflow writes it from GitHub secrets and passes its path and password in
// NDALAMA_KEYSTORE_FILE and NDALAMA_KEYSTORE_PASSWORD. Without them, release
// builds fall back to the debug key so local and test builds still work.
const { withAppBuildGradle } = require('expo/config-plugins');

const RELEASE_CONFIG = `
        release {
            def ndalamaKeyPassword = System.getenv('NDALAMA_KEYSTORE_PASSWORD')
            if (ndalamaKeyPassword) {
                storeFile file(System.getenv('NDALAMA_KEYSTORE_FILE'))
                storeType 'pkcs12'
                storePassword ndalamaKeyPassword
                keyAlias 'ndalama'
                keyPassword ndalamaKeyPassword
            }
        }`;

module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (cfg) => {
    let gradle = cfg.modResults.contents;
    if (gradle.includes('NDALAMA_KEYSTORE_PASSWORD')) return cfg;

    const debugBlock = /(signingConfigs\s*\{\s*debug\s*\{[^}]*\})/;
    if (!debugBlock.test(gradle)) throw new Error('withReleaseSigning: signingConfigs.debug not found in app/build.gradle');
    gradle = gradle.replace(debugBlock, `$1${RELEASE_CONFIG}`);

    const releaseUsesDebug = /(release\s*\{[^{}]*?)signingConfig signingConfigs\.debug/;
    if (!releaseUsesDebug.test(gradle)) throw new Error('withReleaseSigning: release signingConfig not found in app/build.gradle');
    gradle = gradle.replace(
      releaseUsesDebug,
      "$1signingConfig System.getenv('NDALAMA_KEYSTORE_PASSWORD') ? signingConfigs.release : signingConfigs.debug",
    );

    cfg.modResults.contents = gradle;
    return cfg;
  });
};
