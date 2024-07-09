export function getNonce() {
	let text = '';
	const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	for (let i = 0; i < 32; i++) {
		text += possible.charAt(Math.floor(Math.random() * possible.length));
	}
	return text;
}

export function convertToTabulatorData(array: any[]) {
    return array.map(obj => {
      const newObj : { [key: string]: any } = {};
      for (const [key, value] of Object.entries(obj)) {
        newObj[key] = String(value); // Convert value to string
      }
      return newObj;
    });
  }

export function convertBigIntToString(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map(item => convertBigIntToString(item));
  } 
  else if (obj instanceof Uint8Array) {
    return Array.from(obj.values());
  }
  else if (obj !== null && typeof obj === 'object') {
    if (obj instanceof Date) {
      return obj.toUTCString();
    }
    const newObj: { [key: string]: any } = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
          newObj[key] = convertBigIntToString(obj[key]);
      }
    }
    return newObj;
  } 
  else if (typeof obj === 'bigint') {
    return obj.toString();
  } 
  else {
    return obj;
  }
}

export function convertObjectsToJSONStrings(obj: any) {
  for (let key in obj) {
      if (obj.hasOwnProperty(key)) {
          if (typeof obj[key] === 'object' && obj[key] !== null) {
              obj[key] = JSON.stringify(obj[key]);
          }
      }
  }
  return obj;
}

function convertArrayToString(array: any): any{
  try {
      return String.fromCharCode(...array);
  } catch (error) {
      console.error("Conversion failed:", error);
      return array;
  }
}

export function tryConvertObjectArraysToStrings(obj: any): any {
  if (obj instanceof Uint8Array) {
      return convertArrayToString(obj);
  } else if (obj !== null && typeof obj === 'object') {
      const result: Record<string, any> = {};
      for (const key in obj) {
          if (obj.hasOwnProperty(key)) {
              result[key] = tryConvertObjectArraysToStrings(obj[key]);
          }
      }
      return result;
  } else {
      return obj;
  }
}

export function createHeadersFromData(data: any) {
  // create header object
  let headers: any[] = [];
  if (data.length > 0 ){
      headers = Object.keys(data[0]).map(f => {
      return {
          title: f,
          field: f
      };
    });
  }
  return headers;
}