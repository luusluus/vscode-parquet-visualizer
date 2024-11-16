const { exec } = require('child_process');

const envVars = {
    ...process.env,
    AZURE_APP_INSIGHTS_CONNECTION_STRING: process.env.AZURE_APP_INSIGHTS_CONNECTION_STRING,
};

if (process.platform !== 'win32') {

    exec('./build.sh', {env: envVars}, (error, stdout, stderr) => {
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
} else {

    console.log("executing build.bat");
    exec('build.bat', {env: envVars}, (error, stdout, stderr) => {
        if (error) {
            console.error(`Error build extension: ${error.message}`);
        }
        if (stderr) {
            console.error(`Stderr build extension: ${stderr}`);
        }
        console.log(`Stdout build extension: ${stdout}`);
    });

    console.log("executing build_worker.bat");
    exec('build_worker.bat', {env: envVars}, (error, stdout, stderr) => {
        if (error) {
            console.error(`Error build worker: ${error.message}`);
        }
        if (stderr) {
            console.error(`Stderr build worker: ${stderr}`);
        }
        console.log(`Stdout build worker: ${stdout}`);
    });
}
