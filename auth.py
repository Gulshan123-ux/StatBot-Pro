from fastapi import APIRouter, HTTPException, Depends, Header
from pydantic import BaseModel, EmailStr, Field
import jwt
import datetime
import os
from app.services import db

router = APIRouter()

JWT_SECRET = os.getenv("JWT_SECRET", "statbot_secret_super_key_12345!")
JWT_ALGORITHM = "HS256"
TOKEN_EXPIRATION_HOURS = 24

# Pydantic models for request/response validation
class SignUpRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=20)
    email: EmailStr
    password: str = Field(..., min_length=6)

class LoginRequest(BaseModel):
    username_or_email: str = Field(..., min_length=3)
    password: str = Field(..., min_length=6)

class UserResponse(BaseModel):
    id: int
    username: str
    email: str

class LoginResponse(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse

def create_access_token(user_id: int, username: str) -> str:
    payload = {
        "sub": str(user_id),
        "username": username,
        "exp": datetime.datetime.utcnow() + datetime.timedelta(hours=TOKEN_EXPIRATION_HOURS)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def verify_token(authorization: str = Header(...)) -> dict:
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid token scheme. Must be Bearer token.")
    
    token = authorization.split(" ")[1]
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired.")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token.")

@router.post("/signup", response_model=dict)
async def signup(req: SignUpRequest):
    # Check if username exists
    if db.get_user_by_username(req.username):
        raise HTTPException(status_code=400, detail="Username is already taken.")
    # Check if email exists
    if db.get_user_by_email(req.email):
        raise HTTPException(status_code=400, detail="Email is already registered.")
    
    try:
        user_id = db.create_user(req.username, req.email, req.password)
        return {"status": "success", "message": "User registered successfully.", "user_id": user_id}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/login", response_model=LoginResponse)
async def login(req: LoginRequest):
    # Retrieve user by username or email
    user = db.get_user_by_username(req.username_or_email)
    if not user:
        user = db.get_user_by_email(req.username_or_email)
        
    if not user:
        raise HTTPException(status_code=401, detail="Invalid username or password.")
        
    # Verify password
    if not db.verify_password(req.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid username or password.")
        
    token = create_access_token(user["id"], user["username"])
    
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user["id"],
            "username": user["username"],
            "email": user["email"]
        }
    }

@router.get("/me", response_model=UserResponse)
async def get_current_user(payload: dict = Depends(verify_token)):
    user_id = int(payload.get("sub"))
    user = db.get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    return {
        "id": user["id"],
        "username": user["username"],
        "email": user["email"]
    }
