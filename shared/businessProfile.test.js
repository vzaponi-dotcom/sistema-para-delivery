import test from 'node:test'
import assert from 'node:assert/strict'
import { EMPTY_BUSINESS_PROFILE, parseBusinessProfile } from './businessProfile.js'

const valid = (overrides = {}) => ({
  name: '  Amor & Sabor  ',
  phone: ' (19) 99999-9999 ',
  address: {
    line: ' Rua das Flores ',
    number: ' 123 ',
    complement: ' Fundos ',
    neighborhood: ' Centro ',
    city: ' Monte Mor ',
    state: ' sp ',
    postalCode: '13190-000',
  },
  ...overrides,
})

test('business profile parser normalizes the approved V1 fields', () => {
  assert.deepEqual(parseBusinessProfile(valid()), {
    name: 'Amor & Sabor',
    phone: '(19) 99999-9999',
    address: {
      line: 'Rua das Flores',
      number: '123',
      complement: 'Fundos',
      neighborhood: 'Centro',
      city: 'Monte Mor',
      state: 'SP',
      postalCode: '13190000',
    },
  })
})

test('business profile optional fields may be empty', () => {
  assert.deepEqual(parseBusinessProfile({
    name: 'Nova Operação',
    phone: '',
    address: { line: '', number: '', complement: '', neighborhood: '', city: '', state: '', postalCode: '' },
  }), { ...EMPTY_BUSINESS_PROFILE, name: 'Nova Operação' })
})

test('business profile rejects unknown fields and invalid name before persistence', () => {
  for (const [data, field] of [
    [{ ...valid(), businessId: 'other' }, 'businessId'],
    [{ ...valid(), name: '   ' }, 'name'],
    [{ ...valid(), name: 'a'.repeat(121) }, 'name'],
    [{ ...valid(), name: 'Nome\u0000ruim' }, 'name'],
    [{ ...valid(), address: { ...valid().address, extra: 'x' } }, 'address.extra'],
  ]) {
    assert.throws(() => parseBusinessProfile(data), (error) => (
      error?.status === 400 && error?.code === 'BUSINESS_PROFILE_INVALID' && error?.field === field
    ))
  }
})

test('business profile enforces phone and address limits plus normalized UF and CEP', () => {
  const cases = [
    [{ ...valid(), phone: '1'.repeat(33) }, 'phone'],
    [{ ...valid(), address: { ...valid().address, line: 'a'.repeat(121) } }, 'address.line'],
    [{ ...valid(), address: { ...valid().address, number: 'a'.repeat(31) } }, 'address.number'],
    [{ ...valid(), address: { ...valid().address, complement: 'a'.repeat(81) } }, 'address.complement'],
    [{ ...valid(), address: { ...valid().address, neighborhood: 'a'.repeat(81) } }, 'address.neighborhood'],
    [{ ...valid(), address: { ...valid().address, city: 'a'.repeat(81) } }, 'address.city'],
    [{ ...valid(), address: { ...valid().address, state: 'S' } }, 'address.state'],
    [{ ...valid(), address: { ...valid().address, state: 'SPO' } }, 'address.state'],
    [{ ...valid(), address: { ...valid().address, postalCode: '1319' } }, 'address.postalCode'],
    [{ ...valid(), address: { ...valid().address, postalCode: 'abcdefgh' } }, 'address.postalCode'],
  ]
  for (const [data, field] of cases) {
    assert.throws(() => parseBusinessProfile(data), (error) => error?.code === 'BUSINESS_PROFILE_INVALID' && error?.field === field)
  }
})
