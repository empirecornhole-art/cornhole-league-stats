// Server-rendered JSON-LD. "<" is escaped so event titles or other data can never
// close the script tag.
export default function JsonLd({ data }: { data: object }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />;
}
