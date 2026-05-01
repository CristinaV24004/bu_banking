import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import logoFull from '../assets/gv-logo.png';
import PropTypes from 'prop-types';

const Navbar = () => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isGuardian = user?.is_guardian === true;

  const accountHolderLinks = [
    { name: 'Dashboard', path: '/dashboard' },
    { name: 'Transactions', path: '/transactions' },
    { name: 'Make a Payment', path: '/payment/new' },
    { name: 'Pending Approvals', path: '/pending' },
  ];

  const guardianLinks = [
    { name: 'Dashboard', path: '/guardian' },
    { name: 'Approvals', path: '/guardian/approvals' },
    { name: 'Whitelist', path: '/guardian/whitelist' },
    { name: 'Limits', path: '/guardian/limits' },
    { name: 'Transactions', path: '/guardian/transactions' },
  ];

  const links = isGuardian ? guardianLinks : accountHolderLinks;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const closeMobileMenu = () => setMobileMenuOpen(false);

  return (
    <nav
      className="fixed top-0 left-0 z-50 w-full bg-[#EAF0F8] border-b-2 border-[#A67820] shadow-sm"
      aria-label="Main navigation"
    >
      <div className="flex h-16 items-center justify-between px-4 lg:px-6">
        <Link
          to={isGuardian ? '/guardian' : '/dashboard'}
          className="flex items-center gap-3 focus:outline-none focus:ring-2 focus:ring-[#C9992A] focus:ring-offset-2 rounded"
          onClick={closeMobileMenu}
          aria-label="Guardian Vault home"
        >
          <img src={logoFull} alt="" className="h-10 w-auto" aria-hidden="true" />
          <div className="flex flex-col leading-tight">
            <span className="font-cinzel font-semibold text-[#0D2B55] text-sm">Guardian</span>
            <span className="font-cinzel font-bold text-[#C9992A] text-sm tracking-widest">VAULT</span>
          </div>
        </Link>

        <ul className="hidden md:flex md:items-center md:space-x-6 list-none p-0 m-0">
          {links.map((link) => (
            <li key={link.path}>
              <NavLink to={link.path} currentPath={location.pathname}>
                {link.name}
              </NavLink>
            </li>
          ))}
          <li>
            <button
              onClick={handleLogout}
              className="rounded border border-transparent px-3 py-2 text-sm font-cinzel font-semibold text-[#0D2B55] transition hover:border-[#C9992A] hover:text-[#C9992A] focus:outline-none focus:ring-2 focus:ring-[#C9992A] focus:ring-offset-2"
              aria-label="Log out of Guardian Vault"
            >
              Logout
            </button>
          </li>
        </ul>

        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="flex flex-col items-center justify-center space-y-1.5 rounded p-2 focus:outline-none focus:ring-2 focus:ring-[#C9992A] focus:ring-offset-2 md:hidden"
          aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={mobileMenuOpen}
          aria-controls="mobile-menu"
        >
          <span className="block h-0.5 w-6 bg-[#0D2B55]" aria-hidden="true"></span>
          <span className="block h-0.5 w-6 bg-[#0D2B55]" aria-hidden="true"></span>
          <span className="block h-0.5 w-6 bg-[#0D2B55]" aria-hidden="true"></span>
        </button>
      </div>

      {mobileMenuOpen && (
        <ul
          id="mobile-menu"
          className="border-t border-[#A67820] bg-[#EAF0F8] md:hidden list-none p-0 m-0"
        >
          <div className="flex flex-col space-y-2 px-4 py-4">
            {links.map((link) => (
              <li key={link.path}>
                <MobileNavLink
                  to={link.path}
                  currentPath={location.pathname}
                  onClick={closeMobileMenu}
                >
                  {link.name}
                </MobileNavLink>
              </li>
            ))}
            <li>
              <button
                onClick={() => {
                  closeMobileMenu();
                  handleLogout();
                }}
                className="w-full rounded border border-transparent px-3 py-2 text-left text-sm font-cinzel font-semibold text-[#0D2B55] transition hover:border-[#C9992A] hover:text-[#C9992A] focus:outline-none focus:ring-2 focus:ring-[#C9992A] focus:ring-offset-2"
                aria-label="Log out of Guardian Vault"
              >
                Logout
              </button>
            </li>
          </div>
        </ul>
      )}
    </nav>
  );
};

const NavLink = ({ to, children, currentPath }) => {
  const isActive = currentPath === to;
  return (
    <Link
      to={to}
      role="listitem"
      aria-current={isActive ? 'page' : undefined}
      className={`px-3 py-2 text-sm font-cinzel font-semibold text-[#0D2B55] transition hover:text-[#C9992A] focus:outline-none focus:ring-2 focus:ring-[#C9992A] focus:ring-offset-2 rounded ${isActive ? 'border-b-2 border-[#C9992A]' : ''
        }`}
    >
      {children}
    </Link>
  );
};

const MobileNavLink = ({ to, children, currentPath, onClick }) => {
  const isActive = currentPath === to;
  return (
    <Link
      to={to}
      onClick={onClick}
      role="listitem"
      aria-current={isActive ? 'page' : undefined}
      className={`block w-full rounded px-3 py-2 text-sm font-cinzel font-semibold text-[#0D2B55] transition hover:bg-[#CBD5E1] focus:outline-none focus:ring-2 focus:ring-[#C9992A] focus:ring-offset-2 ${isActive ? 'bg-[#CBD5E1] text-[#C9992A]' : ''
        }`}
    >
      {children}
    </Link>
  );
};

NavLink.propTypes = {
  to: PropTypes.string.isRequired,
  children: PropTypes.node.isRequired,
  currentPath: PropTypes.string.isRequired,
};

MobileNavLink.propTypes = {
  to: PropTypes.string.isRequired,
  children: PropTypes.node.isRequired,
  currentPath: PropTypes.string.isRequired,
  onClick: PropTypes.func.isRequired,
};

export default Navbar;