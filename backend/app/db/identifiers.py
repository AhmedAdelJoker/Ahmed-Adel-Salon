"""Validation for SQL identifiers that have to be interpolated into DDL or
metadata queries.

SQL binds *values* with parameters. It cannot bind *identifiers* -- a table or
index name is part of the statement's grammar, not a slot in it -- so the only
defence available is refusing anything that is not plainly an identifier.

The distinction matters because the alternative is trusting a convention. Every
current caller passes a string literal from this repository, so no injection is
reachable today, and that is exactly the property that makes it easy to add a
caller later that does not hold. `assert_valid_identifier` turns "nobody passes
anything untrusted" from an unwritten assumption into something the process
enforces, and it fails loudly rather than silently building a surprising
statement.
"""

from __future__ import annotations

import re

# Deliberately narrower than SQL allows. No quoting, no dots, no spaces, no
# schema prefixes: every identifier in this schema is a bare lowercase name, and
# anything needing a quote is a signal to write the statement differently.
_IDENTIFIER = re.compile(r"\A[A-Za-z_][A-Za-z0-9_]{0,62}\Z")


def assert_valid_identifier(name: str, *, kind: str = "identifier") -> str:
    """Returns `name` unchanged, or raises if it is not a bare identifier.

    `kind` names the thing being checked so the error message points at the
    caller's mistake rather than at this module.
    """
    if not isinstance(name, str) or not _IDENTIFIER.match(name):
        raise ValueError(
            f"refusing to build SQL: {kind} {name!r} is not a bare SQL identifier "
            "(letters, digits and underscore only, 1-63 characters, not starting "
            "with a digit). Identifiers cannot be passed as bind parameters, so "
            "anything that does not match this shape must not be interpolated."
        )
    return name
