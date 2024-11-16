const { exec } = require('child_process');

console.log(`Current working directory: ${process.cwd()}`);
console.log(`${path.join(__dirname, 'build.bat')}`);

const command = process.platform === 'win32' ? path.join(__dirname, 'build.bat') : './build.sh';

const envVars = {
    ...process.env,
    AZURE_APP_INSIGHTS_CONNECTION_STRING: process.env.AZURE_APP_INSIGHTS_CONNECTION_STRING,
};
exec(command, {env: envVars}, (error, stdout, stderr) => {
    if (error) {
        console.error(`Error: ${error.message}`);
        process.exit(1);
    }
    if (stderr) {
        console.error(`Stderr: ${stderr}`);
        process.exit(1);
    }
    console.log(`Stdout: ${stdout}`);
});