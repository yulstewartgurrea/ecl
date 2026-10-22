import hashlib
from datetime import timezone
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from database import get_db
from core.security import get_current_user
from models.models import TermsAcceptance, TermsDocument, User

# Acceptance of the platform terms, asked after login before the app can be used.
# Acceptances are only ever added: there is no update or delete endpoint.
router = APIRouter(prefix="/api/terms", tags=["terms"])


class TermsAcceptanceCreate(BaseModel):
    app_version: str = Field(min_length=1, max_length=50)
    terms_version: str = Field(min_length=1, max_length=50)
    terms_hash: str = Field(pattern=r"^[0-9a-f]{64}$")
    # the exact JSON text the user was shown; its SHA-256 must equal terms_hash
    terms_content: str = Field(min_length=2, max_length=500_000)


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
    """Record that the current user accepted the terms, keeping the terms text the first time it is seen"""
    if hashlib.sha256(body.terms_content.encode("utf-8")).hexdigest() != body.terms_hash:
        raise HTTPException(
            status_code=400,
            detail={'code': -1, 'success': False, 'msg': 'The terms content does not match its fingerprint.'},
        )

    def acceptance_row():
        return TermsAcceptance(
            user_id=user.id, username=user.username, **body.model_dump(exclude={"terms_content"})
        )

    row = acceptance_row()
    if not db.query(TermsDocument).filter(TermsDocument.terms_hash == body.terms_hash).first():
        db.add(TermsDocument(
            terms_hash=body.terms_hash, terms_version=body.terms_version, content=body.terms_content
        ))
    db.add(row)
    try:
        db.commit()
    except IntegrityError:
        # another acceptance stored the same terms text first; keep only this acceptance
        db.rollback()
        row = acceptance_row()
        db.add(row)
        db.commit()
    db.refresh(row)
    return {'code': 1, 'msg': 'Terms accepted.', 'success': True, 'data': _to_json(row)}


@router.get("/content/{terms_hash}")
def get_terms_content(
    terms_hash: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """The exact terms text behind a recorded terms_hash"""
    doc = db.query(TermsDocument).filter(TermsDocument.terms_hash == terms_hash).first()
    if not doc:
        raise HTTPException(
            status_code=404,
            detail={'code': -1, 'success': False, 'msg': 'No terms text is stored for this fingerprint.'},
        )
    return {
        'code': 1,
        'msg': 'Success.',
        'success': True,
        'data': {
            'terms_hash': doc.terms_hash,
            'terms_version': doc.terms_version,
            'content': doc.content,
            'stored_at': doc.created_at.replace(tzinfo=timezone.utc).isoformat(),
        },
    }
