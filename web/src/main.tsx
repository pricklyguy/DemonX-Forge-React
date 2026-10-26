import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles.css';
import { setupInstall } from './install';

setupInstall();

createRoot(document.getElementById('root')!).render(<App />);
