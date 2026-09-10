const icons = {
  clipboard: <><rect x="5" y="5" width="14" height="16" rx="2"/><rect x="9" y="3" width="6" height="4" rx="1"/><path d="M9 12h6M9 16h4"/></>,
  dashboard: <><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/></>,
  orders: <><path d="M6 3h12a2 2 0 0 1 2 2v16l-3-2-3 2-3-2-3 2-3-2-1 1V5a2 2 0 0 1 2-2Z"/><path d="M8 8h8M8 12h6"/></>,
  clients: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></>,
  products: <><path d="m21 8-9 5-9-5 9-5 9 5Z"/><path d="m3 8 9 5 9-5M3 12l9 5 9-5M3 16l9 5 9-5"/></>,
  finance: <><path d="M3 6h18v12H3z"/><path d="M7 10h4M7 14h2M15 12h2"/></>,
  chart: <><path d="M4 20V11M10 20V5M16 20v-7"/><path d="M2 20h20"/></>,
  plus: <path d="M12 5v14M5 12h14"/>,
  search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
  edit: <><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z"/></>,
  trash: <><path d="M3 6h18M8 6V4h8v2M6 6l1 15h10l1-15M10 11v5M14 11v5"/></>,
  close: <path d="m6 6 12 12M18 6 6 18"/>,
  check: <path d="m5 12 4 4L19 6"/>,
  wallet: <><path d="M4 6h14a2 2 0 0 1 2 2v10H4a2 2 0 0 1-2-2V6a3 3 0 0 1 3-3h11"/><path d="M20 11h-5a2 2 0 0 0 0 4h5"/></>,
  receipt: <><path d="M6 3h12v18l-3-2-3 2-3-2-3 2Z"/><path d="M9 8h6M9 12h6"/></>,
  ticket: <><path d="M3 7h18v4a2 2 0 0 0 0 4v2H3v-2a2 2 0 0 0 0-4Z"/><path d="M13 7v10"/></>,
  package: <><path d="m21 8-9 5-9-5 9-5 9 5Z"/><path d="M3 8v8l9 5 9-5V8M12 13v8"/></>,
  meal: <><path d="M4 3v8M7 3v8M4 7h3M5.5 11v10"/><path d="M15 3v18M15 3c3 1 4 4 4 7h-4"/></>,
  snack: <><path d="M4 13h16M5 13c0-4 3-7 7-7s7 3 7 7M6 17h12"/><path d="M8 10h.01M12 9h.01M16 10h.01"/></>,
  combo: <><path d="M4 14h10M5 10h8M6 6h6"/><path d="M17 6h3l-1 15h-5l-.4-6"/></>,
  portion: <><path d="M4 10h16l-2 9H6Z"/><path d="M8 10c0-3 2-5 4-5s4 2 4 5"/></>,
  drink: <><path d="M6 4h12l-1 17H7Z"/><path d="M9 8h6M15 4l2-2"/></>,
  dessert: <><path d="M5 10h14l-2 9H7Z"/><path d="M8 10c0-3 2-5 4-5s4 2 4 5M12 5l2-2"/></>,
  sauce: <><path d="M9 3h6l1 4-1 14H9L8 7Z"/><path d="M8 7h8M10 12h4"/></>,
  eye: <><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></>,
  'eye-off': <><path d="m3 3 18 18"/><path d="M10.6 10.6a2 2 0 0 0 2.8 2.8"/><path d="M9.9 5.2A10.8 10.8 0 0 1 12 5c6.5 0 10 7 10 7a15.5 15.5 0 0 1-2.1 3.1M6.6 6.6C3.7 8.4 2 12 2 12s3.5 7 10 7c1.6 0 3-.4 4.2-1"/></>,
  sun: <><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></>,
  moon: <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z"/>,
  system: <><rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8M12 17v4"/></>,
  'arrow-up': <path d="m7 14 5-5 5 5M12 9v10"/>,
  'arrow-down': <path d="m7 10 5 5 5-5M12 5v10"/>,
  menu: <path d="M4 7h16M4 12h16M4 17h16"/>,
  kitchen: <><path d="M4 4h16v16H4Z"/><path d="M8 8h8M8 12h8M8 16h5"/></>,
  preparation: <><path d="M5 4h14v16H5Z"/><path d="M8 8h8M8 12h5M8 16h8"/></>,
  clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
  alert: <><path d="m12 3 9 18H3Z"/><path d="M12 9v5M12 17h.01"/></>,
  client: <><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3-6 8-6s8 2 8 6"/></>,
  delivery: <><path d="M3 6h11v12H3Z"/><path d="M14 10h4l3 3v5h-7Z"/><circle cx="7" cy="19" r="2"/><circle cx="18" cy="19" r="2"/></>,
  pickup: <><path d="M4 9h16v11H4Z"/><path d="M6 9 8 4h8l2 5M8 13h8"/></>,
  local: <><path d="M12 21s7-6 7-11a7 7 0 1 0-14 0c0 5 7 11 7 11Z"/><circle cx="12" cy="10" r="2.5"/></>,
  table: <><path d="M4 8h16v4H4Z"/><path d="M7 12v9M17 12v9"/></>,
  note: <><path d="M5 3h14v18H5Z"/><path d="M8 8h8M8 12h8M8 16h5"/></>,
  details: <><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></>,
  printer: <><path d="M6 9V3h12v6M6 17H3V9h18v8h-3"/><path d="M6 14h12v7H6Z"/></>,
  'volume-on': <><path d="M4 10h4l5-4v12l-5-4H4Z"/><path d="M16 9c2 2 2 4 0 6M19 6c4 4 4 8 0 12"/></>,
  'volume-off': <><path d="m4 4 16 16M4 10h4l5-4v5M13 15v3l-5-4H4"/></>,
  cancel: <><circle cx="12" cy="12" r="9"/><path d="m9 9 6 6M15 9l-6 6"/></>,
}

function Icon({ name, size = 20, className = '' }) {
  const content = icons[name] ?? icons.dashboard

  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {content}
    </svg>
  )
}

export default Icon
