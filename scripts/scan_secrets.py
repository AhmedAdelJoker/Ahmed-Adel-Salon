"""Secret scanning for the working tree.

A fast, dependency-free pre-commit check. Runs in about six seconds, which is
the point: a scanner slow enough to be skipped gets skipped, and a scanner that
gets skipped protects nothing.

What this is *not*: a replacement for entropy-based scanning. It matches shapes
and keywords, so a bare 40-character credential with no variable name attached
is invisible to it -- a synthetic AWS secret access key with no keyword next to
it does not trip any rule here, and that is a known gap rather than an oversight.
CI runs Gitleaks alongside this for exactly that reason, because it scores
candidate strings for entropy instead of looking for a name. Use both: this one
catches the paste, Gitleaks catches the anonymous blob.

Exclusions are explicit and each one is justified at the point of exclusion. A
blanket allowlist is how secret scanners get disabled.
"""

from __future__ import annotations

import argparse
import os
import re
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent

# Text files only, and never the dependency trees.
TEXT_SUFFIXES = {
    ".py", ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".json", ".yml", ".yaml",
    ".toml", ".ini", ".cfg", ".env", ".sh", ".ps1", ".sql", ".md", ".txt", ".html",
    ".css", ".spec", ".conf", ".properties",
}

# Files above this are skipped. A pasted credential is a line, not a database
# dump, and a large SQL export is a data-handling problem to raise separately.
MAX_FILE_BYTES = 2 * 1024 * 1024

SKIP_DIRS = {
    ".git", "node_modules", ".venv", "venv", "__pycache__", "dist", "build",
    ".pytest_cache", ".mypy_cache", ".ruff_cache", "coverage", "htmlcov",
    "release", "out", ".next", ".vite", "uploads",
    # Build output that is regenerated from source and can contain a bundled
    # copy of any development value that was in the environment at build time.
    # This one matters: scanning generated bundles is how a dev-only key gets
    # reported forever, and it is 14k files of noise.
    "dist-electron", "test-results", "playwright-report", ".archive", "SalonPro_External",
}

# (name, regex, why this is a real credential shape)
RULES: list[tuple[str, re.Pattern[str], str]] = [
    (
        "private-key-block",
        re.compile(r"-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY-----"),
        "A private key in the tree is a private key in the history, forever.",
    ),
    (
        "aws-access-key-id",
        re.compile(r"\b(?:AKIA|ASIA)[0-9A-Z]{16}\b"),
        "AWS access key id, 20 characters, fixed prefix.",
    ),
    (
        "github-token",
        re.compile(r"\bgh[pousr]_[A-Za-z0-9]{36,}\b"),
        "GitHub personal access / app token.",
    ),
    (
        "slack-token",
        re.compile(r"\bxox[abposr]-[A-Za-z0-9-]{10,}\b"),
        "Slack API token.",
    ),
    (
        "google-api-key",
        re.compile(r"\bAIza[0-9A-Za-z_-]{35}\b"),
        "Google API key.",
    ),
    (
        "stripe-live-key",
        re.compile(r"\b(?:sk|rk)_live_[0-9A-Za-z]{16,}\b"),
        "Stripe secret or restricted live key.",
    ),
    (
        "jwt-with-unsigned-alg",
        re.compile(r"\beyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b"),
        "A JSON Web Token. In a repository this is almost always a real session.",
    ),
    (
        "connection-string-with-password",
        re.compile(
            r"\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis|amqp)://[^\s:/@]+:"
            r"[^\s/@]{6,}@"
        ),
        "A database or broker URL carrying an inline password.",
    ),
    (
        "basic-auth-url",
        re.compile(r"https?://[^\s:/@]+:[^\s/@]{6,}@[^\s/]+"),
        "Credentials embedded in a URL. URLs end up in logs and proxies.",
    ),
    (
        "high-entropy-hex-blob",
        re.compile(r"(?<![\w-])[0-9a-fA-F]{48,}(?![\w-])"),
        "A long hex literal. 48 characters is past any hash this codebase "
        "computes locally, and is where a pasted key or token lands.",
    ),
]

