const STYLE_PROMPTS = {
  A: 'professional business executive, corporate office, formal suit, confident, cinematic lighting, newspaper style',
  B: 'tech entrepreneur, modern workspace, laptop, creative studio, vibrant colors, magazine style',
  C: 'inspiring successful person, warm natural lighting, joyful, lifestyle photography, soft bokeh',
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

  const { prompt, template_type, variant = 'header' } = await context.request.json()

  const style = STYLE_PROMPTS[template_type] ?? STYLE_PROMPTS.C
  const variantSuffix = variant === 'body' ? ', wide establishing shot, dramatic moment, symbolic' : ''
  const finalPrompt = prompt
    ? `${prompt}, ${style}${variantSuffix}, photorealistic, high quality`
    : `Successful Korean professional. ${style}${variantSuffix}. Photorealistic.`

  try {
    const response = await AI.run('@cf/stabilityai/stable-diffusion-xl-base-1.0', {
      prompt: finalPrompt,
      num_steps: 20,
    })

    const arrayBuffer = await new Response(response).arrayBuffer()
    const base64 = arrayBufferToBase64(arrayBuffer)

    return Response.json({ imageUrl: `data:image/png;base64,${base64}` })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}
