"""
Generic OAuth routes — works with any registered auth provider.

These routes are only active when AUTH_PROVIDER is NOT 'local'.
"""

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import RedirectResponse
from sqlmodel import select

from app.database import get_session_ctx
from app.models import User, RefreshToken
from app.auth.security import (
    create_access_token,
    create_refresh_token,
    REFRESH_TOKEN_EXPIRE_DAYS,
)
from app.auth.providers import get_active_provider
from app.core.config import settings

router = APIRouter(prefix="/api/v1/auth", tags=["OAuth"])


# ---------------------------------------------------------------------------
# Discovery endpoint — frontend calls this to know which login to show
# ---------------------------------------------------------------------------


@router.get("/providers")
def list_providers():
    """Return the active auth provider for this deployment."""
    provider = get_active_provider()
    if provider:
        return {
            "provider": provider.name,
            "display_name": provider.display_name,
        }
    return {
        "provider": "local",
        "display_name": "Email & Password",
    }


# ---------------------------------------------------------------------------
# OAuth Login + Callback (only active for non-local providers)
# ---------------------------------------------------------------------------


@router.get("/{provider}/login")
async def oauth_login(provider: str, request: Request):
    """Redirect to the external provider's consent screen."""
    active = get_active_provider()
    if not active or active.name != provider:
        raise HTTPException(
            status_code=404, detail=f"Provider '{provider}' is not enabled"
        )
    return await active.login_redirect(request)


@router.get("/{provider}/callback", name="oauth_callback")
async def oauth_callback(provider: str, request: Request):
    """
    Handle the provider's redirect callback.
    Creates a local user if needed, mints a JWT, and redirects to the frontend.
    """
    active = get_active_provider()
    if not active or active.name != provider:
        raise HTTPException(
            status_code=404, detail=f"Provider '{provider}' is not enabled"
        )

    try:
        user_info = await active.handle_callback(request)
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"OAuth error: {e}")

    # Find or create user
    with get_session_ctx() as session:
        user = session.exec(
            select(User).where(User.email == user_info["email"])
        ).first()

        if not user:
            user = User(
                email=user_info["email"],
                name=user_info["name"],
                avatar_url=user_info.get("avatar_url"),
                provider=provider,
            )
            session.add(user)
            session.commit()
            session.refresh(user)
        else:
            # Update avatar/name from provider if they changed
            changed = False
            if (
                user_info.get("avatar_url")
                and user.avatar_url != user_info["avatar_url"]
            ):
                user.avatar_url = user_info["avatar_url"]
                changed = True
            if user_info.get("name") and user.name != user_info["name"]:
                user.name = user_info["name"]
                changed = True
            if changed:
                session.add(user)
                session.commit()
                session.refresh(user)

        token = create_access_token(data={"sub": user.id})
        raw_refresh, refresh_hash = create_refresh_token()
        rt = RefreshToken(
            user_id=user.id,
            token_hash=refresh_hash,
            expires_at=datetime.now(timezone.utc)
            + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS),
        )
        session.add(rt)
        session.commit()

    # Redirect to frontend callback page with the JWT and refresh token
    frontend_url = settings.VITE_FRONTEND_BASE_URL.rstrip("/")
    if not frontend_url.startswith(("http://", "https://")):
        frontend_url = f"https://{frontend_url}"

    return RedirectResponse(
        url=f"{frontend_url}/auth/callback?token={token}&refresh_token={raw_refresh}"
    )
