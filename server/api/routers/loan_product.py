from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from typing import List
from database import get_db
from core.security import get_current_user
from models.models import LoanProduct, Entity
from schemas.schemas import LoanProductCreate, LoanProductUpdate, LoanProductResponse
from datetime import datetime

router = APIRouter(prefix="/api/loan-products", tags=["loan-products"], dependencies=[Depends(get_current_user)])

@router.get("/")
def get_loan_products(db: Session = Depends(get_db)):
    """Get all loan products"""
    try:
        loan_products = db.query(LoanProduct).all()
        res = {
            'code': 1,
            'msg': 'Success.',
            'success': True,
            'data': loan_products
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
            res = {
                'code': -1,
                'success': False,
                'msg': 'Loan product not found'
            }
            raise HTTPException(status_code=404, detail=res)
        
        res = {
            'code': 1,
            'msg': 'Success.',
            'success': True,
            'data': loan_product
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
        # Check if entity exists
        entity = db.query(Entity).filter(Entity.id == entity_id).first()
        if not entity:
            res = {
                'code': -1,
                'success': False,
                'msg': 'Entity not found'
            }
            raise HTTPException(status_code=404, detail=res)
        
        loan_products = db.query(LoanProduct).filter(LoanProduct.entity_id == entity_id).all()
        res = {
            'code': 1,
            'msg': 'Success.',
            'success': True,
            'data': loan_products
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
        # Check if entity exists
        entity = db.query(Entity).filter(Entity.id == loan_product.entity_id).first()
        if not entity:
            res = {
                'code': -1,
                'success': False,
                'msg': 'Entity not found'
            }
            raise HTTPException(status_code=404, detail=res)
        
        db_loan_product = LoanProduct(
            name=loan_product.name,
            entity_id=loan_product.entity_id,
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
            'data': db_loan_product
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
            res = {
                'code': -1,
                'success': False,
                'msg': 'Loan product not found'
            }
            raise HTTPException(status_code=404, detail=res)
        
        if loan_product_update.name is not None:
            db_loan_product.name = loan_product_update.name
        
        if loan_product_update.entity_id is not None:
            # Check if new entity exists
            entity = db.query(Entity).filter(Entity.id == loan_product_update.entity_id).first()
            if not entity:
                res = {
                    'code': -1,
                    'success': False,
                    'msg': 'Entity not found'
                }
                raise HTTPException(status_code=404, detail=res)
            db_loan_product.entity_id = loan_product_update.entity_id
        
        db_loan_product.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(db_loan_product)
        
        res = {
            'code': 1,
            'msg': 'Success.',
            'success': True,
            'data': db_loan_product
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
            res = {
                'code': -1,
                'success': False,
                'msg': 'Loan product not found'
            }
            raise HTTPException(status_code=404, detail=res)
        
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
