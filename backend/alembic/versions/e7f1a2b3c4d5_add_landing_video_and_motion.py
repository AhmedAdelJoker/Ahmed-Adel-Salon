"""Add hero video and motion-control settings to business_settings.

The public landing page can now carry a short hero video and a set of motion
switches. Neither had any storage, so neither could be exposed in the owner
settings panel:

  - `landing_hero_video_url`      the uploaded clip (relative `/uploads/...`)
  - `landing_video_poster_url`    still frame shown before/while the clip loads,
                                  and the permanent fallback when the video is
                                  unsupported, autoplay is blocked, or the
                                  visitor prefers reduced motion
  - `landing_video_autoplay`      loop the clip in the background
  - `landing_video_muted`         required by browsers for autoplay to be
                                  permitted at all; the clip is decorative, so
                                  there is no reason to unmute it
  - `landing_motion_enabled`      master switch for the scroll-reveal and
                                  hover motion on the public site

Video rather than a static poster is the strongest single conversion asset a
salon can have — visitors book off a clip of the room and the work — but it is
also the easiest way to wreck the page: an autoplaying clip that fights the
LCP image, or motion that ignores the OS "reduce motion" setting and reads as
a glitch to anyone who asked for stillness. That is why the poster is stored
separately and why motion has one master switch rather than being implicit in
the components.

Shape follows the existing `landing_*` convention: plain columns on
`business_settings`, snapshotted into `public_site_snapshot` on publish, so the
public site never reads unpublished drafts.

Idempotent on purpose, matching d5e8f2a4b7c1 and b4f1c2d8a90e: a developer
database that booted since the model change may already carry these columns
through `create_all` on a rebuilt table, so `upgrade` must converge rather than
fail on them.
"""

from alembic import op
import sqlalchemy as sa

revision = "e7f1a2b3c4d5"
down_revision = "d5e8f2a4b7c1"
branch_labels = None
depends_on = None


_NEW_COLUMNS = (
    ("landing_hero_video_url", sa.String(500), True, None),
    ("landing_video_poster_url", sa.String(500), True, None),
    ("landing_video_autoplay", sa.Boolean(), True, sa.true()),
    ("landing_video_muted", sa.Boolean(), True, sa.true()),
    ("landing_motion_enabled", sa.Boolean(), True, sa.true()),
)


def _has_table(bind, name: str) -> bool:
    return name in sa.inspect(bind).get_table_names()


def _has_column(bind, table: str, column: str) -> bool:
    if not _has_table(bind, table):
        return False
    return column in {c["name"] for c in sa.inspect(bind).get_columns(table)}


def upgrade() -> None:
    bind = op.get_bind()
    if not _has_table(bind, "business_settings"):
        return
    for name, type_, nullable, server_default in _NEW_COLUMNS:
        if not _has_column(bind, "business_settings", name):
            op.add_column(
                "business_settings",
                sa.Column(name, type_, nullable=nullable, server_default=server_default),
            )


def downgrade() -> None:
    bind = op.get_bind()
    for name, *_ in reversed(_NEW_COLUMNS):
        if _has_column(bind, "business_settings", name):
            op.drop_column("business_settings", name)