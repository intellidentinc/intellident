'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';

const AVATAR_COLORS = ['bg-blue-600', 'bg-indigo-600', 'bg-violet-600', 'bg-sky-600', 'bg-cyan-600'];

function getInitials(name) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 3)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

export default function ClinicSearch({ scrolled }) {
  const [open, setOpen] = useState(false);
  const [clinics, setClinics] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState('');
  const [city, setCity] = useState('');
  const [selectedServices, setSelectedServices] = useState([]);

  const wrapRef = useRef(null);
  const inputRef = useRef(null);

  // Lazy-fetch on first open
  useEffect(() => {
    if (!open || loaded) return;
    let active = true;
    fetch('/api/clinics')
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        if (active) setClinics(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (active) setClinics([]);
      })
      .finally(() => {
        if (active) {
          setLoaded(true);
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [open, loaded]);

  // Focus the input when opened
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  // Close on outside click + Escape
  useEffect(() => {
    if (!open) return;
    const onClick = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const cities = useMemo(
    () => [...new Set(clinics.map((c) => c.city).filter(Boolean))].sort(),
    [clinics]
  );

  const allServices = useMemo(
    () => [...new Set(clinics.flatMap((c) => c.services || []))].sort(),
    [clinics]
  );

  const filtered = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    return clinics.filter((c) => {
      if (city && c.city !== city) return false;
      if (selectedServices.length && !selectedServices.every((s) => (c.services || []).includes(s))) {
        return false;
      }
      if (kw) {
        const haystack = [c.name, ...(c.services || [])].join(' ').toLowerCase();
        if (!haystack.includes(kw)) return false;
      }
      return true;
    });
  }, [clinics, keyword, city, selectedServices]);

  const hasFilters = keyword.trim() || city || selectedServices.length > 0;

  const toggleService = (svc) =>
    setSelectedServices((prev) => (prev.includes(svc) ? prev.filter((s) => s !== svc) : [...prev, svc]));

  const clearFilters = () => {
    setKeyword('');
    setCity('');
    setSelectedServices([]);
  };

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Search clinics"
        aria-expanded={open}
        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border transition-all duration-200 ${
          open
            ? 'bg-white border-blue-200 text-slate-800 shadow-sm'
            : scrolled
              ? 'bg-white/70 border-slate-200 text-slate-500 hover:text-slate-800 hover:border-slate-300'
              : 'bg-white/60 border-slate-200/70 text-slate-500 hover:text-slate-800 hover:border-slate-300'
        }`}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z" />
        </svg>
        <span className="hidden sm:inline">Find a clinic</span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            className="absolute right-0 mt-2 w-[calc(100vw-2rem)] sm:w-[420px] max-w-[420px] bg-white border border-slate-100 rounded-2xl shadow-xl shadow-slate-200/60 p-4 z-50"
          >
            {/* Keyword + city */}
            <div className="space-y-2.5">
              <div className="relative">
                <svg
                  className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z" />
                </svg>
                <input
                  ref={inputRef}
                  type="text"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  placeholder="Search clinics or treatments..."
                  className="w-full pl-9 pr-3 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl text-slate-700 placeholder:text-slate-400 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 focus:bg-white transition-all duration-200"
                />
              </div>
              <select
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full px-3 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl text-slate-700 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 focus:bg-white transition-all duration-200"
              >
                <option value="">All locations</option>
                {cities.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            {/* Service chips */}
            {allServices.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3 max-h-24 overflow-y-auto">
                {allServices.map((svc) => {
                  const active = selectedServices.includes(svc);
                  return (
                    <button
                      key={svc}
                      type="button"
                      onClick={() => toggleService(svc)}
                      className={`px-2.5 py-1 text-[11px] font-medium rounded-full border transition-all duration-200 ${
                        active
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white text-slate-600 border-slate-200 hover:border-blue-200'
                      }`}
                    >
                      {svc}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Result count / clear */}
            <div className="flex items-center justify-between mt-3 mb-1 px-0.5">
              <span className="text-[11px] text-slate-400">
                {loading ? 'Loading…' : `${filtered.length} of ${clinics.length} clinics`}
              </span>
              {hasFilters && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="text-[11px] font-medium text-blue-600 hover:text-blue-700 transition-colors"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Results */}
            <div className="max-h-72 overflow-y-auto -mx-1 px-1">
              {loading ? (
                <div className="space-y-2">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="flex items-center gap-3 p-2.5 animate-pulse">
                      <div className="w-9 h-9 bg-slate-100 rounded-lg shrink-0" />
                      <div className="flex-1 space-y-2">
                        <div className="h-3 bg-slate-100 rounded w-2/3" />
                        <div className="h-2.5 bg-slate-100 rounded w-1/3" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : filtered.length === 0 ? (
                <p className="text-center text-xs text-slate-400 py-8">No clinics match your search.</p>
              ) : (
                filtered.map((clinic, i) => (
                  <Link
                    key={clinic.id}
                    href="/sign-up"
                    onClick={() => setOpen(false)}
                    className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-slate-50 transition-colors duration-150"
                  >
                    <div
                      className={`w-9 h-9 ${AVATAR_COLORS[i % AVATAR_COLORS.length]} rounded-lg flex items-center justify-center shrink-0 overflow-hidden`}
                    >
                      {clinic.logoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={clinic.logoUrl} alt={clinic.name} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-white font-bold text-[11px]">{getInitials(clinic.name)}</span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-slate-800 leading-snug truncate">{clinic.name}</p>
                      {clinic.city && (
                        <p className="flex items-center gap-1 text-[11px] text-slate-400 mt-0.5">
                          <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                          </svg>
                          {clinic.city}
                        </p>
                      )}
                      {(clinic.services || []).length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {clinic.services.slice(0, 2).map((svc) => (
                            <span key={svc} className="px-1.5 py-0.5 text-[10px] font-medium text-blue-600 bg-blue-50 rounded">
                              {svc}
                            </span>
                          ))}
                          {clinic.services.length > 2 && (
                            <span className="px-1.5 py-0.5 text-[10px] font-medium text-slate-500 bg-slate-50 rounded">
                              +{clinic.services.length - 2}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </Link>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
