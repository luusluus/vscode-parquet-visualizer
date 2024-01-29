// This script will be run within the webview itself
// It cannot access the main VS Code APIs directly.
(function () {

    const vscode = acquireVsCodeApi();
    console.log(vscode);


    const oldState = /** @type {{ count: number} | undefined} */ (vscode.getState());


    let table;
    function initTable(headers, tableData) {
        console.log("initTable");

        // https://github.com/TanStack/table/discussions/4928#discussioncomment-8007144
        const columnHelper = TableCore.createColumnHelper();

        const state = {
            columnPinning: {},
            pagination: {
            pageIndex: 0,
            pageSize: 20,
            },
        };

        const data = [
            {
            firstName: 'tanner',
            lastName: 'linsley',
            age: 24,
            visits: 100,
            status: 'In Relationship',
            progress: 50,
            },
            {
            firstName: 'tandy',
            lastName: 'miller',
            age: 40,
            visits: 40,
            status: 'Single',
            progress: 80,
            },
            {
            firstName: 'joe',
            lastName: 'dirte',
            age: 45,
            visits: 20,
            status: 'Complicated',
            progress: 10,
            },
        ];

        const columns = [
            columnHelper.accessor('firstName', {
            cell: (info) => info.getValue(),
            footer: (info) => info.column.id,
            }),
            columnHelper.accessor((row) => row.lastName, {
            id: 'lastName',
            cell: (info) => {
                info.getValue();
            },
            header: () => 'Last Name',
            footer: (info) => info.column.id,
            }),
            columnHelper.accessor('age', {
            header: () => 'Age',
            cell: (info) => info.renderValue(),
            footer: (info) => info.column.id,
            }),
            columnHelper.accessor('visits', {
            header: () => Visits,
            footer: (info) => info.column.id,
            }),
            columnHelper.accessor('status', {
            header: 'Status',
            footer: (info) => info.column.id,
            }),
            columnHelper.accessor('progress', {
            header: 'Profile Progress',
            footer: (info) => info.column.id,
            }),
        ];

        const table = TableCore.createTable({
            data,
            columns,
            getCoreRowModel: TableCore.getCoreRowModel(),
            getPaginationRowModel: TableCore.getPaginationRowModel(),
            state,
            onStateChange: () => {}, // noop
            renderFallbackValue: undefined,
            debugAll: true,
        });

        console.log(table);

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
