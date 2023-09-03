import * as vscode from 'vscode';
import { getNonce } from './util';
import { Disposable } from "./dispose";

import { ParquetPaginator } from './parquet-paginator';
// import { getLogger } from './logger';


class CustomParquetDocument extends Disposable implements vscode.CustomDocument {
    uri: vscode.Uri;
    paginator: ParquetPaginator;
    currentPage: number;

    static async create(
      uri: vscode.Uri
    ): Promise<CustomParquetDocument | PromiseLike<CustomParquetDocument>> {
      // If we have a backup, read that. Otherwise read the resource from the workspace
      const paginator = await ParquetPaginator.createAsync(uri.fsPath);
      return new CustomParquetDocument(uri, paginator);
    }

    private constructor(
      uri: vscode.Uri,
      paginator: ParquetPaginator
    ) {
      super();
      this.uri = uri;
      this.paginator = paginator;
      this.currentPage = 1;
    }

    private readonly _onDidChangeDocument = this._register(new vscode.EventEmitter<{
      readonly rowData?: any;
      readonly rowCount?: number;
      readonly startRow?: number;
      readonly endRow?: number;
    }>());
    /**
     * Fired to notify webviews that the document has changed.
     */
    public readonly onDidChangeContent = this._onDidChangeDocument.event;

    fireChangedDocumentEvent(page: any) {
      const startRow = this.getPageSize() * this.currentPage - this.getPageSize() + 1;
      const tableData = {
        rowData: page,
        rowCount: this.getRowCount(),
        startRow: startRow,
        endRow: startRow + page.length - 1
      };
      this._onDidChangeDocument.fire(tableData);
    }
    async nextPage() {
      this.currentPage++;
      const page = await this.getCurrentPage();

      this.fireChangedDocumentEvent(page);
    }

    async prevPage() {
      this.currentPage--;
      const page = await this.getCurrentPage();
      this.fireChangedDocumentEvent(page);
    }

    async firstPage(){
      this.currentPage = 1;
      const page = await this.getCurrentPage();
      this.fireChangedDocumentEvent(page);
    }

    async lastPage() {
      this.currentPage = this.getPageCount();
      const page = await this.getCurrentPage();

      this.fireChangedDocumentEvent(page);
    }

    async getCurrentPage() {
      return this.paginator.getPage(this.currentPage);
    }

    async getPageByNumber(pageNumber: number) {
      const page = await this.paginator.getPage(pageNumber);

      this.fireChangedDocumentEvent(page);
    }

    getPageSize() {
      return this.paginator.getPageSize();
    }

    getPageCount() {
      return this.paginator.getPageCount();
    }

    getRowCount() {
      return this.paginator.getRowCount();
    }

    setPageSize(value: number){
      this.paginator.setPageSize(value);
    }
  }

export class ParquetEditorProvider implements vscode.CustomReadonlyEditorProvider<CustomParquetDocument> {

    private static readonly viewType = 'parquet-visualizer.parquetVisualizer';

    private webviewPanel: vscode.WebviewPanel;
    private readonly _onDidChangeCustomDocument = new vscode.EventEmitter<vscode.CustomDocumentEditEvent<CustomParquetDocument>>();
	  public readonly onDidChangeCustomDocument = this._onDidChangeCustomDocument.event;

    public static register(context: vscode.ExtensionContext): vscode.Disposable {
        const provider = new ParquetEditorProvider(context);
        return vscode.window.registerCustomEditorProvider(ParquetEditorProvider.viewType, provider);
    }

    constructor(
        private readonly context: vscode.ExtensionContext
    ) { }

    async openCustomDocument(uri: vscode.Uri): Promise<CustomParquetDocument> {
        const document: CustomParquetDocument = await CustomParquetDocument.create(uri);

        const listeners: vscode.Disposable[] = [];

        listeners.push(document.onDidChangeContent(e => {
          // Update all webviews when the document changes
          const dataChange = {
            headers : [],
            body: e.rowData,
            rowCount: e.rowCount,
            startRow: e.startRow,
            endRow: e.endRow,
          };

          console.log(dataChange);
          this.webviewPanel.webview.postMessage({
            type: 'update',
            tableData: dataChange
          });
        }));

        return document;
    }
    
