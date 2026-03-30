from datetime import datetime, timedelta
from jose import JWTError, jwt
from passlib.context import CryptContext
import os
import random
import string
from dotenv import load_dotenv

load_dotenv()

SECRET_KEY = os.getenv("SECRET_KEY", "gigshield-secret-key-change-in-production")
ALGORITHM = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", 10080))

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def generate_otp(length: int = 6) -> str:
    return ''.join(random.choices(string.digits, k=length))

def create_access_token(data: dict, expires_delta: timedelta = None):
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def verify_token(token: str):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        rider_id: str = payload.get("sub")
        if rider_id is None:
            return None
        return rider_id
    except JWTError:
        return None

def send_otp_sms(phone: str, otp: str) -> bool:
    # In production: integrate MSG91 / Twilio
    # For demo: just print (Railway logs will show it)
    print(f"[OTP] Phone: {phone} | OTP: {otp}")
    return True
