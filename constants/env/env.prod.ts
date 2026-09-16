import type { IEnvConfig } from './types'

const prod: IEnvConfig = {
  env:        'prod',
  production: true,
  release:    '138',
  api:        'https://oapi.bharatjodii.com/',
  payment:    'https://oapi.bharatjodii.com/',
  paymentNg:  'https://ng.bharatjodii.com/',
  notify:     'https://mc.bharatjodii.com',
  image:      'https://imgs.bharatjodii.com/',
  web:        'https://www.bharatjodii.com/',
}

export default prod
