/**
 * 保存できた瞬間などに、ごく短く振動させる。
 *
 * 画面の変化だけだと、屋外や移動中は「効いたのか」が分かりにくい。
 * iOS Safari は Vibration API に対応していないため何も起こらない。
 * 対応端末だけのおまけとして扱い、これに頼った作りにはしない。
 */
export function tap(pattern: number | number[] = 12): void {
  if (typeof navigator === 'undefined') return;
  const vibrate = navigator.vibrate?.bind(navigator);
  if (!vibrate) return;
  try {
    vibrate(pattern);
  } catch {
    // 端末の設定で無効なだけなので、失敗しても何もしない。
  }
}
