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
    }>());
    /**
     * Fired to notify webviews that the document has changed.
     */
    public readonly onDidChangeContent = this._onDidChangeDocument.event;

    async nextPage() {
      this.currentPage++;
      const currentPage = await this.getCurrentPage();
      this._onDidChangeDocument.fire({
        rowData: currentPage 
      });
    }

    async getCurrentPage() {
      return this.paginator.getPage(this.currentPage);
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
          this.webviewPanel.webview.postMessage({
            type: 'update',
            body: {
              headers : [],
              body: e.rowData
            }
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
        console.log('resolveCustomEditor');
        this.webviewPanel = webviewPanel;
        webviewPanel.webview.options = {
            enableScripts: true,
        };

        const data = {
          headers: document.paginator.getFieldList(),
          body: await document.getCurrentPage()
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
            webviewPanel.webview.postMessage({
              type: 'update',
              body: data
            });
          }
        });
    
        webviewPanel.webview.onDidReceiveMessage(e => this.onMessage(document, e));

        // Wait for the webview to be properly ready before we init
        // NOTE: Why is onDidReceiveMessage called twice?
        webviewPanel.webview.onDidReceiveMessage(e => {
          if (e.type === 'ready') {
            if (document.uri.scheme === 'untitled') {
              this.postMessage(webviewPanel, 'init', {
                untitled: true,
                editable: true,
              });
            } else {
              const editable = vscode.workspace.fs.isWritableFileSystem(document.uri.scheme);

              this.postMessage(webviewPanel, 'init', {
                value: "",
                editable,
              });
            }
          }
        });
    
        // Make sure we get rid of the listener when our editor is closed.
        webviewPanel.onDidDispose(() => {
          changeDocumentSubscription.dispose();
        });
        
        webviewPanel.webview.postMessage({
          type: 'update',
          body: data
        });

    }

    private async onMessage(document: CustomParquetDocument, message: any) {
        switch (message.type) {
          case 'nextPage':
            await document.nextPage();
        }
    }

    private postMessage(panel: vscode.WebviewPanel, type: string, data: any): void {
      panel.webview.postMessage({ type, data });
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
                <div class="add-button">
                  <button>Next Page</button>
                </div>
                <div class="table"></div>
              </div>

                <script nonce="${nonce}" src="${scriptUri}"></script>
            </body>
            </html>`;
    }

}