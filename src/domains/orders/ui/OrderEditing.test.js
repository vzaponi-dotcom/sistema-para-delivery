import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const source=path=>readFileSync(new URL(path,import.meta.url),'utf8')
test('edition wired end-to-end through owned draft and official API',()=>{
 const app=source('../../../App.jsx')
 const order=source('./NewOrder.jsx')
 const detail=source('./components/OrderDetail.jsx')
 const hook=source('../application/useNewOrderDraft.js')
 const api=source('../infrastructure/ordersApi.js')
 assert.match(app,/handleEditOrder/)
 assert.match(app,/onEditOrder=\{handleEditOrder\}/)
 assert.match(detail,/Editar pedido/)
 assert.match(order,/editOrderMode/)
 assert.match(hook,/submitOrderEdit/)
 assert.match(api,/updateOrder:/)
})
