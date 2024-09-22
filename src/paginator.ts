export abstract class Paginator {
  protected currentPage: number = 1;
  protected pageSize: number = 10;
  protected totalItems: number;
  protected totalPages: number;

  constructor(totalItems: number) {
    this.totalItems = totalItems;
  }

  abstract getPage(pageNumber: number, pageSize: number): Promise<any[]>;

  abstract getTotalPages(pageSize: number): number;

  protected calculateOffset(pageNumber: number, pageSize: number): number {
    return (pageNumber - 1) * pageSize;
  }

  async nextPage(pageSize: number): Promise<any[]> {
    this.totalPages = this.getTotalPages(pageSize);
    this.pageSize = pageSize;

    if (this.totalPages !== undefined && this.currentPage >= this.totalPages) {
      throw new Error("No more pages available.");
    }
    this.currentPage += 1;
    return this.getItems(pageSize);
  }

  async previousPage(pageSize: number): Promise<any[]> {
    this.totalPages = this.getTotalPages(pageSize);
    this.pageSize = pageSize;

    if (this.currentPage <= 1) {
      throw new Error("Already on the first page.");
    }
    this.currentPage -= 1;
    return this.getItems(pageSize);
  }

  async firstPage(pageSize: number): Promise<any[]> {
    this.totalPages = this.getTotalPages(pageSize);
    this.pageSize = pageSize;

    this.currentPage = 1;
    return this.getItems(pageSize);
  }

  async lastPage(pageSize: number): Promise<any[]> {
    this.totalPages = this.getTotalPages(pageSize);
    this.pageSize = pageSize;

    this.currentPage = this.totalPages;

    return this.getItems(pageSize);
  }

  async gotoPage(pageNumber: number, pageSize: number): Promise<any[]> {
    console.log(`gotoPage(${pageNumber}, ${pageSize})`);
    this.totalPages = this.getTotalPages(pageSize);

    if (pageNumber === undefined) {
      pageNumber = this.getPageNumber();
    }
    if (pageNumber > this.totalPages) {
      this.calculateNewPageNumber(pageSize);
      pageNumber = this.getPageNumber();
    }
    this.pageSize = pageSize;

    if (pageNumber < 1 || (this.totalPages !== undefined && pageNumber > this.totalPages)) {
      throw new Error("Invalid page number.");
    }
    this.pageSize = pageSize;
    this.currentPage = pageNumber;
    return this.getItems(pageSize);
  }

  async getItems(pageSize: number): Promise<any[]> {
    return this.getPage(this.currentPage, pageSize);
  }

  hasNextPage(): boolean {
    return this.totalPages === undefined || this.currentPage < this.totalPages;
  }

  hasPreviousPage(): boolean {
    return this.currentPage > 1;
  }

  getCurrentPage(pageSize: number) {
    this.calculateNewPageNumber(pageSize);

    return this.getPage(this.currentPage, pageSize);
  }

  getPageNumber(){
    return this.currentPage;
  }

  calculateNewPageNumber(newPageSize: number): void {
      // Calculate the zero-based index of the first item on the current page
      const firstItemIndex = (this.currentPage - 1) * this.pageSize;

      // Calculate the new page number
      const newPageNumber = Math.floor(firstItemIndex / newPageSize) + 1;

      this.currentPage = newPageNumber;
      this.pageSize = newPageSize;
  }

  getTotalItems() {
    return this.totalItems;
  }
}