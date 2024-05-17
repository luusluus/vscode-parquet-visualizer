// This script will be run within the webview itself
// It cannot access the main VS Code APIs directly.

(function () {
    const vscode = acquireVsCodeApi();

    let table;
    let tableBuilt = false;

    let currentPage = 1;
    let rowCount = 1;
    let amountOfPages = 0;
    let startingRow = 0;

    const schemaContainer = /** @type {HTMLElement} */ (document.querySelector('#schema'));
    const metaDataContainer = /** @type {HTMLElement} */ (document.querySelector('#metadata'));
    
    document.getElementById("data-tab").addEventListener("click", handleTabChange);
    document.getElementById("schema-tab").addEventListener("click", handleTabChange);
    document.getElementById("metadata-tab").addEventListener("click", handleTabChange);


    function handleTabChange(/** @type {any} */ e) {
        var i, tabcontent, tablinks;

        // Get all elements with class="tabcontent" and hide them
        tabcontent = document.getElementsByClassName("tab");
        for (i = 0; i < tabcontent.length; i++) {
            tabcontent[i].style.display = "none";
        }

        // Get all elements with class="tablinks" and remove the class "active"
        tablinks = document.getElementsByClassName("tablinks");
        for (i = 0; i < tablinks.length; i++) {
            // tablinks[i].className = tablinks[i].className.replace(" active", "");
            tablinks[i].checked = false;
        }

        // Show the current tab, and add an "active" class to the button that opened the tab
        const id = e.currentTarget.id;
        if (id === 'data-tab') {
            document.getElementById('data-tab-panel').style.display = "block";
        } else if (id === 'schema-tab'){
            document.getElementById('schema-tab-panel').style.display = "block";
        } else {
            document.getElementById('metadata-tab-panel').style.display = "block";
        }
        e.currentTarget.checked = true;
    }

    function createKeyValueRow(/** @type {string} */  key, /** @type {string} */  value) {
        const keyValueRow = document.createElement("div");
        keyValueRow.className = 'schema-row';
        
        const name = document.createElement("strong");
        name.innerText = key
        keyValueRow.appendChild(name);

        const separator = document.createElement("p");
        separator.innerHTML = ':&nbsp';
        keyValueRow.appendChild(separator);

        const paragraph = document.createElement("p");
        paragraph.innerText = value
        keyValueRow.appendChild(paragraph);

        return keyValueRow;
    }

    function initSchema (/** @type {any} */  data) {
        for (var i = 0; i < data.length; ++i) {
            const schemaRow = createKeyValueRow(data[i].name, data[i].type);
            schemaContainer.appendChild(schemaRow);
        }
    }

    function initMetaData (/** @type {any} */  data) {
        const createdByRow = createKeyValueRow("Created By", data['createdBy']);
        metaDataContainer.appendChild(createdByRow);

        const versionRow = createKeyValueRow("Version", data['version']);
        metaDataContainer.appendChild(versionRow);

        const numRowsRow = createKeyValueRow("Number of Rows", data['numRows']);
        metaDataContainer.appendChild(numRowsRow);
    }

    function initTable(/** @type {any} */ data) {
        const columns = data.headers.map(c => (
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
            footerElement:`<span class="tabulator-page-counter">
                        <span>
                            <span>Showing</span>
                            <span id="page-current"> 1 </span>
                            <span>of</span>
                            <span id="page-count"> ${data.pageCount} </span>
                            <span>pages</span>
                            <span> | </span>
                            <span> ${data.rowCount} records </span>

                        </span>
                    </span>
                    <span class="tabulator-paginator">
                        <label>Page Size</label>
                        <select class="tabulator-page-size" id="dropdown-page-size" aria-label="Page Size" title="Page Size">
                            <option value="10">10</option>
                            <option value="50">50</option>
                            <option value="100">100</option>
                            <option value="500">500</option>
                            <option value="1000">1000</option>
                            <option value="true">All</option>
                        </select>
                        <button class="tabulator-page" disabled id="btn-first" type="button" role="button" aria-label="First Page" title="First Page" data-page="first">First</button>
                        <button class="tabulator-page" disabled id="btn-prev" type="button" role="button" aria-label="Prev Page" title="Prev Page" data-page="prev">Prev</button>
                        <span class="tabulator-pages" id="tabulator-pages">
                        </span>
                        <button class="tabulator-page" id="btn-next" type="button" role="button" aria-label="Next Page" title="Next Page" data-page="next">Next</button>
                        <button class="tabulator-page" id="btn-last" type="button" role="button" aria-label="Last Page" title="Last Page" data-page="last">Last</button>
                    </span>
            `,
            data: data.rawData,
            columns: columns,
            pagination: false,
        });

        table.on("tableBuilt", () => {
            // console.log("tableBuilt");
            tableBuilt = true;
            initializeFooter(rowCount);
            updateNavigationNumberButtons(currentPage, amountOfPages);
            updatePageCounterState(currentPage, amountOfPages);
            updateNavigationButtonsState(currentPage, amountOfPages);
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

            const container = document.getElementById("container");
            const parentRect = container.getBoundingClientRect();
            const childRect = element.getBoundingClientRect();

            if (childRect.right > parentRect.right) {
                const difference = childRect.right - parentRect.right;
                style.left = `${childRect.left - difference}px`;
            }

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
        // console.log("updateTable");
        if (tableBuilt){
            table.replaceData(data);
        }
    }

    function doesFooterExist(){
        const footer = document.querySelector(".tabulator-footer");
        if (!footer) {
            // console.log("footer doesn't exist yet.");
            return false;
        }
        return true;
    }

    function updatePageCounterState( /** @type {Number} */ currentPage ,  /** @type {Number} */ amountOfPages){
        // console.log(`updatePageCounterState(${currentPage}, ${amountOfPages})`);

        if (!doesFooterExist()){
            return;
        }

        const currentPageSpan = /** @type {HTMLElement} */ (document.querySelector('#page-current'));
        const countPageSpan = /** @type {HTMLElement} */ (document.querySelector('#page-count'));

        if (currentPageSpan) {
            currentPageSpan.innerText = currentPage.toString();
        }
        if (countPageSpan) {
            countPageSpan.innerText = amountOfPages.toString();
        }
    }

    function updateNavigationNumberButtons(/** @type {Number} */ currentPage, /** @type {Number} */ amountOfPages){
        // console.log(`updateNavigationNumberButtons(${currentPage}, ${amountOfPages})`);

        if (!doesFooterExist()){
            return;
        }

        const tabulatorPagesSpan = document.getElementById("tabulator-pages");

        var startPage = 1, endPage;

        if (currentPage < 4) {
            startPage = 1;
            endPage = Math.min(amountOfPages, 5);
        }
        else if (currentPage > amountOfPages - 3){
            startPage = amountOfPages - 4;
            endPage = amountOfPages;
        }
        else {
            startPage = currentPage - 2;
            endPage = Math.min(currentPage + 2, amountOfPages);
        }

        const pageNumbers = Array.from({length: endPage - startPage + 1}, (_, a) => a + startPage);

        const elements = document.getElementsByClassName("page-number");
        const elementsArray = Array.from(elements);
        elementsArray.forEach(element => {
            element.remove();
          }
        );

        pageNumbers.forEach(p => {
            const button = document.createElement("button");

            if (p === currentPage){
                button.classList.add("tabulator-page", "page-number", "active");
            } else {
                button.classList.add("tabulator-page", "page-number");
            }
            button.setAttribute("type", "button");
            button.setAttribute("role", "button");
            button.setAttribute("aria-label", `Show Page ${p}`);
            button.setAttribute("title", `Show Page ${p}`);
            button.setAttribute("data-page", `${p}`);

            if (amountOfPages === 1) {
                button.setAttribute('disabled', '');
            }

            button.textContent = `${p}`;

            button.addEventListener('click', (e) => {
                vscode.postMessage({
                    type: 'currentPage',
                    pageNumber: Number(e.target.innerHTML)
                });
            });

            tabulatorPagesSpan?.appendChild(button);
        });
    }

    function updateNavigationButtonsState(/** @type {Number} */ currentPage, /** @type {Number} */ amountOfPages){
        // console.log(`updateNavigationButtonsState(${currentPage}, ${amountOfPages})`);

        if (!doesFooterExist()){
            return;
        }

        const nextButton = /** @type {HTMLElement} */ (document.querySelector('#btn-next'));
        const prevButton = /** @type {HTMLElement} */ (document.querySelector('#btn-prev'));
        const firstButton = /** @type {HTMLElement} */ (document.querySelector('#btn-first'));
        const lastButton = /** @type {HTMLElement} */ (document.querySelector('#btn-last'));

        if (amountOfPages === 1) {
            nextButton.setAttribute('disabled', '');
            prevButton.setAttribute('disabled', '');
            firstButton.setAttribute('disabled', '');
            lastButton.setAttribute('disabled', '');
        }

        if (currentPage === amountOfPages){
            nextButton.setAttribute('disabled', '');
            lastButton.setAttribute('disabled', '');
        }

        if (currentPage > 1){
            prevButton.removeAttribute('disabled');
            firstButton.removeAttribute('disabled');
        }

        if (currentPage < amountOfPages ) {
            nextButton.removeAttribute('disabled');
            lastButton.removeAttribute('disabled');
        }

        if (currentPage === 1){
            prevButton.setAttribute('disabled', '');
            firstButton.setAttribute('disabled', '');
        }
    }

    function initializeFooter(/** @type {Number} */ rowCount) {
        // console.log("initializeFooter");
        const nextButton = /** @type {HTMLElement} */ (document.querySelector('#btn-next'));
        const prevButton = /** @type {HTMLElement} */ (document.querySelector('#btn-prev'));
        const firstButton = /** @type {HTMLElement} */ (document.querySelector('#btn-first'));
        const lastButton = /** @type {HTMLElement} */ (document.querySelector('#btn-last'));

        nextButton.addEventListener('click', () => {
            vscode.postMessage({
                type: 'nextPage'
            });
        });
    
        prevButton.addEventListener('click', () => {
            vscode.postMessage({
                type: 'prevPage'
            });
        });
    
        firstButton.addEventListener('click', () => {
            vscode.postMessage({
                type: 'firstPage'
            });
        });
    
        lastButton.addEventListener('click', () => {
            vscode.postMessage({
                type: 'lastPage'
            });
        });
    
        const numRecordsDropdown = /** @type {HTMLSelectElement} */ (document.querySelector('#dropdown-page-size'));

        if (rowCount >= 10000) {
            // https://stackoverflow.com/questions/3364493/how-do-i-clear-all-options-in-a-dropdown-box
            var i, L = numRecordsDropdown.options.length - 1;
            for(i = L; i >= 0; i--) {
                numRecordsDropdown.remove(i);
            }

            const pageSizes = [10, 50, 100, 500, 1000, 5000, 10000];
            pageSizes.forEach((pageSize) => {
                let option = document.createElement('option');
                option.value = pageSize.toString();
                option.innerHTML = pageSize.toString();
                numRecordsDropdown.options.add(option);
            });
        }

        if (rowCount <= 10 ) {
            numRecordsDropdown.setAttribute('disabled', '');
        } 
        else {
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

    }
    

    // Handle messages from the extension
    window.addEventListener('message', async e => {
        const { type, body } = e.data;
        switch (type) {
            case 'init':{
                const tableData = body.tableData;
                if (tableData) {
                    startingRow = tableData.startRow;
                    rowCount = tableData.rowCount;
                    initTable(tableData);
                    initSchema(tableData.schema);
                    initMetaData(tableData.metaData);

                    currentPage = tableData.currentPage;
                    amountOfPages = tableData.pageCount;
                }
            }
            case 'update': {
                const tableData = body.tableData;
                if (tableData) {
                    startingRow = tableData.startRow;
                    updateTable(tableData.rawData);
                    updatePageCounterState(tableData.currentPage, tableData.pageCount);
                    updateNavigationNumberButtons(tableData.currentPage, tableData.pageCount);
                    updateNavigationButtonsState(tableData.currentPage, tableData.pageCount);
                }
            }
        }
    });

    // Signal to VS Code that the webview is initialized.
    vscode.postMessage({ type: 'ready' });
}());
