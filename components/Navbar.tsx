'use client';

import { signOut, useSession } from 'next-auth/react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Navbar() {
  const { data: session } = useSession();
  const pathname = usePathname();

  if (!session) return null;

  const userRole = (session.user as any).role;

  return (
    <nav className="navbar navbar-expand-lg navbar-dark bg-success no-print">
      <div className="container-fluid">
        <Link className="navbar-brand" href="/dashboard">
          iSAR System
        </Link>
        <button
          className="navbar-toggler"
          type="button"
          data-bs-toggle="collapse"
          data-bs-target="#navbarNav"
        >
          <span className="navbar-toggler-icon"></span>
        </button>
        <div className="collapse navbar-collapse" id="navbarNav">
          <ul className="navbar-nav me-auto">
            <li className="nav-item">
              <Link
                className={`nav-link ${pathname === '/dashboard' ? 'active' : ''}`}
                href="/dashboard"
              >
                Dashboard
              </Link>
            </li>

            {(userRole === 'head_imam' || userRole === 'admin') && (
              <li className="nav-item">
                <Link
                  className={`nav-link ${pathname === '/schedules/manage' ? 'active' : ''}`}
                  href="/schedules/manage"
                >
                  Manage Schedules
                </Link>
              </li>
            )}

            {(userRole === 'imam' || userRole === 'bilal') && (
              <li className="nav-item">
                <Link
                  className={`nav-link ${pathname === '/availability' ? 'active' : ''}`}
                  href="/availability"
                >
                  My Availability
                </Link>
              </li>
            )}

            {userRole === 'admin' && (
              <li className="nav-item">
                <Link
                  className={`nav-link ${pathname === '/users' ? 'active' : ''}`}
                  href="/users"
                >
                  Manage Users
                </Link>
              </li>
            )}
          </ul>

          <div className="d-flex align-items-center">
            <span className="navbar-text me-3 text-white">
              {session.user?.name} ({userRole})
            </span>
            <button
              className="btn btn-outline-light btn-sm"
              onClick={() => signOut({ callbackUrl: '/login' })}
            >
              Logout
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
