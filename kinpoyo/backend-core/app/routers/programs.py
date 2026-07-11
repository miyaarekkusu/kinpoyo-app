from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db
from app.crud import program as program_crud
from app.models.user import User
from app.schemas.program import ProgramOut, UserProgramOut, UserProgramStatusUpdate

router = APIRouter(prefix="/programs", tags=["programs"])
user_programs_router = APIRouter(prefix="/user-programs", tags=["programs"])


@router.get("", response_model=list[ProgramOut])
def list_programs(db: Session = Depends(get_db)):
    programs = program_crud.list_programs(db)
    return [program_crud.program_to_out(p) for p in programs]


@router.post("/{program_id}/join", response_model=UserProgramOut, status_code=status.HTTP_201_CREATED)
def join_program(
    program_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if program_crud.get_program(db, program_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="プログラムが見つかりません")
    try:
        user_program = program_crud.join_program(db, current_user.id, program_id)
    except program_crud.AlreadyJoinedError:
        raise HTTPException(status_code=400, detail="既にこのプログラムに参加しています")
    return program_crud.user_program_to_out(user_program)


@user_programs_router.put("/{user_program_id}/status", response_model=UserProgramOut)
def update_user_program_status(
    user_program_id: int,
    data: UserProgramStatusUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user_program = program_crud.get_user_program(db, user_program_id)
    if user_program is None or user_program.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="参加情報が見つかりません")
    user_program = program_crud.update_status(db, user_program, data.status_id)
    return program_crud.user_program_to_out(user_program)
