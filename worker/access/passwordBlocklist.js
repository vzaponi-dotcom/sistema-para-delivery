export const PASSWORD_BLOCKLIST_VERSION = '2026-09-30.v1'

// Local, reviewed seed list of common/default passwords. Update the version
// together with entries; enrollment requires no external password disclosure.
const BLOCKED_PASSWORDS = new Set([
  'password', 'password1', 'password123', 'password123456', 'passwordpassword',
  '123456', '123456789', '123456789012345', '1234567890123456',
  'qwerty', 'qwerty123', 'qwertyuiop', 'qwertyuiop123456',
  'letmein', 'letmeinletmein', 'letmeinletmein123', 'iloveyou',
  'iloveyouiloveyou', 'welcome', 'welcomewelcome123', 'admin',
  'adminadminadmin', 'administrator', 'changeme', 'changemechangeme',
  'senha', 'senha123', 'senha123456789012', 'amor-e-sabor', 'correct horse battery staple',
])

export const isBlockedPassword = (password) => typeof password === 'string'
  && BLOCKED_PASSWORDS.has(password.normalize('NFKC').toLowerCase())
