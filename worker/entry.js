// Workerd treats every entry export as a handler. Keep test/private helpers
// in index.js without exposing their constants as runtime entrypoints.
export { default } from './index.js'
