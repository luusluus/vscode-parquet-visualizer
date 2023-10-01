// This script will be run within the webview itself
// It cannot access the main VS Code APIs directly.

(function () {
    const vscode = acquireVsCodeApi();

    const oldState = /** @type {{ count: number} | undefined} */ (vscode.getState());

    let currentPage = 1;
    let amountOfPages = 0;
    let startingRow = 0;

    const tableContainer = /** @type {HTMLElement} */ (document.querySelector('#table'));
    const rawContainer = /** @type {HTMLElement} */ (document.querySelector('#raw'));
    rawContainer.style.display = "none";
    
    const pageCounterContainer = /** @type {HTMLElement} */ (document.querySelector('#page-counter'));

    const dataJsonContainer = /** @type {HTMLElement} */ (document.querySelector('#json'));
    
    function updateRawData( /** @type {any} */ data){
        dataJsonContainer.textContent = JSON.stringify(data, undefined, 2);
    }

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
            let tableRowElement = document.createElement('tr');
            tableRowElement.className = 'header-sticky';
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

        for (const row of tableData.values || []) {
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
    
    const nextButton = /** @type {HTMLElement} */ (document.querySelector('#btn-next'));
    const prevButton = /** @type {HTMLElement} */ (document.querySelector('#btn-prev'));
    const firstButton = /** @type {HTMLElement} */ (document.querySelector('#btn-first'));
    const lastButton = /** @type {HTMLElement} */ (document.querySelector('#btn-last'));

    function checkButtonState(){
        if (currentPage === amountOfPages){
            nextButton.setAttribute('disabled', '');
        }

        if (currentPage > 1){
            prevButton.removeAttribute('disabled');
        }

        if (currentPage < amountOfPages ) {
            nextButton.removeAttribute('disabled');
        }

        if (currentPage === 1){
            prevButton.setAttribute('disabled', '');
        }
    }

    nextButton.addEventListener('click', () => {
        if (currentPage < amountOfPages){
            currentPage++;
        }

        checkButtonState();
        
        vscode.postMessage({
            type: 'nextPage'
        });
    });

    prevButton.addEventListener('click', () => {
        if (currentPage > 1){
            currentPage--;
        }

        checkButtonState();
        
        vscode.postMessage({
            type: 'prevPage'
        });
    });

    firstButton.addEventListener('click', () => {
        currentPage = 1;

        checkButtonState();

        vscode.postMessage({
            type: 'firstPage'
        });
    });

    lastButton.addEventListener('click', () => {
        currentPage = amountOfPages;

        checkButtonState();

        vscode.postMessage({
            type: 'lastPage'
        });
    });

    const numRecordsDropdown = /** @type {HTMLSelectElement} */ (document.querySelector('#dropdown-num-records'));
    numRecordsDropdown.addEventListener('change', (e) => {
        const selectedIndex = numRecordsDropdown.selectedIndex;
        const selectedOption = numRecordsDropdown.options[selectedIndex];
        vscode.postMessage({
            type: 'changePageSize',
            data: {
                newPageSize: selectedOption.innerText,
                prevStartRow: startingRow
            }
        });
    });

    const rawRadioInput = /** @type {HTMLInputElement} */ (document.querySelector('#radio-raw'));
    const tableRadioInput = /** @type {HTMLInputElement} */ (document.querySelector('#radio-table'));

    rawRadioInput.addEventListener('change', () => {
        if (rawRadioInput.checked) {
            tableContainer.style.display = 'none';
            rawContainer.style.display = 'block';
        }
    });

    tableRadioInput.addEventListener('change', () => {
        if (tableRadioInput.checked) {
            tableContainer.style.display = 'block';
            rawContainer.style.display = 'none';
        }
    });

    // Handle messages from the extension
    window.addEventListener('message', async e => {
        console.log(e);
        const { type, tableData, requestId } = e.data;
        switch (type) {
            case 'init':{
                console.log('init');
                if (tableData) {
                    const {headers, values, rawData, rowCount, startRow, endRow, pageSize } = tableData;
                    amountOfPages = pageSize;
                    startingRow = startRow;
                    updateTable({headers, values});
                    updatePageCounter({rowCount, startRow, endRow});
                    updateRawData(rawData);
                }
            }
            case 'update': {
                console.log('update');
                console.log(tableData);
                if (tableData) {
                    const {headers, values, rawData, rowCount, startRow, endRow, pageSize } = tableData;
                    amountOfPages = pageSize;
                    startingRow = startRow;
                    updateTable({headers, values});
                    updatePageCounter({rowCount, startRow, endRow});
                    updateRawData(rawData);
                }
            }
        }
    });

    // Signal to VS Code that the webview is initialized.
    vscode.postMessage({ type: 'ready' });
}());
