# Formatting rules for exported Markdown

Every renderer follows these. Each rule exists because Obsidian, Notion or real notes broke
without it. Tests in `tests/domain/export/` hold each one.

## Text the person wrote

1. **Kept as typed.** Line breaks stay. Nothing is reflowed, translated or summarised.
2. **Escaped only where it would turn into structure**: a line starting with `#`, `>`, `-`, `+`,
   `*`, `1.`, `1)` or `---` gets a `\` in front. A note that is just `#2` stays text.
3. **Inside a table cell**: `|` becomes `\|`, line breaks become spaces, and the text is cut on
   a word boundary with `…` (60 characters for a quote, 80 for a note). The full text is always
   written once more below the table, except in a glossary, whose cells are the content.
4. **Code fences in a note** stay fences. A block id never goes on a fence's last line; it goes on
   its own line after a blank one.

## Direction (Arabic and English)

5. Obsidian and Notion pick each line's direction from its first strong letter. So **a line
   starts with a letter of the language it is written in**: labels never sit before a quote in
   another script on the same line; a timestamp lives in its own table column or heading.
6. **Labels follow Hamesh's language** (Arabic or English, as the person set it). Never a mix of
   both in one label.
7. A glossary table puts the **source word first** and the meaning second, whatever the scripts.

## Structure

8. **No raw HTML.** Notion's import drops it. The footer is an italic line, not `<small>`.
9. **Links between files**: Obsidian `[[full/path|Alias]]` (a folder may be called "Hamesh");
   Notion relative `[Alias](../path.md)` with spaces encoded as `%20`. An alias never contains
   `|`, `[` or `]`.
10. **Properties**: Obsidian YAML frontmatter with every value a JSON string, number or list of
    strings. Notion: a two-column table after the title (its import ignores frontmatter).
11. **Callouts** (`> [!quote]`, `> [!info]`) are Obsidian only. Notion gets a plain `>` quote.
12. **Block ids** (`^hm-xxxxxxxx`) are Obsidian only.
13. **Diagrams**: Mermaid `flowchart`, `mindmap` and `pie` only. Labels lose `"()[]{}<>#;|` and
    are cut at 44 characters. Each diagram is checked with `mermaid.parse()` in tests.
14. **A diagram only when it says something**: three or more notes on a page; a pie only with two
    or more sites.
15. **Headings**: one `#` per file (the title), `##` for sections, `###` for a video moment.
16. **Footer, always**: a rule, then `*Exported from [Hamesh](https://hamesh.fandees.tech) · <date>*`
    in Hamesh's language.

## Names

17. File names lose `\ / : * ? " < > | # ^ [ ]`, Windows device names and leading/trailing dots,
    and stop at 80 characters. Two pages with one name in a site folder: the later one gets
    ` (abcd)`, the first four characters of its first note's id. Names never change between
    exports of the same data.
18. YouTube titles lose the leading `(N) ` notification count and the trailing ` - YouTube`.

## Layouts

| Layout      | Page file                                                                                       | Folder or site file               |
| ----------- | ----------------------------------------------------------------------------------------------- | --------------------------------- |
| `notes`     | Map (3+), at-a-glance table (2+), each quote then note                                          | Table: on · note · page           |
| `glossary`  | Table: word · meaning · in context                                                              | Table: word · meaning · page, A→Z |
| `timeline`  | Video: flowchart (3+), time · note table, a `###` per moment. Other pages: in the order written | List by date                      |
| `checklist` | `- [ ] note` with the quote or time under it                                                    | Every open item, by page          |

**Inference** for a group of notes (a folder, or a site's unfiled notes):

- 60% or more are video moments → `timeline`;
- 3 or more notes, and 60% or more are short pairs (quote of 4 words / 40 characters or less,
  note of 8 words / 60 characters or less, one line) → `glossary`;
- otherwise `notes`. `checklist` is never guessed; it is the person's choice.
