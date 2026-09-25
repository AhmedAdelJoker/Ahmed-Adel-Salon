from datetime import datetime

from alembic import op
import sqlalchemy as sa

revision = "b8e2f3a4c5d6"
down_revision = "a9d1e2f3b4c5"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if not inspector.has_table("invoice_counters"):
        op.create_table(
            "invoice_counters",
            sa.Column("counter_date", sa.Date(), nullable=False),
            sa.Column("last_number", sa.Integer(), nullable=False, server_default="0"),
            sa.PrimaryKeyConstraint("counter_date"),
        )

    if not inspector.has_table("invoices"):
        return

    last_numbers = {}
    for (invoice_no,) in bind.execute(
        sa.text("SELECT invoice_no FROM invoices WHERE invoice_no LIKE 'INV-%'")
    ).fetchall():
        try:
            prefix, number = str(invoice_no).rsplit("-", 1)
            if not prefix.startswith("INV-"):
                continue
            date_text = prefix.removeprefix("INV-")
            parsed_date = datetime.strptime(date_text, "%Y%m%d").date()
            last_numbers[parsed_date] = max(
                last_numbers.get(parsed_date, 0),
                int(number),
            )
        except (TypeError, ValueError):
            continue

    counter_table = sa.table(
        "invoice_counters",
        sa.column("counter_date", sa.Date()),
        sa.column("last_number", sa.Integer()),
    )
    existing_rows = {
        row[0]: row[1]
        for row in bind.execute(
            sa.text("SELECT counter_date, last_number FROM invoice_counters")
        ).fetchall()
    }
    for counter_date, last_number in last_numbers.items():
        current = existing_rows.get(counter_date, 0)
        if last_number > current:
            bind.execute(
                counter_table.update()
                .where(counter_table.c.counter_date == counter_date)
                .values(last_number=last_number)
            )
            if counter_date not in existing_rows:
                bind.execute(
                    counter_table.insert().values(
                        counter_date=counter_date,
                        last_number=last_number,
                    )
                )


def downgrade() -> None:
    if sa.inspect(op.get_bind()).has_table("invoice_counters"):
        op.drop_table("invoice_counters")
