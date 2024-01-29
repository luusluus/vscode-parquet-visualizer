// This script will be run within the webview itself
// It cannot access the main VS Code APIs directly.
(function () {

    const vscode = acquireVsCodeApi();
    console.log(vscode);


    const oldState = /** @type {{ count: number} | undefined} */ (vscode.getState());


    let table;
    function initTable(headers, tableData) {
        console.log("initTable");
        const columns = headers.map(r => r['title']);
        new gridjs.Grid({
            columns: columns,
            sort: true,
            fixedHeader: true,
            search: true,
            data: tableData
          }).render(document.getElementById("table"));
    }


    // Handle messages from the extension
    window.addEventListener('message', async e => {
        console.log(e.data);
        const { type, tableData, requestId } = e.data;
        switch (type) {
            case 'init':{
                console.log('init');
                const headers = tableData.headers;
                const data = tableData.values;
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
