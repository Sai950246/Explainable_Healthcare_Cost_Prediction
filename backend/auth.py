from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from pymongo import MongoClient
import hashlib

router = APIRouter(prefix="/auth", tags=["auth"])

client = MongoClient("mongodb://localhost:27017/")
db = client["medical_costs_db"]
users = db["users"]

# Utils
def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()


# Schemas
class RegisterInput(BaseModel):
    username: str
    email: str
    password: str

class LoginInput(BaseModel):
    email: str
    password: str


# Routes
@router.post("/register")
def register(data: RegisterInput):
    if users.find_one({"email": data.email}):
        raise HTTPException(status_code=400, detail="User already exists")

    users.insert_one({
        "username": data.username,
        "email": data.email,
        "password": hash_password(data.password)
    })

    return {"message": "User registered successfully"}


@router.post("/login")
def login(data: LoginInput):
    user = users.find_one({"email": data.email})

    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    if user["password"] != hash_password(data.password):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    return {
        "token": "simple-login-token",
        "user": {
            "username": user["username"],
            "email": user["email"]
        }
    }