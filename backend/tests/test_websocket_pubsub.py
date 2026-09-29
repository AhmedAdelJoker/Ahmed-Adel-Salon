"""Realtime delivery across replicas.

The defect this guards against
------------------------------
`ConnectionManager` held its sockets in a per-process dict, so a broadcast only
reached the users attached to the worker that produced it. Single-replica
development hid it completely; a second replica turned it into "the POS board
sometimes does not update".

The second defect was quieter and worse. `record_invoice_payment` is a sync
endpoint, so FastAPI runs it in a threadpool where no event loop is running.
Its broadcast called `asyncio.ensure_future`, which raises there, and the
surrounding `except Exception` swallowed it. Paying an invoice never refreshed
the POS board — on any deployment — and the only evidence was a log line.

The bus is tested against a fake client, because the properties that matter
(delivery to every process, exactly-once, personal filtering, no re-publish
loop) are properties of the protocol rather than of a live server.

Style note: the project has no `pytest-asyncio` and deliberately keeps every
test synchronous, so each case wraps its body in `asyncio.run` instead of
reaching for a new dependency.
"""

import asyncio
import json
import threading

import pytest

from app.core import limiter
from app.services.websocket import (
    CHANNEL,
    KIND_BROADCAST,
    KIND_PERSONAL,
    ConnectionManager,
)


class FakeSocket:
    """A WebSocket that records what it was sent and can be made to fail."""

    def __init__(self, *, fail: bool = False):
        self.received: list[dict] = []
        self._fail = fail

    async def accept(self, subprotocol=None):
        self.subprotocol = subprotocol

    async def send_json(self, message):
        if self._fail:
            raise RuntimeError("socket is gone")
        self.received.append(message)


class FakePubSub:
    """Hands every published message to a queue the listener reads.

    `listen()` must be an async iterator yielding Redis-shaped envelopes, which
    is the contract `ConnectionManager._listen` consumes via `async for`.
    """

    def __init__(self, broker):
        self._broker = broker
        self.queue: asyncio.Queue = asyncio.Queue()
        self.closed = False

    async def subscribe(self, channel):
        self._broker.subscribers.append(self.queue)

    async def listen(self):
        while not self.closed:
            payload = await self.queue.get()
            yield {"type": "message", "data": payload}

    async def unsubscribe(self, channel):
        pass

    async def aclose(self):
        self.closed = True


class FakeRedis:
    """Enough Redis for pub/sub: publish fans out to every local subscriber."""

    def __init__(self):
        self.subscribers: list[asyncio.Queue] = []
        self.published: list[tuple[str, str]] = []

    def ping(self):
        return True

    def pubsub(self, ignore_subscribe_messages=False):
        return FakePubSub(self)

    def publish(self, channel: str, payload: str) -> int:
        self.published.append((channel, payload))
        for queue in list(self.subscribers):
            queue.put_nowait(payload.encode("utf-8"))
        return len(self.subscribers)


@pytest.fixture(autouse=True)
def _clean():
    limiter.reset_memory()
    limiter.reset_backend_cache()
    yield
    limiter.reset_memory()
    limiter.reset_backend_cache()


@pytest.fixture
def broker(monkeypatch):
    fake = FakeRedis()
    monkeypatch.setattr(limiter, "_build_redis", lambda: fake)
    limiter.reset_backend_cache()
    return fake


async def _settle():
    """Lets the listener drain the queue it was handed."""
    for _ in range(4):
        await asyncio.sleep(0)


def run(coroutine):
    """Executes an already-created coroutine on a fresh loop.

    Call sites pass `body()`, so this takes the coroutine rather than the
    factory.
    """
    return asyncio.run(coroutine)


# --------------------------------------------------------------------------- #
# Delivery to this process
# --------------------------------------------------------------------------- #


def test_broadcast_reaches_every_local_socket():
    async def body():
        mgr = ConnectionManager()
        first, second = FakeSocket(), FakeSocket()
        await mgr.connect(first, user_id=1)
        await mgr.connect(second, user_id=2)

        await mgr.broadcast({"event": "invoice_paid"})

        assert first.received == [{"event": "invoice_paid"}]
        assert second.received == [{"event": "invoice_paid"}]
        assert mgr.local_socket_count() == 2

    run(body())


