import type { AppEnv, IEnvConfig } from './types'
import dev     from './env.dev'
import uat     from './env.uat'
import preprod from './env.preprod'
import prod    from './env.prod'

const envMap: Record<AppEnv, IEnvConfig> = { dev, uat, preprod, prod }

const APP_ENV = (process.env.EXPO_PUBLIC_APP_ENV as AppEnv) ?? 'dev'

export const EnvConfig: IEnvConfig = envMap[APP_ENV] ?? dev
export const CurrentEnv: AppEnv    = EnvConfig.env
export const IsProduction: boolean  = EnvConfig.env === 'prod'

export type { AppEnv, IEnvConfig }
