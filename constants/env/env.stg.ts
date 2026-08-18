import type { IEnvConfig } from './types'

const stg: IEnvConfig = {
  env:        'stg',
  production: false,
  release:    '138',
 api:        'https://oapi.jodii.app/',
  payment:    'https://oapi.jodii.app/',
  paymentNg:  'https://ng.jodii.app/',
  notify:     'https://mc.jodii.app',
  image:      'https://imgs.jodii.app/',
}

export default stg
