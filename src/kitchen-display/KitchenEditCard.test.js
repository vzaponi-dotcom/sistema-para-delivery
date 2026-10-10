import assert from 'node:assert/strict'
import test from 'node:test'
import { nodeText,workspaceHarness } from '../test-support/renderWorkspace.js'
test('KDS card marks edited orders separately from NEW PEDIDO and shows removed item',async t=>{
 const h=await workspaceHarness(t)
 const {KitchenDisplayCard}=await h.load('/src/kitchen-display/KitchenDisplayCard.jsx')
 const order={id:'o1',orderNumber:42,client:'Ana',type:'Entrega',status:'Em preparo',
   createdAt:'2026-10-10T15:40:00Z',items:[{name:'Marmita',quantity:2,note:'sem gelo'}],
   editPending:true,operationalRevision:1,
   editSummary:{items:[{kind:'removed',before:{name:'Salada',quantity:1,note:'sem molho'},after:null},
     {kind:'modified',before:{name:'Marmita',quantity:1,note:''},after:{name:'Marmita',quantity:2,note:'sem gelo'}}]}}
 const entry={order,state:'preparing',phase:'preparing',operationalStartAt:new Date(order.createdAt)}
 const render=await h.render(KitchenDisplayCard,{entry,now:new Date('2026-10-10T15:42:00Z')})
 const text=nodeText(render.root)
 assert.match(text,/PEDIDO ALTERADO/)
 assert.match(text,/Salada/)
 assert.match(text,/Removido/)
 assert.match(text,/Marmita/)
 assert.doesNotMatch(text,/NOVO PEDIDO/)
 assert.equal(render.root.findByType('article').props['data-edit-pending'],true)
})
