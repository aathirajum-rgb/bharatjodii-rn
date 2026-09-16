import type { IEnvConfig } from './types'

const stg: IEnvConfig = {
  env:        'stg',
  production: false,
  release:    '138',
 api:        'https://stgoapi.bharatjodii.com/',
  payment:    'https://stgoapi.bharatjodii.com/',
  paymentNg:  'https://stgng.bharatjodii.com/',
  notify:     'https://stgmc.bharatjodii.com/',
  image:      'https://stgimg.bharatjodii.com/',
  web:        'https://devwww.bharatjodii.com/',
}

export default stg
