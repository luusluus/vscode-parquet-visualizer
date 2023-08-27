// This script will be run within the webview itself
// It cannot access the main VS Code APIs directly.

(function () {
    const vscode = acquireVsCodeApi();

    const oldState = /** @type {{ count: number} | undefined} */ (vscode.getState());

    const tableContainer = /** @type {HTMLElement} */ (document.querySelector('.table'));

    function updateTable( /** @type {any} */  tableData) {
        console.log("updateTable");
        let tableElement = document.querySelector('table');
        if (tableElement?.parentElement !== tableContainer) {
            tableElement = document.createElement('table');
            const tableHeaderElement = document.createElement('thead');
            const tableRowElement = document.createElement('tr');
            tableHeaderElement.appendChild(tableRowElement);
    
            for (const header of tableData.headers || []) {
                const tableHeaderColumnElement = document.createElement('th');
                tableHeaderColumnElement.innerText = header.name;
                tableRowElement.appendChild(tableHeaderColumnElement);
            }
            tableElement.appendChild(tableHeaderElement);
        }

        let tbody = document.querySelector('tbody');

        if (tbody) {
            tbody.innerHTML = '';
        } else {
            tbody = document.createElement('tbody');
        }

        for (const row of tableData.body || []) {
            const tableRowElement = document.createElement('tr');
            for (const cell of row) {
                const tableCellElement = document.createElement('td');
                tableCellElement.innerText = cell;
                tableRowElement.appendChild(tableCellElement);
            }
            tbody.appendChild(tableRowElement);
        }

        tableElement.appendChild(tbody);
        tableContainer.appendChild(tableElement);
    }
    
    const nextButtonContainer = /** @type {HTMLElement} */ (document.querySelector('#btn-next'));
    const prevButtonContainer = /** @type {HTMLElement} */ (document.querySelector('#btn-prev'));

    nextButtonContainer.addEventListener('click', () => {
        vscode.postMessage({
            type: 'nextPage'
        });
    });

    prevButtonContainer.addEventListener('click', () => {
        vscode.postMessage({
            type: 'prevPage'
        });
    });

    // Handle messages from the extension
    window.addEventListener('message', async e => {
        const { type, body, requestId } = e.data;
        switch (type) {
            case 'init':
                {
                    console.log('init');
                }
            case 'update':
                {
                    console.log('update');
                    if (body) {
                        updateTable(body);
                    }
                }
            
        }
    });

    // Signal to VS Code that the webview is initialized.
    vscode.postMessage({ type: 'ready' });
}());
