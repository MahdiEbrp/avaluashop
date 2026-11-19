import prisma from '@/lib/prisma'
import {
   completePendingOrder,
   releasePendingOrder,
} from '@/lib/payments/order-lifecycle'
import { verifyTabapayPayment } from '@/lib/payments/tabapay'
import { NextResponse } from 'next/server'

function checkoutRedirect(result: 'success' | 'failed' | 'pending', orderId?: string) {
   const appUrl =
      process.env.APP_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.NEXT_PUBLIC_URL

   if (!appUrl) {
      return new NextResponse('Payment status is being checked', { status: 503 })
   }

   const redirectUrl = new URL(`/checkout?payment=${result}`, appUrl)
   if (orderId) redirectUrl.searchParams.set('orderId', orderId)
   return NextResponse.redirect(redirectUrl, { status: 303 })
}

export async function GET(request: Request) {
   const url = new URL(request.url)
   const token = url.searchParams.get('token')

   if (!token || token.length > 128) {
      return checkoutRedirect('failed')
   }

   try {
      const payment = await prisma.payment.findUnique({
         where: { refId: token },
         include: { order: true },
      })

      if (!payment) return checkoutRedirect('failed')
      if (payment.status === 'Paid' && payment.isSuccessful) {
         return checkoutRedirect('success', payment.orderId)
      }
      if (payment.status !== 'Processing') {
         return checkoutRedirect('failed')
      }

      const amountRial = Math.round(payment.payable * 10)
      const verified = await verifyTabapayPayment({ token, amountRial })

      if (!verified) {
         await releasePendingOrder(payment.orderId, payment.id)
         return checkoutRedirect('failed')
      }

      await completePendingOrder(payment.orderId, payment.id)
      return checkoutRedirect('success')
   } catch (error) {
      console.error('[TABAPAY_CALLBACK]', error)
      // A network/verification error is not proof of payment failure.
      // Keep the order pending so it can be safely checked again.
      return checkoutRedirect('pending')
   }
}
