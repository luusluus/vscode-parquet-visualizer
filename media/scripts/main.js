// This script will be run within the webview itself
// It cannot access the main VS Code APIs directly.

(function () {
    const vscode = acquireVsCodeApi();

    const oldState = /** @type {{ count: number} | undefined} */ (vscode.getState());

    const tableContainer = /** @type {HTMLElement} */ (document.querySelector('.table'));

    function updateTable( /** @type {undefined} */  tableData) {
        const tableElement = document.createElement('table');
        const tableRowElement = document.createElement('tr');
        tableElement.appendChild(tableRowElement);
        for (const header of tableData.headers || []) {
            const tableHeaderElement = document.createElement('th');
            tableHeaderElement.innerText = header.name;
            tableRowElement.appendChild(tableHeaderElement);
        }

        tableContainer.appendChild(tableRowElement);

        for (const row of tableData.body || []) {
            const tableRowElement = document.createElement('tr');
            for (const cell of row) {
                const tableCellElement = document.createElement('td');
                tableCellElement.innerText = cell;
                tableRowElement.appendChild(tableCellElement);
            }
            tableContainer.appendChild(tableRowElement);
        }
    }
    
    const buttonContainer = /** @type {HTMLElement} */ (document.querySelector('button'));

    // const editor = new PawDrawEditor(document.querySelector('.drawing-canvas'));

    buttonContainer.addEventListener('click', () => {
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
            case 'update':
                {
                    updateTable(body);
                }
            
        }
    });

    // Signal to VS Code that the webview is initialized.
    vscode.postMessage({ type: 'ready' });
}());
