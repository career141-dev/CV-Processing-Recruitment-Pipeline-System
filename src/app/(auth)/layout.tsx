import React from 'react';
import { redirect } from 'next/navigation';
import { auth } from '@clerk/nextjs/server';

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();
  if (userId) {
    redirect('/dashboard');
  }

  return (
    <div className="flex min-h-screen w-full">
      {/* Form Section */}
      <main className="w-full lg:w-1/2 flex flex-col justify-center items-center p-gutter lg:p-12 relative z-10">
        <div className="w-full max-w-[400px]">
          {children}
        </div>
      </main>

      {/* Visual / Value Prop Section */}
      <aside className="hidden lg:flex w-1/2 bg-surface-container-low relative overflow-hidden flex-col justify-between">
        {/* Background Image */}
        <div className="absolute inset-0 z-0">
          <div
            className="absolute inset-0 bg-cover bg-center opacity-60 mix-blend-multiply"
            style={{
              backgroundImage:
                "url('https://lh3.googleusercontent.com/aida-public/AB6AXuDnKUSf1K-03GAIVyY2fpcN-WccSzP35-K7Nm155wMdwtZhrP-6c_n5VSxisJHasjq4q-PEMb7sVqJqxLIs5JxRNogEPWCUu-rl3wufOKQ0wNYcfLSfkif5q2HZvtV6vElO7SJoItisAwTDqJrLcAh8vANDotJ6CF-1w7sv8fMcTbcyGwow0jhuB-1538w_iW_RFT4Hlx9ClJDU4iQixvdjl9zGPVWTn--VY9nHoijGQxKNgNexOQOf-2avmsJIK5Z3_CwGsFuFbE0')",
            }}
          ></div>
          <div className="absolute inset-0 bg-gradient-to-t from-surface-container-low/90 via-surface-container-low/40 to-transparent"></div>
        </div>

        <div className="relative z-10 p-12 mt-auto mb-12 max-w-xl">
          {/* Glassmorphism Card */}
          <div className="bg-surface/80 backdrop-blur-md border border-white/40 p-8 rounded-xl shadow-lg">
            <div className="w-12 h-12 bg-primary-container/10 rounded-lg flex items-center justify-center mb-6">
              <span
                className="material-symbols-outlined text-primary-container text-2xl"
                style={{ fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}
              >
                insights
              </span>
            </div>
            <h3 className="font-page-title text-page-title text-text-primary mb-3">
              Accelerate your hiring pipeline
            </h3>
            <p className="font-body text-body text-text-secondary leading-relaxed">
              Career141 provides a streamlined, data-driven approach to sourcing, tracking, and engaging
              with top candidates. Build your team faster with intuitive tools designed for modern
              recruitment professionals.
            </p>
            <div className="mt-8 flex items-center gap-4">
              <div className="flex -space-x-3">
                <div className="w-8 h-8 rounded-full border-2 border-surface bg-surface-variant flex items-center justify-center overflow-hidden">
                  <span className="material-symbols-outlined text-[16px] text-text-secondary">
                    person
                  </span>
                </div>
                <div className="w-8 h-8 rounded-full border-2 border-surface bg-surface-variant flex items-center justify-center overflow-hidden">
                  <span className="material-symbols-outlined text-[16px] text-text-secondary">
                    person_3
                  </span>
                </div>
                <div className="w-8 h-8 rounded-full border-2 border-surface bg-surface-variant flex items-center justify-center overflow-hidden">
                  <span className="material-symbols-outlined text-[16px] text-text-secondary">
                    person_4
                  </span>
                </div>
              </div>
              <span className="font-nav-item text-nav-item text-text-secondary">
                Join 10,000+ recruiters
              </span>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
