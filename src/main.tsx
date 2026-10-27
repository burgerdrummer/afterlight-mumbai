import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles.css';
import './mobile.css';
import './journeys.css';
import './compare.css';
createRoot(document.getElementById('root')!).render(<StrictMode><App/></StrictMode>);
if(import.meta.env.PROD&&'serviceWorker' in navigator){window.addEventListener('load',()=>{navigator.serviceWorker.register(import.meta.env.BASE_URL+'sw.js').then(()=>navigator.serviceWorker.ready).then(()=>console.info('Afterlight offline help ready')).catch(()=>console.warn('Offline help unavailable; the online app remains usable.'));});}
