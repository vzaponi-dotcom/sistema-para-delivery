import TeamAccess from './TeamAccess.jsx'
import ActivityLog from './ActivityLog.jsx'
import MyAccount from './MyAccount.jsx'

export default function AccessSurface({ section, ...props }) {
  if (section === 'access-team') return <TeamAccess {...props} />
  if (section === 'access-activity') return <ActivityLog {...props} />
  if (section === 'my-account') return <MyAccount {...props} />
  return null
}
