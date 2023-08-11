import pyarrow.parquet as pq

def paginate_parquet(parquet_file, batch_size):
    parquet_reader = pq.ParquetFile(parquet_file)
    print(parquet_reader.num_row_groups)
    num_rows = parquet_reader.num_row_groups * parquet_reader.metadata.num_rows
    for i in range(0, num_rows, batch_size):
        table = parquet_reader.read_row_group(i)
        yield table

# Usage
parquet_file = "data/large.parquet"
batch_size = 20

for batch in paginate_parquet(parquet_file, batch_size):
    # Process the batch
    break