import duckdb

con = duckdb.connect()

con.install_extension("spatial")
con.load_extension("spatial")

con.sql("COPY (SELECT 1 as a, 2 as b) TO 'output.xlsx' WITH (FORMAT GDAL, DRIVER 'xlsx')")
