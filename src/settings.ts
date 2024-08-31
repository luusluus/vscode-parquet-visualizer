import * as vscode from 'vscode';

import { name, contributes } from '../package.json';

function settings(): vscode.WorkspaceConfiguration {
    return vscode.workspace.getConfiguration(name);
}

export function defaultPageSizes(): number[] {
    return settings().get('defaultPageSizes');
}

export function defaultQuery(): string {
    return settings().get('defaultQuery');
}

export function defaultBackend(): string {
    return settings().get('backend');
}

export function defaultRunQueryKeyBinding(): string {
    return settings().get('RunQueryKeyBinding');
}
  
function settingsChanged(e: vscode.ConfigurationChangeEvent, sections: string[]): boolean {
    return sections.map(s => `${name}.${s}`).some(s => e.affectsConfiguration(s));
}

export function affectsDocument(e: vscode.ConfigurationChangeEvent): boolean {
    return settingsChanged(e, ['defaultPageSizes', 'defaultQuery', 'backend']);
  }