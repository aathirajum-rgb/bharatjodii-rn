declare module 'react-native-razorpay' {
  export interface RazorpayOptions {
    key: string
    amount: number | string
    currency?: string
    order_id?: string
    name?: string
    description?: string
    image?: string
    prefill?: {
      name?: string
      email?: string
      contact?: string
    }
    notes?: Record<string, string>
    theme?: { color?: string }
    method?: Record<string, boolean | string>
    'upi.vpa'?: string
  }

  export interface RazorpaySuccessResponse {
    razorpay_payment_id: string
    razorpay_order_id?: string
    razorpay_signature?: string
  }

  export interface RazorpayError {
    code: number
    description: string
  }

  const RazorpayCheckout: {
    open(options: RazorpayOptions): Promise<RazorpaySuccessResponse>
  }

  export default RazorpayCheckout
}
