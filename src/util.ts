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