import * as vscode from 'vscode';

import { ParquetEditorProvider } from './parquet-editor';

export function activate(context: vscode.ExtensionContext) {
	// Register our custom editor providers
	console.log("extension.activate()");
	context.subscriptions.push(ParquetEditorProvider.register(context));
}
