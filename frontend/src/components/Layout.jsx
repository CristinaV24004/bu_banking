import Navbar from './Navbar';
import PropTypes from 'prop-types';

const Layout = ({ children }) => {
  return (
    <>
      <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded focus:bg-[#0D2B55] focus:px-4 focus:py-2 focus:text-white focus:ring-2 focus:ring-[#C9992A]"
      >
      Skip to main content
    </a>
      <div className="min-h-screen bg-[#F4F7FB]">
        <Navbar />
        <main id="main-content" className="pt-16 w-full" tabIndex={-1}>
          {children}
        </main>
      </div>
    </>
  );
};

Layout.propTypes = {
  children: PropTypes.node.isRequired,
};

export default Layout;