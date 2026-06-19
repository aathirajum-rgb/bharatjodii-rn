import type { IEnvConfig } from './types'

const uat: IEnvConfig = {
  env:        'uat',
  production: false,
  release:    '138',
  api:        'https://stgoapi.jodii.app/',
  payment:    'https://stgoapi.jodii.app/',
  paymentNg:  'https://stgng.jodii.app/',
  notify:     'https://stgmc.jodii.app/',
  image:      'https://stgimg.jodii.app/',
}

export default uat
