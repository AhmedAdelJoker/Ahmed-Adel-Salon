"""`run_backend.py` refuses a second start with a message that names the cause.

Started by hand or double-clicked as the frozen exe, a second instance used to
hand a busy port straight to uvicorn and die on `[WinError 10013] An attempt
was made to access a socket in a way forbidden by its access permissions` — an
error that names neither the port nor the process holding it, and that reads
like a firewall or permissions problem. `run.ps1` has guarded its own launch
with Assert-PortFree for a while; the frozen-exe path had no equivalent.
"""
import os
import socket

import run_backend


def _listening_socket():
    listener = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    listener.bind(("127.0.0.1", 0))
    listener.listen(1)
    return listener


def test_reports_the_process_that_holds_the_port():
    with _listening_socket() as listener:
        port = listener.getsockname()[1]
        owner = run_backend.port_owner("127.0.0.1", port)

    assert owner is not None, "a listening socket must be reported as an owner"
    assert str(os.getpid()) in owner, "the owner should name the holding PID"


def test_a_free_port_is_reported_as_free():
    with _listening_socket() as listener:
        port = listener.getsockname()[1]

    assert run_backend.port_owner("127.0.0.1", port) is None


def test_a_wildcard_bind_is_probed_on_loopback():
    with _listening_socket() as listener:
        port = listener.getsockname()[1]
        owner = run_backend.port_owner("0.0.0.0", port)

    assert owner is not None, "0.0.0.0 must be probed through 127.0.0.1"


def test_main_refuses_and_names_the_port(capsys, monkeypatch):
    with _listening_socket() as listener:
        port = listener.getsockname()[1]
        monkeypatch.setenv("BACKEND_HOST", "127.0.0.1")
        monkeypatch.setenv("BACKEND_PORT", str(port))
        code = run_backend.main()

    stderr = capsys.readouterr().err
    assert code == 1, "a refused start must exit non-zero"
    assert f":{port} is already in use" in stderr
    assert "stop.ps1" in stderr, "the message should say how to recover"
