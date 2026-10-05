"""Realtime delivery across replicas.

The problem
-----------
`ConnectionManager` kept its sockets in a dict inside one process. Every worker
therefore only ever saw its own connections, so a broadcast reached the users
attached to the worker that produced it and nobody else. On a single-replica
install that is invisible. The moment a second worker is added, a cashier on
replica 2 never sees the POS board update after a payment on replica 1.

A second, quieter defect sat behind it. `record_invoice_payment` is a *sync*
endpoint, so FastAPI runs it in a threadpool where no event loop is running.
Its broadcast called `asyncio.ensure_future`, which raises there — and the call
was wrapped in `except Exception: logger.warning(...)`, so the event was
silently discarded. Paying an invoice never updated the POS board live, on any
deployment, and the warning was easy to miss.

The design
----------
`publish` is **synchronous**. That single decision removes the event-loop
problem from every call site, sync or async, and there is no `try/except`
around it any more: a publish either works or raises, so a dropped event is
visible instead of silent.

Delivery has exactly one path, chosen by whether Redis is available:

    Redis present   publish ──PUBLISH──▶ every process's subscriber ──▶ local sockets
    Redis absent    publish ─────────────────────────────────────────▶ local sockets

Both routes end in `_deliver_local`, and the subscriber never re-publishes, so
a socket receives each message exactly once. Publishing *and* delivering
locally as well would double every notification.

The socket objects are owned by one event loop, so the Redis-less fallback has
to get back onto that loop — from a threadpool thread that is exactly what
`run_coroutine_threadsafe` is for, and the reason `bind_loop` exists.

Personal messages go through Redis too. A load balancer without sticky
sessions hands a user a different socket per request, so "send to user 7" is
just a broadcast with a filter applied by whichever process holds their socket.
"""

from __future__ import annotations

import asyncio
import json
import logging
from typing import Dict, List

from fastapi import WebSocket

from app.core import limiter

logger = logging.getLogger(__name__)

CHANNEL = "salonpro:ws"

KIND_BROADCAST = "broadcast"
KIND_PERSONAL = "personal"


