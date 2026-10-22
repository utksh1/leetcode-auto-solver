import React, { useEffect, useRef, useState } from 'react';
import { Copy, Check, X } from 'lucide-react';
import { useToast } from '../context/ToastContext';
import CodeBlock from './CodeBlock';
import { copyToClipboard } from '../lib/utils';

export default function CodeModal({ isOpen, onClose, title, code, language }) {
  const { showToast } = useToast();
  const closeRef = useRef(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!isOpen) return undefined;

    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', onKeyDown);
    document.body.classList.add('modal-open');
    closeRef.current?.focus();

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.classList.remove('modal-open');
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleCopy = async () => {
    if (!code) return;
    try {
      await copyToClipboard(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
      showToast('Code copied to clipboard!', 'success');
    } catch {
      showToast('Could not copy to clipboard', 'error');
    }
  };

  return (
    <div
      className="modal-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={title || 'Submission code'}
    >
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-group">
            <h3 className="modal-title">{title || 'Submission Code'}</h3>
            {language && (
              <span className="badge badge-accent" style={{ marginTop: 4 }}>
                {language}
              </span>
            )}
          </div>
          <button ref={closeRef} type="button" className="modal-close" onClick={onClose} aria-label="Close dialog">
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          {code ? (
            <CodeBlock code={code} language={language} maxHeight="58vh" />
          ) : (
            <div className="empty-state" style={{ padding: '32px 16px' }}>
              <div className="empty-title">No code stored</div>
              <p className="empty-desc">
                This submission record does not contain the submitted source code.
              </p>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
          <button type="button" className="btn btn-primary" onClick={handleCopy} disabled={!code}>
            {copied ? <Check size={16} /> : <Copy size={16} />}
            <span>{copied ? 'Copied!' : 'Copy Code'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
