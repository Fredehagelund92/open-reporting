"""
Auth Provider Registry — extensible authentication providers.

To add a new SSO provider:
1. Create a class that extends AuthProvider
2. Add it to PROVIDER_REGISTRY
3. Add the corresponding env vars to config.py
"""

from abc import ABC, abstractmethod
from typing import Optional
from starlette.requests import Request
from starlette.responses import RedirectResponse
from authlib.integrations.starlette_client import OAuth

from app.core.config import settings


# ---------------------------------------------------------------------------
# Abstract Base
# ---------------------------------------------------------------------------


class AuthProvider(ABC):
    """
    Base class for all auth providers.
    Each provider must be able to:
      1. Redirect the user to the external login page
      2. Handle the callback and extract user info
    """

    @property
    @abstractmethod
    def name(self) -> str:
        """Unique provider name, e.g. 'google', 'microsoft', 'okta'."""
        ...

    @property
    @abstractmethod
    def display_name(self) -> str:
        """Human-readable label for the login button, e.g. 'Google Workspace'."""
        ...

    @abstractmethod
    async def login_redirect(self, request: Request) -> RedirectResponse:
        """Return a redirect response to the provider's consent screen."""
        ...

    @abstractmethod
    async def handle_callback(self, request: Request) -> dict:
        """
        Handle the OAuth callback.
        Must return a dict with at least: { email, name, avatar_url }
        """
        ...


# ---------------------------------------------------------------------------
# Google Workspace Provider
# ---------------------------------------------------------------------------

# Shared OAuth instance (lazy-initialised in GoogleAuthProvider)
_oauth = OAuth()


class GoogleAuthProvider(AuthProvider):
    """Google Workspace / Google Account OAuth 2.0 provider."""

    def __init__(self):
        _oauth.register(
            name="google",
            client_id=settings.GOOGLE_CLIENT_ID,
            client_secret=settings.GOOGLE_CLIENT_SECRET,
            server_metadata_url="https://accounts.google.com/.well-known/openid-configuration",
            client_kwargs={"scope": "openid email profile"},
        )

    @property
    def name(self) -> str:
        return "google"

    @property
    def display_name(self) -> str:
        return "Google"

    async def login_redirect(self, request: Request) -> RedirectResponse:
        redirect_uri = str(request.url_for("oauth_callback", provider="google"))
        return await _oauth.google.authorize_redirect(request, redirect_uri)

    async def handle_callback(self, request: Request) -> dict:
        token = await _oauth.google.authorize_access_token(request)
        user_info = token.get("userinfo")
        if not user_info:
            raise ValueError("Could not retrieve user info from Google")

        email: str = user_info["email"]

        # Optional domain restriction
        if settings.GOOGLE_ALLOWED_DOMAIN:
            domain = email.split("@")[1]
            if domain != settings.GOOGLE_ALLOWED_DOMAIN:
                raise PermissionError(
                    f"Only @{settings.GOOGLE_ALLOWED_DOMAIN} accounts are allowed"
                )

        return {
            "email": email,
            "name": user_info.get("name", email.split("@")[0]),
            "avatar_url": user_info.get("picture"),
        }


# ---------------------------------------------------------------------------
# Provider Registry
# ---------------------------------------------------------------------------

# Map of provider name -> class.
# To add a new provider, just add an entry here.
PROVIDER_REGISTRY: dict[str, type[AuthProvider]] = {
    "google": GoogleAuthProvider,
    # Future examples:
    # "microsoft": MicrosoftAuthProvider,
    # "okta": OktaAuthProvider,
}


def get_active_provider() -> Optional[AuthProvider]:
    """
    Return the configured auth provider instance, or None if AUTH_PROVIDER is 'local'.
    """
    provider_name = settings.AUTH_PROVIDER.lower()
    if provider_name == "local":
        return None

    provider_class = PROVIDER_REGISTRY.get(provider_name)
    if not provider_class:
        raise ValueError(
            f"Unknown AUTH_PROVIDER '{provider_name}'. "
            f"Available: {', '.join(['local'] + list(PROVIDER_REGISTRY.keys()))}"
        )
    return provider_class()
