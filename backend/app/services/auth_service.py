from datetime import datetime, timedelta
from jose import JWTError, jwt
from passlib.context import CryptContext
import os
import random
import string
import resend
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

# Resend Setup for Email OTP
RESEND_API_KEY = os.getenv("RESEND_API_KEY")
if RESEND_API_KEY:
    resend.api_key = RESEND_API_KEY

def send_email_otp(email: str, otp: str) -> bool:
    """Sends an OTP via Resend email service."""
    if not RESEND_API_KEY:
        print(f"[MOCK EMAIL] To: {email} | OTP: {otp}")
        return True

    try:
        resend.emails.send({
            "from": "GigShield <onboarding@resend.dev>",
            "to": email,
            "subject": f"{otp} is your GigShield verification code",
            "html": f"""
                <div style='font-family: sans-serif; padding: 20px; color: #333;'>
                    <h2>Welcome to GigShield</h2>
                    <p>Your verification code is:</p>
                    <h1 style='color: #007bff; letter-spacing: 5px;'>{otp}</h1>
                    <p>This code will expire in 5 minutes.</p>
                    <hr />
                    <p style='font-size: 12px; color: #666;'>If you didn't request this, please ignore this email.</p>
                </div>
            """
        })
        return True
    except Exception as e:
        print(f"[RESEND] Error: {e}")
        return False

# Firebase Admin Setup
import firebase_admin
from firebase_admin import credentials, auth as firebase_auth

try:
    firebase_json = os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON")
    if firebase_json:
        # Load from environment variable (Best for Render/Railway)
        import json
        firebase_info = json.loads(firebase_json)
        cred = credentials.Certificate(firebase_info)
        firebase_admin.initialize_app(cred)
        print("[FIREBASE] Initialized from Environment Variable")
    else:
        # Fallback to local file
        cred_path = os.getenv("FIREBASE_SERVICE_ACCOUNT_PATH", "firebase-key.json")
        if os.path.exists(cred_path):
            cred = credentials.Certificate(cred_path)
            firebase_admin.initialize_app(cred)
            print(f"[FIREBASE] Initialized from {cred_path}")
        else:
            print("[FIREBASE] Keys not found. Firebase features will run in MOCK mode.")
except Exception as e:
    print(f"[FIREBASE] Init error: {e}")

def verify_firebase_token(id_token: str):
    """Verifies a Firebase ID token and returns identity info."""
    if not id_token or id_token == "dummy_token":
        return {"phone": "+919876500001", "email": "demo@gigshield.ai"} # Demo override

    try:
        decoded_token = firebase_auth.verify_id_token(id_token)
        phone = decoded_token.get("phone_number")
        email = decoded_token.get("email")
        
        if phone:
            phone = phone.replace(" ", "")
            
        return {"phone": phone, "email": email}
    except Exception as e:
        print(f"[FIREBASE] Token verification failed: {e}")
        return None

# Twilio Settings (Keep as secondary or for custom SMS)
TWILIO_ACCOUNT_SID = os.getenv("TWILIO_ACCOUNT_SID")
TWILIO_AUTH_TOKEN = os.getenv("TWILIO_AUTH_TOKEN")
TWILIO_VERIFY_SERVICE_SID = os.getenv("TWILIO_VERIFY_SERVICE_SID")

def send_otp_sms(phone: str, otp: str = None) -> bool:
    """
    Sends an OTP via Twilio Verify. 
    If otp is None, it uses Twilio's built-in Verify generation.
    """
    # In demo mode if keys are missing, just print
    if not TWILIO_ACCOUNT_SID or not TWILIO_AUTH_TOKEN:
        print(f"[MOCK OTP] Phone: {phone} | OTP: {otp}")
        return True

    from twilio.rest import Client
    try:
        client = Client(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
        verification = client.verify.v2.services(TWILIO_VERIFY_SERVICE_SID) \
            .verifications \
            .create(to=phone, channel='sms')
        return verification.status == "pending"
    except Exception as e:
        print(f"Error sending SMS: {str(e)}")
        return False

def verify_sms_otp(phone: str, otp: str) -> bool:
    """Verifies the OTP using Twilio's built-in check."""
    if not TWILIO_ACCOUNT_SID or not TWILIO_AUTH_TOKEN:
        return otp == "123456" # Demo fallback

    from twilio.rest import Client
    try:
        client = Client(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
        check = client.verify.v2.services(TWILIO_VERIFY_SERVICE_SID) \
            .verification_checks \
            .create(to=phone, code=otp)
        return check.status == "approved"
    except Exception as e:
        print(f"Error verifying SMS: {str(e)}")
        return False
