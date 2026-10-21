from fastapi import APIRouter, Depends, HTTPException
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse
from sqlalchemy import func
from sqlalchemy.orm import Session
from database import get_db
from core.security import get_current_user
from models.models import LoanProduct, Entity
from schemas.schemas import LoanProductCreate, LoanProductUpdate, LoanProductResponse
from datetime import datetime

router = APIRouter(prefix="/api/loan-products", tags=["loan-products"], dependencies=[Depends(get_current_user)])


def _to_json(loan_product: LoanProduct):
    return jsonable_encoder(LoanProductResponse.model_validate(loan_product))


def _error(status_code: int, msg: str):
    raise HTTPException(status_code=status_code, detail={'code': -1, 'success': False, 'msg': msg})


def _require_entity(db: Session, entity_id: int) -> Entity:
    entity = db.query(Entity).filter(Entity.id == entity_id).first()
    if not entity:
        _error(404, 'Entity not found')
    return entity


def _clean_name(db: Session, name: str, entity: Entity, exclude_id: int | None = None) -> str:
    """Loan product names are unique within their entity."""
    name = name.strip()
    if not name:
        _error(400, 'Loan product name is required.')
    query = db.query(LoanProduct).filter(
        LoanProduct.entity_id == entity.id,
        func.lower(LoanProduct.name) == name.lower(),
    )
    if exclude_id is not None:
        query = query.filter(LoanProduct.id != exclude_id)
    if query.first():
        _error(409, f'"{entity.name}" already has a loan product named "{name}".')
    return name


@router.get("/")
def get_loan_products(db: Session = Depends(get_db)):
    """Get all loan products"""
    try:
        loan_products = db.query(LoanProduct).order_by(func.lower(LoanProduct.name)).all()
        res = {
            'code': 1,
            'msg': 'Success.',
            'success': True,
            'data': [_to_json(lp) for lp in loan_products]
        }
        return JSONResponse(status_code=200, content=res)
    except Exception as e:
        res = {
            'code': -1,
            'success': False,
            'msg': f'Something went wrong. {str(e)}'
        }
        raise HTTPException(status_code=500, detail=res)

@router.get("/{loan_product_id}")
def get_loan_product(loan_product_id: int, db: Session = Depends(get_db)):
    """Get a specific loan product by ID"""
    try:
        loan_product = db.query(LoanProduct).filter(LoanProduct.id == loan_product_id).first()
        if not loan_product:
            _error(404, 'Loan product not found')

        res = {
            'code': 1,
            'msg': 'Success.',
            'success': True,
            'data': _to_json(loan_product)
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

@router.get("/entity/{entity_id}")
def get_loan_products_by_entity(entity_id: int, db: Session = Depends(get_db)):
    """Get all loan products for a specific entity"""
    try:
        _require_entity(db, entity_id)

        loan_products = (
            db.query(LoanProduct)
            .filter(LoanProduct.entity_id == entity_id)
            .order_by(func.lower(LoanProduct.name))
            .all()
        )
        res = {
            'code': 1,
            'msg': 'Success.',
            'success': True,
            'data': [_to_json(lp) for lp in loan_products]
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
def create_loan_product(loan_product: LoanProductCreate, db: Session = Depends(get_db)):
    """Create a new loan product"""
    try:
        entity = _require_entity(db, loan_product.entity_id)

        db_loan_product = LoanProduct(
            name=_clean_name(db, loan_product.name, entity),
            entity_id=entity.id,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        db.add(db_loan_product)
        db.commit()
        db.refresh(db_loan_product)

        res = {
            'code': 1,
            'msg': 'Success.',
            'success': True,
            'data': _to_json(db_loan_product)
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

@router.put("/{loan_product_id}")
def update_loan_product(loan_product_id: int, loan_product_update: LoanProductUpdate, db: Session = Depends(get_db)):
    """Update an existing loan product"""
    try:
        db_loan_product = db.query(LoanProduct).filter(LoanProduct.id == loan_product_id).first()
        if not db_loan_product:
            _error(404, 'Loan product not found')

        entity_id = loan_product_update.entity_id if loan_product_update.entity_id is not None else db_loan_product.entity_id
        entity = _require_entity(db, entity_id)
        name = loan_product_update.name if loan_product_update.name is not None else db_loan_product.name

        db_loan_product.name = _clean_name(db, name, entity, exclude_id=loan_product_id)
        db_loan_product.entity_id = entity.id
        db_loan_product.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(db_loan_product)

        res = {
            'code': 1,
            'msg': 'Success.',
            'success': True,
            'data': _to_json(db_loan_product)
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

@router.delete("/{loan_product_id}")
def delete_loan_product(loan_product_id: int, db: Session = Depends(get_db)):
    """Delete a loan product"""
    try:
        db_loan_product = db.query(LoanProduct).filter(LoanProduct.id == loan_product_id).first()
        if not db_loan_product:
            _error(404, 'Loan product not found')

        db.delete(db_loan_product)
        db.commit()

        res = {
            'code': 1,
            'msg': 'Success.',
            'success': True,
            'data': {'message': 'Loan product deleted successfully'}
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
