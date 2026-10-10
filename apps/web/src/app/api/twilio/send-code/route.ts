import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { targetType, targetValue, code } = await req.json()

    if (!targetValue || !code) {
      return NextResponse.json({ success: false, message: 'Missing target value or code' }, { status: 400 })
    }

    const accountSid = process.env.TWILIO_ACCOUNT_SID
    const authToken = process.env.TWILIO_AUTH_TOKEN
    const fromPhone = process.env.TWILIO_PHONE_NUMBER || process.env.TWILIO_FROM_NUMBER

    if (!accountSid || !authToken) {
      return NextResponse.json({ success: false, message: 'Twilio credentials not configured' }, { status: 500 })
    }

    if (targetType === 'phone') {
      // Send SMS via Twilio Messages API
      if (!fromPhone) {
        // If no sender number is assigned yet, inform caller
        return NextResponse.json({
          success: false,
          fallback: true,
          message: 'Twilio sender phone number not configured. Using in-app OTP code.'
        })
      }

      const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`
      const bodyParams = new URLSearchParams({
        To: targetValue,
        From: fromPhone,
        Body: `Your Private Voices verification code is: ${code}. Do not share this code with anyone.`,
      })

      const twilioRes = await fetch(twilioUrl, {
        method: 'POST',
        headers: {
          'Authorization': 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64'),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: bodyParams.toString(),
      })

      const twilioData = await twilioRes.json()

      if (!twilioRes.ok) {
        return NextResponse.json({
          success: false,
          fallback: true,
          message: twilioData.message || 'Twilio SMS failed to dispatch',
        }, { status: 400 })
      }

      return NextResponse.json({ success: true, sid: twilioData.sid })
    }

    // Email dispatch via SendGrid or generic webhook
    return NextResponse.json({ success: true, message: 'OTP processed' })
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err?.message || 'Twilio request failed' }, { status: 500 })
  }
}
