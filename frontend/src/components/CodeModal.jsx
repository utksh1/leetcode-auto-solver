import React from 'react';
import { Copy, X } from 'lucide-react';
import { useToast } from '../context/ToastContext';

export default function CodeModal({ isOpen, onClose, title, code, language }) {
  const { showToast } = useToast();

  if (!isOpen) return null;

  const handleCopy = () => {
    if (!code) return;
    navigator.clipboard.writeText(code);
    showToast('Code copied to clipboard!', 'success');
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h3 style={{ margin: 0 }}>{title || 'Submission Code'}</h3>
            {language && (
              <span className="badge" style={{ marginTop: '4px', background: 'rgba(255,255,255,0.06)' }}>
                {language}
              </span>
            )}
          </div>
          <button className="modal-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        <div className="modal-body">
          <div className="code-container" style={{ maxHeight: '60vh' }}>
            <pre>
              <code>{code || '// No code stored'}</code>
            </pre>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
          <button className="btn btn-primary" onClick={handleCopy}>
            <Copy size={16} />
            <span>Copy Code</span>
          </button>
        </div>
      </div>
    </div>
  );
}
