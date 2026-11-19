/** The editor's fixed top bar. Kept as its own component so the app shell's header region has a stable, single place to add further chrome (e.g. a project name) without touching the work-area layout. */
export function EditorHeader({ title }: { title: string }) {
  return (
    <header className="editor-header">
      <h1>{title}</h1>
    </header>
  )
}
