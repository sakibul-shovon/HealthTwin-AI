import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT

try:
    conn = psycopg2.connect(dbname="postgres", user="postgres", password="postgres", host="127.0.0.1", port="5432")
    conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
    cursor = conn.cursor()
    cursor.execute("CREATE DATABASE healthtwin;")
    cursor.close()
    conn.close()
    print("Database created successfully")
except Exception as e:
    print(f"Error: {e}")
