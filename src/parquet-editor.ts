import * as fs from 'fs';
import { Worker } from 'worker_threads';

import * as vscode from 'vscode';
import { DuckDbError } from 'duckdb-async';

import { Paginator } from './paginator';
import { Backend } from './backend';
import { createHeadersFromData, getNonce } from './util';
import { Disposable } from "./dispose";
import { DuckDBBackend } from './duckdb-backend';
import { DuckDBPaginator } from './duckdb-paginator';
import { ParquetWasmBackend } from './parquet-wasm-backend';
import { ParquetWasmPaginator } from './parquet-wasm-paginator';
import { affectsDocument, defaultPageSizes, defaultQuery, defaultBackend } from './settings';

// import { getLogger } from './logger';

// TODO: Put in constants.ts
const requestSourceDataTab = 'dataTab';
const requestSourceQueryTab = 'queryTab';

class CustomParquetDocument extends Disposable implements vscode.CustomDocument {
    uri: vscode.Uri;
    paginator: Paginator;
    backend: Backend;
    worker: Worker;
    isQueryAble: boolean = false;

    static async create(
      uri: vscode.Uri
    ): Promise<CustomParquetDocument | PromiseLike<CustomParquetDocument>> {
        try{
            switch (defaultBackend()) {
              case 'duckdb': {
                const backend = await DuckDBBackend.createAsync(uri.fsPath);
                await backend.initialize();
                const totalItems = backend.getRowCount();
                const table = 'data';
                const readFromFile = true;
                const paginator = new DuckDBPaginator(backend, table, totalItems, readFromFile);
                return new CustomParquetDocument(uri, backend, paginator);
              }
              case 'parquet-wasm': {
                const backend = await ParquetWasmBackend.createAsync(uri.fsPath);
                const paginator = new ParquetWasmPaginator(backend);
                return new CustomParquetDocument(uri, backend, paginator);
              }
              default:
                throw Error("Unknown backend. Terminating");
            }

        } catch (err: any){
            console.log(err);

            const backend = await ParquetWasmBackend.createAsync(uri.fsPath);
            const paginator = new ParquetWasmPaginator(backend);
            return new CustomParquetDocument(uri, backend, paginator);
        }
    }

    private constructor(
      uri: vscode.Uri,
      backend: Backend,
      paginator: Paginator
    ) {
      super();
      this.uri = uri;
      this.backend = backend;
      this.paginator = paginator;
      
      // FIXME: Check if backend is of type ParquetWasm
      if (this.backend instanceof DuckDBBackend) {
        this.isQueryAble = true;

        this.worker = new Worker(__dirname + "/worker.js", {
            workerData: {
              pathParquetFile: this.uri.fsPath
            }
          });
    
          this.worker.on('message', (message) => {
            if (message.type === 'query'){
              this.emitQueryResult(message);
            } else if (message.type === 'paginator') {
              this.fireDataPaginatorEvent(
                message.result, 
                message.rowCount,
                message.pageSize,
                message.pageNumber,
                message.pageCount,
                requestSourceQueryTab
              );
            }
          });
      }
    }

    private readonly _onDidDispose = this._register(new vscode.EventEmitter<void>());
    /**
     * Fired when the document is disposed of.
     */
    public readonly onDidDispose = this._onDidDispose.event;

    private readonly _onDidChangeDocument = this._register(new vscode.EventEmitter<{
      readonly rawData?: any;
      readonly headers?: any;
      readonly rowCount?: number;
      readonly pageCount?: number;
      readonly pageSize?: number;
      readonly currentPage?: number;
      readonly requestSource?: string;
      readonly requestType?: string;

    }>());

    /**
     * Fired to notify webviews that the document has changed.
    */
    public readonly onDidChangeContent = this._onDidChangeDocument.event;

    fireChangedDocumentEvent(
      rawData: any, 
      headers: any, 
      rowCount: number,
      requestSource: string,
      requestType: string,
      pageSize: number,
      pageNumber: number,
      pageCount: number
    ) {
      // console.log(`fireChangedDocumentEvent(${this.uri}). Page {${this.currentPage}}`);
      const tableData = {
        rawData: rawData,
        headers: headers,
        rowCount: rowCount,
        pageCount: pageCount,
        pageSize: pageSize,
        currentPage: pageNumber,
        requestSource: requestSource,
        requestType: requestType,
      };
      this._onDidChangeDocument.fire(tableData);
    }

