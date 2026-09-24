"""Google Play purchase verification (Android Publisher API v3, purchases.products.get).

Needs a Google Cloud service account that has been granted access in Play Console
(Users and permissions -> "View financial data, orders and cancellation survey responses").
"""
import asyncio
import json
import logging
import os
from dataclasses import dataclass
from typing import Optional

import httpx

logger = logging.getLogger(__name__)

SCOPE = "https://www.googleapis.com/auth/androidpublisher"
API = "https://androidpublisher.googleapis.com/androidpublisher/v3/applications"


@dataclass
class PlayPurchase:
    state: str  # "purchased" | "pending" | "cancelled" | "invalid"
    order_id: Optional[str] = None
    is_test: bool = False
    consumed: bool = False


class PlayVerifier:
    def __init__(self, package_name: str, service_account_file: Optional[str]):
        self.package_name = package_name
        self.service_account_file = service_account_file
        self._credentials = None
        self._lock = asyncio.Lock()

    @property
    def configured(self) -> bool:
        return bool(self.service_account_file and os.path.exists(self.service_account_file))

    async def _access_token(self) -> str:
        # google-auth is synchronous: refresh in a worker thread, shared behind a lock.
        from google.auth.transport.requests import Request
        from google.oauth2 import service_account

        async with self._lock:
            if self._credentials is None:
                with open(self.service_account_file) as f:
                    info = json.load(f)
                self._credentials = service_account.Credentials.from_service_account_info(info, scopes=[SCOPE])
            if not self._credentials.valid:
                await asyncio.to_thread(self._credentials.refresh, Request())
            return self._credentials.token

    async def verify_product(self, product_id: str, purchase_token: str) -> PlayPurchase:
        token = await self._access_token()
        url = f"{API}/{self.package_name}/purchases/products/{product_id}/tokens/{purchase_token}"
        async with httpx.AsyncClient(timeout=10) as http:
            r = await http.get(url, headers={"Authorization": f"Bearer {token}"})
        if r.status_code in (400, 404, 410):
            return PlayPurchase(state="invalid")
        r.raise_for_status()
        data = r.json()
        # purchaseState: 0 purchased, 1 cancelled, 2 pending
        state = {0: "purchased", 1: "cancelled", 2: "pending"}.get(data.get("purchaseState"), "invalid")
        return PlayPurchase(
            state=state,
            order_id=data.get("orderId"),
            is_test=data.get("purchaseType") == 0,  # license tester purchase
            consumed=data.get("consumptionState") == 1,
        )
