import * as vscode from 'vscode';
import { getNonce } from './util';
import { Disposable } from "./dispose";

import { ParquetPaginator } from './parquet-paginator';
import { getLogger } from './logger';


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

    nextPage() {
      this.currentPage++;
      return this.getCurrentPage();
    }

    getCurrentPage() {
      return this.paginator.getPage(this.currentPage);
    }
  }

export class ParquetEditorProvider implements vscode.CustomReadonlyEditorProvider<CustomParquetDocument> {

    private static readonly viewType = 'parquet-visualizer.parquetVisualizer';

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
        webviewPanel.webview.options = {
            enableScripts: true,
        };

        const data = {
          'headers': document.paginator.getFieldList(),
          'body': await document.getCurrentPage()
        };

        webviewPanel.webview.html = this.getHtmlForWebview(webviewPanel.webview, data);

        function updateWebview() {
            webviewPanel.webview.postMessage({
              type: 'update',
            });
          }
      
          // Hook up event handlers so that we can synchronize the webview with the text document.
          //
          // The text document acts as our model, so we have to sync change in the document to our
          // editor and sync changes in the editor back to the document.
          // 
          // Remember that a single text document can also be shared between multiple custom
          // editors (this happens for example when you split a custom editor)
      
          const changeDocumentSubscription = vscode.workspace.onDidChangeTextDocument(e => {
            if (e.document.uri.toString() === document.uri.toString()) {
              updateWebview();
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


    }

    private async onMessage(document: CustomParquetDocument, message: any) {
        switch (message.type) {
          case 'nextPage':
            const page = await document.nextPage();
            console.log(page);
            break;
        }
    }

    private postMessage(panel: vscode.WebviewPanel, type: string, body: any): void {
      panel.webview.postMessage({ type, body });
    }

    private getHtmlForWebview(webview: vscode.Webview, table: any): string {
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

        const tableHTML = this.getTableHTMLFromData(table);
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
                <!-- ${tableHTML} -->

                <script nonce="${nonce}" src="${scriptUri}"></script>
            </body>
            </html>`;
    }

    private getTableHTMLFromData(table: any) {
      const {headers, body} = table;

      const headerTableHTML = this.getTableHeaderHTMLFromData(headers);
      const bodyTableHTML = this.getTableBodyHTMLFromData(body);

      return `
        <table>
        ${headerTableHTML}
        ${bodyTableHTML}
        </table>
      `;
    }

    private getTableHeaderHTMLFromData(headers: any) {
      // header
      let formattedCells = [];
      for (let i = 0; i < headers.length; i++) {
        let row = headers[i];
        
        let formattedCell = `<th>${row.name}</th>`;
        formattedCells.push(formattedCell);
      }
      return `<tr>${formattedCells.join('')}</tr>`;
    }

    private getTableBodyHTMLFromData(body: any) {
      // body
      let formattedRows = [];
      for (let i = 0; i < body.length; i++) {
        let row = body[i];
        let formattedCells = [];
        for (let j = 0; j < row.length; j++) {
          let formattedCell = `<td>${row[j]}</td>`;
          formattedCells.push(formattedCell);
        }
        let formattedRow = `<tr>${formattedCells.join('')}</tr>`;
        formattedRows.push(formattedRow);
      }

      return `${formattedRows.join('')}`;
    }
}