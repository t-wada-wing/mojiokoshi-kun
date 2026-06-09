const RECIPIENTS = [
  't-narazaki@rensei.co.jp',
  't-wada@rensei.co.jp',
];

function doGet() {
  return json_({
    ok: true,
    service: 'mojiokoshi-kun-upload-notification',
  });
}

function doPost(e) {
  try {
    const payload = parsePayload_(e);
    const expectedSecret = PropertiesService.getScriptProperties().getProperty('GAS_WEBHOOK_SECRET');

    if (!expectedSecret) {
      return json_({ ok: false, error: 'GAS_WEBHOOK_SECRET is not set' });
    }

    if (payload.secret !== expectedSecret) {
      return json_({ ok: false, error: 'forbidden' });
    }

    MailApp.sendEmail({
      to: RECIPIENTS.join(','),
      subject: `[文字起こしくん] ${text_(payload.school)} / ${text_(payload.studentName)}`,
      body: buildBody_(payload),
      name: '文字起こしくん',
    });

    return json_({ ok: true });
  } catch (error) {
    console.error(error);
    return json_({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

function setWebhookSecretForSetup(secret) {
  if (!secret) {
    throw new Error('secret is required');
  }

  PropertiesService.getScriptProperties().setProperty('GAS_WEBHOOK_SECRET', String(secret));
  return { ok: true };
}

function authorizeForSetup() {
  return {
    ok: true,
    hasSecret: Boolean(PropertiesService.getScriptProperties().getProperty('GAS_WEBHOOK_SECRET')),
    remainingDailyQuota: MailApp.getRemainingDailyQuota(),
  };
}

function parsePayload_(e) {
  if (!e || !e.postData || !e.postData.contents) {
    throw new Error('Request body is empty');
  }

  return JSON.parse(e.postData.contents);
}

function buildBody_(payload) {
  const lines = [
    '新しい音声アップロードが完了しました。',
    '',
    `学校: ${text_(payload.school)}`,
    `学年: ${text_(payload.grade)}`,
    `クラス: ${text_(payload.className)}`,
    `生徒: ${text_(payload.studentName)}`,
    `ファイル: ${text_(payload.filename)}`,
  ];

  if (payload.transcriptId) {
    lines.push(`記録ID: ${text_(payload.transcriptId)}`);
  }

  if (payload.adminUrl) {
    lines.push('', `管理画面: ${text_(payload.adminUrl)}`);
  }

  return lines.join('\n');
}

function text_(value) {
  if (value === null || value === undefined) return '';
  return String(value);
}

function json_(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
