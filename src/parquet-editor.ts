import * as fs from 'fs';
import { Worker } from 'node:worker_threads';

import * as vscode from 'vscode';
import { DuckDbError } from 'duckdb-async';

import { Paginator } from './paginator';
import { Backend } from './backend';
import { createHeadersFromData, replacePeriodWithUnderscoreInKey, getNonce } from './util';
import { Disposable, disposeAll } from "./dispose";
import { DuckDBBackend } from './duckdb-backend';
import { DuckDBPaginator } from './duckdb-paginator';
import { ParquetWasmBackend } from './parquet-wasm-backend';
import { ParquetWasmPaginator } from './parquet-wasm-paginator';
import { affectsDocument, defaultPageSizes, defaultQuery, defaultBackend, defaultRunQueryKeyBinding } from './settings';
import { Action, BackendName, MessageType, RequestSource } from './constants';


class CustomParquetDocument extends Disposable implements vscode.CustomDocument {
    uri: vscode.Uri;
    paginator: Paginator;
    backend: Backend;
    worker: Worker;
    memoryReaderWorker: Worker;
    isQueryAble: boolean = false;
    dataIsLoaded: boolean = false;

    static async create(
      uri: vscode.Uri
    ): Promise<CustomParquetDocument | PromiseLike<CustomParquetDocument>> {
        try{
            switch (defaultBackend()) {
              case BackendName.duckdb: {
                const backend = await DuckDBBackend.createAsync(uri.fsPath);
                await backend.initialize();
                const totalItems = backend.getRowCount();
                const table = 'data';
                const readFromFile = true;
                const paginator = new DuckDBPaginator(backend, table, totalItems, readFromFile);
                return new CustomParquetDocument(uri, backend, paginator);
              }
              case BackendName.parquetWasm: {
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

    private initializeWorker(initializeData: boolean = false) {
      const worker =  new Worker(__dirname + "/worker.js", {
          workerData: {
            pathParquetFile: this.uri.fsPath,
            initialize: initializeData
          }
      });

      worker.on('exit', (exitCode) => {
        console.log(`Exit code: ${exitCode}`);
      });

      worker.on('message', (message) => {
        if (message.type === MessageType.query){
          this.emitQueryResult(message);
        } 
        else if (message.type === MessageType.paginator) {
          this.fireDataPaginatorEvent(
            message.result, 
            message.rowCount,
            message.pageSize,
            message.pageNumber,
            message.pageCount,
            message.source
          );
        } 
        else if (message.type === MessageType.exportQueryResults) {
          vscode.window.showInformationMessage(`Exported query result to ${message.path}`);
        }
        else if (message.type === MessageType.initialized) {
          this.worker.terminate().then(() => {
            this.worker = this.memoryReaderWorker;
            this.dataIsLoaded = true;
            vscode.window.showInformationMessage(`Parquet data of ${this.uri} loaded into memory`);
          });

        }
        else if (message.type === MessageType.error) {
          vscode.window.showErrorMessage(`${message.err}`);
        }
      });

      return worker;
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
      this.dataIsLoaded = false;
      
      // FIXME: Check if backend is of type ParquetWasm
      if (this.backend instanceof DuckDBBackend) {
        this.isQueryAble = true;
        this.worker = this.initializeWorker(false);
        this.memoryReaderWorker = this.initializeWorker(true);
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
        console.log("CustomParquetDocument.dispose()");
        this._onDidDispose.fire();
        this.backend.dispose();

        if (this.backend instanceof DuckDBBackend) {
            this.worker.terminate().then(
              (val) => {
                console.log(val);
              }
            ).catch(e => {
              console.error(e);
            });
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
      this.fireChangedDocumentEvent(
        values, 
        headers, 
        rowCount,
        requestSource,
        MessageType.paginator,
        pageSize,
        pageNumber,
        pageCount
      );
    }

    async emitPage(message: any) {
      console.log(`emitPage()`);
      let values;
      if (message.source === RequestSource.queryTab) {
        this.worker.postMessage({
            type: MessageType.paginator,
            action: message.action,
            source: message.source,
            pageSize: Number(message.pageSize)
        });

      } else if (message.source === RequestSource.dataTab && this.dataIsLoaded) {
        this.worker.postMessage({
            type: MessageType.paginator,
            action: message.action,
            source: message.source,
            pageSize: Number(message.pageSize)
        });
      } else if (message.source === RequestSource.dataTab) {
          if (message.action === Action.nextPage) {
              values = await this.paginator.nextPage(message.pageSize);
          } else if (message.action === Action.prevPage) {
              values = await this.paginator.previousPage(message.pageSize);
          } else if (message.action === Action.firstPage) {
              values = await this.paginator.firstPage(message.pageSize);
          } else if (message.action === Action.lastPage) {
              values = await this.paginator.lastPage(message.pageSize);
          } else if (message.action === Action.currentPage) {
              values = await this.paginator.getCurrentPage(message.pageSize);
          } else {
              throw Error(`Unknown message type: ${message.action}`);
          }
          
          values = replacePeriodWithUnderscoreInKey(values);
          const rowCount = 0;
          this.fireDataPaginatorEvent(
              values,
              rowCount, 
              Number(message.pageSize),
              this.paginator.getPageNumber(),
              this.paginator.getTotalPages(message.pageSize),
              RequestSource.dataTab
          );
      }
    }

    async currentPage(message: any){
      console.log(`currentPage`);
      console.log(message);
      if (message.source === RequestSource.queryTab) {
        this.worker.postMessage({
          type: MessageType.paginator,
          source: RequestSource.queryTab,
          action: message.action,
          pageSize: Number(message.pageSize),
        });
      } else if (message.source === RequestSource.dataTab && this.dataIsLoaded) { 
        this.worker.postMessage({
          type: MessageType.paginator,
          source: RequestSource.dataTab,
          action: message.action,
          pageSize: Number(message.pageSize),
        });
      } else if (message.source === RequestSource.dataTab) {
        const values = await this.paginator.getCurrentPage(Number(message.pageSize));
        const rowCount = 0;
        this.fireDataPaginatorEvent(
            values, 
            rowCount,
            Number(message.pageSize),
            this.paginator.getPageNumber(),
            this.paginator.getTotalPages(message.pageSize),
            RequestSource.dataTab
        );
      }
    }
    
    async goToPage(message: any) {
        console.log("goToPage");
        console.log(message);
        if (message.source === RequestSource.queryTab) {
            this.worker.postMessage({
                type: MessageType.paginator,
                source: RequestSource.queryTab,
                action: message.action,
                pageSize: Number(message.pageSize),
                pageNumber: message.pageNumber
            });
        } else if (message.source === RequestSource.dataTab && this.dataIsLoaded) { 
            this.worker.postMessage({
                type: MessageType.paginator,
                source: RequestSource.dataTab,
                action: message.action,
                pageSize: Number(message.pageSize),
                pageNumber: message.pageNumber
            });
        } else if (message.source === RequestSource.dataTab) {
            const values = await this.paginator.gotoPage(message.pageNumber, message.pageSize);
            const rowCount = 0;
            this.fireDataPaginatorEvent(
                values, 
                rowCount,
                Number(message.pageSize),
                this.paginator.getPageNumber(),
                this.paginator.getTotalPages(message.pageSize),
                RequestSource.dataTab
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
        this.fireChangedDocumentEvent(
            message.result, 
            message.headers, 
            message.rowCount,
            RequestSource.queryTab,
            MessageType.query,
            message.pageSize,
            message.pageNumber,
            message.pageCount
        );
        vscode.window.showInformationMessage("Query succeeded");
    }

    async changePageSize(message: any) {
      if (message.source === RequestSource.queryTab) {
        this.worker.postMessage({
            type: MessageType.paginator,
            source: message.source,
            action: Action.currentPage,
            pageSize: Number(message.newPageSize),
        });
      }
      else if (message.source === RequestSource.dataTab) {
        const page = await this.paginator.getCurrentPage(Number(message.newPageSize));
        const values = replacePeriodWithUnderscoreInKey(page);
        let headers: any[] = [];
  
        this.fireChangedDocumentEvent(
          values, 
          headers, 
          values.length,
          RequestSource.dataTab,
          MessageType.paginator,
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
            this.postMessage(webviewPanel, MessageType.error, {
                type: MessageType.error
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
            this.postMessage(webviewPanel, MessageType.update, {
                type: MessageType.update,
                tableData: dataChange
            });
          }
        }));

        document.onDidDispose(() => disposeAll(this.listeners));

        return document;
    }

    createShortcutMapping(input: string): { win: string; mac: string } {
      if (input.startsWith("Ctrl-")) {
          const suffix = input.substring(5); // Remove "Ctrl-" from the start
          return {
              win: `Ctrl-${suffix}`,
              mac: `Command-${suffix}`,
          };
      } else if (input.startsWith("Command-")) {
          const suffix = input.substring(8); // Remove "Command-" from the start
          return {
              win: `Ctrl-${suffix}`,
              mac: `Command-${suffix}`,
          };
      } else {
         // Show an error message to the user
          const errorMessage = 'Value of setting "parquet-visualizer.RunQueryKeyBinding" invalid. The string must start with "Ctrl-" or "Command-".';
          vscode.window.showErrorMessage(`${errorMessage}`);
          
          // Optionally, log the error to the output channel for more details
          const outputChannel = vscode.window.createOutputChannel("Your Extension");
          outputChannel.appendLine(`Configuration Error: ${errorMessage}`);
          outputChannel.show();
          throw Error(errorMessage);
      }
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

        const defaultRunQueryKeyBindingFromSettings = defaultRunQueryKeyBinding();
        const shortCutMapping = this.createShortcutMapping(defaultRunQueryKeyBindingFromSettings);

        const page = await document.paginator.getCurrentPage(pageSize);
        const values = replacePeriodWithUnderscoreInKey(page);
        const headers = createHeadersFromData(values);
        const pageNumber = document.paginator.getPageNumber();
        const schema = document.backend.getSchema();
        const metadata = document.backend.getMetaData();
        const data = {
          headers: headers, 
          schema: schema, 
          metaData: metadata, 
          rawData: values,
          rowCount: document.backend.getRowCount(),
          pageCount: document.paginator.getTotalPages(pageSize),
          currentPage: pageNumber,
          requestSource: RequestSource.dataTab,
          requestType: MessageType.paginator,
          isQueryable: document.isQueryAble,
          settings: {
            defaultQuery: defaultQueryFromSettings,
            defaultPageSizes: defaultPageSizesFromSettings,
            shortCutMapping: shortCutMapping
          }
        };

        // Wait for the webview to be properly ready before we init
        webviewPanel.webview.onDidReceiveMessage(e => {
          if (e.action === MessageType.ready) {
            if (document.uri.scheme === 'untitled') {
              this.postMessage(webviewPanel, MessageType.init, {
                tableData: data,
              });
            } else {
              this.postMessage(webviewPanel, MessageType.init, {
                tableData: data,
              });
            }
          }
        });
    }

    private postMessage(panel: vscode.WebviewPanel, type: string, body: any): void {
      panel.webview.postMessage({ type, body });
    }

    private async onMessage(document: CustomParquetDocument, message: any) {
      console.log(`onMessage(${message.action})`);
      switch (message.action) {
        case Action.nextPage: {
          await document.emitPage(message);
          break;
        }
        case Action.prevPage: {
          await document.emitPage(message);
          break;
        }
        case Action.firstPage: {
          await document.emitPage(message);
          break;
        }
        case Action.lastPage: {
          await document.emitPage(message);
          break;
        }
        case Action.goToPage: {
          await document.goToPage(message);
          break;
        }
        case Action.currentPage: {
          await document.currentPage(message);
          break;
        }
        case Action.changePageSize: {
          await document.changePageSize(message.data);
          break;
        }
        case Action.startQuery: {
          document.worker.postMessage({
            type: MessageType.query,
            source: RequestSource.queryTab,
            query: message.data,
            path: document.uri.fsPath,
            pageSize: message.pageSize
          });
          break;
        }
        case Action.exportQueryResults: {
          document.worker.postMessage({
            type: message.action,
            source: RequestSource.queryTab,
            exportType: message.exportType
          });
          break;
        }
        case Action.copyQueryResults: {
          vscode.window.showInformationMessage("Query result data copied");
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
      console.log("webviewPanel.OnDidDispose()");
			this._webviews.delete(entry);
		});
	}
}