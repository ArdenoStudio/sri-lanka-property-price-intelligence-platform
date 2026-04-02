from db.connection import engine
from sqlalchemy import text
with engine.connect() as conn:
    print("RUNNING_STAT")
    res = conn.execute(text("SELECT count(*) FROM listings")).fetchone()
    print(f"LISTINGS_COUNT: {res[0]}")
    res = conn.execute(text("SELECT district, count(*) FROM listings GROUP BY district")).fetchall()
    for row in res:
        print(f"DISTRICT: {row[0]}, COUNT: {row[1]}")
