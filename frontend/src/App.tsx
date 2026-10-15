import Admin from './pages/Admin'
import Rifa from './pages/Rifa'

// Sin react-router: si la URL es /admin mostramos el panel, si no, la rifa
export default function App() {
  return window.location.pathname.startsWith('/admin') ? <Admin /> : <Rifa />
}
