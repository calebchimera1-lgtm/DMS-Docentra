import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import { DocumentItem } from '../types';
import { formatBytes, formatDate } from '../utils/format';

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [fileType, setFileType] = useState('');
  const [category, setCategory] = useState('');
  const [tag, setTag] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [results, setResults] = useState<DocumentItem[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [searchName, setSearchName] = useState('');

  function buildParams() {
    return { q: query || undefined, fileType: fileType || undefined, category: category || undefined, tag: tag || undefined, dateFrom: dateFrom || undefined, dateTo: dateTo || undefined };
  }

  async function handleSearch(e: FormEvent) {
    e.preventDefault();
    const res = await api.get('/search', { params: buildParams() });
    setResults(res.data.data.documents);
    setTotal(res.data.data.total);
  }

  async function saveSearch() {
    if (!searchName.trim()) return;
    await api.post('/search/saved', { name: searchName, query: buildParams() });
    setSearchName('');
    alert('Search saved');
  }

  return (
    <div>
      <h2>Smart Search</h2>
      <form className="card mb-16" onSubmit={handleSearch}>
        <div className="field">
          <label>Keyword / OCR content / metadata</label>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search documents by name, content, author, tag..." />
        </div>
        <div className="grid grid-cols-4">
          <div className="field"><label>File type</label><input value={fileType} onChange={(e) => setFileType(e.target.value)} placeholder="pdf, image, word..." /></div>
          <div className="field"><label>Category</label><input value={category} onChange={(e) => setCategory(e.target.value)} /></div>
          <div className="field"><label>Tag</label><input value={tag} onChange={(e) => setTag(e.target.value)} /></div>
          <div className="field"><label>From</label><input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} /></div>
        </div>
        <div className="field"><label>To</label><input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} /></div>
        <div className="flex gap-8">
          <button className="btn btn-primary" type="submit">Search</button>
          <input placeholder="Save this search as..." value={searchName} onChange={(e) => setSearchName(e.target.value)} />
          <button className="btn" type="button" onClick={saveSearch}>Save search</button>
        </div>
      </form>

      {total !== null && (
        <div className="card">
          <p className="muted">{total} result(s)</p>
          <table>
            <thead><tr><th>Name</th><th>Type</th><th>Size</th><th>Updated</th></tr></thead>
            <tbody>
              {results.map((doc) => (
                <tr key={doc.id}>
                  <td><Link to={`/documents/${doc.id}`}>{doc.name}</Link></td>
                  <td className="muted">{doc.fileType}</td>
                  <td className="muted">{formatBytes(doc.sizeBytes)}</td>
                  <td className="muted">{formatDate(doc.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
