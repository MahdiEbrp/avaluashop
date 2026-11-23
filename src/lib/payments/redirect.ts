export function redirectToPayment(paymentUrl: string) {
   globalThis.location.assign(paymentUrl)
}
