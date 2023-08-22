import * as vscode from 'vscode';
import { getNonce } from './util';
import { Disposable } from "./dispose";

import { ParquetPaginator } from './parquet-paginator';


class CustomParquetDocument extends Disposable implements vscode.CustomDocument {
    uri: vscode.Uri;
    path: string;
  
    constructor(uri: vscode.Uri) {
      super();
      this.uri = uri;
      this.path = uri.fsPath;
    }
  
    public async open() {
      await vscode.window.showTextDocument(
        this.uri.with({ scheme: 'parquet', path: this.path })
      );
    }
  }

export class ParquetEditorProvider implements vscode.CustomReadonlyEditorProvider<CustomParquetDocument> {

    private static readonly viewType = 'parquet-visualizer.parquetVisualizer';

    public static register(context: vscode.ExtensionContext): vscode.Disposable {
        const provider = new ParquetEditorProvider(context);
        return vscode.window.registerCustomEditorProvider(ParquetEditorProvider.viewType, provider);
    }

    constructor(
        private readonly context: vscode.ExtensionContext
    ) { }

    async openCustomDocument(uri: vscode.Uri): Promise<CustomParquetDocument> {
        return new CustomParquetDocument(uri);
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

        webviewPanel.webview.html = this.getHtmlForWebview(webviewPanel.webview);

        function updateWebview() {
            webviewPanel.webview.postMessage({
              type: 'update',
              // text: document.getText(),
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
      
          // Make sure we get rid of the listener when our editor is closed.
          webviewPanel.onDidDispose(() => {
            changeDocumentSubscription.dispose();
          });

        const path = vscode.Uri.joinPath(this.context.extensionUri, 'data', 'large.parquet');

        const paginator = await ParquetPaginator.createAsync(path.fsPath, 10);
        

        await document.open();
    }

    private async onMessage(document: CustomParquetDocument, message: string) {
        switch (message) {
          case 'clicked':
            await document.open();
            break;
        }
      }

    private getHtmlForWebview(webview: vscode.Webview): string {
        // Local path to script and css for the webview
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(
            this.context.extensionUri, 'media', 'main.js'));

        const styleResetUri = webview.asWebviewUri(vscode.Uri.joinPath(
            this.context.extensionUri, 'media', 'reset.css'));

        const styleVSCodeUri = webview.asWebviewUri(vscode.Uri.joinPath(
            this.context.extensionUri, 'media', 'vscode.css'));

        // const styleMainUri = webview.asWebviewUri(vscode.Uri.joinPath(
        // 	this.context.extensionUri, 'media', 'catScratch.css'));

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

                <title>Parquet Visualizer</title>
            </head>
            <body>
                
                <script nonce="${nonce}" src="${scriptUri}"></script>
            </body>
            </html>`;
    }
}