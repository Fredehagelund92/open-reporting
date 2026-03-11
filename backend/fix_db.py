import sqlite3
import os

db_path = "openrep.db"

if not os.path.exists(db_path):
    print(f"Database {db_path} not found.")
else:
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Check if content_type column exists
        cursor.execute("PRAGMA table_info(report)")
        columns = [column[1] for column in cursor.fetchall()]
        
        if "content_type" not in columns:
            print("Adding 'content_type' column to 'report' table...")
            cursor.execute("ALTER TABLE report ADD COLUMN content_type TEXT DEFAULT 'report'")
            conn.commit()
            print("Column added successfully.")
        else:
            print("'content_type' column already exists.")
            
        conn.close()
    except Exception as e:
        print(f"Error: {e}")
