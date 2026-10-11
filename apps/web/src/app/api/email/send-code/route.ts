import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { email, code } = await req.json()

    if (!email || !code) {
      return NextResponse.json(
        { success: false, message: 'Missing email or verification code' },
        { status: 400 }
      )
    }

    const apiKey = process.env.RESEND_API_KEY
    const fromAddress = process.env.EMAIL_FROM || 'onboarding@resend.dev'

    if (!apiKey) {
      return NextResponse.json(
        { success: false, message: 'Resend API key not configured' },
        { status: 500 }
      )
    }

    const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f9fafb; margin: 0; padding: 24px; color: #111827; }
    .card { max-width: 480px; margin: 0 auto; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 16px; padding: 32px 28px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
    .logo { font-size: 20px; font-weight: 800; color: #4f46e5; margin-bottom: 24px; display: inline-block; }
    h1 { font-size: 20px; font-weight: 700; color: #111827; margin: 0 0 12px 0; }
    p { font-size: 14px; color: #4b5563; line-height: 1.5; margin: 0 0 20px 0; }
    .code-box { background: #f3f4f6; border-radius: 12px; padding: 18px 24px; text-align: center; margin: 24px 0; }
    .code { font-family: 'Courier New', Courier, monospace; font-size: 32px; font-weight: 800; letter-spacing: 6px; color: #4f46e5; }
    .expiry { font-size: 12px; color: #6b7280; text-align: center; margin-top: 8px; }
    .footer { margin-top: 32px; font-size: 12px; color: #9ca3af; text-align: center; border-top: 1px solid #f3f4f6; padding-top: 16px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">🤫 Private Voices</div>
    <h1>Verify your email address</h1>
    <p>Please enter the following 6-digit verification code to complete your Private Voices sign-up:</p>
    <div class="code-box">
      <div class="code">${code}</div>
      <div class="expiry">Expires in 10 minutes</div>
    </div>
    <p style="font-size: 13px; color: #6b7280;">If you didn't request this verification code, you can safely ignore this email.</p>
    <div class="footer">
      &copy; ${new Date().getFullYear()} Private Voices. All rights reserved.
    </div>
  </div>
</body>
</html>
`

    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `Private Voices <${fromAddress}>`,
        to: [email],
        subject: `${code} is your Private Voices verification code`,
        html: htmlBody,
      }),
    })

    const resendData = await resendRes.json()

    if (!resendRes.ok) {
      console.error('Resend API response error:', resendData)
      return NextResponse.json(
        {
          success: false,
          fallback: true,
          message: resendData.message || 'Failed to dispatch email via Resend',
        },
        { status: 400 }
      )
    }

    return NextResponse.json({ success: true, id: resendData.id })
  } catch (err: any) {
    console.error('Email dispatch route error:', err)
    return NextResponse.json(
      { success: false, message: err?.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
