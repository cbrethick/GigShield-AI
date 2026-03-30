from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.models.models import Rider
from app.services.auth_service import verify_token

security = HTTPBearer()

def get_current_rider(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
) -> Rider:
    token = credentials.credentials
    rider_id = verify_token(token)
    if not rider_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    rider = db.query(Rider).filter(Rider.id == rider_id).first()
    if not rider:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Rider not found")
    return rider
