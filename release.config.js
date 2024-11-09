const { execSync } = require('child_process');

module.exports = isDryRun() ? getDryRunConfig() : getCIConfig();

function getDryRunConfig() {
  return {
    repositoryUrl: getLocalRepoUrl(),
    branches: getCurrentBranch(),
    plugins: [
      '@semantic-release/commit-analyzer',
      '@semantic-release/release-notes-generator',
    ],
  };
}

function getCIConfig() {
  // contains your normal semantic-release config
  // this will be used on your CI environment
  return {

    plugins: [
      '@semantic-release/commit-analyzer',
      '@semantic-release/release-notes-generator',
      '@semantic-release/changelog',
      [
        '@semantic-release/npm',
        {
          npmPublish: false
        }
      ],
      [
        '@semantic-release/github',
        {
          assets: [{
            path: "*.vsix", label: "Extension File"
          }]
        }
      ],
    ],
  };
}

function isDryRun() {
    console.log("isDryRun()");
  return process.argv.includes('--dry-run');
}

function getLocalRepoUrl() {
  const topLevelDir = execSync('git rev-parse --show-toplevel')
    .toString()
    .trim();

  return `file://${topLevelDir}/.git`;
}

function getCurrentBranch() {
  return execSync('git rev-parse --abbrev-ref HEAD')
    .toString()
    .trim();
}