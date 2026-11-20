import type { Note } from '@/domain/note';
import type { ExportFlavor } from '@/domain/preferences';
import type { ExportLayout } from '@/domain/export/layout';
import type { ExportPage } from '@/domain/export/model';
import { exportStrings, type ExportLang } from '@/domain/export/strings';
import { formatVideoTimestamp } from '@/domain/video-markers';
import { truncateWords } from '@/domain/export/text';

/** How many notes the preview draws: enough to see the shape, never a wall. */
const SHOWN = 4;

interface LayoutPreviewProps {
  page: ExportPage;
  layout: ExportLayout;
  flavor: ExportFlavor;
  lang: ExportLang;
  now: Date;
  label: string;
}

const onOf = (note: Note) => {
  const a = note.anchor;
  if (a.type === 'text') return truncateWords(a.exact, 90);
  if (a.type === 'video') return `▶ ${formatVideoTimestamp(a.timestamp)}`;
  return a.signals.textSnippet
    ? `${a.signals.tagName} · ${a.signals.textSnippet}`
    : a.signals.tagName;
};

/**
 * The reader's own first page, drawn the way the chosen layout will lay it out in the chosen
 * tool. Built from the same model the export writes from, so what they see is what they get;
 * the look stays Hamesh's, never a copy of either tool's.
 */
export function LayoutPreview({ page, layout, flavor, lang, now, label }: LayoutPreviewProps) {
  const s = exportStrings(lang);
  const notes = page.notes.slice(0, SHOWN);
  const obsidian = flavor === 'obsidian';
  return (
    <article className="hm-preview" aria-label={label}>
      <h3 className="hm-preview__title" dir="auto">
        {page.title}
      </h3>

      {obsidian ? (
        <dl className="hm-preview__props" data-flavor="obsidian" dir="ltr">
          <dt>site</dt>
          <dd>{page.site}</dd>
          <dt>layout</dt>
          <dd>{layout}</dd>
          <dt>tags</dt>
          <dd className="hm-preview__tags">#hamesh #hamesh/{layout}</dd>
        </dl>
      ) : (
        <dl className="hm-preview__props" data-flavor="notion">
          <dt>{s.source}</dt>
          <dd className="hm-preview__tags" dir="ltr">
            {page.site}
          </dd>
          <dt>{s.colLayout}</dt>
          <dd>{s.layout[layout]}</dd>
        </dl>
      )}

      {layout === 'notes' && (
        <>
          <h4 className="hm-preview__heading">{s.notes}</h4>
          {notes.map((note) => (
            <div key={note.id}>
              <blockquote className="hm-preview__quote" data-flavor={flavor}>
                {obsidian && <span className="hm-preview__callout">{s.onThePage}</span>}
                <span dir="auto">{onOf(note)}</span>
              </blockquote>
              <p className="hm-preview__note" dir="auto">
                {truncateWords(note.content, 160)}
              </p>
            </div>
          ))}
        </>
      )}

      {layout === 'glossary' && (
        <>
          <h4 className="hm-preview__heading">{s.glossary}</h4>
          <table className="hm-preview__table">
            <thead>
              <tr>
                <th>{s.colWord}</th>
                <th>{s.colMeaning}</th>
              </tr>
            </thead>
            <tbody>
              {notes.map((note) => (
                <tr key={note.id}>
                  <td dir="auto">{onOf(note)}</td>
                  <td dir="auto">{truncateWords(note.content, 80)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {layout === 'timeline' && (
        <>
          <h4 className="hm-preview__heading">{s.timeline}</h4>
          <ol className="hm-preview__timeline">
            {notes.map((note) => (
              <li key={note.id}>
                <span className="hm-preview__when" dir="ltr">
                  {note.anchor.type === 'video'
                    ? formatVideoTimestamp(note.anchor.timestamp)
                    : s.date(note.createdAt)}
                </span>
                <span dir="auto">{truncateWords(note.content, 90)}</span>
              </li>
            ))}
          </ol>
        </>
      )}

      {layout === 'checklist' && (
        <>
          <h4 className="hm-preview__heading">{s.toDo}</h4>
          <ul className="hm-preview__tasks">
            {notes.map((note) => (
              <li key={note.id}>
                <span className="hm-preview__box" aria-hidden="true" />
                <span className="hm-preview__task">
                  <span dir="auto">{truncateWords(note.content, 90)}</span>
                  <span className="hm-preview__on" dir="auto">
                    {onOf(note)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </>
      )}

      <p className="hm-preview__footer">
        {s.exportedFrom} <span>{s.rootTitle}</span> · {s.date(now.toISOString())}
      </p>
    </article>
  );
}
