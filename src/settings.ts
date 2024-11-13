import * as vscode from 'vscode';

const name = "parquet-visualizer";

function settings(): vscode.WorkspaceConfiguration {
    return vscode.workspace.getConfiguration(name);
}

export function defaultPageSizes(): number[] {
    return settings().get('defaultPageSizes') as number[];
}

export function defaultQuery(): string {
    return settings().get('defaultQuery') as string;
}

export function defaultBackend(): string {
    return settings().get('backend') as string;
}

export function defaultRunQueryKeyBinding(): string {
    return settings().get('RunQueryKeyBinding') as string;
}

export function dateTimeFormat(): string {
    return settings().get('dateTimeFormat') as string;
}

export function outputDateTimeFormatInUTC(): boolean {
    return settings().get<boolean>('outputDateTimeFormatInUTC') as boolean;
}
  
function settingsChanged(e: vscode.ConfigurationChangeEvent, sections: string[]): boolean {
    return sections.map(s => `${name}.${s}`).some(s => e.affectsConfiguration(s));
}

export function affectsDocument(e: vscode.ConfigurationChangeEvent): boolean {
    return settingsChanged(e, ['defaultPageSizes', 'defaultQuery', 'backend']);
  }