class ConnectionManager:
    """Owns the local sockets and, when configured, the shared message bus."""

    def __init__(self) -> None:
        self._connections: Dict[int, List[WebSocket]] = {}
        self._pubsub = None
        self._listener: asyncio.Task | None = None
        self._loop: asyncio.AbstractEventLoop | None = None

    # -- lifecycle ---------------------------------------------------------

    def bind_loop(self, loop: asyncio.AbstractEventLoop) -> None:
        """Records the loop that owns the sockets.

        Called from the application lifespan. A sync endpoint runs on a worker
        thread, so it cannot `await` its way back to the sockets; it needs a
        handle on the loop to hand the work to.
        """
        self._loop = loop

    async def start_subscriber(self) -> None:
        """Begins listening on the shared channel. Idempotent."""
        client = limiter._client()
        if client is None:
            logger.info("Realtime running in single-process mode (no Redis).")
            return
        if self._listener is not None and not self._listener.done():
            return
        self._pubsub = client.pubsub(ignore_subscribe_messages=True)
        await self._pubsub.subscribe(CHANNEL)
        self._listener = asyncio.create_task(self._listen(), name="ws-bus-listener")
        logger.info("Realtime subscribed to %s.", CHANNEL)

    async def stop_subscriber(self) -> None:
        if self._listener is not None:
            self._listener.cancel()
            try:
                await self._listener
            except (asyncio.CancelledError, Exception):  # noqa: B014
                pass
            self._listener = None
        if self._pubsub is not None:
            try:
                await self._pubsub.unsubscribe(CHANNEL)
                await self._pubsub.aclose()
            except Exception:  # pragma: no cover
                logger.debug("Pub/Sub close failed during shutdown", exc_info=True)
            self._pubsub = None

    async def _listen(self) -> None:
        """Fan-out task. Delivers locally and never re-publishes."""
        # A real check, not an `assert`. Under `python -O` the assert is compiled
        # out and this task would hold a `None` pubsub for its whole lifetime,
        # which is a connection that reports itself subscribed and delivers
        # nothing -- the exact failure that looks like "the POS board sometimes
        # does not update" and is invisible in any log.
        pubsub = self._pubsub
        if pubsub is None:
            logger.warning("Realtime listener started with no pub/sub; no cross-replica events will arrive")
            return
        try:
            async for raw in pubsub.listen():
                if raw is None or raw.get("type") != "message":
                    continue
                payload = raw.get("data")
                if payload is None:
                    continue
                if isinstance(payload, (bytes, bytearray)):
                    payload = payload.decode("utf-8", "replace")
                try:
                    envelope = json.loads(payload)
                except (TypeError, ValueError):
                    logger.warning("Discarding malformed realtime envelope")
                    continue
                await self._deliver_local(
                    envelope.get("payload") or {},
                    user_id=envelope.get("user_id"),
                )
        except asyncio.CancelledError:  # pragma: no cover - shutdown path
            raise
        except Exception as exc:  # pragma: no cover - depends on the bus
            logger.error("Realtime listener died: %s", exc)

    # -- connection registry ----------------------------------------------

    async def connect(
        self,
        websocket: WebSocket,
        user_id: int,
        subprotocol: str | None = None,
    ) -> None:
        await websocket.accept(subprotocol=subprotocol)
        self._connections.setdefault(user_id, []).append(websocket)
        logger.info(
            "WebSocket connected: user=%s local_sockets=%d",
            user_id,
            len(self._connections[user_id]),
        )

    def disconnect(self, websocket: WebSocket, user_id: int) -> None:
        connections = self._connections.get(user_id)
        if not connections:
            return
        if websocket in connections:
            connections.remove(websocket)
        if not connections:
            self._connections.pop(user_id, None)

    def local_socket_count(self) -> int:
        return sum(len(sockets) for sockets in self._connections.values())

    # -- delivery ----------------------------------------------------------

    async def _deliver_local(self, message: dict, *, user_id: int | None) -> None:
        """Pushes to the sockets held by *this* process, and only those."""
        if user_id is None:
            for owner, connections in list(self._connections.items()):
                for connection in list(connections):
                    await self._send(connection, message, owner)
            return

        for connection in list(self._connections.get(user_id, [])):
            await self._send(connection, message, user_id)

    async def _send(self, connection: WebSocket, message: dict, user_id: int) -> None:
        try:
            await connection.send_json(message)
        except Exception:
            # A socket that has gone away is normal: laptops sleep, phones
            # change network. Drop it rather than retrying into a dead handle.
            self.disconnect(connection, user_id)

    # -- publishing --------------------------------------------------------

    def _envelope(self, message: dict, user_id: int | None) -> str:
        return json.dumps(
            {
                "kind": KIND_PERSONAL if user_id is not None else KIND_BROADCAST,
                "user_id": user_id,
                "payload": message,
            },
            ensure_ascii=False,
        )

    def publish(self, message: dict, *, user_id: int | None = None) -> None:
        """Sends a message to every process. Safe from any thread.

        Synchronous on purpose: a sync endpoint runs on a worker thread, so it
        cannot `await` its way back to the sockets that live on the app's loop.
        Going through the bus removes the need to, and takes the
        `asyncio.ensure_future` + `try/except` dance that was silently
        discarding payment events.
        """
        client = limiter._client()
        if client is not None:
            client.publish(CHANNEL, self._envelope(message, user_id))
            return

        loop = self._loop
        if loop is None:
            raise RuntimeError(
                "Realtime has no event loop bound and no Redis. "
                "Call manager.bind_loop() from the application lifespan, or set "
                "REDIS_URL so the message goes through the bus."
            )

        coroutine = self._deliver_local(message, user_id=user_id)
        asyncio.run_coroutine_threadsafe(coroutine, loop)

    # -- call-site API -----------------------------------------------------

    async def send_personal_message(self, message: dict, user_id: int) -> None:
        """Delivers to one user, wherever their socket is connected.

        For async call sites. A sync endpoint should call `publish` instead.
        """
        client = limiter._client()
        if client is not None:
            self.publish(message, user_id=user_id)
            return
        await self._deliver_local(message, user_id=user_id)

    async def broadcast(self, message: dict) -> None:
        """Delivers to every connected user, on every replica.

        For async call sites. A sync endpoint should call `publish` instead.
        """
        client = limiter._client()
        if client is not None:
            self.publish(message)
            return
        await self._deliver_local(message, user_id=None)

    async def reset(self) -> None:
        """Drops all state. Used by the test suite."""
        await self.stop_subscriber()
        self._connections.clear()
        self._loop = None


# One manager per process. Every module that emits a realtime event imports
# this, so there is a single bus per worker and a single subscriber to it.
manager = ConnectionManager()
