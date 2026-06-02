import {
  analyzeTranscript,
  checkAnalysisLimit,
  ensureSchema,
  getAnalysisLimitConfig,
  getAnalysisModel,
  hashClientIp,
  jsonResponse,
  recordAnalysisEvent,
  unauthorized,
  verifyPasscode,
  type Env,
  type TranscriptRecord,
} from '../_lib';

interface PagesContext {
  request: Request;
  env: Env;
}

interface AnalyzeBody {
  id?: number;
  force?: boolean;
}

export const onRequestPost: PagesFunction<Env> = async (context: PagesContext) => {
  const { request, env } = context;

  if (!verifyPasscode(request, env)) {
    return unauthorized();
  }

  if (!env.OPENAI_API_KEY) {
    return jsonResponse({ ok: false, error: 'OPENAI_API_KEY が設定されていません' }, 500);
  }

  try {
    await ensureSchema(env);

    let body: AnalyzeBody = {};
    try {
      body = (await request.json()) as AnalyzeBody;
    } catch {
      return jsonResponse({ ok: false, error: 'リクエスト形式が不正です' }, 400);
    }

    const id = Number(body.id);
    if (!Number.isFinite(id) || id <= 0) {
      return jsonResponse({ ok: false, error: 'id が不正です' }, 400);
    }

    const force = Boolean(body.force);

    const record = await env.DB.prepare(
      `SELECT id, school, grade, class, student_name, filename, transcript,
              analysis, analyzed_at, analysis_model
       FROM transcripts WHERE id = ?`,
    )
      .bind(id)
      .first<
        Pick<
          TranscriptRecord,
          | 'id'
          | 'school'
          | 'grade'
          | 'class'
          | 'student_name'
          | 'filename'
          | 'transcript'
          | 'analysis'
          | 'analyzed_at'
          | 'analysis_model'
        >
      >();

    if (!record) {
      return jsonResponse({ ok: false, error: '記録が見つかりません' }, 404);
    }

    if (record.analysis && record.analyzed_at && !force) {
      return jsonResponse({
        ok: true,
        analysis: record.analysis,
        cached: true,
        analyzed_at: record.analyzed_at,
        model: record.analysis_model ?? getAnalysisModel(env),
      });
    }

    const config = getAnalysisLimitConfig(env);
    if (record.transcript.length > config.maxInputChars) {
      return jsonResponse(
        {
          ok: false,
          error: `文字起こしが長すぎます（上限 ${config.maxInputChars.toLocaleString()} 文字）`,
        },
        400,
      );
    }

    const ipHash = await hashClientIp(request);
    const limit = await checkAnalysisLimit(env, ipHash);
    if (!limit.allowed) {
      return jsonResponse({ ok: false, error: limit.message ?? '分析数が上限に達しました' }, 429);
    }

    const model = getAnalysisModel(env);

    try {
      const result = await analyzeTranscript(env, record);

      await env.DB.prepare(
        `UPDATE transcripts
         SET analysis = ?, analyzed_at = datetime('now'), analysis_model = ?
         WHERE id = ?`,
      )
        .bind(result.analysis, result.model, id)
        .run();

      await recordAnalysisEvent(env, {
        ipHash,
        transcriptId: id,
        model: result.model,
        inputTokens: result.usage.inputTokens,
        outputTokens: result.usage.outputTokens,
        status: 'completed',
      });

      const updated = await env.DB.prepare(`SELECT analyzed_at FROM transcripts WHERE id = ?`)
        .bind(id)
        .first<{ analyzed_at: string }>();

      return jsonResponse({
        ok: true,
        analysis: result.analysis,
        cached: false,
        analyzed_at: updated?.analyzed_at ?? null,
        model: result.model,
      });
    } catch (error) {
      await recordAnalysisEvent(env, {
        ipHash,
        transcriptId: id,
        model,
        inputTokens: 0,
        outputTokens: 0,
        status: 'failed',
      });
      throw error;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : '分析に失敗しました';
    return jsonResponse({ ok: false, error: message }, 500);
  }
};
