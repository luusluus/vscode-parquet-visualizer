import * as fs from 'fs';

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
      readonly rawData?: any;
      readonly rowData?: any;
      readonly rowCount?: number;
      readonly startRow?: number;
      readonly endRow?: number;
      readonly pageCount?: number;
      readonly pageSize?: number;
    }>());
    /**
     * Fired to notify webviews that the document has changed.
     */
    public readonly onDidChangeContent = this._onDidChangeDocument.event;

    fireChangedDocumentEvent(rowData: any, rawData: any, startRow: number) {
      const tableData = {
        rowData: rowData,
        rawData: rawData,
        rowCount: this.getRowCount(),
        startRow: startRow,
        endRow: startRow + rowData.length - 1,
        pageCount: this.getPageCount(),
        pageSize: this.getPageSize()
      };
      this._onDidChangeDocument.fire(tableData);
    }

    getStartRowNumber() {
      return this.getPageSize() * this.currentPage - this.getPageSize() + 1;
    }

    async nextPage() {
      this.currentPage++;
      const startRow = this.getStartRowNumber();

      const rawData = await this.getCurrentPage();
      const rowData = rawData.map(p => Object.keys(p).map(key => p[key]));
      this.fireChangedDocumentEvent(rowData, rawData, startRow);
    }

    async prevPage() {
      this.currentPage--;
      const startRow = this.getStartRowNumber();
      
      const rawData = await this.getCurrentPage();
      const rowData = rawData.map(p => Object.keys(p).map(key => p[key]));
      this.fireChangedDocumentEvent(rowData, rawData, startRow);

    }

    async firstPage(){
      this.currentPage = 1;
      const startRow = this.getStartRowNumber();
      
      const rawData = await this.getCurrentPage();
      const rowData = rawData.map(p => Object.keys(p).map(key => p[key]));
      this.fireChangedDocumentEvent(rowData, rawData, startRow);
    }

    async lastPage() {
      this.currentPage = Math.ceil(this.getRowCount() / this.getPageSize());
      const startRow = this.getStartRowNumber();

      const rawData = await this.getCurrentPage();
      const rowData = rawData.map(p => Object.keys(p).map(key => p[key]));
      this.fireChangedDocumentEvent(rowData, rawData, startRow);
    }

    async changePageSize(data: any) {
      // Check if value is 'All'
      if (isNaN(+(data.newPageSize))) {
        this.setPageSize(this.getRowCount());
        await this.firstPage();
        return;
      }

      const newPageSize: number = +(data.newPageSize);
      const prevStartRow: number = data.prevStartRow;
      let pageNumber = 1;
      let endRow = newPageSize;
      while (true) {
        endRow += newPageSize;
        if (prevStartRow <= endRow){
          break;
        }
        pageNumber++;
      }

      this.setPageSize(newPageSize);
      const rawData = await this.getPageByNumber(pageNumber);
      const rowData = rawData.map(p => Object.keys(p).map(key => p[key]));
      this.fireChangedDocumentEvent(rowData, rawData, prevStartRow);
    }

    async getCurrentPage() {
      return this.paginator.getPage(this.currentPage);
    }

    async getPageByNumber(pageNumber: number) {
      return await this.paginator.getPage(pageNumber);
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

    getSchema() {
      return this.paginator.getSchema();
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
            values: e.rowData,
            rawData: e.rawData,
            rowCount: e.rowCount,
            startRow: e.startRow,
            endRow: e.endRow,
            pageCount: e.pageCount,
            pageSize: e.pageSize
          };

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

        const currentPage = await document.getCurrentPage();
        const values = currentPage.map(p => Object.keys(p).map(key => p[key]));

        const data = {
          headers: document.paginator.getFields(),
          schema: document.getSchema(),
          values: values,
          rawData: currentPage,
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
          await document.changePageSize(message.data);
          break;
        }
      }
    }

    private fillTemplate(template: string, variables: { [key: string]: string | number }): string {
        return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
            return String(variables[key] || '');
        });
    }

    private getHtmlForWebview(webview: vscode.Webview): string {
        // Local path to script and css for the webview
        const scripts = webview.asWebviewUri(vscode.Uri.joinPath(
            this.context.extensionUri, 'media', 'scripts')
        );

        const libraryScriptUri = webview.asWebviewUri(vscode.Uri.joinPath(
          this.context.extensionUri, 'node_modules', 'tabulator-tables', 'dist', 'js', 'tabulator_esm.min.js'
        ));

        const styleResetUri = webview.asWebviewUri(vscode.Uri.joinPath(
            this.context.extensionUri, 'media', 'styles', 'reset.css'));

        const styleVSCodeUri = webview.asWebviewUri(vscode.Uri.joinPath(
            this.context.extensionUri, 'media', 'styles', 'vscode.css'));

        const styleMainUri = webview.asWebviewUri(vscode.Uri.joinPath(
        	this.context.extensionUri, 'media', 'styles', 'parquet-visualizer.css'));

        const htmlUri = vscode.Uri.joinPath(
          this.context.extensionUri, 'media', 'index.html'
        );
        const nonce = getNonce();

        const html = fs.readFileSync(htmlUri.fsPath, 'utf-8');

        let vars = {
          cspSource: webview.cspSource,
          scripts: scripts.toString(true),
          libraryScriptUri: libraryScriptUri.toString(true),
          styleResetUri: styleResetUri.toString(true),
          styleVSCodeUri: styleVSCodeUri.toString(true),
          styleMainUri: styleMainUri.toString(true),
          nonce: nonce,
      };

      return this.fillTemplate(html, vars);
        // Use a nonce to whitelist which scripts can be run
    }

}