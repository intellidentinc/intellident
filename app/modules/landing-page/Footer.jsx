'use client';

export default function Footer() {
  return (
    <footer className="bg-white border-t border-slate-100 py-10 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 bg-blue-600 rounded-md flex items-center justify-center">
              <svg className="w-3.5 h-3.5 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5S10.62 6.5 12 6.5s2.5 1.12 2.5 2.5S13.38 11.5 12 11.5z"/>
              </svg>
            </div>
            <span className="text-sm font-semibold text-slate-700">Intellident</span>
          </div>

          {/* Center text */}
          <p className="text-xs text-slate-400 text-center">
            Built by BS IT (Cybersecurity) students — FEU Institute of Technology &middot; &copy; 2026
          </p>

          {/* Compliance badges */}
          <div className="flex items-center gap-3">
            {['RA 10173', 'ISO 27001', 'NIST CSF'].map((badge) => (
              <span key={badge} className="text-[10px] font-semibold text-slate-400 bg-slate-50 border border-slate-100 rounded-md px-2 py-1">
                {badge}
              </span>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
