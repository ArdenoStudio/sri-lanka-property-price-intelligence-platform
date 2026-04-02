import os
from dotenv import load_dotenv
load_dotenv()
from db.connection import engine
from sqlalchemy import text
with engine.connect() as conn:
    print("CONNECTION_OK")
    res = conn.execute(text("SELECT count(*) FROM listings"))
    print(f"COUNT: {res.scalar()}")