def test_personal_message_only_reaches_its_owner():
    async def body():
        mgr = ConnectionManager()
        target, bystander = FakeSocket(), FakeSocket()
        await mgr.connect(target, user_id=7)
        await mgr.connect(bystander, user_id=8)

        await mgr.send_personal_message({"event": "yours"}, user_id=7)

        assert target.received == [{"event": "yours"}]
        assert bystander.received == [], "a personal message leaked to another user"

    run(body())


def test_a_dead_socket_is_dropped_not_retried():
    async def body():
        mgr = ConnectionManager()
        broken, healthy = FakeSocket(fail=True), FakeSocket()
        await mgr.connect(broken, user_id=1)
        await mgr.connect(healthy, user_id=1)

        await mgr.broadcast({"event": "x"})

        assert healthy.received == [{"event": "x"}]
        assert mgr.local_socket_count() == 1, "the failed socket stayed registered"

    run(body())


# --------------------------------------------------------------------------- #
# Across replicas
# --------------------------------------------------------------------------- #


def test_broadcast_goes_through_the_bus_when_redis_is_present(broker):
    async def body():
        mgr = ConnectionManager()
        await mgr.start_subscriber()

        await mgr.broadcast({"event": "invoice_paid"})

        assert broker.published, "the message never left this process"
        channel, payload = broker.published[-1]
        assert channel == CHANNEL
        envelope = json.loads(payload)
        assert envelope["kind"] == KIND_BROADCAST
        assert envelope["user_id"] is None
        assert envelope["payload"] == {"event": "invoice_paid"}

    run(body())


def test_personal_message_is_tagged_with_its_recipient(broker):
    async def body():
        mgr = ConnectionManager()
        await mgr.start_subscriber()

        await mgr.send_personal_message({"event": "yours"}, user_id=42)

        envelope = json.loads(broker.published[-1][1])
        assert envelope["kind"] == KIND_PERSONAL
        assert envelope["user_id"] == 42

    run(body())


def test_a_message_from_another_replica_reaches_local_sockets(broker):
    """The behaviour that was missing entirely.

    A second process publishes; this process is subscribed; the socket held here
    must receive it. Before the bus, the dict only ever knew about local sockets.
    """

    async def body():
        mgr = ConnectionManager()
        socket = FakeSocket()
        await mgr.connect(socket, user_id=3)
        await mgr.start_subscriber()
        await _settle()

        # Simulate the other replica: the message is already on the wire.
        broker.publish(
            CHANNEL,
            json.dumps(
                {"kind": KIND_BROADCAST, "user_id": None, "payload": {"event": "from_elsewhere"}}
            ),
        )
        await _settle()

        assert socket.received == [{"event": "from_elsewhere"}]

    run(body())


def test_a_foreign_personal_message_is_filtered_by_recipient(broker):
    async def body():
        mgr = ConnectionManager()
        socket = FakeSocket()
        await mgr.connect(socket, user_id=3)
        await mgr.start_subscriber()
        await _settle()

        broker.publish(
            CHANNEL,
            json.dumps({"kind": KIND_PERSONAL, "user_id": 99, "payload": {"event": "not_yours"}}),
        )
        await _settle()

        assert socket.received == [], "another user's personal message was delivered"

    run(body())


def test_each_socket_receives_a_message_exactly_once(broker):
    """The bug a naive "publish *and* also deliver locally" would introduce."""
    async def body():
        mgr = ConnectionManager()
        socket = FakeSocket()
        await mgr.connect(socket, user_id=3)
        await mgr.start_subscriber()
        await _settle()

        await mgr.broadcast({"event": "once"})
        # Delivery is asynchronous by design: publish puts the envelope on the
        # bus, the listener task picks it up on a later loop iteration, then
        # the socket is written. Asserting immediately would be asserting on
        # scheduling rather than on behaviour.
        await _settle()

        assert socket.received == [{"event": "once"}], (
            f"expected exactly one delivery, got {socket.received}"
        )

    run(body())


