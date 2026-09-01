'use client';

import { useEffect, useState } from 'react';

import {
  DEFAULT_THEME,
  THEME_OPTIONS,
  THEME_STORAGE_KEY,
  normalizeTheme,
} from '@/lib/theme';
import type { ThemeKey } from '@/lib/theme';

/**
 * ブルーデザイン3案の切り替え。
 *
 * サーバーには保存しない。端末ごとの見え方の好みなので localStorage に置き、
 * `<html data-theme>` を書き換えて即座に反映する。
 * 初回描画のちらつきは layout.tsx の先読みスクリプトで防いでいる。
 */
export default function ThemePicker() {
  // サーバー描画時は既定案。マウント後に保存値へ合わせる。
  const [theme, setTheme] = useState<ThemeKey>(DEFAULT_THEME);

  useEffect(() => {
    setTheme(normalizeTheme(readStoredTheme()));
  }, []);

  const choose = (next: ThemeKey) => {
    setTheme(next);
    document.documentElement.dataset.theme = next;
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // プライベートモードなどで保存できなくても、その場の切り替えは効かせる。
    }
  };

  return (
    <div className="theme-options" role="radiogroup" aria-label="画面の配色">
      {THEME_OPTIONS.map((option) => {
        const selected = option.key === theme;
        return (
          <button
            key={option.key}
            type="button"
            role="radio"
            aria-checked={selected}
            className="theme-option"
            data-selected={selected}
            onClick={() => choose(option.key)}
          >
            <span className="theme-option-head">
              {option.label}　{option.name}
              <span className="theme-option-check" aria-hidden="true">
                ✓
              </span>
            </span>
            <span className="theme-swatch" aria-hidden="true">
              {option.swatch.map((color) => (
                <span key={color} style={{ background: color }} />
              ))}
            </span>
            <span className="theme-option-desc">{option.description}</span>
          </button>
        );
      })}
    </div>
  );
}

function readStoredTheme(): string | null {
  try {
    return window.localStorage.getItem(THEME_STORAGE_KEY);
  } catch {
    return null;
  }
}
