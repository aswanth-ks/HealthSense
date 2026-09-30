export default function Card({ eyebrow, title, action, children, className = '' }) {
  return (
    <section className={`card p-6 ${className}`}>
      {(eyebrow || title || action) && (
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            {eyebrow && <p className="eyebrow">{eyebrow}</p>}
            {title && <h2 className="mt-2 text-lg font-medium">{title}</h2>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}
