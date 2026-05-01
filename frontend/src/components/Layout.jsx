import Navbar from './Navbar';
import PropTypes from 'prop-types';


const Layout = ({ children }) => {
  return (
    <div className="min-h-screen bg-[#F4F7FB]">
      <Navbar />
      <main className="pt-16">{children}</main>
    </div>
  );
};

Layout.propTypes = {
  children: PropTypes.node.isRequired,
};

export default Layout;