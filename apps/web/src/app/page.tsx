export default function Home() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-24">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-coral-deep">
        EST. 2026 · scaffold
      </p>
      <h1 className="mt-3 font-display text-5xl font-extrabold leading-tight text-ink">
        Do agendamento ao <span className="text-coral">replay</span>.
      </h1>
      <p className="mt-4 max-w-xl text-gray">
        Plataforma de gestão, agendamento e replays para quadras de areia. Este é o
        esqueleto inicial do front — as telas entram conforme o roadmap (marco M2+).
      </p>
      <div className="mt-8 flex gap-3">
        <a
          href="/api/v1/health"
          className="inline-block rounded-chip bg-coral px-5 py-3 font-semibold text-ink"
        >
          Bora jogar
        </a>
        <a
          href="https://github.com/LucasAck3rmann/rally"
          className="inline-block rounded-chip border border-line bg-white px-5 py-3 font-semibold text-ink"
        >
          Ver no GitHub
        </a>
      </div>
    </main>
  );
}
