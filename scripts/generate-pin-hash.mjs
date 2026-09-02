import { hashPin } from '../worker/auth.js'

const pin = process.env.PIN
if (!pin) {
  console.error('Defina a variável de ambiente PIN antes de gerar o hash.')
  process.exit(1)
}

console.log(await hashPin(pin))
