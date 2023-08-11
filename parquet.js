"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const parquets_1 = require("@dvirtz/parquets");
class ParquetPaginator {
    constructor(filePath, pageSize = 10) {
        this.pageSize = pageSize;
        this.reader = this.init(filePath);
    }
    async init(filePath) {
        return await parquets_1.ParquetReader.openFile(filePath);
    }
    async numPages() {
        const numRows = await this.reader.getRowCount();
        return Math.ceil(numRows / this.pageSize);
    }
}
(async () => {
    let reader = await parquets_1.ParquetReader.openFile("data/large.parquet");
    console.log(reader.getRowCount());
    let cursor = reader.getCursor();
    const pageSize = 20;
    const numRows = await reader.getRowCount();
    const numPages = Math.ceil(numRows / pageSize);
    console.log(numPages);
    // read all records from the file and print them
    let record = null;
    // console.log(reader.metadata.row_groups[0]);
    // console.log(cursor.envelopeReader.readRowGroup());
    while (record = await cursor.next()) {
        // console.log(record);
    }
    await reader.close();
})();
//# sourceMappingURL=parquet.js.map