    private readonly _onError = this._register(new vscode.EventEmitter<{
      readonly error?: string;
    }>());

    /**
     * Fired to notify webviews that the document has errorred.
    */
    public readonly onError = this._onError.event;

    fireErrorEvent(error: string) {
      this._onError.fire({
        error: error
      });
    }

    /**
     * Called by VS Code when there are no more references to the document.
     *
     * This happens when all editors for it have been closed.
     */
    dispose(): void {
        // console.log("CustomParquetDocument.dispose()");
        this.backend.dispose();
        this._onDidDispose.fire();

        if (this.backend instanceof DuckDBBackend) {
            this.worker.terminate();
        }
        
        super.dispose();
    }

    fireDataPaginatorEvent(
      values: any, 
      rowCount: number,
      pageSize: number, 
      pageNumber: number, 
      pageCount: number,
      requestSource: string
    ){
      const headers = createHeadersFromData(values);
      const requestType = 'paginator';
      this.fireChangedDocumentEvent(
        values, 
        headers, 
        rowCount,
        requestSource,
        requestType,
        pageSize,
        pageNumber,
        pageCount
      );
    }

    async emitPage(message: any) {
      let values;
      if (message.source === requestSourceQueryTab) {
        this.worker.postMessage({
            source: 'paginator',
            type: message.type,
            pageSize: Number(message.pageSize)
        });

      } else if (message.source === requestSourceDataTab) {
            if (message.type === 'nextPage') {
                values = await this.paginator.nextPage(message.pageSize);
            } else if (message.type === 'prevPage') {
                values = await this.paginator.previousPage(message.pageSize);
            } else if (message.type === 'firstPage') {
                values = await this.paginator.firstPage(message.pageSize);
            } else if (message.type === 'lastPage') {
                values = await this.paginator.lastPage(message.pageSize);
            } else {
                throw Error(`Unknown message type: ${message.type}`);
            }
            
            const rowCount = 0;
            this.fireDataPaginatorEvent(
                values,
                rowCount, 
                Number(message.pageSize),
                this.paginator.getPageNumber(),
                this.paginator.getTotalPages(message.pageSize),
                requestSourceDataTab
            );
      }
    }
    
    async emitCurrentPage(message: any) {
        if (message.source === requestSourceQueryTab) {
            this.worker.postMessage({
                source: 'paginator',
                type: message.type,
                pageSize: Number(message.pageSize),
                pageNumber: message.pageNumber
            });
        } else if (message.source === requestSourceDataTab) {
            const values = await this.paginator.gotoPage(message.pageNumber, message.pageSize);
            const rowCount = 0;
            this.fireDataPaginatorEvent(
                values, 
                rowCount,
                Number(message.pageSize),
                this.paginator.getPageNumber(),
                this.paginator.getTotalPages(message.pageSize),
                requestSourceDataTab
            );
        }
    }
    

    emitQueryResult(message: any) {
        if (message.err) {
            const err = message.err;
            console.error(err);
            const error = err as DuckDbError;
            this.fireErrorEvent(err);
            vscode.window.showErrorMessage(error.message);
            return;
        } 
        const requestType = 'query';
        this.fireChangedDocumentEvent(
            message.result, 
            message.headers, 
            message.rowCount,
            requestSourceQueryTab,
            requestType,
            message.pageSize,
            message.pageNumber,
            message.pageCount
        );
        vscode.window.showInformationMessage("Query Succeeded");
    }

    async changePageSize(message: any) {
      if (message.source === requestSourceQueryTab) {
        this.worker.postMessage({
            source: 'paginator',
            type: 'currentPage',
            pageSize: Number(message.newPageSize),
        });
      }
      else if (message.source === requestSourceDataTab) {
        const values = await this.paginator.getCurrentPage(Number(message.newPageSize));
        let headers: any[] = [];
  
        const requestType = 'paginator';
        this.fireChangedDocumentEvent(
          values, 
          headers, 
          values.length,
          requestSourceDataTab,
          requestType,
          Number(message.newPageSize),
          this.paginator.getPageNumber(), // TODO: Handle ChangePageSize for both query and datatab
          this.paginator.getTotalPages(message.newPageSize)
        );
      }
    }
  }

