import test from 'node:test'
import assert from 'node:assert/strict'
import { validateProductCategory, validateStructuredPresentation } from './validation.js'

test('structured product validation accepts approved category and normalizes decimal volume', () => {
  assert.equal(validateProductCategory('Bebidas'), 'Bebidas')
  assert.deepEqual(validateStructuredPresentation({
    presentationType: 'volume',
    presentationValue: '1,5',
    presentationUnit: 'L',
  }), {
    presentationType: 'volume',
    presentationValue: '1.5',
    presentationUnit: 'L',
    size: '1,5 L',
  })
})

test('structured product validation rejects invalid category and zero volume', () => {
  assert.throws(() => validateProductCategory('Bebida'))
  assert.throws(() => validateStructuredPresentation({
    presentationType: 'volume',
    presentationValue: '0',
    presentationUnit: 'ml',
  }), (error) => error?.code === 'VALIDATION_ERROR' && error?.field === 'presentationValue')
})
