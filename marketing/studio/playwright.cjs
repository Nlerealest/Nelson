// Loads Playwright from the project if installed, else from the global npm
// install (the cloud environment ships it globally with Chromium).
try {
  module.exports = require('playwright');
} catch {
  const root = require('child_process').execSync('npm root -g').toString().trim();
  module.exports = require(root + '/playwright');
}
