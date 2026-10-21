from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from typing import List
from database import get_db
from core.security import get_current_user
from models.models import Entity
from schemas.schemas import EntityCreate, EntityUpdate, EntityResponse
from datetime import datetime

router = APIRouter(prefix="/api/entities", tags=["entities"], dependencies=[Depends(get_current_user)])

@router.get("/")
def get_entities(db: Session = Depends(get_db)):
    """Get all entities"""
    try:
        entities = db.query(Entity).all()
        res = {
            'code': 1,
            'msg': 'Success.',
            'success': True,
            'data': entities
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
            res = {
                'code': -1,
                'success': False,
                'msg': 'Entity not found'
            }
            raise HTTPException(status_code=404, detail=res)
        
        res = {
            'code': 1,
            'msg': 'Success.',
            'success': True,
            'data': entity
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
            name=entity.name,
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
            'data': db_entity
        }
        return JSONResponse(status_code=201, content=res)
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
            res = {
                'code': -1,
                'success': False,
                'msg': 'Entity not found'
            }
            raise HTTPException(status_code=404, detail=res)
        
        if entity_update.name is not None:
            db_entity.name = entity_update.name
        
        db_entity.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(db_entity)
        
        res = {
            'code': 1,
            'msg': 'Success.',
            'success': True,
            'data': db_entity
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
            res = {
                'code': -1,
                'success': False,
                'msg': 'Entity not found'
            }
            raise HTTPException(status_code=404, detail=res)
        
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
