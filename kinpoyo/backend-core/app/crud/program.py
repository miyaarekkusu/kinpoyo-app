from datetime import date
from typing import Optional

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.models.program import Program, ProgramExercise, UserProgram
from app.schemas.program import ProgramCreate, ProgramExerciseOut, ProgramOut, UserProgramOut

STATUS_ACTIVE = 1
STATUS_COMPLETED = 3
STATUS_DROPPED = 4


class AlreadyJoinedError(Exception):
    pass


class AlreadyHasActiveProgramError(Exception):
    pass


class ProgramNameTakenError(Exception):
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


def create_program(db: Session, user_id: int, data: ProgramCreate) -> Program:
    program = Program(
        name=data.name,
        description=data.description,
        is_public=False,
        created_by=user_id,
    )
    db.add(program)
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        raise ProgramNameTakenError()

    for order_index, exercise in enumerate(data.exercises):
        db.add(
            ProgramExercise(
                program_id=program.id,
                exercise_id=exercise.exercise_id,
                week_number=1,
                day_number=1,
                order_index=order_index,
                sets=exercise.sets,
                reps_min=exercise.reps_min,
                reps_max=exercise.reps_max,
                note=exercise.note,
            )
        )
    db.commit()
    db.refresh(program)
    return program


def list_my_created_programs(db: Session, user_id: int) -> list[Program]:
    stmt = (
        select(Program)
        .where(Program.created_by == user_id)
        .options(selectinload(Program.category), selectinload(Program.difficulty_level))
        .order_by(Program.id.desc())
    )
    return list(db.scalars(stmt).all())


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

    other_active = db.scalars(
        select(UserProgram).where(
            UserProgram.user_id == user_id,
            UserProgram.status_id == STATUS_ACTIVE,
            UserProgram.program_id != program_id,
        )
    ).first()
    if other_active is not None:
        raise AlreadyHasActiveProgramError()

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


def leave_program(db: Session, user_program: UserProgram) -> UserProgram:
    user_program.status_id = STATUS_DROPPED
    db.commit()
    return get_user_program(db, user_program.id)


def list_user_programs(db: Session, user_id: int) -> list[UserProgram]:
    stmt = (
        select(UserProgram)
        .where(UserProgram.user_id == user_id)
        .options(selectinload(UserProgram.program), selectinload(UserProgram.status))
        .order_by(UserProgram.id)
    )
    return list(db.scalars(stmt).all())


def program_exercise_to_out(pe: ProgramExercise) -> ProgramExerciseOut:
    return ProgramExerciseOut(
        id=pe.id,
        exercise_id=pe.exercise_id,
        exercise_name=pe.exercise.name,
        week_number=pe.week_number,
        day_number=pe.day_number,
        order_index=pe.order_index,
        sets=pe.sets,
        reps_min=pe.reps_min,
        reps_max=pe.reps_max,
        rest_interval_sec=pe.rest_interval_sec,
        note=pe.note,
    )


def get_program_exercises(
    db: Session, program_id: int, week: int, day: int
) -> list[ProgramExercise]:
    stmt = (
        select(ProgramExercise)
        .where(
            ProgramExercise.program_id == program_id,
            ProgramExercise.week_number == week,
            ProgramExercise.day_number == day,
        )
        .options(selectinload(ProgramExercise.exercise))
        .order_by(ProgramExercise.order_index)
    )
    return list(db.scalars(stmt).all())


def advance_program(db: Session, user_program: UserProgram) -> UserProgram:
    program = user_program.program
    max_day = db.scalar(
        select(func.max(ProgramExercise.day_number)).where(
            ProgramExercise.program_id == user_program.program_id,
            ProgramExercise.week_number == user_program.current_week,
        )
    ) or 1

    if user_program.current_day >= max_day:
        next_week = user_program.current_week + 1
        if program.duration_weeks is not None and next_week > program.duration_weeks:
            user_program.status_id = STATUS_COMPLETED
            user_program.completed_at = date.today()
        else:
            user_program.current_week = next_week
            user_program.current_day = 1
    else:
        user_program.current_day += 1

    db.commit()
    return get_user_program(db, user_program.id)
