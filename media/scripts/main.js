// This script will be run within the webview itself
// It cannot access the main VS Code APIs directly.

(function () {
    const vscode = acquireVsCodeApi();

    let table;

    let currentPage = 1;
    let amountOfPages = 0;
    let startingRow = 0;

    const tableContainer = /** @type {HTMLElement} */ (document.querySelector('#table'));
    // const rawDataContainer = /** @type {HTMLElement} */ (document.querySelector('#data-raw'));
    // rawDataContainer.style.display = "none";
    
    // const rawDataJsonContainer = /** @type {HTMLElement} */ (document.querySelector('#data-json'));
    const rawSchemaJsonContainer = /** @type {HTMLElement} */ (document.querySelector('#schema'));
    
    const pageCounterContainer = /** @type {HTMLElement} */ (document.querySelector('#page-counter'));

    
    function updateRawData( /** @type {any} */ data){
        // rawDataJsonContainer.textContent = JSON.stringify(data, undefined, 2);
    }

    function updatePageCounter( /** @type {any} */  pageCounterData) {
        // pageCounterContainer
        let pageRangeElement = pageCounterContainer.querySelector('#page-range');
        if (pageRangeElement){
            pageRangeElement.innerHTML = `${pageCounterData.startRow}-${pageCounterData.endRow}`;
        }

        let rowCountElement = pageCounterContainer.querySelector('#row-count');
        if (rowCountElement){
            rowCountElement.innerHTML = pageCounterData.rowCount;
        }

    }

    function updateSchema (/** @type {any} */  data) {
        rawSchemaJsonContainer.textContent = JSON.stringify(data, undefined, 2);
    }
    
    function initTable( /** @type {any} */  columns, /** @type {any} */ data) {
        columns = columns.map(c => (
            {
                ...c, 
                cellClick:function(e, cell){
                    const val = cell.getValue();

                    let popupValue = '';
                    try{
                        const obj = JSON.parse(val);
                        popupValue = `<pre>${JSON.stringify(obj, undefined, 4)}</pre>`;
                    } catch(e) {
                        popupValue = val;
                    }

                    cell.popup(popupValue, "center");
                },
            }
        ));
        table = new Tabulator("#table", {
            columnDefaults:{
                width:150, //set the width on all columns to 200px
            },
            placeholder:"No Data Available", //display message to user on empty table
            // footerElement:"<div id='footer' class='tabulator-footer'> <div class='dropdown'> <label for='num-records'>Num records:</label> <select name='num-records' id='dropdown-num-records'> <option value='10'>10</option> <option value='50'>50</option> <option value='100'>100</option> <option value='500'>500</option> <option value='1000'>1000</option> <option value='all'>All</option> </select> </div> <div class='buttons'> <button id='btn-first' type='button'>First</button> <button id='btn-prev' type='button' disabled>Previous</button> <div id='page-counter'> <span> <span id='page-range'></span> <span>of</span> <span id='row-count'></span> </span> </div> <button id='btn-next' type='button'>Next</button> <button id='btn-last' type='button'>Last</button> </div> </div>",
            data: data,
            columns: columns,
            pagination: true,
            paginationSize: 25,
            paginationSizeSelector:[25, 50, 100, true],
            paginationCounter:"pages", 
        });

        table.on("tableBuilt", () => {
            // initializeFooter();
        });

        table.on("popupOpened", function(component){
            const element = document.getElementsByClassName("tabulator-popup tabulator-popup-container")[0];
            
            let innerHTML = element.innerHTML;

            let style = element.style;
            // Check if html contains JSON. Make it a little bit wider and horizontally scrollable
            if (innerHTML.includes('pre')) {
                style.width = '400px';
                style.overflowX  = 'auto';
            }
            style.maxHeight = '400px';
            if (style.top[0] === '-') { // negative top
                style.top = '0px';
            }
            style.backgroundColor = '#101010';
            style.color = '#d4d4d4';
        });

        // const filters = columns = columns.map(c => ({
        //     field: c.field,
        //     headerFilter: true,
        //     type: 'like',
        //     value: 'searchValue'
        // }));
        // table.setFilter([filters]);
    }

    function updateTable(/** @type {any} */ data) {
        table.replaceData(data);
    }

    function initializeFooter() {
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
    }
    

    // const rawRadioInput = /** @type {HTMLInputElement} */ (document.querySelector('#radio-raw'));
    // const tableRadioInput = /** @type {HTMLInputElement} */ (document.querySelector('#radio-table'));

    // rawRadioInput.addEventListener('change', () => {
    //     if (rawRadioInput.checked) {
    //         tableContainer.style.display = 'none';
    //         // rawDataContainer.style.display = 'block';
    //     }
    // });

    // tableRadioInput.addEventListener('change', () => {
    //     if (tableRadioInput.checked) {
    //         tableContainer.style.display = 'block';
    //         // rawDataContainer.style.display = 'none';
    //     }
    // });

    // Handle messages from the extension
    window.addEventListener('message', async e => {
        console.log(e.data);
        const { type, tableData, requestId } = e.data;
        switch (type) {
            case 'init':{
                console.log('init');
                if (tableData) {
                    const {headers, schema, values, rawData, rowCount, startRow, endRow, pageCount, pageSize } = tableData;
                    amountOfPages = pageCount;
                    startingRow = startRow;
                    initTable(headers, rawData);
                    // updatePageCounter({rowCount, startRow, endRow});
                    updateRawData(rawData);
                    updateSchema(schema);
                }
            }
            case 'update': {
                console.log('update');
                // if (tableData) {
                //     const {headers, values, rawData, rowCount, startRow, endRow, pageCount, pageSize } = tableData;
                //     amountOfPages = pageCount;
                //     startingRow = startRow;
                //     updateTable(rawData);
                //     updatePageCounter({rowCount, startRow, endRow});
                //     updateRawData(rawData);
                // }
            }
        }
    });

    // Signal to VS Code that the webview is initialized.
    vscode.postMessage({ type: 'ready' });
}());
