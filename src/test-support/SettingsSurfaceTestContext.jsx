import React from 'react'

import { PolicyEditingContext } from '../app/policy-editing/policyEditingContext.js'
import SettingsSurface from '../app/surfaces/settings/SettingsSurface.jsx'

export default function SettingsSurfaceTestContext({ policyEditing, ...props }) {
  return <PolicyEditingContext.Provider value={policyEditing}>
    <SettingsSurface {...props} />
  </PolicyEditingContext.Provider>
}
