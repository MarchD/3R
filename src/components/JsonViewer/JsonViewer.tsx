import JsonView from '@uiw/react-json-view';
import { Check, Copy, Download, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { copyJson } from '../../utils/clipboard';
import { downloadJson } from '../../utils/download';
import { searchJson, toJsonCompatible } from '../../utils/json';

interface Props {
  value: object;
  filename: string;
  label: string;
  onCopied: () => void;
}

export function JsonViewer({ value, filename, label, onCopied }: Props) {
  const [query, setQuery] = useState('');
  const [depth, setDepth] = useState(2);
  const compatible = useMemo(() => toJsonCompatible(value) as object, [value]);
  const matched = useMemo(() => searchJson(compatible, query), [compatible, query]);
  return (
    <section className="jsonPanel">
      <div className="toolbar">
        <label className="search"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search key or value" /></label>
        <label className="depthControl">Collapse depth <select value={depth} onChange={(event) => setDepth(Number(event.target.value))}><option value={1}>1</option><option value={2}>2</option><option value={3}>3</option><option value={4}>4</option></select></label>
        <button className="button secondary" aria-label={`Copy ${label}`} onClick={() => copyJson(compatible).then(onCopied)}><Copy size={15} /> Copy</button>
        <button className="button secondary" onClick={() => downloadJson(filename, compatible)}><Download size={15} /> Download</button>
      </div>
      {query && <p className={`searchStatus ${matched ? '' : 'noMatch'}`}><Check size={14} /> {matched ? 'A matching key or value exists in this document.' : 'No matching key or value.'}</p>}
      <div className="jsonTree"><JsonView value={compatible} collapsed={depth} displayDataTypes={false} enableClipboard onCopied={onCopied} /></div>
    </section>
  );
}
