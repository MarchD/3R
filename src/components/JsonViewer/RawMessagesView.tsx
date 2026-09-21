import { Copy, Download, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { List, type RowComponentProps } from 'react-window';
import type { RawFitMessage } from '../../models/fit';
import { copyJson } from '../../utils/clipboard';
import { downloadJson } from '../../utils/download';
import { safeStringify } from '../../utils/json';

function MessageRow({ index, style, messages }: RowComponentProps<{ messages: RawFitMessage[] }>) {
  const message = messages[index];
  return <div className="rawRow" style={style}><div><strong>{message.messageType}</strong><span>#{message.index} · mesg {message.messageNumber}</span></div><pre>{safeStringify(message.data, 0)}</pre></div>;
}

export function RawMessagesView({ messages, onCopied }: { messages: RawFitMessage[]; onCopied: () => void }) {
  const [type, setType] = useState('all');
  const [query, setQuery] = useState('');
  const types = useMemo(() => [...new Set(messages.map((message) => message.messageType))].sort(), [messages]);
  const filtered = useMemo(() => messages.filter((message) => {
    if (type !== 'all' && message.messageType !== type) return false;
    if (!query.trim()) return true;
    return `${message.messageType} ${safeStringify(message.data, 0)}`.toLowerCase().includes(query.toLowerCase());
  }), [messages, query, type]);
  return (
    <section>
      <div className="toolbar">
        <label className="search"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search raw messages" /></label>
        <label className="depthControl">Message type <select value={type} onChange={(event) => setType(event.target.value)}><option value="all">All types</option>{types.map((item) => <option key={item}>{item}</option>)}</select></label>
        <button className="button secondary" onClick={() => copyJson(messages).then(onCopied)}><Copy size={15} /> Copy raw JSON</button>
        <button className="button secondary" onClick={() => downloadJson('activity.raw.json', messages)}><Download size={15} /> Download</button>
      </div>
      <p className="resultCount">Showing {filtered.length.toLocaleString()} of {messages.length.toLocaleString()} messages</p>
      <List className="virtualList" rowComponent={MessageRow} rowCount={filtered.length} rowHeight={76} rowProps={{ messages: filtered }} overscanCount={8} />
    </section>
  );
}
