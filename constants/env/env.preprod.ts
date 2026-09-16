import type { IEnvConfig } from './types'

const preprod: IEnvConfig = {
  env:        'preprod',
  production: false,
  release:    '138',
  api:        'https://ppoapi.bharatjodii.com/',
  payment:    'https://ppoapi.bharatjodii.com/',
  paymentNg:  'https://ppng.bharatjodii.com/',
  notify:     'https://ppmc.bharatjodii.com',
  image:      'https://ppimgs.bharatjodii.com/',
  web:        'https://ppwww.bharatjodii.com/',
}

export default preprod
