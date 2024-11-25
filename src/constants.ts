export const FILENAME_SHORTNAME_FULLNAME_MAPPING: Record<string, string> = {
    'csv': 'Comma Separated Values file',
    'json': 'JavaScript Object Notation file',
    'parquet': 'Parquet file',
    'ndjson': 'Newline Delimited JSON file',
    'excel': 'Microsoft Excel file'
};

export const FILENAME_SHORTNAME_EXTENSION_MAPPING: Record<string, string> = {
    'csv': 'csv',
    'json': 'json',
    'parquet': 'parquet',
    'ndjson': 'ndjson',
    'excel': 'xlsx'
};

export const REQUEST_SOURCE_DATA_TAB = 'dataTab';
export const REQUEST_SOURCE_QUERY_TAB = 'queryTab';