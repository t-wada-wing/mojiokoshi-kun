import { ensureSchema, jsonResponse, unauthorized, verifyPasscode, type Env } from '../_lib';

interface PagesContext {
  request: Request;
  env: Env;
}

export const onRequestDelete: PagesFunction<Env> = async (context: PagesContext) => {
  const { request, env } = context;

  if (!verifyPasscode(request, env)) {
    return unauthorized();
  }

  const id = Number(new URL(request.url).searchParams.get('id'));
  if (!Number.isFinite(id)) {
    return jsonResponse({ ok: false, error: 'id が不正です' }, 400);
  }

  try {
    await ensureSchema(env);
    const record = await env.DB.prepare(`SELECT audio_key FROM transcripts WHERE id = ?`)
      .bind(id)
      .first<{ audio_key: string | null }>();

    if (!record) {
      return jsonResponse({ ok: false, error: '記録が見つかりません' }, 404);
    }

    if (record.audio_key) {
      await env.AUDIO.delete(record.audio_key);
    }

    await env.DB.prepare(`DELETE FROM transcripts WHERE id = ?`).bind(id).run();

    return jsonResponse({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : '削除に失敗しました';
    return jsonResponse({ ok: false, error: message }, 500);
  }
};
