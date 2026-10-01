/**
 * A note at a glance, beside what it is attached to: an accent dot, the note's
 * first line, and — for a video note — its moment. The one pill for both kinds
 * that have one (a video marker's hover, highlighted text's hover), so the two
 * read as the same thing because they are.
 */
export function PreviewPillContent({ preview, time }: { preview: string; time?: string }) {
  return (
    <>
      <span className="hm-video-preview__dot" aria-hidden="true" />
      <span className="hm-video-preview__text hm-prose" dir="auto">
        {preview}
      </span>
      {time && <span className="hm-video-preview__time">{time}</span>}
    </>
  );
}
