from datetime import date
from typing import Optional

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models.program import Program, UserProgram
from app.schemas.program import ProgramOut, UserProgramOut

STATUS_ACTIVE = 1


class AlreadyJoinedError(Exception):
    pass


def program_to_out(program: Program) -> ProgramOut:
    return ProgramOut(
        id=program.id,
        name=program.name,
        description=program.description,
        category_id=program.category_id,
        category_name=program.category.name_ja if program.category else None,
        difficulty_level_id=program.difficulty_level_id,
        difficulty_name=program.difficulty_level.name_ja if program.difficulty_level else None,
        duration_weeks=program.duration_weeks,
        frequency_per_week=program.frequency_per_week,
        thumbnail_url=program.thumbnail_url,
        is_public=program.is_public,
    )


def user_program_to_out(user_program: UserProgram) -> UserProgramOut:
    return UserProgramOut(
        id=user_program.id,
        program_id=user_program.program_id,
        program_name=user_program.program.name,
        status_id=user_program.status_id,
        status_code=user_program.status.code,
        current_week=user_program.current_week,
        current_day=user_program.current_day,
        started_at=user_program.started_at,
        completed_at=user_program.completed_at,
    )


def list_programs(db: Session) -> list[Program]:
    stmt = (
        select(Program)
        .where(Program.is_public.is_(True))
        .options(selectinload(Program.category), selectinload(Program.difficulty_level))
        .order_by(Program.id)
    )
    return list(db.scalars(stmt).all())


def get_program(db: Session, program_id: int) -> Optional[Program]:
    return db.get(Program, program_id)


def get_user_program(db: Session, user_program_id: int) -> Optional[UserProgram]:
    stmt = (
        select(UserProgram)
        .where(UserProgram.id == user_program_id)
        .options(selectinload(UserProgram.program), selectinload(UserProgram.status))
    )
    return db.scalars(stmt).first()


def join_program(db: Session, user_id: int, program_id: int) -> UserProgram:
    existing = db.scalars(
        select(UserProgram).where(
            UserProgram.user_id == user_id, UserProgram.program_id == program_id
        )
    ).first()
    if existing is not None:
        raise AlreadyJoinedError()

    user_program = UserProgram(
        user_id=user_id,
        program_id=program_id,
        status_id=STATUS_ACTIVE,
        started_at=date.today(),
    )
    db.add(user_program)
    db.commit()
    db.refresh(user_program)
    return get_user_program(db, user_program.id)


def update_status(db: Session, user_program: UserProgram, status_id: int) -> UserProgram:
    user_program.status_id = status_id
    db.commit()
    return get_user_program(db, user_program.id)
