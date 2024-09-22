import * as vscode from 'vscode';

export function disposeAll(disposables: vscode.Disposable[]): void {
	console.log("disposeAll()");
	while (disposables.length) {
		const item = disposables.pop();
		if (item) {
			item.dispose();
		}
	}
}

export abstract class Disposable {
	private _isDisposed = false;

	protected _disposables: vscode.Disposable[] = [];

	public dispose(): any {
		console.log("Disposable.dispose()");
		if (this._isDisposed) {
			return;
		}
		this._isDisposed = true;
		disposeAll(this._disposables);
	}

	protected _register<T extends vscode.Disposable>(value: T): T {
		console.log("Disposable._register()");
		if (this._isDisposed) {
			value.dispose();
		} else {
			this._disposables.push(value);
		}
		return value;
	}

	protected get isDisposed(): boolean {
		console.log("Disposable.isDisposed()");
		return this._isDisposed;
	}
}