const STYLE_SUFFIXES = {
  A: 'newspaper editorial style, cinematic lighting, corporate atmosphere',
  B: 'tech magazine style, vibrant colors, futuristic workspace',
  C: 'career success, professional confidence, warm studio lighting',
  D: 'personal achievement, joyful celebration, warm natural lighting, inspiring atmosphere',
}

const VARIANT_SUFFIXES = {
  header: 'portrait composition, high quality, photorealistic',
  body: 'wide establishing shot, symbolic moment, high quality, photorealistic',
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

  const style = STYLE_SUFFIXES[template_type] ?? STYLE_SUFFIXES.C
  const variantSuffix = VARIANT_SUFFIXES[variant] ?? VARIANT_SUFFIXES.header
  const finalPrompt = prompt
    ? `${prompt}, ${style}, ${variantSuffix}`
    : `successful professional, modern environment, confident, ${style}, ${variantSuffix}`

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
