"""
Group Management Router.
"""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.auth_matrix import AuthMatrix
from app.models.group import Group
from app.models.user import User
from app.schemas.group import GroupCreate, GroupResponse, GroupUpdate

router = APIRouter(prefix="/api/groups", tags=["Groups"])


@router.get("", response_model=list[GroupResponse])
async def list_groups(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    """List all groups along with user counts."""
    stmt = select(Group).order_by(Group.id.asc())
    result = await db.execute(stmt)
    groups = result.scalars().all()

    # Calculate user count for each group
    group_responses: list[GroupResponse] = []
    for g in groups:
        count_stmt = select(func.count(User.id)).where(User.group_id == g.id)
        count_res = await db.execute(count_stmt)
        user_count = count_res.scalar() or 0

        group_responses.append(
            GroupResponse(
                id=g.id,
                name=g.name,
                description=g.description,
                allowed_item_groups=g.allowed_item_groups or "*",
                default_page=g.default_page or "/dashboard",
                is_active=g.is_active,
                user_count=user_count,
                created_at=g.created_at,
                updated_at=g.updated_at,
            )
        )
    return group_responses


@router.post("", response_model=GroupResponse, status_code=status.HTTP_201_CREATED)
async def create_group(
    data: GroupCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    """Create a new group."""
    existing = await db.execute(select(Group).where(Group.name == data.name))
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Group name already exists",
        )

    group = Group(
        name=data.name,
        description=data.description,
        allowed_item_groups=data.allowed_item_groups or "*",
        default_page=data.default_page or "/dashboard",
        is_active=data.is_active,
    )
    db.add(group)
    await db.commit()
    await db.refresh(group)

    return GroupResponse(
        id=group.id,
        name=group.name,
        description=group.description,
        allowed_item_groups=group.allowed_item_groups or "*",
        default_page=group.default_page or "/dashboard",
        is_active=group.is_active,
        user_count=0,
        created_at=group.created_at,
        updated_at=group.updated_at,
    )


@router.put("/{group_id}", response_model=GroupResponse)
async def update_group(
    group_id: int,
    data: GroupUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    """Update group details."""
    stmt = select(Group).where(Group.id == group_id)
    result = await db.execute(stmt)
    group = result.scalar_one_or_none()
    if not group:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Group not found")

    if data.name is not None:
        group.name = data.name
    if data.description is not None:
        group.description = data.description
    if data.allowed_item_groups is not None:
        group.allowed_item_groups = data.allowed_item_groups
    if data.default_page is not None:
        group.default_page = data.default_page
    if data.is_active is not None:
        group.is_active = data.is_active

    await db.commit()
    await db.refresh(group)

    count_stmt = select(func.count(User.id)).where(User.group_id == group.id)
    count_res = await db.execute(count_stmt)
    user_count = count_res.scalar() or 0

    return GroupResponse(
        id=group.id,
        name=group.name,
        description=group.description,
        allowed_item_groups=group.allowed_item_groups or "*",
        default_page=group.default_page or "/dashboard",
        is_active=group.is_active,
        user_count=user_count,
        created_at=group.created_at,
        updated_at=group.updated_at,
    )


@router.delete("/{group_id}")
async def delete_group(
    group_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    """Delete a group if there are no active users in it and it's not the Admin group."""
    stmt = select(Group).where(Group.id == group_id)
    result = await db.execute(stmt)
    group = result.scalar_one_or_none()
    if not group:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="ไม่พบกลุ่มที่ต้องการลบ")

    if group.name.lower() == "admin":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="ไม่สามารถลบกลุ่มระบบหลัก (Admin) ได้",
        )

    # Check if any user belongs to this group
    count_stmt = select(func.count(User.id)).where(User.group_id == group_id)
    count_res = await db.execute(count_stmt)
    user_count = count_res.scalar() or 0

    if user_count > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"ไม่สามารถลบกลุ่ม '{group.name}' ได้ เนื่องจากยังมีผู้ใช้งานในกลุ่มนี้ {user_count} คน กรุณาย้ายผู้ใช้งานไปกลุ่มอื่นก่อน",
        )

    # Delete related AuthMatrix permissions
    await db.execute(delete(AuthMatrix).where(AuthMatrix.group_id == group_id))

    # Delete group record
    await db.delete(group)
    await db.commit()

    return {"message": f"ลบกลุ่ม '{group.name}' เรียบร้อยแล้ว"}
