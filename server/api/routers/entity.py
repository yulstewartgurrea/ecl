from fastapi import APIRouter, Depends, HTTPException
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse
from sqlalchemy import func
from sqlalchemy.orm import Session
from database import get_db
from core.security import get_current_user
from models.models import Entity, LoanProduct
from schemas.schemas import EntityCreate, EntityUpdate, EntityResponse
from datetime import datetime

router = APIRouter(prefix="/api/entities", tags=["entities"], dependencies=[Depends(get_current_user)])


def _to_json(entity: Entity):
    return jsonable_encoder(EntityResponse.model_validate(entity))


def _error(status_code: int, msg: str):
    raise HTTPException(status_code=status_code, detail={'code': -1, 'success': False, 'msg': msg})


def _clean_name(db: Session, name: str, exclude_id: int | None = None) -> str:
    name = name.strip()
    if not name:
        _error(400, 'Entity name is required.')
    query = db.query(Entity).filter(func.lower(Entity.name) == name.lower())
    if exclude_id is not None:
        query = query.filter(Entity.id != exclude_id)
    if query.first():
        _error(409, f'An entity named "{name}" already exists.')
    return name


@router.get("/")
def get_entities(db: Session = Depends(get_db)):
    """Get all entities"""
    try:
        entities = db.query(Entity).order_by(func.lower(Entity.name)).all()
        res = {
            'code': 1,
            'msg': 'Success.',
            'success': True,
            'data': [_to_json(e) for e in entities]
        }
        return JSONResponse(status_code=200, content=res)
    except Exception as e:
        res = {
            'code': -1,
            'success': False,
            'msg': f'Something went wrong. {str(e)}'
        }
        raise HTTPException(status_code=500, detail=res)

@router.get("/{entity_id}")
def get_entity(entity_id: int, db: Session = Depends(get_db)):
    """Get a specific entity by ID"""
    try:
        entity = db.query(Entity).filter(Entity.id == entity_id).first()
        if not entity:
            _error(404, 'Entity not found')

        res = {
            'code': 1,
            'msg': 'Success.',
            'success': True,
            'data': _to_json(entity)
        }
        return JSONResponse(status_code=200, content=res)
    except HTTPException:
        raise
    except Exception as e:
        res = {
            'code': -1,
            'success': False,
            'msg': f'Something went wrong. {str(e)}'
        }
        raise HTTPException(status_code=500, detail=res)

@router.post("/")
def create_entity(entity: EntityCreate, db: Session = Depends(get_db)):
    """Create a new entity"""
    try:
        db_entity = Entity(
            name=_clean_name(db, entity.name),
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        db.add(db_entity)
        db.commit()
        db.refresh(db_entity)

        res = {
            'code': 1,
            'msg': 'Success.',
            'success': True,
            'data': _to_json(db_entity)
        }
        return JSONResponse(status_code=201, content=res)
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        res = {
            'code': -1,
            'success': False,
            'msg': f'Something went wrong. {str(e)}'
        }
        raise HTTPException(status_code=500, detail=res)

@router.put("/{entity_id}")
def update_entity(entity_id: int, entity_update: EntityUpdate, db: Session = Depends(get_db)):
    """Update an existing entity"""
    try:
        db_entity = db.query(Entity).filter(Entity.id == entity_id).first()
        if not db_entity:
            _error(404, 'Entity not found')

        if entity_update.name is not None:
            db_entity.name = _clean_name(db, entity_update.name, exclude_id=entity_id)

        db_entity.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(db_entity)

        res = {
            'code': 1,
            'msg': 'Success.',
            'success': True,
            'data': _to_json(db_entity)
        }
        return JSONResponse(status_code=200, content=res)
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        res = {
            'code': -1,
            'success': False,
            'msg': f'Something went wrong. {str(e)}'
        }
        raise HTTPException(status_code=500, detail=res)

@router.delete("/{entity_id}")
def delete_entity(entity_id: int, db: Session = Depends(get_db)):
    """Delete an entity"""
    try:
        db_entity = db.query(Entity).filter(Entity.id == entity_id).first()
        if not db_entity:
            _error(404, 'Entity not found')

        # loan_product.entity_id is NOT NULL, so the entity can't go while products point at it
        product_count = db.query(LoanProduct).filter(LoanProduct.entity_id == entity_id).count()
        if product_count:
            _error(409, f'"{db_entity.name}" still has {product_count} loan product(s). Delete those first.')

        db.delete(db_entity)
        db.commit()

        res = {
            'code': 1,
            'msg': 'Success.',
            'success': True,
            'data': {'message': 'Entity deleted successfully'}
        }
        return JSONResponse(status_code=200, content=res)
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        res = {
            'code': -1,
            'success': False,
            'msg': f'Something went wrong. {str(e)}'
        }
        raise HTTPException(status_code=500, detail=res)
