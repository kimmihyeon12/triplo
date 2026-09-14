export function normalizeNickname(value: string): string | null {
  const nickname = value.normalize('NFC').trim();
  const length = Array.from(nickname).length;
  return length >= 2 && length <= 20 && !/[\u0000-\u001f\u007f]/.test(nickname) ? nickname : null;
}

export function nicknameFrom(metadata: Record<string, unknown> | undefined): string | null {
  return typeof metadata?.['travel_nickname'] === 'string'
    ? normalizeNickname(metadata['travel_nickname'])
    : null;
}
