import * as vscode from 'vscode';

import { name, contributes } from '../package.json';

function settings(): vscode.WorkspaceConfiguration {
    return vscode.workspace.getConfiguration(name);
}

export function defaultPageSizes(): number[] {
    return settings().get('defaultPageSizes') ?? [
        20,
        50,
        100,
        500
      ];
}

export function defaultQuery(): string{
    const defaultQuery = "SELECT *\r\nFROM data\r\nLIMIT 1000;";
    return settings().get('defaultQuery') ?? defaultQuery;
}

export function defaultBackend(): string{
    return settings().get('backend') ?? "duckdb";
}

export function defaultRunQueryKeyBinding(): string{
    return settings().get('RunQueryKeyBinding') ?? "Ctrl-Enter";
}
  
function settingsChanged(e: vscode.ConfigurationChangeEvent, sections: string[]): boolean {
    return sections.map(s => `${name}.${s}`).some(s => e.affectsConfiguration(s));
}

export function affectsDocument(e: vscode.ConfigurationChangeEvent): boolean {
    return settingsChanged(e, ['defaultPageSizes', 'defaultQuery', 'backend']);
  }