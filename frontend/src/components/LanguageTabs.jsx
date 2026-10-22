import React from 'react';
import { LANGUAGES, cn } from '../lib/utils';

export default function LanguageTabs({ value, onChange, disabled }) {
  return (
    <div className="lang-tabs" role="tablist" aria-label="Solution language">
      {LANGUAGES.map((lang) => (
        <button
          key={lang.value}
          type="button"
          role="tab"
          aria-selected={value === lang.value}
          disabled={disabled}
          className={cn('lang-tab', value === lang.value && 'active')}
          onClick={() => onChange?.(lang.value)}
          title={`Show ${lang.label} solution`}
        >
          {lang.label}
        </button>
      ))}
    </div>
  );
}
