import nodemailer from 'nodemailer'

const requiredKeys = ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASSWORD', 'EMAIL_FROM'] as const

function isConfigured() {
  return requiredKeys.every((key) => Boolean(process.env[key]))
}

export async function sendTransactionalEmail(input: {
  to: string
  subject: string
  text: string
  html: string
}) {
  if (!isConfigured()) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Transactional email is not configured.')
    }
    console.info(`[email preview] ${input.subject} → ${input.to}\n${input.text}`)
    return
  }

  const port = Number(process.env.SMTP_PORT ?? 465)
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD,
    },
  })

  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    ...input,
  })
}
