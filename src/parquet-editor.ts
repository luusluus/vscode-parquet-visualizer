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

    private readonly _onDidDispose = this._register(new vscode.EventEmitter<void>());
    /**
     * Fired when the document is disposed of.
     */
    public readonly onDidDispose = this._onDidDispose.event;

    private readonly _onDidChangeDocument = this._register(new vscode.EventEmitter<{
      readonly rawData?: any;
      readonly rowCount?: number;
      readonly startRow?: number;
      readonly endRow?: number;
      readonly pageCount?: number;
      readonly pageSize?: number;
      readonly currentPage?: number;
    }>());
    /**
     * Fired to notify webviews that the document has changed.
     */
    public readonly onDidChangeContent = this._onDidChangeDocument.event;

    fireChangedDocumentEvent(rawData: any, startRow: number) {
      console.log(`fireChangedDocumentEvent(${this.uri}). Page {${this.currentPage}}`);
      const tableData = {
        rawData: rawData,
        rowCount: this.getRowCount(),
        startRow: startRow,
        endRow: startRow + rawData.length - 1,
        pageCount: this.getPageCount(),
        pageSize: this.getPageSize(),
        currentPage: this.currentPage
      };
      this._onDidChangeDocument.fire(tableData);
    }

    /**
     * Called by VS Code when there are no more references to the document.
     *
     * This happens when all editors for it have been closed.
     */
    dispose(): void {
      console.log(`dispose(${this.uri})`);
      this._onDidDispose.fire();
      super.dispose();
    }

    getStartRowNumber() {
      return this.getPageSize() * this.currentPage - this.getPageSize() + 1;
    }

    async emitNextPage() {
      this.currentPage++;
      const startRow = this.getStartRowNumber();

      const rawData = await this.getCurrentPage();
      this.fireChangedDocumentEvent(rawData, startRow);
    }

    async emitPrevPage() {
      this.currentPage--;
      const startRow = this.getStartRowNumber();
      
      const rawData = await this.getCurrentPage();
      this.fireChangedDocumentEvent(rawData, startRow);
    }

    async emitFirstPage(){
      this.currentPage = 1;
      const startRow = this.getStartRowNumber();
      
      const rawData = await this.getCurrentPage();
      this.fireChangedDocumentEvent(rawData, startRow);
    }

    async emitLastPage() {
      this.currentPage = Math.ceil(this.getRowCount() / this.getPageSize());
      const startRow = this.getStartRowNumber();

      const rawData = await this.getCurrentPage();
      this.fireChangedDocumentEvent(rawData, startRow);
    }

    async emitCurrentPage(currentPage: number) {
      this.currentPage = currentPage;
      const rawData = await this.getPageByNumber(currentPage);
      const startRow = this.getStartRowNumber();
      this.fireChangedDocumentEvent(rawData, startRow);
    }

    async changePageSize(data: any) {
      // Check if value is 'All'
      if (isNaN(+(data.newPageSize))) {
        this.setPageSize(this.getRowCount());
        this.currentPage = 1;
        await this.emitFirstPage();
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

      this.currentPage = pageNumber;

      this.setPageSize(newPageSize);
      this.setPageCount(newPageSize);
      
      const rawData = await this.getPageByNumber(pageNumber);
      this.fireChangedDocumentEvent(rawData, prevStartRow);
    }

    async getCurrentPage() {
      return this.paginator.getPage(this.currentPage);
    }

    async getAllRows() {
      return this.paginator.getAllRows();
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

    setPageCount(pageSize: number){
      this.paginator.setPageCount(pageSize);
    }
  }

export class ParquetEditorProvider implements vscode.CustomReadonlyEditorProvider<CustomParquetDocument> {

    private static readonly viewType = 'parquet-visualizer.parquetVisualizer';

    public static register(context: vscode.ExtensionContext): vscode.Disposable {
        console.log(`register()`);
        const provider = new ParquetEditorProvider(context);
        return vscode.window.registerCustomEditorProvider(
          ParquetEditorProvider.viewType, 
          provider,
          {
            // For this demo extension, we enable `retainContextWhenHidden` which keeps the
            // webview alive even when it is not visible. You should avoid using this setting
            // unless is absolutely required as it does have memory overhead.
            webviewOptions: {
              retainContextWhenHidden: true
            },
            supportsMultipleEditorsPerDocument: false
          }
        );
    }

    /**
     * Tracks all known webviews
     */
    private readonly webviews = new WebviewCollection();

    constructor(
        private readonly context: vscode.ExtensionContext
    ) { }

    async openCustomDocument(uri: vscode.Uri): Promise<CustomParquetDocument> {
        console.log(`openCustomDocument(uri: ${uri})`);
        const document: CustomParquetDocument = await CustomParquetDocument.create(uri);

        const listeners: vscode.Disposable[] = [];

        listeners.push(document.onDidChangeContent(e => {
          const dataChange = {
            headers : [],
            rawData: e.rawData,
            rowCount: e.rowCount,
            startRow: e.startRow,
            endRow: e.endRow,
            pageCount: e.pageCount,
            pageSize: e.pageSize,
            currentPage: e.currentPage
          };

          // Update all webviews when the document changes
          for (const webviewPanel of this.webviews.get(document.uri)) {
            this.postMessage(webviewPanel, 'update', {
                type: 'update',
                tableData: dataChange
            });
          }
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

        console.log(`resolveCustomEditor(${document.uri})`);
        this.webviews.add(document.uri, webviewPanel);
        // Setup initial content for the webview
        webviewPanel.webview.options = {
            enableScripts: true,
        };

        webviewPanel.webview.html = this.getHtmlForWebview(webviewPanel.webview);
      
        webviewPanel.webview.onDidReceiveMessage(e => this.onMessage(document, e));

        // Hook up event handlers so that we can synchronize the webview with the text document.
        //
        // The text document acts as our model, so we have to sync change in the document to our
        // editor and sync changes in the editor back to the document.
        // 
        // Remember that a single text document can also be shared between multiple custom
        // editors (this happens for example when you split a custom editor)
        // const changeDocumentSubscription = vscode.workspace.onDidChangeTextDocument(e => {
        //   if (e.document.uri.toString() === document.uri.toString()) {
        //     console.log('onDidChangeTextDocument');
        //     webviewPanel.webview.postMessage({
        //       type: 'update',
        //       tableData: data
        //     });
        //   }
        // });

        const values = await document.getCurrentPage();

        const data = {
          headers: document.paginator.getFields(),
          schema: document.getSchema(),
          values: values,
          rawData: values,
          rowCount: document.getRowCount(),
          startRow: document.getPageSize() * document.currentPage - document.getPageSize() + 1,
          endRow: document.getPageSize() * document.currentPage,
          pageCount: document.getPageCount(),
          currentPage: document.currentPage
        };

        // Wait for the webview to be properly ready before we init
        webviewPanel.webview.onDidReceiveMessage(e => {
          if (e.type === 'ready') {
            if (document.uri.scheme === 'untitled') {
              this.postMessage(webviewPanel, 'init', {
                tableData: data,
              });
            } else {
              this.postMessage(webviewPanel, 'init', {
                tableData: data,
              });
            }
          }
        });
    
    }

    private readonly _onDidChangeCustomDocument = new vscode.EventEmitter<vscode.CustomDocumentEditEvent<CustomParquetDocument>>();
	  public readonly onDidChangeCustomDocument = this._onDidChangeCustomDocument.event;

    private postMessage(panel: vscode.WebviewPanel, type: string, body: any): void {
      panel.webview.postMessage({ type, body });
    }

    private async onMessage(document: CustomParquetDocument, message: any) {
      console.log(`onMessage(${document.uri})`);
      console.log(`Message: ${JSON.stringify(message)}`);
      switch (message.type) {
        case 'nextPage': {
          await document.emitNextPage();
          break;
        }
        case 'prevPage': {
          await document.emitPrevPage();
          break;
        }
        case 'firstPage': {
          await document.emitFirstPage();
          break;
        }
        case 'lastPage': {
          await document.emitLastPage();
          break;
        }
        case 'currentPage': {
          await document.emitCurrentPage(message.pageNumber);
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
        const styles = webview.asWebviewUri(vscode.Uri.joinPath(
            this.context.extensionUri, 'media', 'styles')
        );

        const styleResetUri = webview.asWebviewUri(vscode.Uri.joinPath(
            this.context.extensionUri, 'media', 'styles', 'reset.css'));

        const styleVSCodeUri = webview.asWebviewUri(vscode.Uri.joinPath(
            this.context.extensionUri, 'media', 'styles', 'vscode.css'));

        const styleMainUri = webview.asWebviewUri(vscode.Uri.joinPath(
        	this.context.extensionUri, 'media', 'styles', 'parquet-visualizer.css'));

        const styleTabulatorUri = webview.asWebviewUri(vscode.Uri.joinPath(
        	this.context.extensionUri, 'media', 'styles', 'tabulator', 'tabulator.min.css'));

        const styleTabsUri = webview.asWebviewUri(vscode.Uri.joinPath(
        	this.context.extensionUri, 'media', 'styles', 'tabs.css'));

        const htmlUri = vscode.Uri.joinPath(
          this.context.extensionUri, 'media', 'index.html'
        );
        const nonce = getNonce();

        const html = fs.readFileSync(htmlUri.fsPath, 'utf-8');

        let vars = {
          cspSource: webview.cspSource,
          scripts: scripts.toString(true),
          styles: styles.toString(true),
          styleResetUri: styleResetUri.toString(true),
          styleVSCodeUri: styleVSCodeUri.toString(true),
          styleMainUri: styleMainUri.toString(true),
          styleTabulatorUri: styleTabulatorUri.toString(true),
          styleTabsUri : styleTabsUri.toString(true),
          nonce: nonce,
      };

      return this.fillTemplate(html, vars);
        // Use a nonce to whitelist which scripts can be run
    }

}

/**
 * Tracks all webviews.
 */
class WebviewCollection {

	private readonly _webviews = new Set<{
		readonly resource: string;
		readonly webviewPanel: vscode.WebviewPanel;
	}>();

	/**
	 * Get all known webviews for a given uri.
	 */
	public *get(uri: vscode.Uri): Iterable<vscode.WebviewPanel> {
		const key = uri.toString();
		for (const entry of this._webviews) {
			if (entry.resource === key) {
				yield entry.webviewPanel;
			}
		}
	}

	/**
	 * Add a new webview to the collection.
	 */
	public add(uri: vscode.Uri, webviewPanel: vscode.WebviewPanel) {
		const entry = { resource: uri.toString(), webviewPanel };
		this._webviews.add(entry);

		webviewPanel.onDidDispose(() => {
			this._webviews.delete(entry);
		});
	}
}