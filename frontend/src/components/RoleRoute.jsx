import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import PropTypes from 'prop-types';


export const RoleRoute = ({ children, requiredRole }) => {
  const { isAuthenticated, user, loading } = useAuth();

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  const userRole = user?.is_guardian === true ? 'guardian' : 'account_holder';
  if (userRole !== requiredRole) {
    return <Navigate to="/unauthorized" replace />;
  }

  return children;
};

RoleRoute.propTypes = {
  children: PropTypes.node.isRequired,
  requiredRole: PropTypes.oneOf(['guardian', 'account_holder']).isRequired,
};