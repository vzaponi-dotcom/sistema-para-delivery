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
 assert.match(text,/Editado/)
 assert.match(text,/Salada/)
 assert.match(text,/Removido/)
 assert.match(text,/Marmita/)
 assert.doesNotMatch(text,/NOVO PEDIDO/)
 assert.equal(render.root.findByType('article').props['data-edit-pending'],true)
})

test('TV omits unchanged quantities in note-only edits', async t => {
 const h=await workspaceHarness(t)
 const {KitchenDisplayCard}=await h.load('/src/kitchen-display/KitchenDisplayCard.jsx')
 const order={id:'note-only',orderNumber:42,client:'Ana',type:'Entrega',
   createdAt:'2026-10-10T15:40:00Z',items:[{name:'Marmita',quantity:1,note:'Sem cebola'}],
   operationalRevision:1,editSummary:{items:[{
     kind:'modified',before:{name:'Marmita',quantity:1,note:''},after:{name:'Marmita',quantity:1,note:'Sem cebola'}
   }]}}
 const render=await h.render(KitchenDisplayCard,{entry:{order,state:'preparing',phase:'preparing'},now:new Date('2026-10-10T15:42:00Z')})
 const copy=nodeText(render.root)
 assert.match(copy,/Observação alterada: Marmita/)
 assert.doesNotMatch(copy,/1x → 1x/)
})

test('TV groups identical removed lines without losing the removed quantity', async t => {
 const h=await workspaceHarness(t)
 const {KitchenDisplayCard}=await h.load('/src/kitchen-display/KitchenDisplayCard.jsx')
 const order={id:'removed-twice',orderNumber:335,client:'Luiz',type:'Entrega',
   createdAt:'2026-10-10T15:40:00Z',items:[{name:'Marmita',quantity:1}],
   operationalRevision:1,editSummary:{items:[
     {kind:'removed',before:{name:'Prato feito',quantity:1},after:null},
     {kind:'removed',before:{name:'Prato feito',quantity:1},after:null},
   ]}}
 const render=await h.render(KitchenDisplayCard,{entry:{order,state:'preparing',phase:'preparing'},now:new Date('2026-10-10T15:42:00Z')})
 const copy=nodeText(render.root)
 assert.equal((copy.match(/Removido:/g)||[]).length,1)
 assert.match(copy,/Removido: 2x Prato feito/)
})
