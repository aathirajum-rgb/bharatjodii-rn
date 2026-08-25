import type { IEnvConfig } from './types'

const stg: IEnvConfig = {
  env:        'stg',
  production: false,
  release:    '138',
 api:        'https://stgoapi.jodii.app/',
  payment:    'https://stgoapi.jodii.app/',
  paymentNg:  'https://stgng.jodii.app/',
  notify:     'https://stgmc.jodii.app/',
  image:      'https://stgimg.jodii.app/',
}

export default stg
