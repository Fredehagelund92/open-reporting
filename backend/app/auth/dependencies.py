from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlmodel import Session, select
import jwt
from typing import Annotated, Optional

from app.database import get_session
from app.models import User, Space, SpaceAccess
from app.auth.security import SECRET_KEY, ALGORITHM

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/token", auto_error=False)

def get_current_user_optional(
    token: Annotated[Optional[str], Depends(oauth2_scheme)],
    session: Annotated[Session, Depends(get_session)]
) -> Optional[User]:
    if not token:
        return None
        
    import os
    # Development bypass for mock user
    if token == "fake-token" and os.getenv("ENVIRONMENT") == "development":
        user = session.exec(select(User).where(User.email == "alex@company.com")).first()
        if user:
            return user
            
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            return None
    except jwt.InvalidTokenError:
        return None
    
    user = session.get(User, user_id)
    if not user or not user.is_active:
        return None
    return user

def get_current_user(
    current_user: Annotated[Optional[User], Depends(get_current_user_optional)]
) -> User:
    if not current_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not current_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is deactivated",
        )
    return current_user

def require_admin(current_user: Annotated[User, Depends(get_current_user)]) -> User:
    if current_user.role != "ADMIN":
        raise HTTPException(status_code=403, detail="Not enough permissions")
    return current_user

def get_space_or_404(space_id: str, session: Session) -> Space:
    space = session.get(Space, space_id)
    if not space:
        raise HTTPException(status_code=404, detail="Space not found")
    return space

def require_space_access(
    space_id: str,
    session: Annotated[Session, Depends(get_session)],
    current_user: Annotated[Optional[User], Depends(get_current_user_optional)]
) -> Space:
    space = get_space_or_404(space_id, session)
    
    if not space.is_private:
        return space
        
    if not current_user:
        raise HTTPException(status_code=401, detail="Authentication required for private space")
        
    if current_user.role == "ADMIN" or space.owner_id == current_user.id:
        return space
        
    # Check SpaceAccess
    access = session.exec(select(SpaceAccess).where(
        SpaceAccess.space_id == space_id,
        SpaceAccess.user_id == current_user.id
    )).first()
    
    if not access:
        raise HTTPException(status_code=403, detail="Not authorized to access this space")
        
    return space
