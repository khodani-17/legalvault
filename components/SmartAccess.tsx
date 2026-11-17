"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Search, ArrowUpRight, Loader2 } from "lucide-react";

type SearchType = "all" | "matters" | "clients" | "documents";
type Result = {
  id: string;
  type: "matter" | "client" | "document";
  title: string;
  subtitle: string;
  href: string;
};

const filters: { value: SearchType; label: string }[] = [
  { value: "all", label: "All" },
  { value: "matters", label: "Matters" },
  { value: "clients", label: "Clients" },
  { value: "documents", label: "Documents" },
];

export default function SmartAccess() {
  const [query, setQuery] = useState("");
  const [type, setType] = useState<SearchType>("all");
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      setError("");
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams({ q: query.trim(), type });
        const response = await fetch(`/api/smart-access?${params}`, {
          signal: controller.signal,
          cache: "no-store",
        });
        if (!response.ok) throw new Error("Unable to search right now.");
        const data: { results: Result[] } = await response.json();
        setResults(data.results);
      } catch (err) {
        if (controller.signal.aborted) return;
        setResults([]);
        setError(err instanceof Error ? err.message : "Search failed.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, type]);

  return (
    <section aria-label="SmartAccess search" className="mb-8 rounded-[24px] border border-[#D4AF37]/25 bg-navy-light p-5 shadow-lg sm:p-7">
      <div className="mb-4 flex items-center gap-3">
        <div className="rounded-xl bg-[#D4AF37]/15 p-3 text-gold"><Search className="h-5 w-5" /></div>
        <div>
          <h2 className="text-xl font-bold text-gold">SmartAccess</h2>
          <p className="text-sm text-[#C4D0E0]">Find authorised matters, clients and documents in seconds.</p>
        </div>
      </div>
      <label htmlFor="smartaccess-query" className="sr-only">Search LegalVault</label>
      <div className="flex items-center gap-3 rounded-xl border border-[#4C6280] bg-navy px-4 py-3 text-white focus-within:border-[#D4AF37]">
        <Search className="h-5 w-5 shrink-0 text-gold" />
        <input
          id="smartaccess-query"
          type="search"
          autoComplete="off"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Name, matter number, case type, document..."
          className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-[#9BAEC7]"
        />
        {loading && <Loader2 aria-label="Searching" className="h-4 w-4 animate-spin text-gold" />}
      </div>
      <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Search category">
        {filters.map((filter) => (
          <button
            key={filter.value}
            type="button"
            aria-pressed={type === filter.value}
            onClick={() => setType(filter.value)}
            className={`rounded-full px-4 py-1.5 text-xs font-semibold transition ${type === filter.value ? "bg-[#D4AF37] text-navy" : "border border-[#4C6280] text-white hover:bg-[#203A59]"}`}
          >
            {filter.label}
          </button>
        ))}
      </div>
      <div className="mt-4" aria-live="polite">
        {error && <p className="text-sm text-[#FFB9BC]">{error}</p>}
        {!error && query.trim().length >= 2 && !loading && results.length === 0 && (
          <p className="text-sm text-[#C4D0E0]">No accessible results found.</p>
        )}
        {results.length > 0 && (
          <ul className="space-y-2">
            {results.map((result) => (
              <li key={`${result.type}-${result.id}`}>
                <Link href={result.href} className="flex items-center justify-between gap-3 rounded-xl border border-[#304663] bg-navy px-4 py-3 transition hover:border-[#D4AF37]">
                  <span className="min-w-0">
                    <span className="block text-[10px] font-bold uppercase tracking-widest text-gold">{result.type}</span>
                    <span className="block truncate text-sm font-semibold text-white">{result.title}</span>
                    <span className="block truncate text-xs text-[#C4D0E0]">{result.subtitle}</span>
                  </span>
                  <ArrowUpRight className="h-4 w-4 shrink-0 text-gold" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
