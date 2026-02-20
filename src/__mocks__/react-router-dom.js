// src/__mocks__/react-router-dom.js
const mockNavigate = jest.fn();

module.exports = {
  useNavigate: () => mockNavigate,
  Link: ({ children, to }) => {
    return children;
  },
  BrowserRouter: ({ children }) => children,
  Routes: ({ children }) => children,
  Route: ({ children }) => children,
  Navigate: () => null,
  useParams: () => ({}),
  useLocation: () => ({ pathname: '/' }),
  mockNavigate, // Export for tests to access
};