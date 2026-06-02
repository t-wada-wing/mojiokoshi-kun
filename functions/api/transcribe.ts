import {
  buildFilename,
  ensureSchema,
  getTranscribeModel,
  jsonResponse,
  transcribeAudio,
  type Env,
} from '../_lib';

interface PagesContext {
  request: Request;
  env: Env;
}

export const onRequestPost: PagesFunction<Env> = async (context: PagesContext) => {
  const { request, env } = context;

  if (!env.OPENAI_API_KEY) {
    return jsonResponse({ ok: false, error: 'OPENAI_API_KEY が設定されていません' }, 500);
  }

  try {
    await ensureSchema(env);
    const formData = await request.formData();
    const school = String(formData.get('school') ?? '').trim();
    const grade = String(formData.get('grade') ?? '').trim();
    const className = String(formData.get('className') ?? '').trim();
    const studentName = String(formData.get('studentName') ?? '').trim();
    const audio = formData.get('audio');

    if (!school || !grade || !className || !studentName) {
      return jsonResponse({ ok: false, error: '入力項目が不足しています' }, 400);
    }

    if (!/^\S+ \S+$/.test(studentName) || studentName.includes('\u3000')) {
      return jsonResponse(
        { ok: false, error: '生徒氏名は苗字と名前の間に半角スペースを入れてください' },
        400,
      );
    }

    if (!(audio instanceof File)) {
      return jsonResponse({ ok: false, error: '音声ファイルがありません' }, 400);
    }

    const filename = buildFilename(school, grade, className, studentName);
    const model = getTranscribeModel(env);
    const audioKey = crypto.randomUUID() + '.mp3';

    await env.AUDIO.put(audioKey, audio.stream(), {
      httpMetadata: {
        contentType: audio.type || 'audio/mpeg',
      },
    });

    let transcript: string;
    try {
      transcript = await transcribeAudio(env, audio, audio.name || 'audio.mp3');
    } catch (error) {
      await env.AUDIO.delete(audioKey);
      throw error;
    }

    const result = await env.DB.prepare(
      `INSERT INTO transcripts (school, grade, class, student_name, filename, transcript, audio_key, model)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       RETURNING id`,
    )
      .bind(school, grade, className, studentName, filename, transcript, audioKey, model)
      .first<{ id: number }>();

    return jsonResponse({
      ok: true,
      id: result?.id,
      filename,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '文字起こしに失敗しました';
    return jsonResponse({ ok: false, error: message }, 500);
  }
};
