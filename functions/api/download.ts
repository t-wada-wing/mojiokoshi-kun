import { zipSync, strToU8 } from 'fflate';
import {
  contentDisposition,
  ensureSchema,
  jsonResponse,
  unauthorized,
  verifyPasscode,
  type Env,
  type TranscriptRecord,
} from '../_lib';

interface PagesContext {
  request: Request;
  env: Env;
}

function uniqueZipName(filename: string, used: Map<string, number>): string {
  const count = used.get(filename) ?? 0;
  used.set(filename, count + 1);
  if (count === 0) return filename;

  const dotIndex = filename.lastIndexOf('.');
  if (dotIndex === -1) return `${filename}_${count + 1}`;
  const base = filename.slice(0, dotIndex);
  const ext = filename.slice(dotIndex);
  return `${base}_${count + 1}${ext}`;
}

export const onRequestGet: PagesFunction<Env> = async (context: PagesContext) => {
  const { request, env } = context;

  if (!verifyPasscode(request, env)) {
    return unauthorized();
  }

  const url = new URL(request.url);
  const id = url.searchParams.get('id');
  const school = url.searchParams.get('school')?.trim();

  try {
    await ensureSchema(env);
    if (id) {
      const record = await env.DB.prepare(
        `SELECT id, filename, transcript FROM transcripts WHERE id = ?`,
      )
        .bind(Number(id))
        .first<Pick<TranscriptRecord, 'id' | 'filename' | 'transcript'>>();

      if (!record) {
        return jsonResponse({ ok: false, error: '記録が見つかりません' }, 404);
      }

      return new Response(record.transcript, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Content-Disposition': contentDisposition(record.filename),
        },
      });
    }

    if (school) {
      const result = await env.DB.prepare(
        `SELECT id, filename, transcript FROM transcripts WHERE school = ? ORDER BY created_at ASC, id ASC`,
      )
        .bind(school)
        .all<Pick<TranscriptRecord, 'id' | 'filename' | 'transcript'>>();

      const records = result.results ?? [];
      if (records.length === 0) {
        return jsonResponse({ ok: false, error: 'このスクールの記録はありません' }, 404);
      }

      const usedNames = new Map<string, number>();
      const zipEntries: Record<string, Uint8Array> = {};

      for (const record of records) {
        const zipName = uniqueZipName(record.filename, usedNames);
        zipEntries[zipName] = strToU8(record.transcript);
      }

      const zipData = zipSync(zipEntries);
      const zipFilename = `${school}_文字起こし.zip`;

      return new Response(zipData, {
        headers: {
          'Content-Type': 'application/zip',
          'Content-Disposition': contentDisposition(zipFilename),
        },
      });
    }

    return jsonResponse({ ok: false, error: 'id または school を指定してください' }, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'ダウンロードに失敗しました';
    return jsonResponse({ ok: false, error: message }, 500);
  }
};
