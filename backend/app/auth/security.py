from datetime import datetime, timedelta, timezone
import os
from passlib.context import CryptContext
import jwt

# To get a string like this run:
# openssl rand -hex 32
DEFAULT_SECRET_KEY = "df17a3a936a2cdfc183faeebfac3db258bfecb164a66e5114b73bcf3d4ae2cd8"
SECRET_KEY = os.getenv("SECRET_KEY", DEFAULT_SECRET_KEY)
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30 * 24 * 60  # 30 Days

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def ensure_secure_secret_key() -> None:
    """Block default JWT secret usage outside local/dev environments."""
    environment = (os.getenv("ENVIRONMENT") or "development").strip().lower()
    if environment not in {"development", "dev", "test", "local"} and SECRET_KEY == DEFAULT_SECRET_KEY:
        raise RuntimeError(
            "Insecure SECRET_KEY detected. Set a unique SECRET_KEY before starting in non-development environments."
        )

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: timedelta | None = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt
