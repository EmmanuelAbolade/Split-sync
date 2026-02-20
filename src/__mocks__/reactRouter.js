// src/__mocks__/reactRouter.js
// Mock React Router for testing

export const mockNavigate = jest.fn();

export const useNavigate = jest.fn(() => mockNavigate);

export const useParams = jest.fn(() => ({}));

export const useLocation = jest.fn(() => ({
  pathname: '/test',
  search: '',
  hash: '',
  state: null,
}));

export const Link = ({ children, to }) => <a href={to}>{children}</a>;

export const BrowserRouter = ({ children }) => <div>{children}</div>;

export const Navigate = ({ to }) => <div>Navigate to {to}</div>;