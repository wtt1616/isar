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
    <nav className="navbar navbar-expand-lg navbar-dark no-print" style={{
      background: 'linear-gradient(135deg, #059669 0%, #047857 50%, #065f46 100%)',
      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
      borderBottom: '3px solid #f59e0b'
    }}>
      <div className="container-fluid">
        <Link className="navbar-brand d-flex align-items-center" href="/dashboard">
          <i className="bi bi-mosque me-2" style={{ fontSize: '1.75rem' }}></i>
          <span>iSAR System</span>
        </Link>
        <button
          className="navbar-toggler"
          type="button"
          data-bs-toggle="collapse"
          data-bs-target="#navbarNav"
          aria-label="Toggle navigation"
          style={{
            minHeight: '44px',
            minWidth: '44px',
            border: '2px solid rgba(255, 255, 255, 0.3)'
          }}
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
              <>
                <li className="nav-item">
                  <Link
                    className={`nav-link ${pathname === '/schedules/manage' ? 'active' : ''}`}
                    href="/schedules/manage"
                  >
                    Manage Schedules
                  </Link>
                </li>
                <li className="nav-item">
                  <Link
                    className={`nav-link ${pathname === '/dashboard/unavailability' ? 'active' : ''}`}
                    href="/dashboard/unavailability"
                  >
                    <i className="bi bi-calendar-x me-1"></i>
                    Unavailability
                  </Link>
                </li>
                <li className="nav-item">
                  <Link
                    className={`nav-link ${pathname === '/dashboard/whatsapp-test' ? 'active' : ''}`}
                    href="/dashboard/whatsapp-test"
                  >
                    <i className="bi bi-whatsapp me-1"></i>
                    WhatsApp Test
                  </Link>
                </li>
              </>
            )}

            <li className="nav-item">
              <Link
                className={`nav-link ${pathname === '/preacher-schedules' ? 'active' : ''}`}
                href="/preacher-schedules"
              >
                Preacher Schedules
              </Link>
            </li>

            {(userRole === 'admin' || userRole === 'inventory_staff') && (
              <>
                <li className="nav-item">
                  <Link
                    className={`nav-link ${pathname.startsWith('/inventory') && !pathname.startsWith('/inventory') ? 'active' : pathname === '/inventory' || pathname.startsWith('/inventory/') ? 'active' : ''}`}
                    href="/inventory"
                  >
                    Inventori
                  </Link>
                </li>
                <li className="nav-item">
                  <Link
                    className={`nav-link ${pathname.startsWith('/harta-modal') ? 'active' : ''}`}
                    href="/harta-modal"
                  >
                    Harta Modal
                  </Link>
                </li>
              </>
            )}

            {(userRole === 'admin' || userRole === 'bendahari' || userRole === 'head_imam') && (
              <>
                <li className="nav-item">
                  <Link
                    className={`nav-link ${pathname.startsWith('/financial') && !pathname.startsWith('/dashboard/reports') ? 'active' : ''}`}
                    href="/financial"
                  >
                    <i className="bi bi-cash-coin me-1"></i>
                    Kewangan
                  </Link>
                </li>
                <li className="nav-item dropdown">
                  <a
                    className={`nav-link dropdown-toggle ${pathname.startsWith('/dashboard/reports') ? 'active' : ''}`}
                    href="#"
                    id="reportsDropdown"
                    role="button"
                    data-bs-toggle="dropdown"
                    aria-expanded="false"
                  >
                    <i className="bi bi-file-earmark-text me-1"></i>
                    Laporan
                  </a>
                  <ul className="dropdown-menu" aria-labelledby="reportsDropdown">
                    <li>
                      <Link className="dropdown-item" href="/dashboard/reports/anggaran">
                        <i className="bi bi-graph-up me-2"></i>
                        BR-KMS-001: Laporan Anggaran
                      </Link>
                    </li>
                    <li>
                      <Link className="dropdown-item" href="/dashboard/reports/buku-tunai">
                        <i className="bi bi-journal-text me-2"></i>
                        BR-KMS-002: Buku Tunai
                      </Link>
                    </li>
                  </ul>
                </li>
              </>
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
              <>
                <li className="nav-item">
                  <Link
                    className={`nav-link ${pathname === '/users' ? 'active' : ''}`}
                    href="/users"
                  >
                    Manage Users
                  </Link>
                </li>
                <li className="nav-item">
                  <Link
                    className={`nav-link ${pathname === '/preachers/manage' ? 'active' : ''}`}
                    href="/preachers/manage"
                  >
                    Manage Preachers
                  </Link>
                </li>
              </>
            )}
          </ul>

          <div className="d-flex align-items-center">
            <div className="dropdown">
              <button
                className="btn btn-outline-light btn-sm dropdown-toggle"
                type="button"
                id="userDropdown"
                data-bs-toggle="dropdown"
                aria-expanded="false"
              >
                {session.user?.name} ({userRole})
              </button>
              <ul className="dropdown-menu dropdown-menu-end" aria-labelledby="userDropdown">
                <li>
                  <Link className="dropdown-item" href="/dashboard/profile">
                    <i className="bi bi-person-circle me-2"></i>
                    My Profile
                  </Link>
                </li>
                <li><hr className="dropdown-divider" /></li>
                <li>
                  <button
                    className="dropdown-item text-danger"
                    onClick={async () => {
                      console.log('Logout button clicked');
                      try {
                        // Sign out without redirect, then manually redirect
                        await signOut({ redirect: false });
                        console.log('SignOut completed, redirecting...');
                        // Use window.location to redirect to login on same host/port
                        window.location.href = '/login';
                      } catch (error) {
                        console.error('Logout error:', error);
                      }
                    }}
                  >
                    <i className="bi bi-box-arrow-right me-2"></i>
                    Logout
                  </button>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
