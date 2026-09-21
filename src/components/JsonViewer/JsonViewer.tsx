import JsonView from '@uiw/react-json-view';
import { Check, Copy, Download, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { copyJson } from '../../utils/clipboard';
import { downloadJson } from '../../utils/download';
import { searchJson, toJsonCompatible } from '../../utils/json';
import { useLanguage } from '../../i18n/LanguageContext';

interface Props {
  value: object;
  filename: string;
  label: string;
  onCopied: () => void;
}

export function JsonViewer({ value, filename, label, onCopied }: Props) {
  const { t } = useLanguage();
  const [query, setQuery] = useState('');
  const [depth, setDepth] = useState(2);
  const compatible = useMemo(() => toJsonCompatible(value) as object, [value]);
  const matched = useMemo(() => searchJson(compatible, query), [compatible, query]);
  return (
    <section className="jsonPanel">
      <div className="toolbar">
        <label className="search"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('json.search')} /></label>
        <label className="depthControl">{t('json.depth')} <select value={depth} onChange={(event) => setDepth(Number(event.target.value))}><option value={1}>1</option><option value={2}>2</option><option value={3}>3</option><option value={4}>4</option></select></label>
        <button className="button secondary" aria-label={t('json.copyLabel', { label })} onClick={() => copyJson(compatible).then(onCopied)}><Copy size={15} /> {t('json.copy')}</button>
        <button className="button secondary" onClick={() => downloadJson(filename, compatible)}><Download size={15} /> {t('json.download')}</button>
      </div>
      {query && <p className={`searchStatus ${matched ? '' : 'noMatch'}`}><Check size={14} /> {matched ? t('json.match') : t('json.noMatch')}</p>}
      <div className="jsonTree"><JsonView value={compatible} collapsed={depth} displayDataTypes={false} enableClipboard onCopied={onCopied} /></div>
    </section>
  );
}
