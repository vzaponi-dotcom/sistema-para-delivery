import { CustomersWorkspace } from '../../../domains/customers/index.js'
import { OrderDetail, canReceiveStandaloneOrder } from '../../../domains/orders/index.js'
import { hasCapability } from '../../access.js'

export default function CustomersSurface(props) {
  const { granted = new Set(), printing, onToast } = props
  return <CustomersWorkspace {...props}
    canReceiveOrder={(order, source) => canReceiveStandaloneOrder(order, granted, source)}
    renderOrderDetail={detailProps => <OrderDetail {...detailProps} printing={printing} printJob={printing?.latestJobByOrderId?.get(detailProps.order.id)} canExecutePrinting={hasCapability(granted, 'printing.execute')} canForcePrinting={hasCapability(granted, 'printing.force')} onToast={onToast} />}
  />
}
