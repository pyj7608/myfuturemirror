const STYLE_PROMPTS = {
  A: 'professional business executive, corporate office background, formal suit, confident pose, newspaper portrait style, high quality photography, cinematic lighting',
  B: 'tech entrepreneur, modern workspace, laptop and screens, creative studio, magazine cover style, vibrant colors, dynamic composition',
  C: 'inspiring successful person, warm natural lighting, lifestyle photography, joyful expression, social media aesthetic, soft bokeh background',
}

function arrayBufferToBase64(buffer) {
  const uint8 = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < uint8.byteLength; i++) {
    binary += String.fromCharCode(uint8[i])
  }
  return btoa(binary)
}

export async function onRequestPost(context) {
  const { AI } = context.env

  if (!AI) {
    return Response.json({ error: 'AI binding을 사용할 수 없습니다.' }, { status: 500 })
  }

  const { template_type } = await context.request.json()
  const style = STYLE_PROMPTS[template_type] ?? STYLE_PROMPTS.C
  const prompt = `A successful Korean professional. ${style}. Photorealistic, high resolution.`

  try {
    const response = await AI.run('@cf/stabilityai/stable-diffusion-xl-base-1.0', {
      prompt,
      num_steps: 20,
    })

    const arrayBuffer = await new Response(response).arrayBuffer()
    const base64 = arrayBufferToBase64(arrayBuffer)
    const imageUrl = `data:image/png;base64,${base64}`

    return Response.json({ imageUrl })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}
