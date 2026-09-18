import { buildOrderDetailTimingRows } from './OrderDetailTiming.js'

export { buildOrderDetailTimingRows }

function OrderDetailTiming({ order }) {
  return <dl className="order-detail-timing">
    {buildOrderDetailTimingRows(order).map((row) => (
      <div className="order-detail-timing-row" key={row.key}>
        <dt>{row.label}</dt>
        <dd>{row.value}</dd>
      </div>
    ))}
  </dl>
}

export default OrderDetailTiming
