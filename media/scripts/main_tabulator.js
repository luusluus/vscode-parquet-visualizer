// This script will be run within the webview itself
// It cannot access the main VS Code APIs directly.

// import Tabulator from 'tabulator-tables/dist/js/tabulator';

// import {Tabulator} from 'https://unpkg.com/tabulator-tables@5.5.2/dist/js/tabulator_esm.min.js';
(function () {

    const vscode = acquireVsCodeApi();
    console.log(vscode);

    const oldState = /** @type {{ count: number} | undefined} */ (vscode.getState());

    const nextButton = /** @type {HTMLElement} */ (document.querySelector('#btn'));
    
    nextButton.addEventListener('click', () => {
        console.log('click');
        vscode.postMessage({type: 'click'});
    });
    // var tabledata = [
    //     {id:1, name:"Oli Bob", age:"12", col:"red", dob:""},
    //     {id:2, name:"Mary May", age:"1", col:"blue", dob:"14/05/1982"},
    //     {id:3, name:"Christine Lobowski", age:"42", col:"green", dob:"22/05/1982"},
    //     {id:4, name:"Brendon Philips", age:"125", col:"orange", dob:"01/08/1980"},
    //     {id:5, name:"Margret Marmajuke", age:"16", col:"yellow", dob:"31/01/1999"},
    // ];

    let table;
    function initTable(headers, tableData) {
        console.log("initTable");
        //create Tabulator on DOM element with id "example-table"

        // const columns = [ //Define Table Columns
        //     {title:"Name", field:"name", width:150},
        //     {title:"Age", field:"age", hozAlign:"left", formatter:"progress"},
        //     {title:"Favourite Color", field:"col"},
        //     {title:"Date Of Birth", field:"dob", sorter:"date", hozAlign:"center"},
        // ];

        // let columns = [
        //     {formatter:"responsiveCollapse", width:30, minWidth:30, hozAlign:"center", resizable:false, headerSort:false},
        // ];
        let columns = [];

        headers.forEach(c => columns.push(c));

        
    }


    // Handle messages from the extension
    window.addEventListener('message', async e => {
        console.log(e.data);
        const { type, tableData, requestId } = e.data;
        switch (type) {
            case 'init':{
                console.log('init');
                const headers = tableData.headers;
                const data = tableData.rawData;
                initTable(headers, data);

            }
            case 'update': {
                console.log('update');
            }
        }
    });

    // Signal to VS Code that the webview is initialized.
    vscode.postMessage({ type: 'ready' });
}());