def test_a_malformed_envelope_is_discarded_not_fatal(broker):
    async def body():
        mgr = ConnectionManager()
        socket = FakeSocket()
        await mgr.connect(socket, user_id=3)
        await mgr.start_subscriber()
        await _settle()

        broker.publish(CHANNEL, "not json at all")
        await _settle()

        broker.publish(
            CHANNEL,
            json.dumps({"kind": KIND_BROADCAST, "user_id": None, "payload": {"ok": True}}),
        )
        await _settle()

        assert socket.received == [{"ok": True}], "the listener died on bad input"

    run(body())


def test_the_listener_survives_repeated_bad_input(broker):
    async def body():
        mgr = ConnectionManager()
        socket = FakeSocket()
        await mgr.connect(socket, user_id=3)
        await mgr.start_subscriber()
        await _settle()

        for _ in range(3):
            broker.publish(CHANNEL, "{ broken")
            await _settle()

        assert mgr._listener is not None and not mgr._listener.done()

    run(body())


# --------------------------------------------------------------------------- #
# Sync call sites
# --------------------------------------------------------------------------- #


def test_publish_works_from_a_thread_with_no_event_loop(broker):
    """`record_invoice_payment` is a sync endpoint on a worker thread.

    The old code called `asyncio.ensure_future` there, which raises, and the
    surrounding `except` swallowed it — so payment events never reached the POS
    board. Publishing is synchronous and must not need a loop when the bus is
    available.
    """
    mgr = ConnectionManager()
    outcome: dict = {}

    def worker():
        try:
            mgr.publish({"event": "appointment_status_changed", "status": "completed"})
            outcome["ok"] = True
        except BaseException as exc:  # noqa: BLE001 - the assertion is on this
            outcome["error"] = exc

    thread = threading.Thread(target=worker)
    thread.start()
    thread.join(timeout=5)

    assert outcome.get("ok") is True, (
        f"publishing from a worker thread failed: {outcome.get('error')!r}"
    )
    assert broker.published, "the event never reached the bus"


def test_publish_without_a_bus_and_without_a_loop_raises(monkeypatch):
    """Fails loudly rather than dropping the notification.

    The whole point of the rewrite is that a lost event is visible. Silently
    logging a warning is what let the POS bug ship.
    """
    monkeypatch.setattr(limiter, "_build_redis", lambda: None)
    limiter.reset_backend_cache()

    mgr = ConnectionManager()
    with pytest.raises(RuntimeError, match="no event loop bound"):
        mgr.publish({"event": "x"})


def test_publish_hops_back_to_the_bound_loop_without_redis(monkeypatch):
    """Single-process path: work from a thread must reach the sockets' loop."""
    monkeypatch.setattr(limiter, "_build_redis", lambda: None)
    limiter.reset_backend_cache()

    async def body():
        mgr = ConnectionManager()
        mgr.bind_loop(asyncio.get_running_loop())
        socket = FakeSocket()
        await mgr.connect(socket, user_id=5)

        def worker():
            mgr.publish({"event": "from_thread"})

        thread = threading.Thread(target=worker)
        thread.start()
        thread.join(timeout=5)
        await _settle()

        assert socket.received == [{"event": "from_thread"}]

    run(body())


# --------------------------------------------------------------------------- #
# Lifecycle
# --------------------------------------------------------------------------- #


def test_subscriber_start_is_idempotent(broker):
    async def body():
        mgr = ConnectionManager()
        await mgr.start_subscriber()
        first = mgr._listener
        await mgr.start_subscriber()
        assert mgr._listener is first, "a second listener was started for one channel"

    run(body())


def test_stop_releases_the_listener(broker):
    async def body():
        mgr = ConnectionManager()
        await mgr.start_subscriber()
        await mgr.stop_subscriber()
        assert mgr._listener is None

    run(body())


def test_stop_is_safe_when_never_started():
    async def body():
        mgr = ConnectionManager()
        await mgr.stop_subscriber()  # must not raise

    run(body())
