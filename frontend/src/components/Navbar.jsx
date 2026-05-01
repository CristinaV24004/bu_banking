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
    <nav className="fixed top-0 left-0 z-50 w-full bg-[#EAF0F8] border-b-2 border-[#A67820] shadow-sm">
      <div className="flex h-16 items-center justify-between px-4 lg:px-6">
        {/* Logo */}
        <Link
          to={isGuardian ? '/guardian' : '/dashboard'}
          className="flex items-center gap-3"
          onClick={closeMobileMenu}
        >
          <img src={logoFull} alt="Guardian Vault" className="h-10 w-auto" />
          <div className="flex flex-col leading-tight">
            <span className="font-cinzel font-semibold text-[#0D2B55] text-sm">Guardian</span>
            <span className="font-cinzel font-bold text-[#C9992A] text-sm tracking-widest">VAULT</span>
          </div>
        </Link>

        {/* Desktop Navigation */}
        <div className="hidden md:flex md:items-center md:space-x-6">
          {links.map((link) => (
            <NavLink key={link.path} to={link.path} currentPath={location.pathname}>
              {link.name}
            </NavLink>
          ))}
          <button
            onClick={handleLogout}
            className="rounded border border-transparent px-3 py-2 text-sm font-cinzel font-semibold text-[#0D2B55] transition hover:border-[#C9992A] hover:text-[#E8B84B] focus:outline-none"
          >
            Logout
          </button>
        </div>

        {/* Mobile Hamburger Button */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="flex flex-col items-center justify-center space-y-1.5 rounded p-2 text-white focus:outline-none md:hidden"
          aria-label="Menu"
        >
          <span className="block h-0.5 w-6 bg-[#0D2B55]"></span>
          <span className="block h-0.5 w-6 bg-[#0D2B55]"></span>
          <span className="block h-0.5 w-6 bg-[#0D2B55]"></span>
        </button>
      </div>

      {/* Mobile Dropdown Menu */}
      {mobileMenuOpen && (
        <div className="border-t border-[#A67820] bg-[#EAF0F8] md:hidden">
          <div className="flex flex-col space-y-2 px-4 py-4">
            {links.map((link) => (
              <MobileNavLink
                key={link.path}
                to={link.path}
                currentPath={location.pathname}
                onClick={closeMobileMenu}
              >
                {link.name}
              </MobileNavLink>
            ))}
            <button
              onClick={() => {
                closeMobileMenu();
                handleLogout();
              }}
              className="w-full rounded border border-transparent px-3 py-2 text-left text-sm font-cinzel text-white transition hover:border-[#C9992A] hover:text-[#E8B84B]"
            >
              Logout
            </button>
          </div>
        </div>
      )}
    </nav>
  );
};

// Desktop link component with active highlighting
const NavLink = ({ to, children, currentPath }) => {
  const isActive = currentPath === to;
  return (
    <Link
      to={to}
      className={`px-3 py-2 text-sm font-cinzel font-semibold text-[#0D2B55] transition hover:text-[#E8B84B] ${isActive ? 'border-b-2 border-[#C9992A]' : ''
        }`}
    >
      {children}
    </Link>
  );
};

// Mobile link component – full width, no underline, just gold when active
const MobileNavLink = ({ to, children, currentPath, onClick }) => {
  const isActive = currentPath === to;
  return (
    <Link
      to={to}
      onClick={onClick}
      className={`block w-full rounded px-3 py-2 text-sm font-cinzel font-semibold text-[#0D2B55] transition hover:bg-[#CBD5E1] ${isActive ? 'bg-[#CBD5E1] text-[#C9992A]' : ''
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