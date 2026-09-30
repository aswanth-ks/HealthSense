export default function Segmented({ options, value, onChange }) {
  return (
    <div className="flex flex-wrap rounded-xl bg-white/60 p-1 text-xs">
      {options.map((o) => (
        <button
          key={o}
          onClick={() => onChange(o)}
          className={`rounded-lg px-4 py-1.5 ${value === o ? 'bg-white font-medium shadow-card' : 'text-ink-soft'}`}
        >
          {o}
        </button>
      ))}
    </div>
  );
}
