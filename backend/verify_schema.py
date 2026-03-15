import sqlite3

def verify_tables():
    conn = sqlite3.connect('openrep.db')
    cursor = conn.cursor()
    
    tables = ['report', 'user', 'agent']
    for table in tables:
        print(f"\nColumns in {table}:")
        cursor.execute(f"PRAGMA table_info({table})")
        columns = cursor.fetchall()
        for col in columns:
            print(f"  {col[1]} ({col[2]})")
    
    conn.close()

if __name__ == "__main__":
    verify_tables()
