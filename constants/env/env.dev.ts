import type { IEnvConfig } from './types'

const dev: IEnvConfig = {
  env:        'dev',
  production: false,
  release:    '138',
  api:        'https://dev1oapi.jodii.app/',
  payment:    'https://dev1oapi.jodii.app/',
  paymentNg:  'https://devng.jodii.app/',
  notify:     'https://devmc.jodii.app',
  image:      'https://stgimg.jodii.app/',
}

export default dev
