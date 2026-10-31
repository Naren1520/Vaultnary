import { jsx as _jsx } from "react/jsx-runtime";
import { RouterProvider } from 'react-router-dom';
import { router } from './router/routes';
export default function App() {
    return _jsx(RouterProvider, { router: router });
}
