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

    let defaultPageSizes = [];

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

    function onPopupOpenedDataTab(component) {
        const parentContainerId = "data-tab-panel";
        onPopupOpened(parentContainerId);
    }

    function onPopupOpenedQueryResultTab(component) {
        const parentContainerId = "table-queryTab";
        onPopupOpened(parentContainerId);
    }

    function onPopupOpenedSchemaTab(component) {
        const parentContainerId = "schema";
        onPopupOpened(parentContainerId);
    }

    function onPopupOpenedMetaDataTab(component) {
        const parentContainerId = "metadata";
        onPopupOpened(parentContainerId);
    }

    function onPopupOpened(parentContainerId) {
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

        const container = document.getElementById(parentContainerId);
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
        const options = createOptionHTMLElementsString(defaultPageSizes);

        document.getElementById("query-results").innerHTML = `
            <div class="tabulator" style="z-index: 2; overflow: visible">
                <div class="tabulator-footer">
                    <div class="tabulator-footer-contents">
                        <span class="tabulator-page-counter">
                            <span>
                                <span><strong>Results</strong></span>
                                <span id="query-count"></span>
                            </span>
                        </span>
                        <span class="tabulator-paginator">
                            <button class="tabulator-page" disabled id="copy-query-results" type="button" role="button" aria-label="Copy to clipboard" title="Copy to clipboard">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" focusable="false" aria-hidden="true" width="16" height="16" class="copy-icon">
                                    <path d="M2 5h9v9H2z" class="stroke-linejoin-round"></path>
                                    <path d="M5 5V2h9v9h-3" class="stroke-linejoin-round"></path>
                                </svg>
                                Copy
                            </button>

                            <div class="dropdown">
                                <button class="tabulator-page" disabled id="export-query-results" type="button" role="button" aria-label="Export results" title="Export results">
                                Export results
                                <svg class="dropdown-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16" focusable="false" aria-hidden="true">
                                    <path d="M4 5h8l-4 6-4-6z" fill="white" stroke="none"></path>
                                </svg>
                                </button>
                                <ul class="dropdown-menu" id="dropdown-menu">
                                    <li><span data-value="csv" class="dropdown-item">To CSV</span></li>
                                    <li><span data-value="parquet" class="dropdown-item">To Parquet</span></li>
                                    <li><span data-value="json" class="dropdown-item">To JSON</span></li>
                                    <li><span data-value="ndjson" class="dropdown-item">To ndJSON</span></li>
                                </ul>
                            </div>
                        </span>
                    </div>
                    <div class="tabulator-footer-contents">
                        <div class="tabulator-paginator search-container">
                            <div class="search-icon-element">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" focusable="false" aria-hidden="true" class="search-icon">
                                    <circle cx="7" cy="7" r="5"></circle>
                                    <path d="m15 15-4.5-4.5"></path>
                                </svg>
                            </div>
                            <input class="search-box" id="input-filter-values" type="text" placeholder="Search rows">
                            <div class="clear-icon-element" id="clear-icon">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" focusable="false" aria-hidden="true" class="clear-icon">
                                    <path d="m2 2 12 12M14 2 2 14" stroke="#ffffff"></path>
                                </svg>
                            </div>
                        </div>
                    

                        <span class="tabulator-paginator" id="pagination-${requestSourceResultTab}">
                            <label>Page Size</label>
                            <select class="tabulator-page-size" id="dropdown-page-size-${requestSourceResultTab}" aria-label="Page Size" title="Page Size">
                                ${options}
                            </select>
                            <button class="tabulator-page" disabled id="btn-first-${requestSourceResultTab}" type="button" role="button" aria-label="First Page" title="First Page" data-page="first">First</button>
                            <button class="tabulator-page" disabled id="btn-prev-${requestSourceResultTab}" type="button" role="button" aria-label="Prev Page" title="Prev Page" data-page="prev">Prev</button>
                            <span class="tabulator-pages" id="tabulator-pages-${requestSourceResultTab}"></span>
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
            clipboard: "copy", 
            paginationElement: document.getElementById(`pagination-${requestSourceResultTab}`),
        });

        resultsTable.on("popupOpened", onPopupOpenedQueryResultTab);

        resultsTable.on("tableBuilt", function(data){
            const resultsCountElement = document.getElementById("query-count");
            resultsCountElement.innerText = `(${rowCountQueryTab})`;

            let tabulatorTableElement = document.getElementById("table-queryTab");
            tabulatorTableElement.style.zIndex = 1;

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

    function initCodeEditor(isQueryable, defaultQuery, shortCutMapping) {
        const queryTabPanel = document.getElementById("query-tab-panel");
        if (!isQueryable) {
            const paragraph = document.createElement("p");
            paragraph.innerText = "The loaded backend does not have SQL support.";
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

        editor.setValue(defaultQuery);

        editor.commands.addCommand({
            name: 'runQuery',
            bindKey: shortCutMapping,
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

        metadataTable.on("popupOpened", onPopupOpenedMetaDataTab);
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

        schemaTable.on("popupOpened", onPopupOpenedSchemaTab);
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

    function createOptionHTMLElementsString(/** @type {number[]} */ defaultPageSizes) {
        let html = '';
        defaultPageSizes.forEach((pageSize, idx) => {
            if (idx === 0) {
                html += `<option value="${pageSize}" selected="selected">${pageSize}</option>\n`;
            } else {
                html += `<option value="${pageSize}">${pageSize}</option>\n`;
            }
        });
        return html;
    }

    function initDataTable(/** @type {any} */ data) {
        let columns = data.headers.map(c => (
            {
                ...c, 
                cellClick:onCellClick,
                headerMenu: headerMenu
            }
        ));

        const options = createOptionHTMLElementsString(defaultPageSizes);
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
                            ${options}
                        </select>
                        <button class="tabulator-page" disabled id="btn-first-${requestSourceDataTab}" type="button" role="button" aria-label="First Page" title="First Page" data-page="first">First</button>
                        <button class="tabulator-page" disabled id="btn-prev-${requestSourceDataTab}" type="button" role="button" aria-label="Prev Page" title="Prev Page" data-page="prev">Prev</button>
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
            updatePageCounterState(currentPageDataTab, amountOfPagesDataTab, requestSourceDataTab);
            updateNavigationButtonsState(currentPageDataTab, amountOfPagesDataTab, requestSourceDataTab);
        });

        dataTable.on("popupOpened", onPopupOpenedDataTab);
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
                initResultTable(data, headers);

                const exportResultsButton = document.getElementById(`export-query-results`);
                exportResultsButton?.removeAttribute('disabled');

                const copyButton = document.getElementById(`copy-query-results`);
                copyButton?.removeAttribute('disabled');
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
        numRecordsDropdown.value = `${defaultPageSizes[0]}`;

        const exportResultsButton = /** @type {HTMLElement} */ (document.querySelector(`#export-query-results`));

        // Toggle dropdown menu visibility
        exportResultsButton.addEventListener('click', (event) => {
            event.stopPropagation(); // Prevent the event from bubbling up
            let dropdownMenu = document.getElementById('dropdown-menu');

            if (dropdownMenu.style.display === 'none' || dropdownMenu.style.display === '') {
                dropdownMenu.style.display = 'block';
            } else {
                dropdownMenu.style.display = 'none';
            }
        });

        document.getElementById('dropdown-menu').addEventListener('click', function(event) {
            event.stopPropagation();
            if (event.target.tagName === 'SPAN') {
                const selectedOption = event.target.getAttribute('data-value');
                vscode.postMessage({
                    type: 'exportQueryResults',
                    exportType: selectedOption
                });

                // Perform any additional actions here, e.g., close dropdown
                // Hide the menu if it's currently visible
                let dropdownMenu = document.getElementById('dropdown-menu');
                if (dropdownMenu.style.display === 'block') {
                    dropdownMenu.style.display = 'none';
                }
            }
        });

        // Close dropdown when clicking outside
        window.addEventListener('click', function() {
            let dropdownMenu = document.getElementById('dropdown-menu');
            
            // Hide the menu if it's currently visible
            if (dropdownMenu.style.display === 'block') {
                dropdownMenu.style.display = 'none';
            }
        });

        const clearIconButton = /** @type {HTMLElement} */ (document.querySelector(`#clear-icon`));
        clearIconButton.addEventListener("click", function () {
            var searchInput = document.getElementById('input-filter-values');
            searchInput.value = ''; // Clear the input field
            this.style.display = 'none'; // Hide the clear icon

            resultsTable.clearFilter(true);
        });

        const filterValueInput = /** @type {HTMLElement} */ (document.querySelector(`#input-filter-values`));
        filterValueInput.addEventListener("input", function () {

            // Check whether we should show the clear button.
            var clearIcon = document.getElementById('clear-icon');
            if (filterValueInput.value.length > 0) {
                clearIcon.style.display = 'flex';
            } else {
                clearIcon.style.display = 'none';
            }
            
            const searchValue = filterValueInput.value.trim();

            const columnLayout = resultsTable.getColumnLayout();
            const filterArray = columnLayout.map((c) => {
                return {
                    field: c.field,
                    type: 'like',
                    value: searchValue
                };
            });
            
            resultsTable.setFilter([filterArray]);
        });

        const copyResultsButton = /** @type {HTMLElement} */ (document.querySelector(`#copy-query-results`));
        copyResultsButton.addEventListener('click', () => {
            resultsTable.copyToClipboard("all", true);
            vscode.postMessage({
                type: 'copyQueryResults',
            });
        });

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
                    defaultPageSizes = tableData.settings.defaultPageSizes;
                    initDataTable(tableData);
                    initSchema(tableData.schema);
                    initMetaData(tableData.metaData);
                    initCodeEditor(
                        tableData.isQueryable, 
                        tableData.settings.defaultQuery,
                        tableData.settings.shortCutMapping
                    );

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
