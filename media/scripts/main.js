// This script will be run within the webview itself
// It cannot access the main VS Code APIs directly.

(function () {
    const vscode = acquireVsCodeApi();

    let dataTable;
    let schemaTable;
    let metadataTable;
    let resultsTable;

    let dataTableBuilt = false;
    let queryTableBuilt = false;

    let currentPageDataTab = 1;
    let currentPageQueryTab = 1;
    let amountOfPagesDataTab = 0;
    let amountOfPagesQueryTab = 0;
    
    let rowCountDataTab = 1;
    let rowCountQueryTab = 0;

    let pageSizeQueryTab = 10;

    const requestSourceDataTab = 'dataTab';
    const requestSourceResultTab = 'queryTab';

    document.getElementById("data-tab").addEventListener("click", handleTabChange);
    document.getElementById("schema-tab").addEventListener("click", handleTabChange);
    document.getElementById("query-tab").addEventListener("click", handleTabChange);
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
        } else if (id === 'query-tab')  {
            document.getElementById('query-tab-panel').style.display = "block";
        }
        else {
            document.getElementById('metadata-tab-panel').style.display = "block";
        }
        e.currentTarget.checked = true;
    }

    function onCellClick(e, cell) {
        const val = cell.getValue();

        let popupValue = '';
        try{
            const obj = JSON.parse(val);
            popupValue = `<pre>${JSON.stringify(obj, undefined, 4)}</pre>`;
        } catch(e) {
            popupValue = val;
        }

        cell.popup(popupValue, "center");
    }

    function onMenuOpened(component) {
        const element = document.getElementsByClassName("tabulator-menu tabulator-popup-container")[0];
        let style = element.style;

        style.top = '30px';
        style.height = '200px';
        style.overflowX  = 'auto';
        style.overflowY  = 'auto';
    }

    function onPopupOpened(component) {
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
        if (childRect.left < 0){
            style.left = `0px`;
        }
        // TODO: What if child.left < parent. left?
    }

    function resetQueryControl(){
        // console.log("resetQueryControl");
        const runQueryButton = document.getElementById("run-query");
        runQueryButton?.removeAttribute('disabled');
        runQueryButton.innerText = 'Run';
        resultsTable.clearAlert();
    }

    function initResultTable(/** @type {any} */ data, /** @type {any} */ headers) {
        document.getElementById("query-results").innerHTML = `
            <div class="tabulator">
                <div class="tabulator-footer">
                    <div class="tabulator-footer-contents">
                        <span class="tabulator-page-counter">
                            <span>
                                <span><strong>Results</strong></span>
                                <span id="query-count"></span>
                            </span>
                        </span>
                        <span class="tabulator-paginator" id="pagination-${requestSourceResultTab}">
                            <label>Page Size</label>
                            <select class="tabulator-page-size" id="dropdown-page-size-${requestSourceResultTab}" aria-label="Page Size" title="Page Size">
                                <option value="10">10</option>
                                <option value="50">50</option>
                                <option value="100">100</option>
                                <option value="500">500</option>
                            </select>
                            <button class="tabulator-page" disabled id="btn-first-${requestSourceResultTab}" type="button" role="button" aria-label="First Page" title="First Page" data-page="first">First</button>
                            <button class="tabulator-page" disabled id="btn-prev-${requestSourceResultTab}" type="button" role="button" aria-label="Prev Page" title="Prev Page" data-page="prev">Prev</button>
                            <span class="tabulator-pages" id="tabulator-pages-${requestSourceResultTab}">
                            </span>
                            <button class="tabulator-page" disabled id="btn-next-${requestSourceResultTab}" type="button" role="button" aria-label="Next Page" title="Next Page" data-page="next">Next</button>
                            <button class="tabulator-page" disabled id="btn-last-${requestSourceResultTab}" type="button" role="button" aria-label="Last Page" title="Last Page" data-page="last">Last</button>
                        </span>
                    </div>
                </div>
            </div>
            <br>
            <div id="table-${requestSourceResultTab}"></div>
        `;

        let columns = headers.map(c => (
            {
                ...c, 
                cellClick:onCellClick,
            }
        ));

        resultsTable = new Tabulator(`#table-${requestSourceResultTab}`, {
            columnDefaults:{
                width:150, //set the width on all columns to 200px
            },
            placeholder:"No results. Run a query to view results", //display message to user on empty table
            data: data,
            columns: columns,
            paginationElement: document.getElementById(`pagination-${requestSourceResultTab}`),
        });

        resultsTable.on("popupOpened", onPopupOpened);

        resultsTable.on("tableBuilt", function(data){
            const resultsCountElement = document.getElementById("query-count");
            resultsCountElement.innerText = `(${rowCountQueryTab})`;

            resetQueryControl();
            initializeFooter(rowCountQueryTab, requestSourceResultTab);
        });
    }

    function getTextFromEditor(editor) {
        var selectedText = editor.getSelectedText();
        if (selectedText) {
            return selectedText;
        } else {
            return editor.getValue();
        }
    }

    function runQuery(editor) {
        resultsTable.alert("Loading...");

        const runQueryButton = document.getElementById("run-query");
        runQueryButton.setAttribute('disabled', '');
        runQueryButton.innerText = 'Running';

        const numRecordsDropdown = /** @type {HTMLSelectElement} */ (document.querySelector(`#dropdown-page-size-${requestSourceResultTab}`));
        const selectedIndex = numRecordsDropdown.selectedIndex;
        const selectedOption = numRecordsDropdown.options[selectedIndex];

        const query = getTextFromEditor(editor);
        vscode.postMessage({
            type: 'startQuery',
            data: query,
            pageSize: Number(selectedOption.innerText)
        });
    }

    function initCodeEditor(isQueryable) {
        const queryTabPanel = document.getElementById("query-tab-panel");
        if (!isQueryable) {
            const paragraph = document.createElement("p");
            paragraph.innerText = "This parquet file with compression codec BROTLI does not have SQL support. Supported options are uncompressed, gzip, lz4_raw, snappy or zstd.";
            queryTabPanel?.appendChild(paragraph);
            return;
        }

        const editorElement = document.createElement("div");
        editorElement.id = "editor";
        queryTabPanel?.appendChild(editorElement);

        const buttonContainer = document.createElement("div");
        buttonContainer.id = "query-actions";
        buttonContainer.classList.add("button-container");
        queryTabPanel?.appendChild(buttonContainer);

        
        const queryResultsContainer = document.createElement("div");
        queryResultsContainer.id = "query-results";
        queryTabPanel?.appendChild(queryResultsContainer);

        var editor = ace.edit("editor");

        editor.setTheme("ace/theme/idle_fingers");
        editor.session.setMode("ace/mode/sql");

        editor.setValue("SELECT *\r\nFROM data\r\nLIMIT 1000;");

        editor.commands.addCommand({
            name: 'runQuery',
            bindKey: {win: 'Ctrl-Enter',  mac: 'Command-Enter'},
            exec: function(editor) {
                runQuery(editor);
            }
        });

        initResultTable([], []);

        const runQueryButton = document.createElement("button");
        runQueryButton.id = "run-query";
        runQueryButton.innerText = "Run";
        runQueryButton.classList.add("tabulator-page", "flex-button"); 
        
        runQueryButton?.addEventListener('click', (e) => {
            runQuery(editor);
        });
        buttonContainer?.appendChild(runQueryButton);

        const clearQueryTextButton = document.createElement("button");
        clearQueryTextButton.id = "clear-query";
        clearQueryTextButton.innerText = "Clear";
        clearQueryTextButton.classList.add("tabulator-page", "flex-button"); 

        clearQueryTextButton?.addEventListener('click', (e) => {
            editor.setValue("");
        });

        buttonContainer?.appendChild(clearQueryTextButton);
    }

    function initMetaData (/** @type {any} */  data) {
        const columns = [
            // {title:"#", field:"index", width: 150},
            {title:"Key", field:"key", width: 200},
            {title:"Value", field:"value", width: 500},
        ];
        metadataTable = new Tabulator("#metadata", {
            placeholder:"No Data Available", //display message to user on empty table
            data: data,
            columns: columns,
        });

        metadataTable.on("popupOpened", onPopupOpened);
    }

    function initSchema (/** @type {any} */  data) {
        const columns = [
            {title:"#", field:"index", width: 150},
            {title:"Column name", field:"name", width: 150},
            {
                title:"Data type", 
                field:"type", 
                width: 150,
                cellClick:onCellClick
            },
            {title:"Nullable", field:"nullable", width: 150},
            {title:"Metadata", field:"metadata", width: 150},
        ];
        schemaTable = new Tabulator("#schema", {
            columnDefaults:{
                width:150, //set the width on all columns to 200px
            },
            placeholder:"No Data Available", //display message to user on empty table
            data: data,
            columns: columns,
            pagination: true,
            paginationSize: 20,
            paginationSizeSelector: [20, 50, 100],
            paginationCounter: "pages",
        });

        schemaTable.on("popupOpened", onPopupOpened);
    }

    var headerMenu = function(){
        var menu = [];
        var columns = this.getColumns();
        
        function createIcon(isVisible){
            let icon = document.createElement("i");
            icon.classList.add("fas");
            icon.classList.add(isVisible ? "fa-check-square" : "fa-square");
            return icon;
        }

        function createLabel(columnTitle, icon){
            //build label
            let label = document.createElement("span");
            let title = document.createElement("span");
    
            title.textContent = " " + columnTitle;
    
            label.appendChild(icon);
            label.appendChild(title);
            return label;
        }

        for(let column of columns){
            //create checkbox element using font awesome icons
            const columnTitle = column.getDefinition().title;
            let icon = createIcon(column.isVisible());
            let label = createLabel(
                columnTitle,
                icon
            );

            //create menu item
            menu.push({
                label:label,
                action:function(e){
                    //prevent menu closing
                    e.stopPropagation();
    
                    //toggle current column visibility
                    column.toggle();
    
                    //change menu item icon
                    if(column.isVisible()){
                        icon.classList.remove("fa-square");
                        icon.classList.add("fa-check-square");
                    }else{
                        icon.classList.remove("fa-check-square");
                        icon.classList.add("fa-square");
                    }
                }
            });
        }
        return menu;
    };

    function initDataTable(/** @type {any} */ data) {
        let columns = data.headers.map(c => (
            {
                ...c, 
                cellClick:onCellClick,
                headerMenu: headerMenu
            }
        ));

        dataTable = new Tabulator("#table", {
            columnDefaults:{
                width:150, //set the width on all columns to 200px
            },
            placeholder:"No Data Available", //display message to user on empty table
            footerElement:`<span class="tabulator-page-counter">
                        <span>
                            <span>Showing</span>
                            <span id="page-current-${requestSourceDataTab}"> 1 </span>
                            <span>of</span>
                            <span id="page-count-${requestSourceDataTab}"> ${data.pageCount} </span>
                            <span>pages</span>

                        </span>
                    </span>
                    <span class="tabulator-paginator">
                        <label>Page Size</label>
                        <select class="tabulator-page-size" id="dropdown-page-size-${requestSourceDataTab}" aria-label="Page Size" title="Page Size">
                            <option value="10">10</option>
                            <option value="50">50</option>
                            <option value="100">100</option>
                            <option value="500">500</option>
                        </select>
                        <button class="tabulator-page" disabled id="btn-first-${requestSourceDataTab}" type="button" role="button" aria-label="First Page" title="First Page" data-page="first">First</button>
                        <button class="tabulator-page" disabled id="btn-prev-${requestSourceDataTab}" type="button" role="button" aria-label="Prev Page" title="Prev Page" data-page="prev">Prev</button>
                        <span class="tabulator-pages" id="tabulator-pages-${requestSourceDataTab}">
                        </span>
                        <button class="tabulator-page" id="btn-next-${requestSourceDataTab}" type="button" role="button" aria-label="Next Page" title="Next Page" data-page="next">Next</button>
                        <button class="tabulator-page" id="btn-last-${requestSourceDataTab}" type="button" role="button" aria-label="Last Page" title="Last Page" data-page="last">Last</button>
                    </span>
            `,
            data: data.rawData,
            columns: columns,
            pagination: false,
        });

        dataTable.on("tableBuilt", () => {
            dataTableBuilt = true;
            initializeFooter(rowCountDataTab, requestSourceDataTab);
            updateNavigationNumberButtons(currentPageDataTab, amountOfPagesDataTab, requestSourceDataTab);
            updatePageCounterState(currentPageDataTab, amountOfPagesDataTab, requestSourceDataTab);
            updateNavigationButtonsState(currentPageDataTab, amountOfPagesDataTab, requestSourceDataTab);
        });

        dataTable.on("popupOpened", onPopupOpened);
        dataTable.on("menuOpened", onMenuOpened);

        // const filters = columns = columns.map(c => ({
        //     field: c.field,
        //     headerFilter: true,
        //     type: 'like',
        //     value: 'searchValue'
        // }));
        // table.setFilter([filters]);
    }

    function handleError (){
        // console.log("handleError()");
        // query error
        resetQueryControl();
    }

    function updateTable(
        /** @type {any} */ data, 
        /** @type {any} */ headers, 
        /** @type {number} */ rowCount, 
        /** @type {string} */ requestSource,
        /** @type {string} */ requestType,
        /** @type {number} */ pageSize,

    ) {
        // console.log("updateTable");
        if (requestSource === requestSourceDataTab){
            if (dataTableBuilt){
                dataTable.replaceData(data);
                dataTable.clearAlert();
            }
        } else if (requestSource === requestSourceResultTab) {
            if (requestType === 'query'){
                rowCountQueryTab = rowCount;
                pageSizeQueryTab = pageSize;

                initResultTable(data, headers);
            } else if (requestType === 'paginator') {
                resultsTable.replaceData(data);
            }
        }
    }

    function doesFooterExist(){
        const footer = document.querySelector(".tabulator-footer");
        if (!footer) {
            console.error("footer doesn't exist yet.");
            return false;
        }
        return true;
    }

    function updatePageCounterState(
        /** @type {Number} */ currentPage ,  
        /** @type {Number} */ amountOfPages,
        /** @type {String} */ requestSource,

    ){
        // console.log(`updatePageCounterState(${currentPage}, ${amountOfPages})`);

        if (!doesFooterExist()){
            return;
        }

        const currentPageSpan = /** @type {HTMLElement} */ (document.querySelector(`#page-current-${requestSource}`));
        const countPageSpan = /** @type {HTMLElement} */ (document.querySelector(`#page-count-${requestSource}`));

        if (currentPageSpan) {
            currentPageSpan.innerText = currentPage.toString();
        }
        if (countPageSpan) {
            countPageSpan.innerText = amountOfPages.toString();
        }
    }

    function updateNavigationNumberButtons(
        /** @type {Number} */ currentPage, 
        /** @type {Number} */ amountOfPages,
        /** @type {String} */ requestSource
    ){
        // console.log(`updateNavigationNumberButtons(${currentPage}, ${amountOfPages}, ${requestSource})`);

        if (!doesFooterExist()){
            return;
        }

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

        const className = `page-number-${requestSource}`;
        const elements = document.getElementsByClassName(className);
        const elementsArray = Array.from(elements);
        elementsArray.forEach(element => {
            element.remove();
          }
        );

        const numRecordsDropdown = /** @type {HTMLSelectElement} */ (document.querySelector(`#dropdown-page-size-${requestSource}`));
        const selectedIndex = numRecordsDropdown.selectedIndex;
        const selectedOption = numRecordsDropdown.options[selectedIndex];

        const tabulatorPagesSpan = document.getElementById(`tabulator-pages-${requestSource}`);
        pageNumbers.forEach(p => {
            const button = document.createElement("button");

            if (p === currentPage){
                button.classList.add("tabulator-page", className, "active");
            } else {
                button.classList.add("tabulator-page", className);
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
                if (requestSource === requestSourceDataTab) {
                    dataTable.alert("Loading...");
                }

                vscode.postMessage({
                    type: 'currentPage',
                    pageNumber: Number(e.target.innerHTML),
                    pageSize: Number(selectedOption.innerText),
                    source: requestSource
                });
            });

            tabulatorPagesSpan?.appendChild(button);
        });
    }

    function updateNavigationButtonsState(
        /** @type {Number} */ currentPage, 
        /** @type {Number} */ amountOfPages,
        /** @type {String} */ requestSource,
    ){
        // console.log(`updateNavigationButtonsState(${currentPage}, ${amountOfPages})`);

        if (!doesFooterExist()){
            return;
        }

        const nextButton = /** @type {HTMLElement} */ (document.querySelector(`#btn-next-${requestSource}`));
        const prevButton = /** @type {HTMLElement} */ (document.querySelector(`#btn-prev-${requestSource}`));
        const firstButton = /** @type {HTMLElement} */ (document.querySelector(`#btn-first-${requestSource}`));
        const lastButton = /** @type {HTMLElement} */ (document.querySelector(`#btn-last-${requestSource}`));

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

    function initializeFooter(/** @type {Number} */ rowCount, /** @type {String} */ requestSource) {
        // console.log(`initializeFooter(rowCount:${rowCount}, requestSource:${requestSource})`);
        const nextButton = /** @type {HTMLElement} */ (document.querySelector(`#btn-next-${requestSource}`));
        const prevButton = /** @type {HTMLElement} */ (document.querySelector(`#btn-prev-${requestSource}`));
        const firstButton = /** @type {HTMLElement} */ (document.querySelector(`#btn-first-${requestSource}`));
        const lastButton = /** @type {HTMLElement} */ (document.querySelector(`#btn-last-${requestSource}`));

        nextButton.addEventListener('click', () => {
            const selectedIndex = numRecordsDropdown.selectedIndex;
            const selectedOption = numRecordsDropdown.options[selectedIndex];
            if (requestSource === requestSourceDataTab) {
                dataTable.alert("Loading...");
            }
            vscode.postMessage({
                type: 'nextPage',
                pageSize: Number(selectedOption.innerText),
                source: requestSource
            });
        });
    
        prevButton.addEventListener('click', () => {
            const selectedIndex = numRecordsDropdown.selectedIndex;
            const selectedOption = numRecordsDropdown.options[selectedIndex];
            if (requestSource === requestSourceDataTab) {
                dataTable.alert("Loading...");
            }
            vscode.postMessage({
                type: 'prevPage',
                pageSize: Number(selectedOption.innerText),
                source: requestSource
            });
        });
    
        firstButton.addEventListener('click', () => {
            const selectedIndex = numRecordsDropdown.selectedIndex;
            const selectedOption = numRecordsDropdown.options[selectedIndex];
            if (requestSource === requestSourceDataTab) {
                dataTable.alert("Loading...");
            }
            vscode.postMessage({
                type: 'firstPage',
                pageSize: Number(selectedOption.innerText),
                source: requestSource
            });
        });
    
        lastButton.addEventListener('click', () => {
            const selectedIndex = numRecordsDropdown.selectedIndex;
            const selectedOption = numRecordsDropdown.options[selectedIndex];
            if (requestSource === requestSourceDataTab) {
                dataTable.alert("Loading...");
            }
            vscode.postMessage({
                type: 'lastPage',
                pageSize: Number(selectedOption.innerText),
                source: requestSource
            });
        });
    
        const numRecordsDropdown = /** @type {HTMLSelectElement} */ (document.querySelector(`#dropdown-page-size-${requestSource}`));
        
        numRecordsDropdown.value = `${pageSizeQueryTab}`;

        if (rowCount <= 10 ) {
            numRecordsDropdown.setAttribute('disabled', '');
        } 
        else {
            numRecordsDropdown.addEventListener('change', (e) => {
                const selectedIndex = numRecordsDropdown.selectedIndex;
                const selectedOption = numRecordsDropdown.options[selectedIndex];
                if (requestSource === requestSourceDataTab) {
                    dataTable.alert("Loading...");
                }
                vscode.postMessage({
                    type: 'changePageSize',
                    data: {
                        newPageSize: Number(selectedOption.innerText),
                        source: requestSource
                    }
                });
            });
        }
    }
    

    // Handle messages from the extension
    window.addEventListener('message', async e => {
        // console.log(e.data);
        const { type, body } = e.data;
        switch (type) {
            case 'init':{
                const tableData = body.tableData;
                if (tableData) {
                    rowCountDataTab = tableData.rowCount;
                    initDataTable(tableData);
                    initSchema(tableData.schema);
                    initMetaData(tableData.metaData);
                    initCodeEditor(tableData.isQueryable);

                    currentPageDataTab = tableData.currentPage;
                    amountOfPagesDataTab = tableData.pageCount;
                }
                break;
            }
            case 'update': {
                const tableData = body.tableData;
                if (tableData) {
                    updateTable(
                        tableData.rawData, 
                        tableData.headers, 
                        tableData.rowCount, 
                        tableData.requestSource,
                        tableData.requestType,
                        tableData.pageSize,
                    );
                    
                    updatePageCounterState(
                        tableData.currentPage, 
                        tableData.pageCount,
                        tableData.requestSource
                    );
                    updateNavigationNumberButtons(
                        tableData.currentPage, 
                        tableData.pageCount,
                        tableData.requestSource
                    );
                    updateNavigationButtonsState(
                        tableData.currentPage, 
                        tableData.pageCount,
                        tableData.requestSource
                    );
                }
                break;
            }
            case 'error': {
                handleError();
                break;
            }
        }
    });

    // Signal to VS Code that the webview is initialized.
    vscode.postMessage({ type: 'ready' });
}());
