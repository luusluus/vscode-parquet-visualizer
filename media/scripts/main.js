// This script will be run within the webview itself
// It cannot access the main VS Code APIs directly.

(function () {
    const vscode = acquireVsCodeApi();

    const oldState = /** @type {{ count: number} | undefined} */ (vscode.getState());

    let currentPage = 1;
    let amountOfPages = 0;
    let startingRow = 0;

    const tableContainer = /** @type {HTMLElement} */ (document.querySelector('#table'));
    const pageCounterContainer = /** @type {HTMLElement} */ (document.querySelector('#page-counter'));

    function updatePageCounter( /** @type {any} */  pageCounterData) {
        // pageCounterContainer
        console.log(pageCounterData);
        let pageRangeElement = pageCounterContainer.querySelector('#page-range');
        if (pageRangeElement){
            pageRangeElement.innerHTML = `${pageCounterData.startRow}-${pageCounterData.endRow}`;
        }

        let rowCountElement = pageCounterContainer.querySelector('#row-count');
        if (rowCountElement){
            rowCountElement.innerHTML = pageCounterData.rowCount;
        }

    }

    function updateTable( /** @type {any} */  tableData) {
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
    const firstButtonContainer = /** @type {HTMLElement} */ (document.querySelector('#btn-first'));
    const lastButtonContainer = /** @type {HTMLElement} */ (document.querySelector('#btn-last'));

    function checkButtonState(){
        if (currentPage === amountOfPages){
            nextButtonContainer.setAttribute('disabled', '');
        }

        if (currentPage > 1){
            prevButtonContainer.removeAttribute('disabled');
        }

        if (currentPage < amountOfPages ) {
            nextButtonContainer.removeAttribute('disabled');
        }

        if (currentPage === 1){
            prevButtonContainer.setAttribute('disabled', '');
        }
    }

    nextButtonContainer.addEventListener('click', () => {
        if (currentPage < amountOfPages){
            currentPage++;
        }

        checkButtonState();
        
        vscode.postMessage({
            type: 'nextPage'
        });
    });

    prevButtonContainer.addEventListener('click', () => {
        if (currentPage > 1){
            currentPage--;
        }

        checkButtonState();
        
        vscode.postMessage({
            type: 'prevPage'
        });
    });

    firstButtonContainer.addEventListener('click', () => {
        currentPage = 1;

        checkButtonState();

        vscode.postMessage({
            type: 'firstPage'
        });
    });

    lastButtonContainer.addEventListener('click', () => {
        currentPage = amountOfPages;

        checkButtonState();

        vscode.postMessage({
            type: 'lastPage'
        });
    });

    const numRecordsDropdownContainer = /** @type {HTMLSelectElement} */ (document.querySelector('#dropdown-num-records'));
    numRecordsDropdownContainer.addEventListener('change', (e) => {
        const selectedIndex = numRecordsDropdownContainer.selectedIndex;
        const selectedOption = numRecordsDropdownContainer.options[selectedIndex];
        vscode.postMessage({
            type: 'changePageSize',
            data: {
                newPageSize: selectedOption.innerText,
                prevStartRow: startingRow
            }
        });
    });

    // Handle messages from the extension
    window.addEventListener('message', async e => {
        console.log(e);
        const { type, tableData, requestId } = e.data;
        switch (type) {
            case 'init':{
                console.log('init');
                if (tableData) {
                    const {headers, body, rowCount, startRow, endRow, pageSize } = tableData;
                    amountOfPages = pageSize;
                    startingRow = startRow;
                    updateTable({headers, body});
                    updatePageCounter({rowCount, startRow, endRow});
                }
            }
            case 'update': {
                console.log('update');
                console.log(tableData);
                if (tableData) {
                    const {headers, body, rowCount, startRow, endRow, pageSize } = tableData;
                    amountOfPages = pageSize;
                    startingRow = startRow;
                    updateTable({headers, body});
                    updatePageCounter({rowCount, startRow, endRow});
                }
            }
        }
    });

    // Signal to VS Code that the webview is initialized.
    vscode.postMessage({ type: 'ready' });
}());