export class ParquetEditorProvider implements vscode.CustomReadonlyEditorProvider<CustomParquetDocument> {

    private static readonly viewType = 'parquet-visualizer.parquetVisualizer';

    public static register(context: vscode.ExtensionContext): vscode.Disposable {
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

    private listeners: vscode.Disposable[] = [];

    constructor(
        private readonly context: vscode.ExtensionContext
    ) { }

    dispose() {
        // console.log("ParquetEditorProvider.dispose()");
        this.listeners.forEach(l => l.dispose());
        this._onDidChangeCustomDocument.dispose();
    }

    async openCustomDocument(uri: vscode.Uri): Promise<CustomParquetDocument> {
        // console.log(`openCustomDocument(uri: ${uri})`);
        const document: CustomParquetDocument = await CustomParquetDocument.create(uri);

        this.listeners.push(vscode.workspace.onDidChangeConfiguration((e: vscode.ConfigurationChangeEvent) => {
          if (affectsDocument(e)) {
            console.log("settings changed");
          }
        }));

        this.listeners.push(document.onError(e => {
          // Update all webviews when one document has an error
          for (const webviewPanel of this.webviews.get(document.uri)) {
            this.postMessage(webviewPanel, 'error', {
                type: 'error'
            });
          }
        }));

        this.listeners.push(document.onDidChangeContent(e => {
          const dataChange = {
            headers : e.headers,
            rawData: e.rawData,
            rowCount: e.rowCount,
            pageCount: e.pageCount,
            pageSize: e.pageSize,
            currentPage: e.currentPage,
            requestSource: e.requestSource,
            requestType: e.requestType
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

        // console.log(`resolveCustomEditor(${document.uri})`);
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

        const defaultPageSizesFromSettings = defaultPageSizes(); 
        const pageSize = Number(defaultPageSizesFromSettings[0]);

        const defaultQueryFromSettings = defaultQuery();
        
        const values = await document.paginator.getCurrentPage(pageSize);
        const headers = createHeadersFromData(values);
        const pageNumber = document.paginator.getPageNumber();
        const schema = document.backend.getSchema();
        const metadata = document.backend.getMetaData();
        const data = {
          headers: headers, 
          schema: schema, 
          metaData: metadata, 
          values: values,
          rawData: values,
          rowCount: document.backend.getRowCount(),
          pageCount: document.paginator.getTotalPages(pageSize),
          currentPage: pageNumber,
          requestSource: requestSourceDataTab,
          requestType: 'paginator',
          isQueryable: document.isQueryAble,
          defaultPageSizes: defaultPageSizesFromSettings,
          defaultQuery: defaultQueryFromSettings
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
    //   console.log(`onMessage(${message.type})`);
      switch (message.type) {
        case 'nextPage': {
          await document.emitPage(message);
          break;
        }
        case 'prevPage': {
          await document.emitPage(message);
          break;
        }
        case 'firstPage': {
          await document.emitPage(message);
          break;
        }
        case 'lastPage': {
          await document.emitPage(message);
          break;
        }
        case 'currentPage': {
          await document.emitCurrentPage(message);
          break;
        }
        case 'changePageSize': {
          await document.changePageSize(message.data);
          break;
        }
        case 'startQuery': {
          document.worker.postMessage({
            source: 'query',
            query: message.data,
            path: document.uri.fsPath,
            pageSize: message.pageSize
          });
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

        const styleFontAwesomeUri = webview.asWebviewUri(vscode.Uri.joinPath(
        	this.context.extensionUri, 'media', 'styles', 'font-awesome', 'all.min.css'));

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
          styleFontAwesomeUri: styleFontAwesomeUri.toString(true),
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
      // console.log("webviewPanel.OnDidDispose");
			this._webviews.delete(entry);
		});
	}
}