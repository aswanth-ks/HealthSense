export default function PageHeader({ eyebrow, title, subtitle, right }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="mt-3 text-4xl font-medium">{title}</h1>
        <p className="mt-2 text-ink-soft">{subtitle}</p>
      </div>
      {right}
    </div>
  );
}
