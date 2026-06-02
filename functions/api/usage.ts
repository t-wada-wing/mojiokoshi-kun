import {
  ensureSchema,
  getMonthlyUsage,
  getUsdJpyRate,
  jsonResponse,
  unauthorized,
  verifyPasscode,
  type Env,
} from '../_lib';

interface PagesContext {
  request: Request;
  env: Env;
}

export const onRequestGet: PagesFunction<Env> = async (context: PagesContext) => {
  const { request, env } = context;

  if (!verifyPasscode(request, env)) {
    return unauthorized();
  }

  try {
    await ensureSchema(env);
    const months = await getMonthlyUsage(env, 6);

    return jsonResponse({
      ok: true,
      months,
      usdJpyRate: getUsdJpyRate(env),
      disclaimer:
        '表示は目安です。実際の請求はOpenAIダッシュボードをご確認ください。本機能導入以降のデータのみ集計されます。',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '利用料金の取得に失敗しました';
    return jsonResponse({ ok: false, error: message }, 500);
  }
};