    /**
     * Called when our custom editor is opened.
     * 
     * 
     */
    async resolveCustomEditor(
        document: CustomParquetDocument,
        webviewPanel: vscode.WebviewPanel,
        _token: vscode.CancellationToken
    ): Promise<void> {
        // Setup initial content for the webview
        this.webviewPanel = webviewPanel;
        webviewPanel.webview.options = {
            enableScripts: true,
        };

        const data = {
          headers: document.paginator.getFieldList(),
          body: await document.getCurrentPage(),
          rowCount: document.getRowCount(),
          startRow: document.getPageSize() * document.currentPage - document.getPageSize() + 1,
          endRow: document.getPageSize() * document.currentPage,
          pageCount: document.getPageCount(),
        };

        webviewPanel.webview.html = this.getHtmlForWebview(webviewPanel.webview);
      
        // Hook up event handlers so that we can synchronize the webview with the text document.
        //
        // The text document acts as our model, so we have to sync change in the document to our
        // editor and sync changes in the editor back to the document.
        // 
        // Remember that a single text document can also be shared between multiple custom
        // editors (this happens for example when you split a custom editor)
    
        const changeDocumentSubscription = vscode.workspace.onDidChangeTextDocument(e => {
          if (e.document.uri.toString() === document.uri.toString()) {
            console.log('onDidChangeTextDocument');
            webviewPanel.webview.postMessage({
              type: 'update',
              tableData: data
            });
          }
        });
    
        webviewPanel.webview.onDidReceiveMessage(e => this.onMessage(document, e));

        // Wait for the webview to be properly ready before we init
        webviewPanel.webview.onDidReceiveMessage(e => {
          if (e.type === 'ready') {
            if (document.uri.scheme === 'untitled') {
              this.webviewPanel.webview.postMessage({
                type: 'init',
                tableData: data,
              });
            } else {
              // const editable = vscode.workspace.fs.isWritableFileSystem(document.uri.scheme);
              this.webviewPanel.webview.postMessage({
                type: 'init',
                tableData: data,
              });
            }
          }
        });
    
        // Make sure we get rid of the listener when our editor is closed.
        webviewPanel.onDidDispose(() => {
          changeDocumentSubscription.dispose();
        });
        
    }

    private async onMessage(document: CustomParquetDocument, message: any) {
      switch (message.type) {
        case 'nextPage': {
          await document.nextPage();
          break;
        }
        case 'prevPage': {
          await document.prevPage();
          break;
        }
        case 'firstPage': {
          await document.firstPage();
          break;
        }
        case 'lastPage': {
          await document.lastPage();
          break;
        }
        case 'changePageSize': {
          // Check if value is 'All'
          console.log(message.data);
          if (isNaN(+(message.data.newPageSize))) {
            console.log(message.data.newPageSize);
            document.setPageSize(document.getRowCount());
            await document.firstPage();
            break;
          }

          const newPageSize: number = +(message.data.newPageSize);
          const prevStartRow: number = message.data.prevStartRow;
          let pageNumber = 1;
          let startRow = 1;
          let endRow = newPageSize;
          while (startRow < prevStartRow || prevStartRow > endRow) {
            startRow += newPageSize;
            endRow += newPageSize;
            pageNumber++;
          }
          console.log(`New page number: ${pageNumber}`);

          document.setPageSize(newPageSize);
          await document.getPageByNumber(pageNumber);
          break;
        }
      }
    }

    private getHtmlForWebview(webview: vscode.Webview): string {
        // Local path to script and css for the webview
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(
            this.context.extensionUri, 'media', 'scripts', 'main.js'));

        const styleResetUri = webview.asWebviewUri(vscode.Uri.joinPath(
            this.context.extensionUri, 'media', 'styles', 'reset.css'));

        const styleVSCodeUri = webview.asWebviewUri(vscode.Uri.joinPath(
            this.context.extensionUri, 'media', 'styles', 'vscode.css'));

        const styleMainUri = webview.asWebviewUri(vscode.Uri.joinPath(
        	this.context.extensionUri, 'media', 'styles', 'parquet-visualizer.css'));

        // Use a nonce to whitelist which scripts can be run
        const nonce = getNonce();

        return /* html */`
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">

                <!--
                Use a content security policy to only allow loading images from https or from our extension directory,
                and only allow scripts that have a specific nonce.
                -->
                <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource}; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">

                <meta name="viewport" content="width=device-width, initial-scale=1.0">

                <link href="${styleResetUri}" rel="stylesheet" />
                <link href="${styleVSCodeUri}" rel="stylesheet" />
                <link href="${styleMainUri}" rel="stylesheet" />

                <title>Parquet Visualizer</title>
            </head>
            <body>
              <div class="data-view">
                <div id="page-counter">
                  <span>
                    <span>Showing</span>
                    <span id="page-range"></span>
                    <span>of</span>
                    <span id="row-count"></span>
                    <span>rows</span>
                  </span>
                  <label for="num-records">Num records:</label>
                  <select name="num-records" id="dropdown-num-records">
                    <option value="10">10</option>
                    <option value="50">50</option>
                    <option value="100">100</option>
                    <option value="500">500</option>
                    <option value="1000">1000</option>
                    <option value="all">All</option>
                  </select>
                </div>
                <button id="btn-first" class="btn">First Page</button>
                <button id="btn-next" class="btn">Next Page</button>
                <button id="btn-prev" class="btn" disabled>Previous Page</button>
                <button id="btn-last" class="btn">Last Page</button>
                <div id="table"></div>
              </div>

                <script nonce="${nonce}" src="${scriptUri}"></script>
            </body>
            </html>`;
    }

}