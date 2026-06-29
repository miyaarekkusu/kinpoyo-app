from datetime import date, datetime
from decimal import Decimal
from typing import Optional, TYPE_CHECKING
from sqlalchemy import Integer, SmallInteger, Numeric, Boolean, Date, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.user import User
    from app.models.master import GoalType, MeasurementUnit


class BodyGoal(Base, TimestampMixin):
    __tablename__ = "body_goals"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    goal_type_id: Mapped[int] = mapped_column(
        SmallInteger, ForeignKey("goal_types.id"), nullable=False
    )
    target_value: Mapped[Decimal] = mapped_column(Numeric(6, 2), nullable=False)
    current_value: Mapped[Optional[Decimal]] = mapped_column(Numeric(6, 2))
    unit_id: Mapped[int] = mapped_column(
        SmallInteger, ForeignKey("measurement_units.id"), nullable=False
    )
    deadline: Mapped[Optional[date]] = mapped_column(Date)
    is_achieved: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    achieved_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    user: Mapped["User"] = relationship(back_populates="body_goals")
    goal_type: Mapped["GoalType"] = relationship()
    unit: Mapped["MeasurementUnit"] = relationship()
