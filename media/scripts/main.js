// This script will be run within the webview itself
// It cannot access the main VS Code APIs directly.

(function () {
    const vscode = acquireVsCodeApi();

    const oldState = /** @type {{ count: number} | undefined} */ (vscode.getState());

    // const editor = new PawDrawEditor(document.querySelector('.drawing-canvas'));

    document.querySelector('button').addEventListener('click', () => {
        vscode.postMessage({
            type: 'nextPage'
        });
    });

    // Handle messages from the extension
    window.addEventListener('message', async e => {
        const { type, body, requestId } = e.data;
        console.log(type);
        switch (type) {
            case 'init':
                {
                    console.log('init');
                    console.log(body);
                }
            
        }
    });

    // Signal to VS Code that the webview is initialized.
    vscode.postMessage({ type: 'ready' });
}());
