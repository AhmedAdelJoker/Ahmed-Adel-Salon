import sqlite3

def check_db():
    conn = sqlite3.connect('backend/salon_pro.db')
    cursor = conn.cursor()
    
    tables = ['users', 'barbers', 'services', 'products', 'expenses', 'business_settings']
    for table in tables:
        cursor.execute(f"SELECT COUNT(*) FROM {table}")
        count = cursor.fetchone()[0]
        print(f"Table {table}: {count} rows")
    
    conn.close()

if __name__ == "__main__":
    check_db()