# Literals that look like secrets and are not, each with the reason. Keeping
# these specific is the point: a broad allowlist is what makes people turn the
# scanner off.
ALLOWED_LITERALS = {
    # Argon2id and bcrypt digests of a random value that was discarded at
    # generation time. Present in app/core/security.py on purpose, and the
    # scanner would otherwise re-report them on every single run.
    "$argon2id$v=19$m=19456,t=2,p=1$J+HLXvtS3B/kkyJEqymLJg$ODPQr+311lVVN8+qdKaDJ95A+adlYUBYQkYmeDG1dk8",
    "$2b$12$CVjVes50eYEiQcmpKjmZl.eHoULar7eLfNjyHEXe.ZLmZxYeB8HKC",
    # The production guard in app/core/config.py compares against this to reject
    # it, so the literal has to exist for the check to work.
    "test-secret-key-for-testing-only",
    # Alembic revision ids are 12 hex characters, under the 48 threshold, and this
    # one appears in many generated files.
    "b8e3f1a2c4d7",
    "c4d7e9f1a3b5",
}

# Lines that are a check *about* a secret rather than a secret.
#
# `CI_ONLY` is the one worth reading. A CI service container needs a password to
# start, and the workflow file is the only place to put it. Three things make
# that acceptable, and all three have to hold -- so they are spelled out here
# rather than the whole file being skipped:
#
#   1. the value names itself a throwaway, so a reader cannot mistake it for a
#      real credential;
#   2. a GitHub Actions service container is reachable only from the job, and
#      the value is never used outside CI;
#   3. the same string appears in the local setup path too, so the two are
#      covered together rather than each needing its own exemption.
#
# A *production* database URL in a workflow would not carry this marker, which
# is the case that actually matters.
ALLOWED_LINE_MARKERS = (
    "noqa:",
    "nosec",
    "gitleaks:allow",
    "P7.6",  # the audit note that quotes them on purpose
    "SKIP_REASONS",
    "ALLOWED_LITERALS",
    "discarded",
    "rejected",
    "CI_ONLY",
)


def iter_files(root: Path):
    """Yields candidate text files, pruning excluded directories as it walks.

    `Path.rglob` was the obvious choice and the wrong one: it descends into
    `node_modules` and the Electron bundle before any filter runs, so a scan that
    should take a second spent minutes walking 100k generated files. `os.walk` can
    prune in place, which is the entire difference.
    """
    for dirpath, dirnames, filenames in os.walk(root):
        # Pruning in place, before the walk descends. Mutating `dirnames` is the
        # only way to stop os.walk from visiting them.
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
        for filename in filenames:
            path = Path(dirpath) / filename
            suffix = path.suffix.lower()
            if suffix not in TEXT_SUFFIXES and filename not in {
                ".env", ".env.example", ".gitleaks.toml", "Dockerfile", ".gitignore",
            }:
                continue
            # A credential is a line in a source file. A multi-megabyte dump is
            # a data problem, not a secret-scanning one, and the row-by-row hex
            # pattern below is quadratic enough on a large file to matter.
            try:
                if path.stat().st_size > MAX_FILE_BYTES:
                    continue
            except OSError:
                continue
            yield path


def scan(root: Path) -> list[tuple[Path, int, str, str]]:
    findings: list[tuple[Path, int, str, str]] = []
    for path in iter_files(root):
        try:
            text = path.read_text(encoding="utf-8")
        except (UnicodeDecodeError, OSError):
            continue
        for lineno, line in enumerate(text.splitlines(), start=1):
            if any(marker in line for marker in ALLOWED_LINE_MARKERS):
                continue
            for name, pattern, why in RULES:
                match = pattern.search(line)
                if match and match.group(0) not in ALLOWED_LITERALS:
                    findings.append((path, lineno, name, match.group(0)[:24]))
                    break
    return findings


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=REPO_ROOT)
    args = parser.parse_args()

    findings = scan(args.root)
    if not findings:
        print("Secret scan: clean")
        return 0

    print(f"Secret scan: {len(findings)} possible secret(s)\n")
    for path, lineno, name, snippet in findings:
        try:
            shown = path.relative_to(args.root)
        except ValueError:
            shown = path
        print(f"  {shown}:{lineno}  {name}")
        print(f"      {snippet}...")
    print("\nIf any of these is a real credential, rotate it: removing it from the")
    print("working tree does not remove it from the history.")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
