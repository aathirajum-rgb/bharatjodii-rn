import type { IEnvConfig } from './types'

const prod: IEnvConfig = {
  env:        'prod',
  production: true,
  release:    '138',
  api:        'https://oapi.jodii.app/',
  payment:    'https://oapi.jodii.app/',
  paymentNg:  'https://ng.jodii.app/',
  notify:     'https://mc.jodii.app',
  image:      'https://imgs.jodii.app/',
}

export default prod
