// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

const cats = {
	'Coding Cat': 'https://media.giphy.com/media/JIX9t2j0ZTN9S/giphy.gif',
	'Compiling Cat': 'https://media.giphy.com/media/mlvseq9yvZhba/giphy.gif'
  };

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	// Track currently webview panel
	let currentPanel: vscode.WebviewPanel | undefined;
	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "parquet-visualizer" is now active!');

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	context.subscriptions.push(
		vscode.commands.registerCommand('parquet-visualizer.start', () => {
			const column = vscode.window.activeTextEditor
			? vscode.window.activeTextEditor.viewColumn
			: undefined;
			
			if (currentPanel){
				currentPanel.reveal(column);
			} else {
				// Create and show panel
				console.log(column);
				const panel = vscode.window.createWebviewPanel(
					'parquet-visualizer',
					'Cat Coding',
					column || vscode.ViewColumn.One,
					{}
				);
	
				const cat = 'Coding Cat';
				panel.webview.html = getWebviewContent(cat);
	
	
				// Reset when the current panel is closed
				panel.onDidDispose(
					() => {
						currentPanel = undefined;
					},
					null,
					context.subscriptions
				);
			}
		})
	);
}

function getWebviewContent(cat: keyof typeof cats) {
	return `<!DOCTYPE html>
  <html lang="en">
  <head>
	  <meta charset="UTF-8">
	  <meta name="viewport" content="width=device-width, initial-scale=1.0">
	  <title>Cat Coding</title>
  </head>
  <body>
  <img src="${cats[cat]}" width="300" />
  </body>
  </html>`;
  }

// This method is called when your extension is deactivated
export function deactivate() {}
