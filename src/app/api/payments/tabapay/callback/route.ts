import prisma from '@/lib/prisma'
import {
   completePendingOrder,
   releasePendingOrder,
} from '@/lib/payments/order-lifecycle'
import { verifyTabapayPayment } from '@/lib/payments/tabapay'
import { NextResponse } from 'next/server'

function checkoutRedirect(request: Request, result: 'success' | 'failed' | 'pending') {
   return NextResponse.redirect(
      new URL(`/checkout?payment=${result}`, request.url),
      { status: 303 }
   )
}

export async function GET(request: Request) {
   const url = new URL(request.url)
   const token = url.searchParams.get('token')

   if (!token || token.length > 128) {
      return checkoutRedirect(request, 'failed')
   }

   try {
      const payment = await prisma.payment.findUnique({
         where: { refId: token },
         include: { order: true },
      })

      if (!payment) return checkoutRedirect(request, 'failed')
      if (payment.status === 'Paid' && payment.isSuccessful) {
         return checkoutRedirect(request, 'success')
      }
      if (payment.status !== 'Processing') {
         return checkoutRedirect(request, 'failed')
      }

      const amountRial = Math.round(payment.payable * 10)
      const verified = await verifyTabapayPayment({ token, amountRial })

      if (!verified) {
         await releasePendingOrder(payment.orderId, payment.id)
         return checkoutRedirect(request, 'failed')
      }

      await completePendingOrder(payment.orderId, payment.id)
      return checkoutRedirect(request, 'success')
   } catch (error) {
      console.error('[TABAPAY_CALLBACK]', error)
      // A network/verification error is not proof of payment failure.
      // Keep the order pending so it can be safely checked again.
      return checkoutRedirect(request, 'pending')
   }
}
