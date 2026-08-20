import { useEffect, useState } from "react";
import Layout from "./Layout";

export type LegalSection = { id: string; title: string; body: React.ReactNode };

const LegalPage = ({ title, lastUpdated, sections }: { title: string; lastUpdated: string; sections: LegalSection[] }) => {
  const [active, setActive] = useState(sections[0]?.id);

  useEffect(() => {
    const onScroll = () => {
      const offsets = sections.map(s => {
        const el = document.getElementById(s.id);
        return { id: s.id, top: el ? el.getBoundingClientRect().top : Infinity };
      });
      const current = offsets.filter(o => o.top < 150).pop();
      if (current) setActive(current.id);
    };
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, [sections]);

  return (
    <Layout>
      <section className="py-12 md:py-16">
        <h1 className="text-4xl md:text-5xl font-bold text-center mb-12">{title}</h1>
        <div className="container mx-auto px-4 max-w-6xl grid lg:grid-cols-[260px_1fr] gap-12">
          {/* TOC */}
          <aside className="hidden lg:block">
            <div className="sticky top-24">
              <h2 className="font-bold mb-5">Table of Contents</h2>
              <ul className="space-y-3">
                {sections.map((s, i) => (
                  <li key={s.id}>
                    <a
                      href={`#${s.id}`}
                      className={`text-sm font-semibold transition-colors ${active === s.id ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}
                    >
                      {i + 1}. {s.title}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </aside>

          {/* Content */}
          <article className="max-w-3xl">
            <p className="text-sm text-muted-foreground mb-8">Last Updated: {lastUpdated}</p>
            {sections.map((s, i) => (
              <section key={s.id} id={s.id} className="mb-12 scroll-mt-24">
                <h2 className="text-2xl font-bold mb-5">{i + 1}. {s.title}</h2>
                <div className="text-muted-foreground leading-relaxed space-y-4 text-[15px]">{s.body}</div>
              </section>
            ))}
          </article>
        </div>
      </section>
    </Layout>
  );
};

export default LegalPage;
