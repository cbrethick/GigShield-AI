from sqlalchemy import text
import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    print("DATABASE_URL not found in .env")
    exit(1)

from sqlalchemy import create_engine
engine = create_engine(DATABASE_URL)

with engine.connect() as conn:
    print("Migrating database...")
    try:
        conn.execute(text("ALTER TABLE riders ADD COLUMN email VARCHAR(100) UNIQUE;"))
        conn.execute(text("CREATE INDEX ix_riders_email ON riders (email);"))
        print("[OK] Added email to riders")
    except Exception as e:
        print(f"[INFO] Skipping riders.email: {e}")

    try:
        conn.execute(text("ALTER TABLE otp_store ADD COLUMN email VARCHAR(100);"))
        conn.execute(text("ALTER TABLE otp_store ALTER COLUMN phone DROP NOT NULL;"))
        conn.execute(text("CREATE INDEX ix_otp_store_email ON otp_store (email);"))
        print("[OK] Added email to otp_store")
    except Exception as e:
        print(f"[INFO] Skipping otp_store.email: {e}")
    
    conn.commit()
    print("Migration complete!")
