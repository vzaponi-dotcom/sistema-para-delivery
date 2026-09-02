from pathlib import Path

# API helper
path = Path('src/api/client.js')
source = path.read_text()
marker = "export const registerPayment = (id, method) => apiRequest(`/api/orders/${encodeURIComponent(id)}/payment`, withJson('POST', { method }))\n"
addition = marker + "export const registerTableTabPayment = (id, method) => apiRequest(`/api/table-tabs/${encodeURIComponent(id)}/payment`, withJson('POST', { method }))\n"
if source.count(marker) != 1:
    raise SystemExit('client API payment marker mismatch')
path.write_text(source.replace(marker, addition, 1))

# App state/wiring
path = Path('src/App.jsx')
source = path.read_text()
replacements = [
    (
        "  registerPayment as registerPaymentApi,\n",
        "  registerPayment as registerPaymentApi,\n  registerTableTabPayment as registerTableTabPaymentApi,\n",
    ),
    (
        "  const [orders, setOrders] = useState([])\n  const [movements, setMovements] = useState([])",
        "  const [orders, setOrders] = useState([])\n  const [tableTabs, setTableTabs] = useState([])\n  const [movements, setMovements] = useState([])",
    ),
    (
        "    setOrders([])\n    setMovements([])",
        "    setOrders([])\n    setTableTabs([])\n    setMovements([])",
    ),
    (
        "    setOrders(Array.isArray(data?.orders) ? data.orders : [])\n    setMovements(Array.isArray(data?.movements) ? data.movements : [])",
        "    setOrders(Array.isArray(data?.orders) ? data.orders : [])\n    setTableTabs(Array.isArray(data?.tableTabs) ? data.tableTabs : [])\n    setMovements(Array.isArray(data?.movements) ? data.movements : [])",
    ),
    (
        "  const resetClientForm = () => {",
        "  const handleRegisterTableTabPayment = async (tableTabId, method) => {\n    if (writesBlocked) return false\n    setRequestKey(`table-tab:payment:${tableTabId}`)\n    try {\n      const result = await registerTableTabPaymentApi(tableTabId, method)\n      setOrders((current) => current.map((item) => result.orders.find((order) => order.id === item.id) ?? item))\n      setMovements((current) => {\n        const ids = new Set(current.map((item) => item.id))\n        return [...result.movements.filter((item) => !ids.has(item.id)), ...current]\n      })\n      setTableTabs((current) => current.map((tab) => tab.id === result.tableTab.id ? result.tableTab : tab))\n      showSuccessMessage(`Pagamento da Mesa ${result.tableTab.tableIdentifier} recebido via ${method}`)\n      return true\n    } catch (error) {\n      showApiError(error)\n      return false\n    } finally {\n      setRequestKey(null)\n    }\n  }\n\n  const resetClientForm = () => {",
    ),
    (
        "            products={products}\n            currency={currency}",
        "            products={products}\n            tableTabs={tableTabs}\n            currency={currency}",
    ),
    (
        "        {activeTab === 'receivables' && <Receivables orders={orders} currency={currency} onRegisterPayment={openPaymentModal} />}",
        "        {activeTab === 'receivables' && <Receivables orders={orders} tableTabs={tableTabs} currency={currency} onRegisterPayment={openPaymentModal} onRegisterTableTabPayment={handleRegisterTableTabPayment} />}",
    ),
]
for old, new in replacements:
    count = source.count(old)
    if count != 1:
        raise SystemExit(f'App replacement mismatch {count}: {old[:100]}')
    source = source.replace(old, new, 1)
path.write_text(source)
