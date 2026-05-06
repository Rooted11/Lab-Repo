from __future__ import annotations
from typing import Optional
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy import or_, cast, String
from sqlalchemy.orm import Session

from ..services.database import get_db, AuditLog, AuditAction
from ..services.authz import require_permissions

router = APIRouter(prefix="/api/audit/logs", tags=["audit"])


@router.get("", dependencies=[Depends(require_permissions(["view:audit", "config:*"]))])
def list_audit_logs(
    skip: int = 0,
    limit: int = 100,
    q: Optional[str] = None,
    action: Optional[str] = Query(None, description="login|create|update|delete|system"),
    actor: Optional[str] = None,
    success: Optional[bool] = None,
    since_minutes: Optional[int] = None,
    db: Session = Depends(get_db),
):
    query = db.query(AuditLog)
    if q:
        like = f"%{q.lower()}%"
        query = query.filter(or_(
            AuditLog.actor.ilike(like),
            AuditLog.entity_id.ilike(like),
            AuditLog.entity_type.ilike(like),
            AuditLog.ip_address.ilike(like),
            cast(AuditLog.details, String).ilike(like),
        ))
    if actor:
        query = query.filter(AuditLog.actor.ilike(f"%{actor}%"))
    if action:
        try:
            query = query.filter(AuditLog.action == AuditAction(action))
        except ValueError:
            pass
    if success is not None:
        # Filter on JSON 'success' field
        query = query.filter(cast(AuditLog.details["success"], String) == ("true" if success else "false"))
    if since_minutes:
        cutoff = datetime.utcnow() - timedelta(minutes=since_minutes)
        query = query.filter(AuditLog.created_at >= cutoff)

    total = query.count()
    logs = (
        query.order_by(AuditLog.created_at.desc())
        .offset(skip)
        .limit(min(limit, 500))
        .all()
    )
    return {
        "total": total,
        "items": [
            {
                "id": log.id,
                "actor": log.actor,
                "actor_roles": log.actor_roles,
                "action": log.action.value if log.action else None,
                "entity_type": log.entity_type,
                "entity_id": log.entity_id,
                "ip_address": log.ip_address,
                "details": log.details,
                "created_at": log.created_at,
            }
            for log in logs
        ],
    }
