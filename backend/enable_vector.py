import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT

try:
    conn = psycopg2.connect(dbname="healthtwin", user="postgres", password="postgres", host="127.0.0.1", port="5433")
    conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
    cursor = conn.cursor()
    cursor.execute("CREATE EXTENSION IF NOT EXISTS vector;")
    cursor.close()
    conn.close()
    print("pgvector extension enabled successfully")
except Exception as e:
    print(f"Error: {e}")
