"""
Univention SSO Integration for LLM application.

Supports:
- OpenID Connect (Keycloak or Univention OIDC Provider)
- SAML (optional)

Relies on config/univention-integration.yaml for settings and environment variables.
"""
from __future__ import annotations

import json
import logging
import os
from dataclasses import dataclass
from typing import Any, Dict, Optional

import requests

logger = logging.getLogger(__name__)


def _env(name: str, default: Optional[str] = None) -> Optional[str]:
    return os.getenv(name, default)


@dataclass
class OIDCConfig:
    issuer: str
    client_id: str
    client_secret: Optional[str]
    redirect_uri: str
    scope: str = "openid profile email"
    verify_ssl: bool = True


class OIDCClient:
    def __init__(self, cfg: OIDCConfig):
        self.cfg = cfg
        self._endpoints: Optional[Dict[str, str]] = None

    def _discover(self) -> Dict[str, str]:
        if self._endpoints:
            return self._endpoints
        well_known = self.cfg.issuer.rstrip("/") + "/.well-known/openid-configuration"
        logger.debug("Fetching OIDC discovery document from %s", well_known)
        resp = requests.get(well_known, timeout=10, verify=self.cfg.verify_ssl)
        resp.raise_for_status()
        data = resp.json()
        self._endpoints = {
            "authorization_endpoint": data["authorization_endpoint"],
            "token_endpoint": data["token_endpoint"],
            "userinfo_endpoint": data.get("userinfo_endpoint"),
            "jwks_uri": data.get("jwks_uri"),
            "end_session_endpoint": data.get("end_session_endpoint"),
        }
        logger.debug("Discovered OIDC endpoints: %s", self._endpoints)
        return self._endpoints

    def authorization_url(self, state: str, nonce: str) -> str:
        eps = self._discover()
        from urllib.parse import urlencode

        params = {
            "client_id": self.cfg.client_id,
            "response_type": "code",
            "scope": self.cfg.scope,
            "redirect_uri": self.cfg.redirect_uri,
            "state": state,
            "nonce": nonce,
        }
        url = f"{eps['authorization_endpoint']}?{urlencode(params)}"
        logger.debug("Constructed authorization URL: %s", url)
        return url

    def exchange_code(self, code: str) -> Dict[str, Any]:
        eps = self._discover()
        data = {
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": self.cfg.redirect_uri,
            "client_id": self.cfg.client_id,
        }
        auth = None
        if self.cfg.client_secret:
            auth = (self.cfg.client_id, self.cfg.client_secret)
        logger.debug("Exchanging code for tokens at %s", eps["token_endpoint"])
        resp = requests.post(
            eps["token_endpoint"], data=data, auth=auth, timeout=10, verify=self.cfg.verify_ssl
        )
        resp.raise_for_status()
        tokens = resp.json()
        logger.debug("Token response: %s", json.dumps(tokens))
        return tokens

    def userinfo(self, access_token: str) -> Dict[str, Any]:
        eps = self._discover()
        if not eps.get("userinfo_endpoint"):
            raise RuntimeError("userinfo_endpoint not provided by issuer")
        headers = {"Authorization": f"Bearer {access_token}"}
        logger.debug("Fetching userinfo from %s", eps["userinfo_endpoint"])
        resp = requests.get(
            eps["userinfo_endpoint"], headers=headers, timeout=10, verify=self.cfg.verify_ssl
        )
        resp.raise_for_status()
        return resp.json()


def load_oidc_from_env() -> Optional[OIDCClient]:
    issuer = _env("OIDC_ISSUER_URL") or _env("KEYCLOAK_SERVER_URL")
    if not issuer:
        logger.info("OIDC issuer not configured; SSO disabled")
        return None
    client_id = _env("KEYCLOAK_CLIENT_ID") or _env("OIDC_CLIENT_ID") or "llm-app"
    client_secret = _env("KEYCLOAK_CLIENT_SECRET") or _env("OIDC_CLIENT_SECRET")
    app_url = _env("APP_URL", "http://localhost:3000")
    redirect_uri = f"{app_url.rstrip('/')}/auth/callback"
    verify_ssl = _env("OIDC_VERIFY_SSL", "true").lower() == "true"

    cfg = OIDCConfig(
        issuer=issuer,
        client_id=client_id,
        client_secret=client_secret,
        redirect_uri=redirect_uri,
        verify_ssl=verify_ssl,
    )
    return OIDCClient(cfg)


__all__ = ["OIDCClient", "OIDCConfig", "load_oidc_from_env"]
