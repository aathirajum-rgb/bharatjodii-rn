import type { IEnvConfig } from './types'

const preprod: IEnvConfig = {
  env:        'preprod',
  production: false,
  release:    '138',
  api:        'https://ppoapi.jodii.app/',
  payment:    'https://ppoapi.jodii.app/',
  paymentNg:  'https://ppng.jodii.app/',
  notify:     'https://ppmc.jodii.app',
  image:      'https://ppimgs.jodii.app/',
}

export default preprod
