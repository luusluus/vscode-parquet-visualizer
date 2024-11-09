// package.release.config.js
module.exports = {
    plugins: [
        [
            '@semantic-release/commit-analyzer',
            {
                releaseRules: [{ type: '*', release: false }], // Ignore all commits
            },
        ],
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