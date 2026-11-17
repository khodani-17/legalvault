"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  LEGAL_PRACTICE_AREAS,
  PRACTICE_AREA_NAMES,
} from "@/lib/legal-classifications";

type MatterItem = {
  id: string;
  referenceNumber: string;
  title: string;
  practiceArea: string | null;
  matterType: string | null;
  status: string;
  client: {
    name: string;
    referenceNumber: string;
  };
};

type Props = {
  matters: MatterItem[];
};

export default function MattersDirectory({ matters }: Props) {
  const [search, setSearch] = useState("");
  const [practiceArea, setPracticeArea] = useState("");
  const [matterType, setMatterType] = useState("");
  const [status, setStatus] = useState("");
  const [showAllCategories, setShowAllCategories] = useState(false);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};

    for (const area of PRACTICE_AREA_NAMES) {
      counts[area] = 0;
    }

    counts["Unclassified"] = 0;

    for (const matter of matters) {
      const area = matter.practiceArea?.trim();

      if (area && Object.prototype.hasOwnProperty.call(counts, area)) {
        counts[area] += 1;
      } else {
        counts["Unclassified"] += 1;
      }
    }

    return counts;
  }, [matters]);

  const summary = useMemo(() => {
    return {
      total: matters.length,
      open: matters.filter((matter) => matter.status === "OPEN").length,
      closed: matters.filter((matter) => matter.status === "CLOSED").length,
    };
  }, [matters]);

  const sortedCategories = useMemo(() => {
    return [...PRACTICE_AREA_NAMES].sort(
      (a, b) =>
        (categoryCounts[b] ?? 0) - (categoryCounts[a] ?? 0) ||
        a.localeCompare(b)
    );
  }, [categoryCounts]);

  const visibleCategories = showAllCategories
    ? sortedCategories
    : sortedCategories.slice(0, 4);
  const filteredMatters = useMemo(() => {
    const query = search.trim().toLowerCase();

    return matters.filter((matter) => {
      const searchable = [
        matter.referenceNumber,
        matter.title,
        matter.client.name,
        matter.client.referenceNumber,
        matter.practiceArea,
        matter.matterType,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const categoryMatches =
        !practiceArea ||
        (practiceArea === "Unclassified"
          ? !matter.practiceArea?.trim() ||
            !PRACTICE_AREA_NAMES.includes(matter.practiceArea)
          : matter.practiceArea === practiceArea);

      return (
        (!query || searchable.includes(query)) &&
        categoryMatches &&
        (!matterType || matter.matterType === matterType) &&
        (!status || matter.status === status)
      );
    });
  }, [matters, search, practiceArea, matterType, status]);

  const statuses = ["OPEN", "PENDING", "CLOSED", "ARCHIVED"];

  function selectCategory(area: string) {
    setPracticeArea(area);
    setMatterType("");
  }

  function clearFilters() {
    setSearch("");
    setPracticeArea("");
    setMatterType("");
    setStatus("");
  }

  const inputClass =
    "w-full rounded-lg border border-gold/50 bg-navy px-4 py-3 text-sm text-white outline-none focus:border-gold focus:ring-2 focus:ring-gold/30 disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <section className="space-y-6 text-white">

      {/* COMPACT SUMMARY */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Total Cases", value: summary.total },
          { label: "Open", value: summary.open },
          { label: "Closed", value: summary.closed },
        ].map((item) => (
          <div
            key={item.label}
            className="rounded-xl border border-gold/20 bg-navy-light p-4"
          >
            <p className="text-2xl font-bold text-white">
              {item.value}
            </p>
            <p className="mt-1 text-xs font-medium text-white">
              {item.label}
            </p>
          </div>
        ))}
      </div>

      {/* COMPACT PRACTICE AREAS */}
      <div className="rounded-2xl border border-gold/25 bg-navy-light p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-white">
              Practice Areas
            </h2>
            <p className="mt-1 text-xs text-white">
              Select a category to filter matters.
            </p>
          </div>

          <span className="rounded-lg border border-gold/30 px-3 py-1 text-xs text-white">
            {PRACTICE_AREA_NAMES.length} Categories
          </span>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          {visibleCategories.map((area) => (
            <button
              key={area}
              type="button"
              onClick={() => selectCategory(area)}
              aria-pressed={practiceArea === area}
              className={`flex items-center justify-between gap-3 rounded-lg border px-4 py-3 text-left transition ${
                practiceArea === area
                  ? "border-gold bg-[#203B5B] ring-1 ring-gold/40"
                  : "border-[#304663] bg-navy hover:border-gold hover:bg-[#203B5B]"
              }`}
            >
              <span className="min-w-0 truncate text-sm font-medium text-white">
                {area}
              </span>

              <span className="shrink-0 rounded-md border border-gold/30 px-2 py-1 text-sm font-bold text-white">
                {categoryCounts[area] ?? 0}
              </span>
            </button>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setShowAllCategories((value) => !value)}
            aria-expanded={showAllCategories}
            className="rounded-lg border border-gold/40 px-4 py-2 text-sm font-medium text-white transition hover:bg-[#203B5B]"
          >
            {showAllCategories
              ? "Show Fewer Categories"
              : "View All Categories"}
          </button>

          <button
            type="button"
            onClick={() => selectCategory("Unclassified")}
            aria-pressed={practiceArea === "Unclassified"}
            className={`rounded-lg border px-3 py-2 text-sm text-white transition ${
              practiceArea === "Unclassified"
                ? "border-gold bg-[#203B5B]"
                : "border-[#304663] bg-navy hover:border-gold"
            }`}
          >
            Unclassified ({categoryCounts["Unclassified"] ?? 0})
          </button>
        </div>
      </div>
      {/* SEARCH AND FILTERS */}
      <div className="rounded-2xl border border-gold/30 bg-navy-light p-5 shadow-sm">
        <h2 className="text-lg font-bold text-white">
          Find a Matter
        </h2>

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search client, title or reference..."
            aria-label="Search matters"
            className={inputClass}
          />

          <select
            value={practiceArea}
            onChange={(event) => selectCategory(event.target.value)}
            aria-label="Filter by practice area"
            className={inputClass}
          >
            <option value="">All Practice Areas</option>
            {PRACTICE_AREA_NAMES.map((area) => (
              <option key={area} value={area}>
                {area} ({categoryCounts[area] ?? 0})
              </option>
            ))}
            <option value="Unclassified">
              Unclassified ({categoryCounts["Unclassified"]})
            </option>
          </select>

          <select
            value={matterType}
            onChange={(event) => setMatterType(event.target.value)}
            disabled={!practiceArea || practiceArea === "Unclassified"}
            aria-label="Filter by matter type"
            className={inputClass}
          >
            <option value="">All Matter Types</option>
            {(LEGAL_PRACTICE_AREAS[practiceArea] || []).map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>

          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            aria-label="Filter by status"
            className={inputClass}
          >
            <option value="">All Statuses</option>
            {statuses.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-white">
            Showing {filteredMatters.length} of {matters.length} matters
          </p>

          <button
            type="button"
            onClick={clearFilters}
            className="rounded-lg border border-gold/40 px-3 py-2 text-sm font-medium text-white transition hover:bg-[#203B5B]"
          >
            Clear Filters
          </button>
        </div>
      </div>

      {/* MATTERS DIRECTORY */}
      {filteredMatters.length === 0 ? (
        <div className="rounded-2xl border border-gold/30 bg-navy-light p-10 text-center">
          <h3 className="text-lg font-semibold text-white">
            No matching matters
          </h3>
          <p className="mt-2 text-sm text-white">
            Try another search term or adjust your filters.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-gold/30 bg-navy-light">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-white">
              <thead className="bg-navy">
                <tr>
                  {[
                    "Matter",
                    "Client",
                    "Practice Area",
                    "Matter Type",
                    "Status",
                    "Action",
                  ].map((heading) => (
                    <th
                      key={heading}
                      className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-white"
                    >
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody className="divide-y divide-gold/20">
                {filteredMatters.map((matter) => (
                  <tr
                    key={matter.id}
                    className="transition hover:bg-[#203B5B]"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/dashboard/matters/${matter.id}`}
                        className="font-semibold text-white underline-offset-4 hover:underline"
                      >
                        {matter.title}
                      </Link>
                      <p className="mt-1 text-xs text-white">
                        {matter.referenceNumber}
                      </p>
                    </td>

                    <td className="px-4 py-3">
                      <p className="font-medium text-white">
                        {matter.client.name}
                      </p>
                      <p className="text-xs text-white">
                        {matter.client.referenceNumber}
                      </p>
                    </td>

                    <td className="px-4 py-3 text-sm text-white">
                      {matter.practiceArea || "Not classified"}
                    </td>

                    <td className="px-4 py-3 text-sm text-white">
                      {matter.matterType || "Not classified"}
                    </td>

                    <td className="px-4 py-3 text-sm text-white">
                      {matter.status}
                    </td>

                    <td className="px-4 py-3">
                      <Link
                        href={`/dashboard/matters/${matter.id}`}
                        className="font-medium text-white underline-offset-4 hover:underline"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}