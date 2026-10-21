from datetime import timezone
from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from database import get_db
from core.security import get_current_user
from models.models import TermsAcceptance, User

# Acceptance of the platform terms, asked after login before the app can be used.
# Acceptances are only ever added: there is no update or delete endpoint.
router = APIRouter(prefix="/api/terms", tags=["terms"])


class TermsAcceptanceCreate(BaseModel):
    app_version: str = Field(min_length=1, max_length=50)
    terms_version: str = Field(min_length=1, max_length=50)
    terms_hash: str = Field(pattern=r"^[0-9a-f]{64}$")


def _to_json(row: TermsAcceptance):
    return {
        'id': row.id,
        'username': row.username,
        'app_version': row.app_version,
        'terms_version': row.terms_version,
        'terms_hash': row.terms_hash,
        # SQLite CURRENT_TIMESTAMP is UTC but comes back without a zone
        'accepted_at': row.accepted_at.replace(tzinfo=timezone.utc).isoformat(),
    }


@router.get("/acceptance")
def get_acceptance(
    app_version: str,
    terms_hash: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Whether the current user has accepted these exact terms for this app version"""
    row = (
        db.query(TermsAcceptance)
        .filter(
            TermsAcceptance.user_id == user.id,
            TermsAcceptance.app_version == app_version,
            TermsAcceptance.terms_hash == terms_hash,
        )
        .order_by(TermsAcceptance.id.desc())
        .first()
    )
    return {
        'code': 1,
        'msg': 'Success.',
        'success': True,
        'data': {'accepted': row is not None, 'acceptance': _to_json(row) if row else None},
    }


@router.post("/acceptance", status_code=201)
def accept_terms(
    body: TermsAcceptanceCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Record that the current user accepted the terms"""
    row = TermsAcceptance(user_id=user.id, username=user.username, **body.model_dump())
    db.add(row)
    db.commit()
    db.refresh(row)
    return {'code': 1, 'msg': 'Terms accepted.', 'success': True, 'data': _to_json(row)}
