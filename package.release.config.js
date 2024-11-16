// package.release.config.js
module.exports = {
  branches: [
    "master",
    "69-sql-stopped-executing-properly-as-of-0110"
  ],
  plugins: [
    '@semantic-release/commit-analyzer',
    [
      'semantic-release-vsce',
      {
        packageVsix: true,
        publish: false, // no-op since we use semantic-release-stop-before-publish
      },
    ],
    'semantic-release-stop-before-publish',
  ],
};