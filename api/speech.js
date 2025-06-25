// api/speech.js - 语音合成API代理
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  try {
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
    
    const { text, provider = 'openai', voice = 'nova' } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }

    // 尝试ElevenLabs（如果配置了）
    if (provider === 'elevenlabs' && ELEVENLABS_API_KEY) {
      try {
        const response = await fetch('https://api.elevenlabs.io/v1/text-to-speech/21m00Tcm4TlvDq8ikWAM', {
          method: 'POST',
          headers: {
            'Accept': 'audio/mpeg',
            'Content-Type': 'application/json',
            'xi-api-key': ELEVENLABS_API_KEY
          },
          body: JSON.stringify({
            text: text,
            model_id: 'eleven_multilingual_v2',
            voice_settings: {
              stability: 0.5,
              similarity_boost: 0.8,
              style: 0.3,
              use_speaker_boost: true
            }
          })
        });

        if (response.ok) {
          const audioBuffer = await response.arrayBuffer();
          res.setHeader('Content-Type', 'audio/mpeg');
          return res.send(Buffer.from(audioBuffer));
        }
      } catch (error) {
        console.log('ElevenLabs failed, falling back to OpenAI');
      }
    }

    // 备选：使用OpenAI TTS
    if (!OPENAI_API_KEY) {
      return res.status(500).json({ error: 'No TTS API key configured' });
    }

    const response = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'tts-1',
        voice: voice,
        input: text,
        speed: 1.0
      })
    });

    if (!response.ok) {
      throw new Error('OpenAI TTS request failed');
    }

    const audioBuffer = await response.arrayBuffer();
    res.setHeader('Content-Type', 'audio/mpeg');
    res.send(Buffer.from(audioBuffer));

  } catch (error) {
    console.error('Speech API Error:', error);
    res.status(500).json({ error: 'Speech generation failed' });
  }
}