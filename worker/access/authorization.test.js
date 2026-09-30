import test from 'node:test'
import assert from 'node:assert/strict'
import { requireCapability, requireAnyCapability, authorizeOrderCreate } from './authorization.js'

const context = (...keys) => ({ granted:new Set(keys) })
test('capability guards deny missing context and require an actual grant', () => {
  for (const input of [undefined, {}, context()]) {
    assert.throws(() => requireCapability(input,'orders.create'),{status:403,code:'FORBIDDEN'})
    assert.throws(() => requireAnyCapability(input,['orders.view','orders.history']),{status:403})
  }
  requireCapability(context('orders.create'),'orders.create')
  requireAnyCapability(context('orders.history'),['orders.view','orders.history'])
})
test('create compounds require every requested payment adjustment and retroactive capability', () => {
  const now = new Date('2026-09-30T02:00:00Z') // São Paulo business date is September 29.
  const create = context('orders.create')
  authorizeOrderCreate(create,{orderDate:'2026-09-29',adjustment:{type:'none',value:0}},now)
  for (const input of [
    {paymentAllocations:[]}, {adjustment:{type:'discount',value:0}},
    {adjustment:{type:'surcharge',value:0}}, {isBackdated:true}, {orderDate:'2026-09-28'},
  ]) assert.throws(() => authorizeOrderCreate(create,input,now),{status:403})
  assert.throws(() => authorizeOrderCreate(context('payments.receive'),{paymentAllocations:[]},now),{status:403})
  authorizeOrderCreate(context('orders.create','payments.receive','orders.discount','orders.backdate'),{
    paymentAllocations:[],adjustment:{type:'discount',value:0},orderDate:'2026-09-28',isBackdated:true,
  },now)
  authorizeOrderCreate(create,{paymentAllocations:null},now)
})
