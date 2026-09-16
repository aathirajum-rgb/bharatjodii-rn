export type AppEnv = 'dev' | 'stg' | 'uat' | 'preprod' | 'prod'

export interface IEnvConfig {
  env:        AppEnv
  production: boolean
  release:    string
  api:        string   // main API
  payment:    string   // payment API
  paymentNg:  string   // UPI autopay, checkout
  notify:     string   // socket / chat server
  image:      string   // CDN — image uploads, PHP scripts
  web:        string   // marketing/web site — privacy policy, terms, ad banner, web logout redirect
}
