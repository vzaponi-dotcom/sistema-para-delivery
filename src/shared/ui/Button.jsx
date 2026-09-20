import Icon from './Icon'

function Button({ variant = 'primary', icon, children, className = '', ...props }) {
  const classes = ['button', `button-${variant}`, className].filter(Boolean).join(' ')

  return (
    <button className={classes} {...props}>
      {icon && <Icon name={icon} size={18} />}
      <span>{children}</span>
    </button>
  )
}

export default Button
