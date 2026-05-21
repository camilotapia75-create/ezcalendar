import Anthropic from '@anthropic-ai/sdk'
import { NextResponse } from 'next/server'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export async function POST(request) {
  try {
    const { imageData, mediaType } = await request.json()

    const base64 = imageData.includes(',') ? imageData.split(',')[1] : imageData
    const imgMediaType = (mediaType && mediaType.startsWith('image/')) ? mediaType : 'image/jpeg'

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 512,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: imgMediaType, data: base64 },
            },
            {
              type: 'text',
              text: `Extract event details from this flyer. Return ONLY valid JSON with these exact keys (null for anything not found):
{
  "title": "event name",
  "date": "YYYY-MM-DD (if year is abbreviated like '26' use 2026)",
  "time_str": "time range as shown",
  "location": "venue and/or city"
}`,
            },
          ],
        },
      ],
    })

    const text = message.content[0].text.trim()
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    const data = JSON.parse(jsonMatch ? jsonMatch[0] : text)
    return NextResponse.json(data)
  } catch (err) {
    console.error('analyze-flyer error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
