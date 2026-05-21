import { GoogleGenerativeAI } from '@google/generative-ai'
import { NextResponse } from 'next/server'

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY)

export async function POST(request) {
  try {
    const { imageData, mediaType } = await request.json()
    const base64 = imageData.includes(',') ? imageData.split(',')[1] : imageData
    const imgMediaType = (mediaType && mediaType.startsWith('image/')) ? mediaType : 'image/jpeg'

    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

    const result = await model.generateContent([
      {
        inlineData: { mimeType: imgMediaType, data: base64 },
      },
      `Extract event details from this flyer. Return ONLY valid JSON with these exact keys (null for anything not found):
{
  "title": "event name or title",
  "date": "YYYY-MM-DD — if year is abbreviated like '26' treat as 2026",
  "time_str": "time range exactly as shown on the flyer",
  "location": "venue name and/or city"
}`,
    ])

    const text = result.response.text().trim()
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    const data = JSON.parse(jsonMatch ? jsonMatch[0] : text)
    return NextResponse.json(data)
  } catch (err) {
    console.error('analyze-flyer error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
