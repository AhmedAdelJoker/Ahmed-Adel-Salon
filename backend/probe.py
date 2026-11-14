import sqlite3
c = sqlite3.connect('salon_pro.db')
print(c.execute("select substr(created_at,1,7) m, count(*), sum(total_amount) from invoices group by m order by m desc limit 8").fetchall())
print('appts:', c.execute("select substr(created_at,1,7) m, count(*) from appointments group by m order by m desc limit 8").fetchall())
print('appt cols:', [r[1] for r in c.execute('PRAGMA table_info(appointments)')])
